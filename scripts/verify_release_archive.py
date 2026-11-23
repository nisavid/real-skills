"""Verify the released ZIP projection independently against Git objects."""

import hashlib
import json
import re
import stat
import subprocess
from io import BytesIO
from zipfile import ZipFile

EDITIONS = {"real-skills-leashed", "real-skills-unleashed"}
ROOT = r"skills/(?:engineering|productivity)/[a-z0-9]+(?:-[a-z0-9]+)*"
REPO_URL = "https://github.com/nisavid/real-skills"
FORMATS = ("agent-plugins", "claude")
MAX_BYTES = 16 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git(repo, *args):
    result = subprocess.run(
        ["git", "--no-replace-objects", "-C", repo, *args],
        stdin=subprocess.DEVNULL, capture_output=True, timeout=30, check=False,
    )
    require(result.returncode == 0, "required Git object or operation unavailable")
    return result.stdout


def blob(repo, revision, path):
    return git(repo, "cat-file", "blob", f"{revision}:{path}")


def json_object(raw):
    def unique(pairs):
        result = dict(pairs)
        require(len(result) == len(pairs), "duplicate JSON key")
        return result

    data = json.loads(raw, object_pairs_hook=unique)
    require(isinstance(data, dict), "expected JSON object")
    return data


def manifests(repo, source, release):
    package = json_object(blob(repo, source, "package.json"))
    claude = json_object(blob(repo, source, ".claude-plugin/plugin.json"))
    native_bytes = blob(repo, source, ".codex-plugin/plugin.json")
    native = json_object(native_bytes)
    name = package.get("name")
    require(isinstance(name, str) and name in EDITIONS, "unsupported edition")
    for manifest in (package, claude, native):
        require(manifest.get("name") == name and manifest.get("version") == release,
                "source plugin identity or release version differs")
    interface = native.get("interface")
    require(isinstance(interface, dict) and isinstance(interface.get("displayName"), str),
            "invalid native interface")
    roots = claude.get("skills")
    require(isinstance(roots, list) and roots and native.get("skills") == roots
            and all(isinstance(root, str) for root in roots), "source manifests disagree on skills")
    roots = [path.removeprefix("./") for path in roots]
    require(all(re.fullmatch(ROOT, path) for path in roots) and len(roots) == len(set(roots)),
            "invalid or duplicate skill root")
    return name, claude, interface, sha256(native_bytes), roots


def selected_files(repo, source, roots, asset):
    tree = {}
    for row in git(repo, "ls-tree", "-rz", source).split(b"\0"):
        if row:
            metadata, path = row.split(b"\t", 1)
            mode, kind, oid = metadata.decode().split()
            tree[path.decode()] = (mode, kind, oid)
    promoted = {path.removesuffix("/SKILL.md") for path in tree
                if re.fullmatch(r"skills/(?:engineering|productivity)/[^/]+/SKILL[.]md", path)}
    require(set(roots) == promoted, "manifest differs from promoted Git inventory")
    require(len({path.rsplit("/", 1)[1] for path in roots}) == len(roots),
            "duplicate promoted skill name")
    require(all(f"{root}/agents/openai.yaml" in tree for root in roots),
            "missing invocation metadata")
    required = {"LICENSE"}
    if asset:
        required.add(asset)
    require(required <= tree.keys(), "missing license or icon")
    files = {}
    total_size = 0
    for path, (mode, kind, oid) in tree.items():
        if path not in required and not any(path.startswith(root + "/") for root in roots):
            continue
        require(kind == "blob" and mode in {"100644", "100755"},
                "selected Git member must be a regular file")
        require(not path.endswith("/SKILL.md") or path.removesuffix("/SKILL.md") in roots,
                "nested skill in selected tree")
        size = int(git(repo, "cat-file", "-s", oid))
        total_size += size
        require(total_size <= MAX_BYTES, "selected Git files exceed size limit")
        files[path] = (git(repo, "cat-file", "blob", oid), int(mode[-3:], 8))
    return files


def verify_archive(repo, source, source_sha256, base, release, fmt, path):
    name, claude, interface, native_digest, roots = manifests(repo, source, release)
    icon = claude.get("icon")
    if "icon" in claude:
        require(isinstance(icon, str) and
                re.fullmatch(r"\./assets/[a-zA-Z0-9_-]+\.(?:svg|png|jpg|jpeg|webp)", icon)
                and interface.get("logo") == interface.get("composerIcon") == icon,
                "source icon references disagree")
    else:
        require("logo" not in interface and "composerIcon" not in interface,
                "source icon references disagree")
    asset = icon.removeprefix("./") if icon else None
    files = selected_files(repo, source, roots, asset)
    portable = fmt == "agent-plugins"
    targets = {item: item for item in files}
    if portable:
        for item in files:
            if item.startswith("skills/"):
                category, _, suffix = item.partition("/")
                targets[item] = category + "/" + suffix.split("/", 1)[1]
    require(len(set(targets.values())) == len(targets), "archive path collision")

    projected = dict(claude, repository=REPO_URL)
    interface_source = None
    manifest_path = ".claude-plugin/plugin.json"
    path_rule = "identity"
    if portable:
        projected.pop("skills")
        projected.pop("icon", None)
        projected["$schema"] = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
        projected["extensions"] = {"com.openai": {"interface": interface}}
        interface_source = {"path": ".codex-plugin/plugin.json",
                            "sha256": native_digest, "field": "interface"}
        manifest_path = "plugin.json"
        path_rule = "skills/<bucket>/<name>/<suffix> -> skills/<name>/<suffix>"
    else:
        projected["displayName"] = interface["displayName"]
    provenance = {
        "source_revision": source, "source_sha256": source_sha256,
        "source_version": release, "base_version": base, "release_version": release,
        "format": fmt, "manifest_transform": {
            "source": ".claude-plugin/plugin.json", "before": claude, "after": projected,
            "generated_mode": "0o644", "interface_source": interface_source,
            "skill_path_rule": path_rule, "skill_and_support_content": "identity",
            "license_content_and_mode": "identity",
        },
        "source_mapping": [
            {"source": src, "archive": dst, "sha256": sha256(files[src][0]), "mode": oct(files[src][1])}
            for src, dst in sorted(targets.items()) if src != "LICENSE"
        ],
        "license_sha256": sha256(files["LICENSE"][0]),
        "icon_sha256": sha256(files[asset][0]) if asset else None,
    }
    expected = {targets[src]: (data, mode) for src, (data, mode) in files.items()}
    generated = {manifest_path: projected, "RELEASE.json": provenance}
    with path.open("rb") as stream:
        snapshot = stream.read(MAX_BYTES + 1)
    require(len(snapshot) <= MAX_BYTES, "archive exceeds size limit")
    with ZipFile(BytesIO(snapshot)) as archive:
        members = archive.infolist()
        names = expected.keys() | generated.keys()
        require(len(members) == len(names) and set(archive.namelist()) == names,
                "missing or unexpected archive members")
        require(sum(item.file_size for item in members) <= MAX_BYTES,
                "expanded archive exceeds size limit")
        for item in members:
            target = item.filename
            require(item.orig_filename == target, "archive member name was normalized")
            mode = expected[target][1] if target in expected else 0o644
            attrs = item.external_attr >> 16
            require(item.create_system == 3 and stat.S_ISREG(attrs)
                    and stat.S_IMODE(attrs) == mode, "archive member differs in type or mode")
            data = archive.read(item)
            ok = data == expected[target][0] if target in expected else json_object(data) == generated[target]
            require(ok, "archive member differs from Git projection")

    return {"name": name, "skills": len(roots), "members": len(names),
            "git_files": len(files), "icon": asset, "sha256": sha256(snapshot)}
