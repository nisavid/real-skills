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


def verify(candidate, path):
    repo, digest = candidate
    return subprocess.run(
        [sys.executable, RUNNER, "verify", "--repo", repo, "--source", SOURCE,
         "--source-sha256", digest, "--upstream", UPSTREAM, "--base", "1.3.2",
         "--release", "1.3.4+from.1.3.2", "--format", "claude", "--archive", path],
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


def test_export_ignore_cannot_hide_a_selected_file(candidate, tmp_path):
    repo, _ = candidate
    checkout = tmp_path / "attributes"
    subprocess.run(["git", "clone", "--shared", str(repo), str(checkout)], check=True, capture_output=True)
    subprocess.run(["git", "-C", checkout, "checkout", "--detach", SOURCE], check=True, capture_output=True)
    omitted = "skills/engineering/ask-matt/unlinked-fixture.txt"
    (checkout / omitted).write_text("selected supporting bytes\n")
    (checkout / ".gitattributes").write_text(f"{omitted} export-ignore\n")
    subprocess.run(["git", "-C", checkout, "add", ".gitattributes", omitted], check=True)
    subprocess.run(["git", "-C", checkout, "-c", "user.name=Fixture", "-c",
                    "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
                    "commit", "-m", "Omit a selected supporting file"], check=True, capture_output=True)
    revision = subprocess.check_output(["git", "-C", checkout, "rev-parse", "HEAD"], text=True).strip()
    raw = subprocess.check_output(["git", "-C", checkout, "-c", "tar.umask=0022", "archive",
                                   "--format=tar", f"--prefix=mattpocock-skills-{revision}/", revision])
    expected = hashlib.sha256(subprocess.check_output(["gzip", "-n"], input=raw)).hexdigest()
    output = tmp_path / "result"
    result = invoke((checkout, expected), output, "--source", revision)
    assert result.returncode != 0
    assert "missing or unexpected archive members" in result.stderr
    assert not (output / "receipt.json").exists()
