import copy
import hashlib
import io
import json
import stat
import tarfile
import zipfile

import pytest

from test_release_builder import (
    ALPHA_AGENT,
    ALPHA_SCRIPT,
    ALPHA_SKILL,
    BETA_AGENT,
    BETA_DATA,
    BETA_SKILL,
    LICENSE,
    REVISION,
    source_archive,
)


def test_build_packages_unleashed_source_in_both_release_layouts():
    from release_builder import build

    output = io.BytesIO()
    root = "mattpocock-skills-" + REVISION + "/"
    manifests = {
        root + "package.json",
        root + ".claude-plugin/plugin.json",
        root + ".codex-plugin/plugin.json",
    }
    with tarfile.open(fileobj=io.BytesIO(source_archive()), mode="r:gz") as original:
        with tarfile.open(fileobj=output, mode="w:gz") as replacement:
            for member in original:
                member = copy.copy(member)
                if member.isfile():
                    data = original.extractfile(member).read()
                    if member.name in manifests:
                        manifest = json.loads(data)
                        manifest["name"] = "real-skills-unleashed"
                        data = json.dumps(manifest).encode()
                    member.size = len(data)
                    replacement.addfile(member, io.BytesIO(data))
                else:
                    replacement.addfile(member)
    source = output.getvalue()
    source_sha256 = hashlib.sha256(source).hexdigest()

    archives, report = build(
        source, source_sha256, REVISION, "1.3.1", "1.3.2+from.1.3.1"
    )

    expected_archives = {
        "real-skills-unleashed-1.3.2+from.1.3.1-agent-plugins.zip": (
            "agent-plugins",
            "plugin.json",
            {
                "skills/alpha/SKILL.md": (ALPHA_SKILL, 0o644),
                "skills/alpha/agents/openai.yaml": (ALPHA_AGENT, 0o644),
                "skills/alpha/scripts/run.sh": (ALPHA_SCRIPT, 0o755),
                "skills/beta/SKILL.md": (BETA_SKILL, 0o644),
                "skills/beta/agents/openai.yaml": (BETA_AGENT, 0o644),
                "skills/beta/assets/data.bin": (BETA_DATA, 0o644),
            },
        ),
        "real-skills-unleashed-1.3.2+from.1.3.1-claude.zip": (
            "claude",
            ".claude-plugin/plugin.json",
            {
                "skills/engineering/alpha/SKILL.md": (ALPHA_SKILL, 0o644),
                "skills/engineering/alpha/agents/openai.yaml": (ALPHA_AGENT, 0o644),
                "skills/engineering/alpha/scripts/run.sh": (ALPHA_SCRIPT, 0o755),
                "skills/productivity/beta/SKILL.md": (BETA_SKILL, 0o644),
                "skills/productivity/beta/agents/openai.yaml": (BETA_AGENT, 0o644),
                "skills/productivity/beta/assets/data.bin": (BETA_DATA, 0o644),
            },
        ),
    }
    assert set(archives) == set(expected_archives)
    assert set(report["archives"]) == set(expected_archives)
    for filename, (format_name, manifest_path, selected) in expected_archives.items():
        with zipfile.ZipFile(io.BytesIO(archives[filename])) as archive:
            expected_members = set(selected) | {manifest_path, "LICENSE", "RELEASE.json"}
            assert set(archive.namelist()) == expected_members
            assert len(archive.infolist()) == len(expected_members)
            for path, (data, mode) in {**selected, "LICENSE": (LICENSE, 0o644)}.items():
                info = archive.getinfo(path)
                assert archive.read(path) == data, path
                assert info.create_system == 3, path
                assert stat.S_ISREG(info.external_attr >> 16), path
                assert stat.S_IMODE(info.external_attr >> 16) == mode, path

            manifest = json.loads(archive.read(manifest_path))
            assert manifest["name"] == "real-skills-unleashed"
            assert manifest["version"] == "1.3.2+from.1.3.1"
            provenance = json.loads(archive.read("RELEASE.json"))
            assert provenance["source_revision"] == REVISION
            assert provenance["source_sha256"] == source_sha256
            assert provenance["source_version"] == "1.3.2+from.1.3.1"
            assert provenance["base_version"] == "1.3.1"
            assert provenance["release_version"] == "1.3.2+from.1.3.1"
            assert provenance["format"] == format_name
            transform = provenance["manifest_transform"]
            assert transform["before"]["name"] == "real-skills-unleashed"
            assert transform["after"] == manifest


def test_build_refuses_package_name_that_disagrees_with_plugin_manifests():
    from release_builder import build

    output = io.BytesIO()
    target = "mattpocock-skills-" + REVISION + "/package.json"
    with tarfile.open(fileobj=io.BytesIO(source_archive()), mode="r:gz") as original:
        with tarfile.open(fileobj=output, mode="w:gz") as replacement:
            for member in original:
                member = copy.copy(member)
                if member.isfile():
                    data = original.extractfile(member).read()
                    if member.name == target:
                        package = json.loads(data)
                        package["name"] = "real-skills-unleashed"
                        data = json.dumps(package).encode()
                    member.size = len(data)
                    replacement.addfile(member, io.BytesIO(data))
                else:
                    replacement.addfile(member)
    source = output.getvalue()

    with pytest.raises(ValueError, match="source plugin name mismatch"):
        build(
            source, hashlib.sha256(source).hexdigest(), REVISION,
            "1.3.1", "1.3.2+from.1.3.1"
        )
