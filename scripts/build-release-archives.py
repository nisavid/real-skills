import copy
import hashlib
import io
import json
import posixpath
import re
import stat
import tarfile
import urllib.parse
import zipfile

import yaml


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        require(key not in result, f"duplicate YAML key: {key!r}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping
)


def unique_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, f"duplicate JSON key: {key}")
            result[key] = value
        return result

    return json.loads(data, object_pairs_hook=pairs)


def safe_path(path):
    require(isinstance(path, str) and path, "empty path")
    require("\\" not in path and ":" not in path
            and not any(ord(c) < 32 for c in path), f"unsafe path: {path}")
    require(not path.startswith("/"), f"absolute path: {path}")
    require(
        all(part not in ("", ".", "..") for part in path.split("/")),
        f"noncanonical path: {path}",
    )
    return path


def read_source(raw, expected_sha256, revision):
    require(digest(raw) == expected_sha256, "source archive hash mismatch")
    require(re.fullmatch(r"[0-9a-f]{40}", revision), "invalid source revision")
    allowed_roots = {"real-skills-" + revision, "mattpocock-skills-" + revision}
    source_root = None
    source = {}
    types = {}
    seen = set()

    # No tar extraction: read members strictly as data.
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for member in archive:
            name = member.name.rstrip("/")
            safe_path(name)
            require(name not in seen, f"duplicate tar member: {name}")
            seen.add(name)
            parts = name.split("/")
            require(parts[0] in allowed_roots, "unexpected source root")
            if source_root is None:
                source_root = parts[0]
            require(parts[0] == source_root, "multiple source roots")
            if len(parts) == 1:
                require(member.isdir(), "source root is not a directory")
                continue
            relative = "/".join(parts[1:])
            types[relative] = member.type
            if member.isfile():
                require(
                    member.mode in (0o644, 0o755),
                    f"unsupported source mode: {relative}",
                )
                source[relative] = (
                    archive.extractfile(member).read(),
                    member.mode,
                )
    return source, types


def metadata(skill):
    require(skill.startswith(b"---\n"), "missing skill frontmatter")
    contents = skill.decode("utf-8")[4:]
    closing = re.search(r"^---[ \t]*$", contents, re.MULTILINE)
    require(closing is not None, "unterminated skill frontmatter")
    front = yaml.load(contents[:closing.start()], Loader=UniqueLoader)
    require(isinstance(front, dict), "frontmatter is not a mapping")
    return front


def markdown_targets(data):
    # Preserve the existing export's bounded inline-link scanner.
    fence = ""
    for line_number, line in enumerate(data.decode("utf-8").splitlines(), 1):
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence:
            if (match and match[1][0] == fence[0] and len(match[1]) >= len(fence)
                    and not match[2].strip()):
                fence = ""
            continue
        if match:
            fence = match[1]
            continue
        pattern = r'(?<!!)\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)'
        for raw_target in re.findall(pattern, line):
            yield line_number, raw_target.strip("<>")


def verify_links(files):
    links = []
    for path, (data, mode) in sorted(files.items()):
        if not path.endswith(".md"):
            continue
        for line, raw_target in markdown_targets(data):
            target = resolve_relative(path, raw_target, files)
            if target is not None:
                links.append({"file": path, "line": line,
                              "target": raw_target, "resolved": target})
    return links


def resolve_relative(origin, raw_target, files):
    url = urllib.parse.urlsplit(raw_target)
    if url.scheme or url.netloc:
        return None
    if not url.path:
        return None
    path = urllib.parse.unquote(url.path)
    require(not path.startswith("/"), f"root-relative asset: {origin}: {path}")
    require("\\" not in path and "\0" not in path, "unsafe link target")
    target = posixpath.normpath(posixpath.join(posixpath.dirname(origin), path))
    require(
        target != ".." and not target.startswith("../"),
        f"link escapes archive: {origin}: {raw_target}",
    )
    require(
        target in files or any(p.startswith(target.rstrip("/") + "/") for p in files),
        f"unresolved relocated link: {origin}: {raw_target} -> {target}",
    )
    return target


def encode_zip(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for path, (data, mode) in sorted(files.items()):
            safe_path(path)
            info = zipfile.ZipInfo(path, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.create_version = 20
            info.extract_version = 20
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.internal_attr = 0
            info.extra = b""
            info.comment = b""
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, data)
    return output.getvalue()


def verify_zip(raw, files):
    actual = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        require(archive.testzip() is None, "ZIP integrity failure")
        infos = archive.infolist()
        require(
            len(infos) == len(files) == len({i.filename for i in infos}),
            "duplicate or missing archive members",
        )
        require(set(archive.namelist()) == set(files), "archive inventory mismatch")
        for info in infos:
            safe_path(info.filename)
            require(
                not any(info.filename.startswith(p + "/")
                        for p in files if p != info.filename),
                f"file/directory collision: {info.filename}",
            )
            data, mode = files[info.filename]
            require(stat.S_ISREG(info.external_attr >> 16), "nonregular ZIP member")
            require(archive.read(info) == data, f"byte mismatch: {info.filename}")
            require(
                stat.S_IMODE(info.external_attr >> 16) == mode,
                f"mode mismatch: {info.filename}",
            )
            actual[info.filename] = (archive.read(info), mode)
    return actual


NUMERIC = r"(?:0|[1-9][0-9]*)"
CORE = rf"{NUMERIC}\.{NUMERIC}\.{NUMERIC}"
LINEAGE = rf"(?:\+from\.(?:rsl\.(?P<parent>{CORE})\.from\.)?(?P<upstream>{CORE}))?"
SNAPSHOT_VERSION = re.compile(rf"(?P<core>{CORE})-0\.snapshot\.(?P<sequence>[1-9][0-9]*){LINEAGE}")
NAMED_RELEASE_VERSION = re.compile(rf"(?P<core>{CORE}){LINEAGE}")


def build(raw, expected_sha256, revision, base, release):
    """Return two release ZIPs and their verification report as data.

    raw is one immutable source tarball; expected_sha256 and revision bind
    the caller-selected input. No filesystem writes or network access occur.
    """
    base_match = re.fullmatch(rf"({NUMERIC})\.({NUMERIC})\.({NUMERIC})", base)
    require(base_match, "invalid base version")
    release_match = re.fullmatch(
        rf"({NUMERIC})\.({NUMERIC})\.({NUMERIC})\+from\.{re.escape(base)}", release
    )
    require(release_match, "invalid release version")
    require(
        release_match.group(1, 2) == base_match.group(1, 2)
        and int(release_match.group(3)) > int(base_match.group(3)),
        "release must retain upstream major and minor and advance its patch",
    )
    return _build(raw, expected_sha256, revision, base, release)


def build_snapshot(raw, expected_sha256, revision, base, version, *,
                   issued_versions, previous_release, channels, source_review, release_line):
    """Return two snapshot ZIPs and a draft issuance record as data.

    Supply the authoritative issued versions by plugin name, including
    withdrawn snapshots, and the preceding named package version (None only
    if there was no named release). Channels name delivery surfaces, and
    source_review identifies the source review or is None when there is none.
    Supply the release-line observation from Git before preparing the draft
    record. This function reserves no version, writes no files, and exposes
    no artifact. It stamps the requested version into the generated archives
    and retains the agreed original source version in provenance.
    """
    require(re.fullmatch(CORE, base), "invalid base version")
    match = SNAPSHOT_VERSION.fullmatch(version)
    require(match, "invalid snapshot version")
    if previous_release is not None:
        previous = (NAMED_RELEASE_VERSION.fullmatch(previous_release)
                    if isinstance(previous_release, str) else None)
        require(previous, "invalid preceding named release version")
        require(version_core(previous["core"]) < version_core(match["core"]),
                "snapshot target must advance beyond the preceding named release")
    require(isinstance(channels, (list, tuple)) and channels
            and all(isinstance(channel, str) and channel.strip() for channel in channels),
            "snapshot requires named delivery channels")
    require(source_review is None or (isinstance(source_review, str) and source_review.strip()),
            "snapshot source review must name the review or be None")
    source_standing = describe_release_line(release_line, revision)
    archives, report = _build(raw, expected_sha256, revision, base, version,
                              snapshot=(match, issued_versions))
    record = report["snapshot_record"]
    record.update({
        "status": "draft",
        "archive_sha256": {name: entry["sha256"] for name, entry in report["archives"].items()},
        "channels": list(channels),
        "source_review": source_review,
        "previous_release": previous_release,
        "release_line": source_standing,
    })
    if source_standing["standing"] == "off-release-line":
        record["required_retained_ref"] = f"refs/heads/retained/delivered/{record['identifier']}"
    return archives, report


def describe_release_line(observation, source_revision):
    """Interpret a Git check for the packaged source and a fetched release-line tip.

    The caller supplies the two ancestry operands as source_revision and
    revision, respectively, on the observation.
    """
    require(isinstance(observation, dict), "snapshot requires a Git release-line observation")
    ref = observation.get("ref")
    require(isinstance(ref, str) and ref.startswith("refs/heads/") and len(ref) > len("refs/heads/"),
            "snapshot requires a full release-line branch ref")
    origin = observation.get("origin_url")
    canonical = isinstance(origin, str) and origin.removesuffix(".git") in (
        "https://github.com/nisavid/real-skills",
        "git@github.com:nisavid/real-skills",
        "ssh://git@github.com/nisavid/real-skills",
    )
    revision = observation.get("revision")
    full_revision = isinstance(revision, str) and re.fullmatch(r"[0-9a-f]{40}", revision)
    observed_source = observation.get("source_revision")
    full_source = isinstance(observed_source, str) and re.fullmatch(r"[0-9a-f]{40}", observed_source)
    fetch_status = observation.get("fetch_exit_status")
    ancestry_status = observation.get("merge_base_exit_status")
    if not canonical:
        failure = "origin is not the canonical repository"
    elif observation.get("shallow") is not False:
        failure = "checkout is shallow or its history depth is unknown"
    elif type(fetch_status) is not int or fetch_status != 0:
        failure = "canonical release-line fetch did not succeed"
    elif not full_revision:
        failure = "full fetched release-line revision is unavailable"
    elif not full_source or observed_source != source_revision:
        failure = "Git ancestry check is not bound to the packaged source revision"
    elif type(ancestry_status) is not int or ancestry_status not in (0, 1):
        failure = "Git ancestry result did not establish source standing"
    else:
        failure = None

    standing = "not-established"
    if failure is None:
        standing = "on-release-line" if ancestry_status == 0 else "off-release-line"
    return {
        "ref": ref,
        "revision": revision if full_revision else None,
        "source_revision": observed_source if full_source else None,
        "fetch_exit_status": fetch_status if type(fetch_status) is int else None,
        "merge_base_exit_status": ancestry_status if type(ancestry_status) is int else None,
        "standing": standing,
        "reason": failure,
    }


def version_core(version):
    return tuple(map(int, version.split(".")))


def check_snapshot_lineage(snapshot, base, plugin_name):
    target = version_core(snapshot["core"])
    upstream = version_core(base)
    if snapshot["upstream"] is None:
        require(target == upstream, "snapshot without lineage must target the upstream version")
        return

    require(snapshot["upstream"] == base and target[:2] == upstream[:2] and target > upstream,
            "snapshot lineage must retain the upstream major and minor and advance its patch")
    if snapshot["parent"] is not None:
        parent = version_core(snapshot["parent"])
        require(plugin_name == "real-skills-unleashed" and upstream <= parent < target,
                "snapshot must name a Leashed parent between its upstream and Unleashed target")


def check_snapshot_sequence(snapshot, issued_versions, plugin_name):
    require(isinstance(issued_versions, dict) and plugin_name in issued_versions,
            "snapshot issuance history is required for this edition")
    previous = issued_versions[plugin_name]
    require(isinstance(previous, (list, tuple)), "invalid snapshot issuance history")
    sequence = int(snapshot["sequence"])
    for version in previous:
        prior = SNAPSHOT_VERSION.fullmatch(version) if isinstance(version, str) else None
        require(prior, "invalid version in snapshot issuance history")
        if prior["core"] == snapshot["core"]:
            require(sequence > int(prior["sequence"]),
                    "snapshot sequence must advance beyond every issued sequence for this target")


def _build(raw, expected_sha256, revision, base, release, *, snapshot=None):
    source, types = read_source(raw, expected_sha256, revision)
    claude = unique_json(source[".claude-plugin/plugin.json"][0])
    native = unique_json(source[".codex-plugin/plugin.json"][0])
    package = unique_json(source["package.json"][0])
    plugin_name = claude.get("name")
    require(
        plugin_name == native.get("name") == package.get("name")
        and plugin_name in ("real-skills-leashed", "real-skills-unleashed"),
        "source plugin name mismatch",
    )
    if snapshot is not None:
        version_match, issued_versions = snapshot
        check_snapshot_lineage(version_match, base, plugin_name)
        check_snapshot_sequence(version_match, issued_versions, plugin_name)
    source_version = package["version"]
    require(
        isinstance(source_version, str)
        and claude["version"] == native["version"] == source_version,
        "source version mismatch",
    )
    if snapshot is None:
        require(source_version == release, "source version mismatch")
    else:
        require(NAMED_RELEASE_VERSION.fullmatch(source_version)
                or SNAPSHOT_VERSION.fullmatch(source_version), "invalid source version for snapshot")

    roots = claude["skills"]
    require(isinstance(roots, list) and roots, "missing promoted selection")
    require(all(isinstance(p, str) for p in roots), "invalid manifest path")
    require(len(roots) == len(set(roots)), "duplicate manifest roots")
    require(native["skills"] == roots, "native inventories disagree")
    roots = [p[2:] if p.startswith("./") else p for p in roots]
    require(len(roots) == len(set(roots)), "normalized root collision")
    require(
        all(re.fullmatch(r"skills/(engineering|productivity)/[a-z0-9]+"
                         r"(?:-[a-z0-9]+)*", p) for p in roots),
        "selection outside promoted skill roots",
    )
    promoted = {
        p.rsplit("/", 1)[0]
        for p in source
        if re.fullmatch(r"skills/(engineering|productivity)/[^/]+/SKILL.md", p)
    }
    require(set(roots) == promoted, "incomplete or extra promoted membership")
    names = [p.rsplit("/", 1)[1] for p in roots]
    require(len(names) == len(set(names)), "duplicate destination skill names")

    selected = {
        p: entry for p, entry in source.items()
        if any(p.startswith(root + "/") for root in roots)
    }
    for root in roots:
        parts = root.split("/")
        for length in range(1, len(parts) + 1):
            ancestor = "/".join(parts[:length])
            require(types.get(ancestor) == tarfile.DIRTYPE,
                    f"selected ancestor is not a directory: {ancestor}")
    for path, member_type in types.items():
        if any(path.startswith(root + "/") for root in roots):
            require(
                member_type in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE),
                f"selected symlink or special member: {path}",
            )

    for root, name in zip(roots, names):
        require(root + "/SKILL.md" in selected, f"missing skill: {name}")
        require(root + "/agents/openai.yaml" in selected, f"missing controls: {name}")
        require(
            not any(p.endswith("/SKILL.md") and p != root + "/SKILL.md"
                    for p in selected if p.startswith(root + "/")),
            f"nested skill: {name}",
        )
        front = metadata(selected[root + "/SKILL.md"][0])
        require(front.get("name") == name, f"skill name mismatch: {name}")
        require(
            isinstance(front.get("description"), str) and front["description"].strip(),
            f"missing description: {name}",
        )
        flag = front.get("disable-model-invocation")
        require(flag is None or type(flag) is bool, "invalid invocation flag")
        agent = yaml.load(
            selected[root + "/agents/openai.yaml"][0], Loader=UniqueLoader
        )
        require(isinstance(agent, dict), "invalid invocation metadata")
        policy = agent.get("policy", {})
        require(isinstance(policy, dict), "invalid invocation policy")
        implicit = policy.get("allow_implicit_invocation")
        require(implicit is None or type(implicit) is bool, "invalid policy flag")
        require((implicit is False) == (flag is True), f"unpaired controls: {name}")

    allowed = {
        "name", "version", "description", "author", "homepage",
        "repository", "license", "keywords", "skills", "icon",
    }
    require(set(claude) <= allowed, "new manifest fields need projection review")
    require(isinstance(native.get("interface"), dict),
            "missing or non-object native interface")
    icon_path = claude.get("icon")
    if "icon" not in claude:
        require("logo" not in native["interface"] and "composerIcon" not in native["interface"],
                "native icon references disagree")
    else:
        require(isinstance(icon_path, str) and re.fullmatch(
            r"\./assets/[a-zA-Z0-9_-]+\.(?:svg|png|jpg|jpeg|webp)", icon_path
        ), "invalid icon path")
        asset = icon_path[2:]
        require(types.get("assets") == tarfile.DIRTYPE, "invalid icon directory")
        require(types.get(asset) in (tarfile.REGTYPE, tarfile.AREGTYPE) and asset in source,
                "missing or nonregular icon")
        require(native["interface"].get("logo") == icon_path
                and native["interface"].get("composerIcon") == icon_path,
                "native icon references disagree")
    portable = {k: copy.deepcopy(v) for k, v in claude.items() if k not in ("skills", "icon")}
    portable["$schema"] = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    portable["extensions"] = {"com.openai": {"interface": copy.deepcopy(native["interface"])}}
    projected_claude = copy.deepcopy(claude)
    projected_claude["displayName"] = native["interface"]["displayName"]
    for manifest in (portable, projected_claude):
        manifest["version"] = release
        manifest["repository"] = "https://github.com/nisavid/real-skills"

    outputs = {}
    report = {
        "source_revision": revision,
        "source_sha256": expected_sha256,
        "source_version": source_version,
        "base_version": base,
        "release_version": release,
        "archives": {},
        "limitations": [
            "Source hash and supplied revision identity checked; Git commit object not reconstructed",
            "Relative file paths checked; fragment anchors and external URLs not verified",
            "No installation, schema service, harness execution, or workflow execution performed",
        ],
    }
    if snapshot is not None:
        member = "rsl" if plugin_name == "real-skills-leashed" else "rsu"
        intended_version = version_match["core"] + release[version_match.end("sequence"):]
        report["snapshot_record"] = {
            "identifier": f"{member}-{release}",
            "intended_release": f"{member}-{intended_version}",
            "source_revision": revision,
        }

    for format_name, manifest_path, manifest in (
        ("agent-plugins", "plugin.json", portable),
        ("claude", ".claude-plugin/plugin.json", projected_claude),
    ):
        files = {}
        mapping = {}
        for root, name in zip(roots, names):
            for original, entry in selected.items():
                if not original.startswith(root + "/"):
                    continue
                destination = (
                    "skills/" + name + original[len(root):]
                    if format_name == "agent-plugins" else original
                )
                require(destination not in files, "destination collision")
                files[destination] = entry
                mapping[original] = destination
        require(set(mapping) == set(selected), "incomplete selected-file projection")

        files["LICENSE"] = source["LICENSE"]
        if icon_path is not None:
            require(asset not in files, "destination collision")
            files[asset] = source[asset]
            mapping[asset] = asset
        files[manifest_path] = (json_bytes(manifest), 0o644)
        provenance = {
            "source_revision": revision,
            "source_sha256": expected_sha256,
            "source_version": source_version,
            "base_version": base,
            "release_version": release,
            "format": format_name,
            "manifest_transform": {
                "source": ".claude-plugin/plugin.json",
                "before": claude,
                "after": manifest,
                "generated_mode": "0o644",
                "interface_source": (
                    {"path": ".codex-plugin/plugin.json",
                     "sha256": digest(source[".codex-plugin/plugin.json"][0]),
                     "field": "interface"}
                    if format_name == "agent-plugins" else None
                ),
                "skill_path_rule": (
                    "skills/<bucket>/<name>/<suffix> -> skills/<name>/<suffix>"
                    if format_name == "agent-plugins" else "identity"
                ),
                "skill_and_support_content": "identity",
                "license_content_and_mode": "identity",
            },
            "source_mapping": [
                {
                    "source": original,
                    "archive": destination,
                    "sha256": digest(source[original][0]),
                    "mode": oct(source[original][1]),
                }
                for original, destination in sorted(mapping.items())
            ],
            "license_sha256": digest(source["LICENSE"][0]),
            "icon_sha256": digest(source[asset][0]) if icon_path is not None else None,
        }
        files["RELEASE.json"] = (json_bytes(provenance), 0o644)

        archive_bytes = encode_zip(files)
        require(archive_bytes == encode_zip(files), "nondeterministic rebuild")
        actual = verify_zip(archive_bytes, files)
        links = verify_links(actual)
        filename = f"{plugin_name}-{release}-{format_name}.zip"
        outputs[filename] = archive_bytes
        report["archives"][filename] = {
            "sha256": digest(archive_bytes),
            "bytes": len(archive_bytes),
            "members": len(files),
            "relative_links": links,
            "source_mapping": provenance["source_mapping"],
        }

    return outputs, report
