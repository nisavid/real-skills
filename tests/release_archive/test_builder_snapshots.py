import hashlib
import io
import json
from zipfile import ZipFile

import pytest
from release_builder import build_snapshot

from test_release_builder import REVISION, source_archive


def snapshot(edition, version, *, raw=None, **inputs):
    plugin = f"real-skills-{edition}"
    if raw is None:
        raw = source_archive(source_version=version, plugin_name=plugin)
    options = {
        "issued_versions": {plugin: []},
        "previous_release": None,
        "channels": ["private-claude"],
        "source_review": None,
        "release_line": {"ref": "refs/heads/main"},
        **inputs,
    }
    return build_snapshot(raw, hashlib.sha256(raw).hexdigest(), REVISION, "1.3.2",
                          version, **options)


@pytest.mark.parametrize("edition,version", [
    ("leashed", "1.3.2-0.snapshot.1"),
    ("leashed", "1.3.5-0.snapshot.1+from.1.3.2"),
    ("unleashed", "1.3.2-0.snapshot.1"),
    ("unleashed", "1.3.5-0.snapshot.1+from.1.3.2"),
    ("unleashed", "1.3.6-0.snapshot.1+from.rsl.1.3.5.from.1.3.2"),
])
def test_snapshot_identity_reaches_each_archive_manifest(edition, version):
    plugin = f"real-skills-{edition}"
    archives, _ = snapshot(edition, version)

    for layout, manifest_path in (
        ("agent-plugins", "plugin.json"),
        ("claude", ".claude-plugin/plugin.json"),
    ):
        with ZipFile(io.BytesIO(archives[f"{plugin}-{version}-{layout}.zip"])) as archive:
            assert json.loads(archive.read(manifest_path))["version"] == version
            provenance = json.loads(archive.read("RELEASE.json"))
            assert provenance["source_revision"] == REVISION
            assert provenance["release_version"] == version


@pytest.mark.parametrize("edition,version", [
    ("leashed", "1.3.5+from.1.3.2"),
    ("leashed", "1.3.5-0.snapshot.01+from.1.3.2"),
    ("leashed", "1.3.5-0.snapshot.0+from.1.3.2"),
    ("leashed", "1.3.5-0.snapshot.1+from.1.3.1"),
    ("leashed", "1.3.5-0.snapshot.1"),
    ("leashed", "1.3.2-0.snapshot.1+from.1.3.2"),
    ("leashed", "1.3.6-0.snapshot.1+from.rsl.1.3.5.from.1.3.2"),
    ("unleashed", "1.3.6-0.snapshot.1+from.rsl.1.3.6.from.1.3.2"),
    ("unleashed", "1.3.6-0.snapshot.1+from.rsl.1.3.1.from.1.3.2"),
    ("unleashed", "1.4.6-0.snapshot.1+from.rsl.1.3.5.from.1.3.2"),
])
def test_snapshot_builder_refuses_release_versions_or_invalid_snapshot_lineage(edition, version):
    with pytest.raises(ValueError, match="snapshot"):
        snapshot(edition, version)


@pytest.mark.parametrize("previously_issued", [
    "1.3.5-0.snapshot.9+from.1.3.2",
    "1.3.5-0.snapshot.10+from.1.3.2",
    "1.3.5-0.snapshot.10+from.rsl.1.3.4.from.1.3.2",
    "1.3.5-0.snapshot.11+from.1.3.2",
])
def test_snapshot_refuses_lower_or_previously_issued_precedence(previously_issued):
    with pytest.raises(ValueError, match="snapshot sequence must advance"):
        snapshot("unleashed", "1.3.5-0.snapshot.9+from.1.3.2",
                 issued_versions={"real-skills-unleashed": [previously_issued]})


def test_snapshot_advances_its_own_edition_and_intended_release_numerically():
    version = "1.3.5-0.snapshot.10+from.1.3.2"
    archives, _ = snapshot("unleashed", version, issued_versions={
        "real-skills-leashed": ["1.3.5-0.snapshot.11+from.1.3.2"],
        "real-skills-unleashed": ["1.3.4-0.snapshot.11+from.1.3.2",
                                  "1.3.5-0.snapshot.9+from.1.3.2"],
    })
    assert f"real-skills-unleashed-{version}-agent-plugins.zip" in archives


@pytest.mark.parametrize("source_version", [
    "1.3.4+from.1.3.2",
    "1.3.5-0.snapshot.1+from.1.3.2",
])
def test_snapshot_can_advance_from_the_same_source(source_version):
    plugin = "real-skills-unleashed"
    raw = source_archive(source_version=source_version, plugin_name=plugin)
    first = "1.3.5-0.snapshot.1+from.1.3.2"
    second = "1.3.5-0.snapshot.2+from.1.3.2"
    issued_first = {plugin: [first]}

    first_archives, _ = snapshot("unleashed", first, raw=raw)
    second_archives, _ = snapshot("unleashed", second, raw=raw, issued_versions=issued_first)
    for version, archives in ((first, first_archives), (second, second_archives)):
        for layout, manifest_path in (("agent-plugins", "plugin.json"),
                                      ("claude", ".claude-plugin/plugin.json")):
            with ZipFile(io.BytesIO(archives[f"{plugin}-{version}-{layout}.zip"])) as archive:
                assert json.loads(archive.read(manifest_path))["version"] == version
                provenance = json.loads(archive.read("RELEASE.json"))
                assert provenance["source_revision"] == REVISION
                assert provenance["source_version"] == source_version

    with pytest.raises(ValueError, match="snapshot sequence must advance"):
        snapshot("unleashed", first, raw=raw, issued_versions=issued_first)


def test_snapshot_returns_archive_digests_in_an_unissued_record():
    archives, report = snapshot("unleashed", "1.3.5-0.snapshot.1+from.1.3.2")
    record = report["snapshot_record"]

    assert record["status"] == "draft"
    assert record["identifier"] == "rsu-1.3.5-0.snapshot.1+from.1.3.2"
    assert record["intended_release"] == "rsu-1.3.5+from.1.3.2"
    assert record["source_revision"] == REVISION
    assert record["archive_sha256"] == {
        name: hashlib.sha256(data).hexdigest() for name, data in archives.items()
    }
    assert record["channels"] == ["private-claude"]
    assert record["source_review"] is None


@pytest.mark.parametrize("changes,standing", [
    ({}, "on-release-line"),
    ({"merge_base_exit_status": 1}, "off-release-line"),
    ({"merge_base_exit_status": 128}, "not-established"),
    ({"fetch_exit_status": 128, "merge_base_exit_status": 1}, "not-established"),
    ({"shallow": True, "merge_base_exit_status": 1}, "not-established"),
    ({"origin_url": "https://github.com/another/real-skills", "merge_base_exit_status": 1},
     "not-established"),
    ({"source_revision": "c" * 40}, "not-established"),
    ({"source_revision": None}, "not-established"),
])
def test_snapshot_record_derives_source_standing_from_git_observation(changes, standing):
    observation = {
        "origin_url": "https://github.com/nisavid/real-skills",
        "shallow": False,
        "fetch_exit_status": 0,
        "merge_base_exit_status": 0,
        "ref": "refs/heads/main",
        "revision": "b" * 40,
        "source_revision": REVISION,
        **changes,
    }
    _, report = snapshot("unleashed", "1.3.5-0.snapshot.3+from.1.3.2",
                         release_line=observation)
    record = report["snapshot_record"]
    assert record["release_line"]["standing"] == standing
    assert record["release_line"]["ref"] == "refs/heads/main"
    assert record["release_line"]["revision"] == "b" * 40
    assert record["release_line"]["source_revision"] == observation["source_revision"]
    assert record["release_line"]["merge_base_exit_status"] == observation["merge_base_exit_status"]
    if standing == "off-release-line":
        assert record["required_retained_ref"] == (
            "refs/heads/retained/delivered/rsu-1.3.5-0.snapshot.3+from.1.3.2"
        )
    else:
        assert "required_retained_ref" not in record


@pytest.mark.parametrize("previous_release", [
    "1.3.5+from.1.3.2",
    "1.3.6+from.1.3.2",
])
def test_snapshot_has_to_sort_after_preceding_named_release(previous_release):
    with pytest.raises(ValueError, match="snapshot target must advance"):
        snapshot("unleashed", "1.3.5-0.snapshot.1+from.1.3.2",
                 previous_release=previous_release)


def test_snapshot_target_uses_the_interval_after_the_preceding_named_release():
    _, report = snapshot("leashed", "1.3.5-0.snapshot.1+from.1.3.2",
                         previous_release="1.3.4+from.1.3.2")
    assert report["snapshot_record"]["previous_release"] == "1.3.4+from.1.3.2"
    assert report["snapshot_record"]["intended_release"] == "rsl-1.3.5+from.1.3.2"
