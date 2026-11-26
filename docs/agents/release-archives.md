# Build and verify Leashed release archives

Use this procedure when preparing the portable agent-plugins and Claude release ZIPs. For native repository packaging, use [the native package procedure](plugin-packaging.md). Ordinary skill use does not invoke either release build.

## Inputs

This procedure produces Leashed release ZIPs. Use a reviewed Leashed source checkout for the preparation steps. Pin its source revision independently of the reviewed procedure and builder revision. The checkout containing the procedure and builder can be Unleashed.

Before editing the source version, read `package.json`, `.claude-plugin/plugin.json`, and `.codex-plugin/plugin.json` in the selected source checkout. Require all three names to be `real-skills-leashed`. Verify that the Claude and Codex manifest icon fields and the Codex interface `logo` and `composerIcon` point to `./assets/wayfinder.svg` in that source checkout. Stop if any identity or reference differs.

Load this procedure and `scripts/build-release-archives.py` from their reviewed procedure revision. Record that revision separately from the pinned source commit: the source commit supplies package data, while the procedure revision supplies the builder and instructions. Preserve the reviewed builder bytes. Its `build(raw, expected_sha256, revision, base, release)` boundary requires Python 3 and PyYAML; record the actual Python, PyYAML, Git, and gzip versions used.

Select a full, lowercase, 40-character Git source commit, its expected source-tar SHA-256, and the incorporated upstream base version `M.m.U`. Verify the upstream release tag and commit independently, then account for every difference between that tagged source and the candidate, including the approved fork changes; ancestry alone does not establish this provenance. The builder cannot establish it from the supplied base alone. Both native source manifests and `package.json` must agree on the allocated full release version, which differs from the upstream base.

Allocate one release version for both archives and all supported surfaces: `M.m.P+from.M.m.U`. For the same major/minor line, set `P` to one more than the greater of the highest previously exposed fork patch in that line and `U`. For a new higher major/minor line with no exposed fork release, use `U + 1`. Check the release and account records for previously exposed versions, retain the evidence, and stop if that inventory or the upstream baseline is uncertain. The builder checks the supplied base and release relationship; it cannot establish the highest previously exposed fork patch. Reuse the allocated version across formats and surfaces; a consumer-specific exception requires evidence that the uniform version cannot work. The release version must already be present in the reviewed source commit and is retained in generated artifacts; it does not assert an independent downstream major/minor compatibility policy.

In the selected Leashed source checkout, before freezing the release source, write the allocated full release version to `package.json`, run `node scripts/sync-plugin-version.mjs` to synchronize the Claude manifest, and run `npm run build-plugin-package` to regenerate the Codex manifest. Verify that all three versions equal the allocation, retain the promoted skill bytes and invocation settings, and run the native package procedure. Commit and independently review the resulting release candidate before using it as the source commit. Do not advance `stable-vanilla-plus` to the candidate until the GitHub release and archive checks are complete; then point it at that same reviewed commit and qualify repository-marketplace installation and updates separately for each selected harness.

Use a gzip-compressed Git tar with root `real-skills-<full SHA>/` and `tar.umask=0022`. The builder also accepts historical inputs rooted at `mattpocock-skills-<full SHA>/`. Every member must share one of these roots and the selected full source commit. Bind the expected hash to the exact input bytes; changing the prefix changes that hash. Retain historical tar bytes and their recorded hashes for replay. A hash alone does not prove Git origin.

Treat manifests, skills, supporting files, and license text as data. Execute only the reviewed builder and verification tools. Preserve upstream skill bytes and invocation settings.

When changing the manual archive builder or its tests, install pytest and PyYAML and run the relevant builder tests in `tests/release_archive`; a failure blocks use of that changed builder.

## Build

Run the following Bash block from the checkout containing the reviewed procedure and builder. Supply the five required environment variables named below. To replay a retained tar, also set `SOURCE_TAR` to its absolute path; the block copies those bytes into the new output directory. With `SOURCE_TAR` unset or empty, it generates a tar with the canonical `real-skills-<full SHA>/` root. `OUTPUT_DIR` must name a new directory outside the checkout; keep the source commit available in this checkout's Git object database. Set `SOURCE_SHA256` from the retained, independently identified source tar, rather than deriving it inside this invocation. If preparing that tar for the first time, generate it with the same Git archive and gzip command, record its hash and source provenance, and use those fixed bytes for verification.

```bash
set -euo pipefail
: "${SOURCE_COMMIT:?full source commit required}"
: "${SOURCE_SHA256:?expected source tar SHA-256 required}"
: "${BASE_VERSION:?base version required}"
: "${RELEASE_VERSION:?release version required}"
: "${OUTPUT_DIR:?new output directory required}"
test "$(git rev-parse --verify "${SOURCE_COMMIT}^{commit}")" = "$SOURCE_COMMIT"
procedure_revision=$(git rev-parse HEAD)
builder="$PWD/scripts/build-release-archives.py"
git cat-file blob "${procedure_revision}:scripts/build-release-archives.py" | cmp - "$builder"
mkdir -- "$OUTPUT_DIR"
output=$(cd -- "$OUTPUT_DIR" && pwd)
printf '%s\n' "$procedure_revision" > "$output/procedure-revision.txt"
sha256sum -- "$builder" > "$output/builder.sha256"
{
  python3 --version
  python3 -c 'import yaml; print("PyYAML", yaml.__version__)'
  git --version
  gzip --version
} > "$output/tool-versions.txt"
if [ -n "${SOURCE_TAR:-}" ]; then
  cp -- "$SOURCE_TAR" "$output/source.tar.gz"
else
  git -c tar.umask=0022 archive --format=tar \
    --prefix="real-skills-${SOURCE_COMMIT}/" "$SOURCE_COMMIT" \
    | gzip -n > "$output/source.tar.gz"
fi
for run in first second; do
  mkdir -- "$output/$run"
  python3 - "$builder" "$output/source.tar.gz" "$SOURCE_SHA256" \
    "$SOURCE_COMMIT" "$BASE_VERSION" "$RELEASE_VERSION" "$output/$run" <<'PYTHON'
import json
import pathlib
import runpy
import sys

builder, source, expected, revision, base, release, destination = sys.argv[1:]
build = runpy.run_path(builder)["build"]
outputs, report = build(pathlib.Path(source).read_bytes(), expected, revision, base, release)
root = pathlib.Path(destination)
for name, data in outputs.items():
    with (root / name).open("xb") as stream:
        stream.write(data)
with (root / "report.json").open("x", encoding="utf-8", newline="\n") as stream:
    json.dump(report, stream, ensure_ascii=False, sort_keys=True, indent=2)
    stream.write("\n")
PYTHON
 done
for format in agent-plugins claude; do
  name="real-skills-leashed-${RELEASE_VERSION}-${format}.zip"
  cmp -- "$output/first/$name" "$output/second/$name"
done
cmp -- "$output/first/report.json" "$output/second/report.json"
(cd -- "$output" && sha256sum source.tar.gz first/*.zip > SHA256SUMS)
(cd -- "$output" && sha256sum --check SHA256SUMS)
```

Each run starts a separate Python process from the same copied or generated input and checks it against the externally supplied `SOURCE_SHA256`. Require both to succeed and their ZIPs and reports to match byte for byte. The builder's own repeated encoding check is additional evidence, not the second build. A hash mismatch or any validation failure stops this candidate; resolve the input or projection issue before rebuilding.

## Verify against Git

Compare the ZIPs directly with the source commit, independently of the builder's report and tar reader. Read the commit's manifests and blobs with Git object commands, such as `git ls-tree -r -z` and `git cat-file blob`. Derive the selected inventory from that tree and require agreement between the Claude manifest, the native manifest, and every promoted skill root. Account for every selected file, including supporting files, and for `LICENSE`. Reject selected links, special entries, nested skills, duplicate destination names, and unexpected archive members. Git archive attributes can omit or substitute content; a successful tar build does not replace this comparison.

Require ZIP member bytes and Unix modes to match the Git blobs: Git mode `100644` maps to `0644`, and `100755` maps to `0755`. Both ZIPs contain the source `LICENSE` bytes and mode. If the manifest specifies an icon, require the path to resolve inside each archive and its bytes and mode to match the source commit. Check the derivation with the reviewed `scripts/build-wayfinder-icon.py` using both `assets/wayfinder-source.svg` and `assets/wayfinder.svg` read directly from `SOURCE_COMMIT`, rather than the procedure checkout. Place that reviewed checker and the two Git blobs in the same relative paths in an isolated directory, run the checker with `--check`, and record the checker revision, source commit, and SHA-256 of both blobs. Every selected `SKILL.md` and `agents/openai.yaml` remains byte-identical, with paired user-invocation controls. Check the following complete layouts:

- `real-skills-leashed-<release>-agent-plugins.zip`: root `plugin.json`, `LICENSE`, and `RELEASE.json`, plus the referenced icon when declared; each complete selected tree maps from `skills/<bucket>/<name>/` to `skills/<name>/`.
- `real-skills-leashed-<release>-claude.zip`: `.claude-plugin/plugin.json`, `LICENSE`, and `RELEASE.json`, plus the referenced icon when declared; each complete selected tree retains `skills/<bucket>/<name>/`.

For each Real Skills [Leashed] archive, require the Wayfinder icon and perform and record the light- and dark-background appearance check in the native package procedure, identifying the source revision, archive format, and observed surface or preview method. Record provider rendering as unobserved when no authorized provider observation is available; an archive or local preview alone does not establish it.

Generated manifest and provenance files have mode `0644`. Review the generated manifests against their source JSON: the builder's fixed fork repository URL is a deliberate transform; the release version must agree with the source; the portable manifest omits Claude's `skills`, adds the schema URL, and copies the native `interface` into `extensions.com.openai.interface`. The Claude manifest copies `displayName` from the native interface. Other Claude fields remain as the builder defines. Verify `RELEASE.json` identifies the source commit, source hash, fork source version, upstream base and release versions, format, manifest transform, and complete selected-file mapping with hashes and modes. Verify its license hash. These records describe the transformation; the direct Git comparison establishes content preservation.

## Evidence and gates

Retain the source commit and tar hash, reviewed procedure revision and builder hash, dependency versions, both independent build results, direct Git comparison, reports, and verified checksums. The link scanner checks only its supported inline Markdown links outside recognized fenced blocks, and only relative file or directory existence. It does not establish complete Markdown-link coverage, fragment validity, external URL reachability, or general security. Review relocation-sensitive links beyond that coverage when the selected inputs need it. Package checks establish neither license clearance beyond preserving the source license nor harness behavior.

Before publication, complete the native procedure's applicable source checks and the repository's independent review on the final procedure and candidate inputs. Record review evidence for the release artifacts and rerun affected checks whenever inputs, builder bytes, or relevant dependencies change. Before claiming discovery or qualifying an installation, exercise discovery for the selected ZIP through its intended harness route: compare observed names with the promoted inventory, confirm non-promoted names are absent, and record harness versions and observed invocation controls. Before qualifying an edition for a harness, compare the edition's skill names with that harness's built-in names, and record the result under [Harness built-in names](#harness-built-in-names). Source metadata alone does not establish runtime enforcement. Unavailable or failed required review or direct verification blocks the affected release. Unavailable or failed discovery blocks the corresponding consumer qualification.

Follow the standing Git publication workflow for authorized repository changes. Release upload or publication, final installation, host configuration changes, and official-directory submission each retain their own authorization and acceptance requirements. Archive construction and discovery do not complete those actions. Consumers load the reviewed procedure revision and verify its required evidence before dependent use; useful corrections return to this maintained procedure and its builder.

## Harness built-in names

A harness built-in that shares a skill's bare name can take that name, so a bare call can reach the built-in instead of this collection's skill. Record each comparison here with the harness, the shared names, and the source. Only a reservation observed on a supported harness and recorded here makes a sibling call to that name plugin-qualified. A name that was reported but not observed is a lead to check, and sibling calls to it keep the bare name until the reservation is observed. Every other sibling call keeps its bare name.

Known so far:

- **Claude Code:** `code-review`. Observed on 2026-11-18: with every other provider removed, the profile listed the built-in under the bare name beside the plugin's qualified skill.
- **Claude Code:** `prototype`, from an upstream report ([mattpocock/skills#1019](https://github.com/mattpocock/skills/issues/1019)). This fork has not observed it.
- **Claude Code:** `pr`, present in the 2.1.327 bundled-skill list (static inspection). Not observed in a profile listing by this fork.
- **Claude Code, standalone copy** (not a supported install route): whether the bare `code-review` reaches the copy or the built-in has not been checked.
- **Copilot CLI:** `research`, from an upstream report ([mattpocock/skills#857](https://github.com/mattpocock/skills/issues/857)). This fork has not observed it.
- **ChatGPT upload route** ([the install block](../../.agents/install-block.md)): not checked. Whether it reserves any of these names, or resolves a plugin-qualified skill name, has not been observed.
- **Codex:** not checked. Whether Codex reserves any of these names, or resolves a plugin-qualified skill name, has not been observed.

## Check provenance in CI

The provenance job supports `real-skills-leashed` and `real-skills-unleashed`. Run **Release archive provenance** manually on the default branch for one reviewed, repository-reachable release source. Supply its full commit ID, independently retained source-tar SHA-256, the verified upstream release commit and base version, and the already allocated release version. Verify upstream tag resolution and account for the fork changes before dispatch. The job checks ancestry and version consistency using those inputs. The job has read-only repository access and requires no provider credentials. It runs one candidate at a time on Linux with a ten-minute timeout.

For a local run from a reviewed checkout, use a Python interpreter with PyYAML installed. Use that interpreter for preflight and the provenance command. Make the pinned builder commit available in the selected Git object database. Obtain its full commit ID with `python scripts/check-release-archive-provenance.py --builder-revision`. If the object is absent, fetch that exact commit from the fork's trusted GitHub origin. The runner verifies the builder and procedure digests before executing the builder. To check changes to the automation, complete that preflight, install pytest in the same interpreter, and run `python -m pytest -q tests/release_archive`. A failed suite blocks the changed automation. For a local provenance run, use the same release inputs:

```sh
python scripts/check-release-archive-provenance.py build \
  --repo . --source "$SOURCE_COMMIT" --source-sha256 "$SOURCE_SHA256" \
  --upstream "$UPSTREAM_COMMIT" --base "$BASE_VERSION" \
  --release "$RELEASE_VERSION" --output "$OUTPUT_DIR"
```

The runner retains the historical `mattpocock-skills-<full SHA>/` tar recipe required by its pinned builder and source hashes. For this runner, identify and hash the source tar using that recipe; the manual build block above generates a different prefix when no `SOURCE_TAR` is supplied. Updating this manual builder does not update the runner's pinned builder or hashes.

The runner executes the pinned archive builder in two separate Python processes. Its independent verifier derives both expected ZIPs' contents from the source Git tree. It checks the complete layouts, selected bytes and modes, generated manifests, provenance, and declared icon bytes. It checks Wayfinder asset derivation when the source declares the Wayfinder SVG. To check one existing ZIP against the same source binding, use the `verify` subcommand with `--format agent-plugins` or `--format claude` and `--archive PATH` in place of `--output`.

Use a new output directory per attempt. Keep the receipt with the reviewed pilot checkout commit for a local run, or the workflow run URL and its head commit for a hosted run. Match the receipt’s runner and verifier hashes to the corresponding Git blobs in that commit. The receipt fields `procedure_revision` and `procedure_sha256` identify the separately pinned builder procedure. The receipt also binds the source, toolchain, builder, archive digests, and cleanup. A nonzero exit or missing receipt leaves the run failed or incomplete. Check the logs and reconcile the original attempt before issuing another. The hosted runner disposes of its workspace after the job. The job qualifies archive repeatability and Git correspondence. Appearance checks, provider rendering, discovery, installation, and invocation require their own evidence.

For a hosted replay before merge, create the dedicated `nisavid/archive-provenance-replay` branch once at the reviewed workflow commit. Branch creation exercises the push entry with the fixed historical Leashed source, which predates the Wayfinder icon. Subsequent pushes skip the job. A passing replay supplies evidence for that exact historical source and push entry. Observe a default-branch manual dispatch separately before claiming it works. Current Leashed releases still require the Wayfinder icon and its appearance checks. The manual release can proceed under its applicable checks independently of the provenance job.
