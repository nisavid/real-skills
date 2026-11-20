"""Exercise the reflink-only deposit of verified release archives with fixture archives."""
import errno
import hashlib
import importlib.util
import itertools
import json
import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
SCRIPT = SCRIPTS / "deposit-release-archives.py"
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location("deposit_release_archives", SCRIPT)
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)

VERSION = "1.4.0-rc.1+from.1.3.2"
PLUGINS = sorted(tool.EDITIONS)
FORMATS = tool.FORMATS


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive_name(plugin="real-skills-leashed", fmt="claude", version=VERSION):
    return f"{plugin}-{version}-{fmt}.zip"


def filesystem(path):
    probe = subprocess.run(["stat", "-f", "-c", "%T", str(path)], capture_output=True, text=True)
    return probe.stdout.strip() if probe.returncode == 0 else "unknown"


@pytest.fixture(scope="session")
def clone_support(tmp_path_factory):
    """Probe FICLONE where the tests create their files; name the filesystem."""
    root = tmp_path_factory.mktemp("probe")
    source, target = root / "source", root / "target"
    source.write_bytes(b"probe")
    target.touch()
    with source.open("rb") as left, target.open("r+b") as right:
        try:
            tool.ficlone(left.fileno(), right.fileno())
            supported = True
        except OSError as error:
            # Only a refusal means this filesystem cannot reflink. Any other
            # errno (ENOTTY from a wrong request number, EBADF from swapped
            # arguments) is a defect in the write path and must fail loudly.
            if error.errno not in (errno.EOPNOTSUPP, errno.EXDEV):
                raise
            supported = False
    return supported, filesystem(root)


@pytest.fixture
def build(tmp_path):
    """Two fixture archives of one build and the digests that build verified."""
    root = tmp_path / "build"
    root.mkdir()
    archives = []
    for fmt in FORMATS:
        data = f"fixture archive in the {fmt} format\n".encode() * 64
        path = root / archive_name(fmt=fmt)
        path.write_bytes(data)
        archives.append((path, sha(data)))
    return archives


@pytest.fixture
def folder(tmp_path):
    path = tmp_path / "distribution"
    path.mkdir()
    return path


def snapshot(directory):
    """Every entry's type, identity, timestamps and content, without following links."""
    state = {}
    for entry in sorted(os.listdir(directory)):
        path = directory / entry
        info = os.lstat(path)
        if stat.S_ISREG(info.st_mode):
            content = path.read_bytes()
        elif stat.S_ISLNK(info.st_mode):
            content = os.readlink(path)
        else:
            content = None
        state[entry] = (stat.S_IFMT(info.st_mode), info.st_ino, info.st_mtime_ns, content)
    return state


def never(source_fd, target_fd):
    raise AssertionError("the clone must not be attempted")


def refuse(code):
    def clone(source_fd, target_fd):
        raise OSError(code, os.strerror(code))
    return clone


def partial_then_refuse(source_fd, target_fd):
    os.write(target_fd, b"partial bytes")
    raise OSError(errno.EIO, os.strerror(errno.EIO))


def emulated(source_fd, target_fd):
    """Test double for a successful clone, so control flow is shown on any filesystem."""
    os.lseek(source_fd, 0, os.SEEK_SET)
    while chunk := os.read(source_fd, 1 << 16):
        os.write(target_fd, chunk)


def run_cli(*args):
    return subprocess.run([sys.executable, SCRIPT, *map(str, args)],
                          capture_output=True, text=True, timeout=30)


def archive_args(archives):
    return [item for path, digest in archives for item in ("--archive", digest, path)]


@pytest.mark.parametrize("plugin,fmt", list(itertools.product(PLUGINS, FORMATS)))
def test_clone_into_free_name_on_a_reflink_filesystem(clone_support, tmp_path, folder,
                                                      record_property, plugin, fmt):
    supported, fs = clone_support
    record_property("filesystem", fs)
    print(f"filesystem: {fs}")
    if not supported:
        pytest.skip(f"filesystem {fs} refuses FICLONE, so a successful clone cannot be shown")
    data = f"{plugin} {fmt} fixture archive\n".encode() * 128
    source = tmp_path / archive_name(plugin, fmt)
    source.write_bytes(data)
    [entry] = tool.deposit([(source, sha(data))], folder)
    assert entry == tool.result(tool.DEPOSITED, source.name, sha(data))
    deposited = folder / source.name
    assert sha(deposited.read_bytes()) == sha(data)
    source.write_bytes(b"the build output changed afterwards")
    assert deposited.read_bytes() == data, "a reflink copy is an independent file"


def test_cli_deposits_both_archives_and_exits_zero(clone_support, build, folder, record_property):
    supported, fs = clone_support
    record_property("filesystem", fs)
    print(f"filesystem: {fs}")
    if not supported:
        pytest.skip(f"filesystem {fs} refuses FICLONE, so a successful clone cannot be shown")
    result = run_cli("--folder", folder, *archive_args(build))
    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.splitlines() == [
        f"deposited: {path.name} sha256={digest}" for path, digest in build]
    assert sorted(os.listdir(folder)) == sorted(path.name for path, _ in build)


def test_identical_file_is_left_alone(build, folder):
    for path, _ in build:
        (folder / path.name).write_bytes(path.read_bytes())
    before = snapshot(folder)
    results = tool.deposit(build, folder, clone=never)
    assert [entry["status"] for entry in results] == [tool.PRESENT] * 2
    assert snapshot(folder) == before


def test_different_file_is_refused_and_untouched(build, folder):
    (path, digest), _ = build
    other = b"a different archive under the same name\n"
    (folder / path.name).write_bytes(other)
    before = snapshot(folder)
    [entry] = tool.deposit([(path, digest)], folder, clone=never)
    assert entry["status"] == tool.NOT_MADE
    assert entry["sha256"] == digest
    assert f"a different file is at that name, sha256={sha(other)}" in entry["reason"]
    assert snapshot(folder) == before


@pytest.mark.parametrize("kind", ["symlink to an identical file", "dangling symlink",
                                  "directory", "fifo"])
def test_entry_that_is_not_a_regular_file_is_refused(build, folder, tmp_path, kind):
    (path, digest), _ = build
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    target = elsewhere / "target.zip"
    entry_path = folder / path.name
    if kind == "symlink to an identical file":
        target.write_bytes(path.read_bytes())
        entry_path.symlink_to(target)
    elif kind == "dangling symlink":
        entry_path.symlink_to(target)
    elif kind == "directory":
        entry_path.mkdir()
    else:
        os.mkfifo(entry_path)
    before, outside = snapshot(folder), snapshot(elsewhere)
    [entry] = tool.deposit([(path, digest)], folder, clone=never)
    assert entry["status"] == tool.NOT_MADE
    assert entry["reason"] == "an entry that is not a regular file is at that name"
    assert snapshot(folder) == before
    assert snapshot(elsewhere) == outside, "the link was not followed"


@pytest.mark.parametrize("clone", [refuse(errno.EOPNOTSUPP), refuse(errno.EXDEV),
                                   partial_then_refuse],
                         ids=["not supported", "cross filesystem", "partial then refused"])
def test_refused_clone_leaves_nothing_on_any_filesystem(build, folder, clone):
    (folder / "unrelated.txt").write_bytes(b"kept as it is\n")
    before = snapshot(folder)
    results = tool.deposit(build, folder, clone=clone)
    assert [entry["status"] for entry in results] == [tool.NOT_MADE] * 2
    assert all(entry["reason"].startswith("the clone was refused: ") for entry in results)
    assert snapshot(folder) == before, "no empty or partial file is left at either name"


def test_os_refused_clone_leaves_nothing(clone_support, build, folder, record_property):
    supported, fs = clone_support
    record_property("filesystem", fs)
    print(f"filesystem: {fs}")
    if supported:
        pytest.skip(f"filesystem {fs} accepts FICLONE, so the operating system's refusal "
                    "is not observable here; the injected refusals cover this path")
    result = run_cli("--folder", folder, *archive_args(build))
    assert result.returncode == 1
    lines = result.stdout.splitlines()
    assert len(lines) == 2
    for text, (path, digest) in zip(lines, build):
        assert text.startswith(f"not made: {path.name} sha256={digest} (the clone was refused: ")
    assert os.listdir(folder) == []


@pytest.mark.parametrize("name", [
    "real-skills-other-1.0.0-claude.zip",
    "real-skills-leashed--claude.zip",
    "real-skills-leashed-1.0.0-codex.zip",
    "real-skills-leashed-1.0.0-claude.tar.gz",
    "real-skills-leashed-1.0.0-claude.zip.part",
    "leashed-1.0.0-agent-plugins.zip",
])
def test_wrong_name_is_refused(tmp_path, folder, name):
    path = tmp_path / name
    path.write_bytes(b"fixture archive\n")
    [entry] = tool.deposit([(path, sha(path.read_bytes()))], folder, clone=never)
    assert entry["status"] == tool.NOT_MADE
    assert entry["reason"].startswith("the name is not ")
    assert os.listdir(folder) == []


@pytest.mark.parametrize("plugin,fmt", list(itertools.product(PLUGINS, FORMATS)))
@pytest.mark.parametrize("version", ["1.3.4+from.1.3.2", VERSION])
def test_both_plugins_and_formats_keep_their_names(tmp_path, folder, plugin, fmt, version):
    source = tmp_path / archive_name(plugin, fmt, version)
    source.write_bytes(b"fixture archive\n")
    [entry] = tool.deposit([(source, sha(source.read_bytes()))], folder, clone=emulated)
    assert entry["status"] == tool.DEPOSITED
    assert os.listdir(folder) == [source.name]


@pytest.mark.parametrize("kind", ["missing", "regular file"])
def test_folder_that_is_missing_or_not_a_directory_is_refused(build, tmp_path, kind):
    target = tmp_path / "not-a-folder"
    if kind == "regular file":
        target.write_bytes(b"not a directory\n")
    before = snapshot(tmp_path)
    results = tool.deposit(build, target, clone=never)
    assert [entry["status"] for entry in results] == [tool.NOT_MADE] * 2
    assert all(entry["reason"].startswith("the distribution folder is missing or is not a "
                                          "directory") for entry in results)
    assert snapshot(tmp_path) == before
    result = run_cli("--folder", target, *archive_args(build))
    assert result.returncode == 1
    assert [line.split(" sha256=")[0] for line in result.stdout.splitlines()] == [
        f"not made: {path.name}" for path, _ in build]
    assert snapshot(tmp_path) == before


@pytest.mark.parametrize("competitor", ["different", "identical"])
def test_file_that_appears_before_the_write_is_never_overwritten(build, folder, monkeypatch,
                                                                 competitor):
    (path, digest), _ = build
    data = path.read_bytes() if competitor == "identical" else b"appeared after the look\n"
    real_open = os.open

    def racing_open(name, flags, mode=0o777, *, dir_fd=None):
        if flags & os.O_EXCL and name == path.name:
            fd = real_open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644, dir_fd=dir_fd)
            os.write(fd, data)
            os.close(fd)
        return real_open(name, flags, mode, dir_fd=dir_fd)

    monkeypatch.setattr(tool.os, "open", racing_open)
    [entry] = tool.deposit([(path, digest)], folder, clone=never)
    monkeypatch.undo()
    assert (folder / path.name).read_bytes() == data
    if competitor == "identical":
        assert entry["status"] == tool.PRESENT
    else:
        assert entry["status"] == tool.NOT_MADE
        assert f"sha256={sha(data)}; it was left untouched" in entry["reason"]


def test_one_deposited_and_one_refused_rolls_nothing_back(build, folder):
    (first, first_digest), (second, second_digest) = build
    other = b"a different archive under the second name\n"
    (folder / second.name).write_bytes(other)
    results = tool.deposit(build, folder, clone=emulated)
    assert [entry["status"] for entry in results] == [tool.DEPOSITED, tool.NOT_MADE]
    assert (folder / first.name).read_bytes() == first.read_bytes()
    assert (folder / second.name).read_bytes() == other

    calls = []

    def first_only(source_fd, target_fd):
        calls.append(target_fd)
        if len(calls) > 1:
            raise OSError(errno.EOPNOTSUPP, os.strerror(errno.EOPNOTSUPP))
        emulated(source_fd, target_fd)

    fresh = folder.parent / "fresh"
    fresh.mkdir()
    results = tool.deposit(build, fresh, clone=first_only)
    assert [entry["status"] for entry in results] == [tool.DEPOSITED, tool.NOT_MADE]
    assert os.listdir(fresh) == [first.name]


def test_cli_reports_every_archive_and_exits_zero_only_when_all_are_present(build, folder):
    for path, _ in build:
        (folder / path.name).write_bytes(path.read_bytes())
    result = run_cli("--folder", folder, *archive_args(build))
    assert result.returncode == 0
    assert result.stdout.splitlines() == [
        f"already present: {path.name} sha256={digest}" for path, digest in build]
    (path, digest), (other, other_digest) = build
    (folder / other.name).unlink()
    (folder / other.name).write_bytes(b"different\n")
    result = run_cli("--folder", folder, *archive_args(build))
    assert result.returncode == 1
    lines = result.stdout.splitlines()
    assert lines[0] == f"already present: {path.name} sha256={digest}"
    assert lines[1].startswith(f"not made: {other.name} sha256={other_digest} "
                               "(a different file is at that name")


def test_failed_deposits_leave_the_verified_archives_unchanged(build, folder, tmp_path):
    root = build[0][0].parent
    before = snapshot(root)
    tool.deposit(build, tmp_path / "missing", clone=never)
    tool.deposit(build, folder, clone=partial_then_refuse)
    (folder / build[0][0].name).write_bytes(b"different\n")
    tool.deposit(build, folder, clone=refuse(errno.EOPNOTSUPP))
    assert snapshot(root) == before


def test_no_write_path_other_than_the_clone(build, folder):
    (folder / "unrelated.txt").write_bytes(b"kept as it is\n")
    before = snapshot(folder)
    tool.deposit(build, folder, clone=refuse(errno.EOPNOTSUPP))
    assert snapshot(folder) == before, "a failing clone leaves the folder byte for byte"
    source = SCRIPT.read_text(encoding="utf-8")
    for forbidden in ("shutil", "subprocess", "copyfile", "copy_file_range", "sendfile",
                      "reflink=auto", "os.write", ".write("):
        assert forbidden not in source, forbidden


def test_archive_that_differs_from_its_verified_digest_is_refused(build, folder):
    (path, _), _ = build
    [entry] = tool.deposit([(path, sha(b"some other bytes"))], folder, clone=never)
    assert entry["reason"] == "the archive does not match its verified digest"
    assert os.listdir(folder) == []


def test_symlinked_archive_is_refused(build, folder, tmp_path):
    (path, digest), _ = build
    link = tmp_path / "links" / path.name
    link.parent.mkdir()
    link.symlink_to(path)
    [entry] = tool.deposit([(link, digest)], folder, clone=never)
    assert entry["reason"] == "the archive is not a regular file"
    assert os.listdir(folder) == []


def test_deposited_bytes_are_checked_against_the_verified_digest(build, folder):
    def wrong_bytes(source_fd, target_fd):
        os.write(target_fd, b"not the archive")

    results = tool.deposit(build, folder, clone=wrong_bytes)
    assert all("not the verified digest" in entry["reason"] for entry in results)
    assert os.listdir(folder) == []


def test_only_the_file_created_in_the_same_call_is_removed(build, folder):
    (path, digest), _ = build

    def swapped_then_refused(source_fd, target_fd):
        (folder / path.name).unlink()
        (folder / path.name).write_bytes(b"put there by someone else\n")
        raise OSError(errno.EOPNOTSUPP, os.strerror(errno.EOPNOTSUPP))

    [entry] = tool.deposit([(path, digest)], folder, clone=swapped_then_refused)
    assert entry["reason"].endswith("the entry at that name changed and was left in place")
    assert (folder / path.name).read_bytes() == b"put there by someone else\n"


def receipt(build, status="passed"):
    root = build[0][0].parent
    entries = {fmt: {"name": "real-skills-leashed", "sha256": digest}
               for fmt, (_, digest) in zip(FORMATS, build)}
    path = root / "receipt.json"
    path.write_text(json.dumps({"status": status, "release": VERSION, "archives": entries}))
    return path


def test_receipt_supplies_the_archives_and_their_verified_digests(build, folder):
    for path, _ in build:
        (folder / path.name).write_bytes(path.read_bytes())
    result = run_cli("--folder", folder, "--receipt", receipt(build))
    assert result.returncode == 0, result.stderr
    assert sorted(result.stdout.splitlines()) == sorted(
        f"already present: {path.name} sha256={digest}" for path, digest in build)


def test_receipt_that_did_not_pass_is_refused_before_writing(build, folder):
    result = run_cli("--folder", folder, "--receipt", receipt(build, status="failed"))
    assert result.returncode == 2
    assert "not a passed provenance receipt" in result.stderr
    assert os.listdir(folder) == []
