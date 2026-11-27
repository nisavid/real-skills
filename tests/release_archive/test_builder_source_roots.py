import copy
import hashlib
import io
import json
import tarfile
import zipfile

import pytest

from test_release_builder import ALPHA_SKILL, REVISION, source_archive


@pytest.mark.parametrize("prefix", ["real-skills-", "mattpocock-skills-"])
def test_build_accepts_current_and_historical_source_roots(prefix):
    from release_builder import build

    source = source_archive(root=prefix + REVISION)
    source_hash = hashlib.sha256(source).hexdigest()
    archives, _report = build(source, source_hash, REVISION, "1.3.1", "1.3.2+from.1.3.1")
    for fmt, skill_path in (("agent-plugins", "skills/alpha/SKILL.md"),
                            ("claude", "skills/engineering/alpha/SKILL.md")):
        name = f"real-skills-leashed-1.3.2+from.1.3.1-{fmt}.zip"
        with zipfile.ZipFile(io.BytesIO(archives[name])) as archive:
            assert archive.read(skill_path) == ALPHA_SKILL
            release = json.loads(archive.read("RELEASE.json"))
            assert release["source_revision"] == REVISION
            assert release["source_sha256"] == source_hash


@pytest.mark.parametrize("root", [
    "other-skills-" + REVISION,
    "real-skills-" + "0" * 40,
    "mattpocock-skills-" + "0" * 40,
    "real-skills-" + REVISION[:12],
])
def test_build_refuses_unrelated_or_wrong_revision_roots(root):
    from release_builder import build

    source = source_archive(root=root)
    with pytest.raises(ValueError, match="unexpected source root"):
        build(source, hashlib.sha256(source).hexdigest(), REVISION,
              "1.3.1", "1.3.2+from.1.3.1")


@pytest.mark.parametrize("prefix", ["real-skills-", "mattpocock-skills-"])
def test_build_binds_either_root_to_the_expected_tar_bytes(prefix):
    from release_builder import build

    source = source_archive(root=prefix + REVISION)
    with pytest.raises(ValueError, match="source archive hash mismatch"):
        build(source, "0" * 64, REVISION, "1.3.1", "1.3.2+from.1.3.1")


@pytest.mark.parametrize("member_path", ["", "/LICENSE"])
def test_build_refuses_mixed_current_and_historical_roots(member_path):
    from release_builder import build

    old_root = "mattpocock-skills-" + REVISION
    new_root = "real-skills-" + REVISION
    output = io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(source_archive()), mode="r:gz") as original:
        with tarfile.open(fileobj=output, mode="w:gz") as replacement:
            for member in original:
                changed = copy.copy(member)
                if member.name == old_root + member_path:
                    changed.name = new_root + member_path
                replacement.addfile(changed, original.extractfile(member)
                                    if member.isfile() else None)
    source = output.getvalue()
    with pytest.raises(ValueError, match="multiple source roots"):
        build(source, hashlib.sha256(source).hexdigest(), REVISION,
              "1.3.1", "1.3.2+from.1.3.1")
