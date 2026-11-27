"""Run the documented manual build with synthetic, locally committed sources."""
import hashlib
import io
import json
import os
import subprocess
import tarfile
from pathlib import Path
from zipfile import ZipFile

import pytest

from test_release_builder import source_archive

REPO = Path(__file__).resolve().parents[2]
BUILD_BLOCK = (REPO / "docs/agents/release-archives.md").read_text().split(
    "```bash\n", 1)[1].split("\n```", 1)[0]


@pytest.fixture
def candidate(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    with tarfile.open(fileobj=io.BytesIO(source_archive()), mode="r:gz") as source:
        for member in source:
            if member.isfile():
                relative = member.name.split("/", 1)[1]
                target = repo / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.extractfile(member).read())
                target.chmod(member.mode)
    builder = repo / "scripts/build-release-archives.py"
    builder.parent.mkdir()
    builder.write_bytes((REPO / "scripts/build-release-archives.py").read_bytes())
    subprocess.run(["git", "init", "-q", repo], check=True)
    subprocess.run(["git", "-C", repo, "add", "."], check=True)
    subprocess.run(["git", "-C", repo, "-c", "user.name=Fixture", "-c",
                    "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
                    "commit", "-qm", "Synthetic release input"], check=True)
    revision = subprocess.check_output(["git", "-C", repo, "rev-parse", "HEAD"],
                                       text=True).strip()
    return repo, revision


def source_tar(repo, revision, prefix):
    raw = subprocess.check_output(["git", "-C", repo, "-c", "tar.umask=0022", "archive",
                                   "--format=tar", f"--prefix={prefix}{revision}/", revision])
    return subprocess.check_output(["gzip", "-n"], input=raw)


@pytest.mark.parametrize("retained", [True, False], ids=["historical-replay", "canonical-generation"])
@pytest.mark.parametrize("correct_hash", [True, False], ids=["bound-hash", "wrong-hash"])
def test_manual_build_uses_one_hash_bound_input(candidate, tmp_path, retained, correct_hash):
    repo, revision = candidate
    raw = source_tar(repo, revision, "mattpocock-skills-" if retained else "real-skills-")
    expected = hashlib.sha256(raw).hexdigest()
    output = tmp_path / "output"
    env = dict(os.environ, SOURCE_COMMIT=revision, SOURCE_SHA256=expected if correct_hash else "0" * 64,
               BASE_VERSION="1.3.1", RELEASE_VERSION="1.3.2+from.1.3.1", OUTPUT_DIR=str(output))
    env.pop("SOURCE_TAR", None)
    if retained:
        original = tmp_path / "retained source.tar.gz"
        original.write_bytes(raw)
        env["SOURCE_TAR"] = str(original)
    subprocess.run(["bash", "-n"], input=BUILD_BLOCK, text=True, check=True)
    result = subprocess.run(["bash", "-c", BUILD_BLOCK], cwd=repo, env=env,
                            capture_output=True, text=True, timeout=30)
    if not correct_hash:
        assert result.returncode != 0
        assert "source archive hash mismatch" in result.stderr
        assert not (output / "second").exists()
        return
    assert result.returncode == 0, result.stderr
    assert (output / "source.tar.gz").read_bytes() == raw
    if retained:
        assert original.read_bytes() == raw
    for fmt in ("agent-plugins", "claude"):
        name = f"real-skills-leashed-1.3.2+from.1.3.1-{fmt}.zip"
        first, second = (output / "first" / name).read_bytes(), (output / "second" / name).read_bytes()
        assert first == second
        with ZipFile(io.BytesIO(first)) as archive:
            release = json.loads(archive.read("RELEASE.json"))
            assert release["source_revision"] == revision
            assert release["source_sha256"] == expected
    assert (output / "first/report.json").read_bytes() == (output / "second/report.json").read_bytes()
