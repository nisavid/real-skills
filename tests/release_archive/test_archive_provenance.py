"""Exercise the archive-provenance CLI with a disposable Git object database."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

import pytest

REPO = Path(__file__).resolve().parents[2]
RUNNER = REPO / "scripts/check-release-archive-provenance.py"
SOURCE = "c63cbf7f7ceb578eb3d55950cf6bb18bad7f680b"
UPSTREAM = "d1478fcb140db0b93c0c8df17bcfd311844749d0"


@pytest.fixture(scope="module")
def candidate(tmp_path_factory):
    root = tmp_path_factory.mktemp("provenance")
    repo = root / "git"
    subprocess.run(["git", "clone", "--shared", "--no-checkout", str(REPO), str(repo)],
                   check=True, capture_output=True)
    tar = subprocess.check_output(["git", "-C", repo, "-c", "tar.umask=0022", "archive",
                                   "--format=tar", f"--prefix=mattpocock-skills-{SOURCE}/", SOURCE])
    compressed = subprocess.check_output(["gzip", "-n"], input=tar)
    digest = hashlib.sha256(compressed).hexdigest()
    return repo, digest


def invoke(candidate, output, *override):
    repo, digest = candidate
    args = ["--repo", repo, "--source", SOURCE, "--source-sha256", digest,
            "--upstream", UPSTREAM, "--base", "1.3.2", "--release", "1.3.4+from.1.3.2",
            "--output", output]
    return subprocess.run([sys.executable, RUNNER, "build", *args, *override],
                          capture_output=True, text=True, timeout=30)


@pytest.fixture(scope="module")
def completed(candidate, tmp_path_factory):
    output = tmp_path_factory.mktemp("result") / "build"
    result = invoke(candidate, output)
    assert result.returncode == 0, result.stderr
    return output


def test_success_receipt_binds_both_verified_formats(completed):
    receipt = json.loads((completed / "receipt.json").read_bytes())
    assert receipt["source"] == SOURCE
    assert receipt["upstream"] == UPSTREAM
    assert set(receipt["archives"]) == {"agent-plugins", "claude"}
    assert receipt["cleanup"] == "temporary build directory removed"
    assert {entry["skills"] for entry in receipt["archives"].values()} == {27}


@pytest.mark.parametrize("flag,value,message", [
    ("--source", "0" * 40, "unavailable"),
    ("--source-sha256", "0" * 64, "source tar SHA-256 mismatch"),
    ("--source", SOURCE[:12], "full commit"),
])
def test_binding_failure_has_no_pass_receipt(candidate, tmp_path, flag, value, message):
    result = invoke(candidate, tmp_path / "result", flag, value)
    assert result.returncode != 0
    assert message in result.stderr
    assert not (tmp_path / "result/receipt.json").exists()


def test_does_not_overwrite_incomplete_run(candidate, tmp_path):
    output = tmp_path / "result"
    output.mkdir()
    marker = output / "prior-attempt"
    marker.write_text("incomplete")
    result = invoke(candidate, output)
    assert result.returncode != 0
    assert marker.read_text() == "incomplete"
    assert not (output / "receipt.json").exists()


def test_unchanged_archive_passes_direct_verification(candidate, completed):
    assert verify(candidate, completed / f"real-skills-leashed-1.3.4+from.1.3.2-claude.zip").returncode == 0


def test_verification_digest_identifies_inspected_zip_after_path_replacement(
        candidate, completed, tmp_path):
    original = (completed / "real-skills-leashed-1.3.4+from.1.3.2-claude.zip").read_bytes()
    path = tmp_path / "archive.zip"
    path.write_bytes(original)
    replacement = path.with_suffix(".next")
    replacement.write_bytes(b"replacement")
    # Replace the file when the ZIP library starts reading a member.
    control = """
import runpy
import sys
from pathlib import Path
from zipfile import ZipFile

path = Path(sys.argv[-1])
replacement = path.with_suffix(".next")
read = ZipFile.read

def replace_then_read(archive, *args, **kwargs):
    if replacement.exists():
        replacement.replace(path)
    return read(archive, *args, **kwargs)

ZipFile.read = replace_then_read
sys.argv.pop(0)
sys.path.insert(0, str(Path(sys.argv[0]).parent))
runpy.run_path(sys.argv[0], run_name="__main__")
"""
    result = verify(candidate, path, python_args=("-c", control))
    assert result.returncode == 0, result.stderr
    assert path.read_bytes() == b"replacement"
    assert json.loads(result.stdout)["sha256"] == hashlib.sha256(original).hexdigest()


def verify(candidate, path, fmt="claude", *, python_args=()):
    repo, digest = candidate
    return subprocess.run(
        [sys.executable, *python_args, RUNNER, "verify", "--repo", repo, "--source", SOURCE,
         "--source-sha256", digest, "--upstream", UPSTREAM, "--base", "1.3.2",
         "--release", "1.3.4+from.1.3.2", "--format", fmt, "--archive", path],
        capture_output=True, text=True, timeout=20)


@pytest.mark.parametrize("change", ["bytes", "mode", "missing", "extra", "duplicate", "collision", "manifest", "provenance"])
def test_direct_git_verification_rejects_corrupt_zip(candidate, completed, tmp_path, change):
    original = completed / "real-skills-leashed-1.3.4+from.1.3.2-claude.zip"
    mutated = tmp_path / "mutated.zip"
    with ZipFile(original) as source, ZipFile(mutated, "w") as output:
        for item in source.infolist():
            name = item.filename
            content = source.read(item)
            if name == "LICENSE":
                if change == "missing":
                    continue
                if change == "bytes":
                    content += b"\n"
                if change == "mode":
                    item.external_attr ^= 0o100 << 16
                if change == "duplicate":
                    with pytest.warns(UserWarning, match="Duplicate name"):
                        output.writestr(item, content)
                        output.writestr(item, content)
                    continue
            if change == "manifest" and name == ".claude-plugin/plugin.json":
                content = json.dumps(dict(json.loads(content), version="0.0.0")).encode()
            if change == "provenance" and name == "RELEASE.json":
                content = json.dumps(dict(json.loads(content), source_revision="0" * 40)).encode()
            output.writestr(item, content)
        if change in {"extra","collision"}:
            output.writestr("extra" if change=="extra" else "LICENSE/child", b"")
    result = verify(candidate, mutated)
    assert result.returncode != 0
    assert "missing or unexpected archive members" in result.stderr or "archive member differs" in result.stderr



def checkout_candidate(candidate, tmp_path):
    repo, _ = candidate
    checkout = tmp_path / "candidate"
    git_command = ["git", "-C", checkout]
    subprocess.run(["git", "clone", "--shared", "--no-checkout", str(repo), str(checkout)],
                   check=True, capture_output=True)
    subprocess.run([*git_command, "checkout", "--detach", SOURCE], check=True, capture_output=True)
    return checkout


def commit_candidate(checkout, *paths):
    git_command = ["git", "-C", checkout]
    subprocess.run([*git_command, "add", "--", *paths], check=True)
    subprocess.run([*git_command, "-c", "user.name=Fixture", "-c",
                    "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
                    "commit", "-m", "Set synthetic archive input"], check=True, capture_output=True)
    revision = subprocess.check_output([*git_command, "rev-parse", "HEAD"], text=True).strip()
    raw = subprocess.check_output([*git_command, "-c", "tar.umask=0022", "archive",
                                   "--format=tar", f"--prefix=mattpocock-skills-{revision}/", revision])
    digest = hashlib.sha256(subprocess.check_output(["gzip", "-n"], input=raw)).hexdigest()
    return revision, digest


@pytest.mark.parametrize("omitted,message", [
    ("skills/engineering/ask-matt/unlinked-fixture.txt", "missing or unexpected archive members"),
    ("skills/engineering/Unlisted/SKILL.md", "manifest differs from promoted Git inventory"),
])
def test_export_ignore_cannot_hide_git_inventory(candidate, tmp_path, omitted, message):
    checkout = checkout_candidate(candidate, tmp_path)
    target = checkout / omitted
    target.parent.mkdir(exist_ok=True)
    target.write_text("selected file bytes\n")
    (checkout / ".gitattributes").write_text(f"{omitted} export-ignore\n")
    revision, digest = commit_candidate(checkout, ".gitattributes", omitted)
    output = tmp_path / "result"
    result = invoke((checkout, digest), output, "--source", revision)
    assert result.returncode != 0
    assert message in result.stderr
    assert not (output / "receipt.json").exists()


def test_synthetic_unleashed_build_has_two_layouts_and_no_icon(candidate, tmp_path):
    checkout = checkout_candidate(candidate, tmp_path)
    paths = ("package.json", ".claude-plugin/plugin.json", ".codex-plugin/plugin.json")
    for path in paths:
        manifest = checkout / path
        data = json.loads(manifest.read_bytes())
        data["name"] = "real-skills-unleashed"
        manifest.write_text(json.dumps(data) + "\n")
    revision, digest = commit_candidate(checkout, *paths)
    output = tmp_path / "result"
    process = invoke((checkout, digest), output, "--source", revision)
    assert process.returncode == 0, process.stderr
    receipt = json.loads((output / "receipt.json").read_bytes())
    assert all(row["name"] == "real-skills-unleashed" and row["icon"] is None
               for row in receipt["archives"].values())
    assert receipt["icon_derivation"] is None
    for fmt, member in (("agent-plugins", "skills/ask-matt/SKILL.md"),
                        ("claude", "skills/engineering/ask-matt/SKILL.md")):
        with ZipFile(output / f"real-skills-unleashed-1.3.4+from.1.3.2-{fmt}.zip") as archive:
            assert member in archive.namelist()


def test_external_zip_cannot_vouch_for_an_incorrect_tar_digest(candidate, completed, tmp_path):
    modified = tmp_path / "forged.zip"
    incorrect = "0" * 64
    with ZipFile(completed / "real-skills-leashed-1.3.4+from.1.3.2-claude.zip") as source:
        with ZipFile(modified, "w") as output:
            for item in source.infolist():
                data = source.read(item)
                if item.filename == "RELEASE.json":
                    data = json.dumps(dict(json.loads(data), source_sha256=incorrect)).encode()
                output.writestr(item, data)
    result = verify((candidate[0], incorrect), modified)
    assert result.returncode != 0
    assert "source tar SHA-256 mismatch" in result.stderr


def test_external_zip_rejects_normalized_member_name(candidate, completed, tmp_path):
    original = completed / "real-skills-leashed-1.3.4+from.1.3.2-claude.zip"
    regular = tmp_path / "with-sentinel.zip"
    malformed = tmp_path / "malformed.zip"
    with ZipFile(original) as source, ZipFile(regular, "w") as output:
        for item in source.infolist():
            data = source.read(item)
            if item.filename == "LICENSE":
                item.filename = "LICENSE~"
            output.writestr(item, data)
    stored = regular.read_bytes()
    assert stored.count(b"LICENSE~") == 2
    malformed.write_bytes(stored.replace(b"LICENSE~", b"LICENSE\0"))
    result = verify(candidate, malformed)
    assert result.returncode != 0
    assert "archive member name was normalized" in result.stderr


def test_portable_support_file_bytes_are_verified(candidate, completed, tmp_path):
    mutated = tmp_path / "mutated.zip"
    original = completed / "real-skills-leashed-1.3.4+from.1.3.2-agent-plugins.zip"
    member = "skills/ask-matt/PHASE-BOUNDARIES.md"
    with ZipFile(original) as source, ZipFile(mutated, "w") as output:
        assert member in source.namelist()
        for item in source.infolist():
            data = source.read(item)
            output.writestr(item, data + b"\n" if item.filename == member else data)
    result = verify(candidate, mutated, "agent-plugins")
    assert result.returncode != 0
    assert "archive member differs from Git projection" in result.stderr
