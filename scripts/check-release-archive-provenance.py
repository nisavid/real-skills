"""Build two release ZIP pairs and verify them against immutable Git objects."""

import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from zipfile import BadZipFile

import yaml

from verify_release_archive import (
    FORMATS, MAX_BYTES, blob, git, manifests, require, sha256, verify_archive,
)

HERE = Path(__file__).resolve().parent
BUILDER_REVISION = "d955a868321ec41fef6464576b88073f66fc1208"
BUILDER_PATH = "scripts/build-release-archives.py"
BUILDER_SHA256 = "7cc513b8b445158432c5a7d2489d35d9f54526c34623d81cca14155412f0bd15"
PROCEDURE_PATH = "docs/agents/release-archives.md"
PROCEDURE_SHA256 = "92b446861bc62704d692e93a18bb0cade07a7b5e8a09fabedc1af223d611338c"
CHECKER = HERE / "build-wayfinder-icon.py"

BUILD = """
from pathlib import Path
import json, runpy, sys
builder, tar, digest, source, base, release, output = sys.argv[1:]
build = runpy.run_path(builder)["build"]
archives, report = build(Path(tar).read_bytes(), digest, source, base, release)
root = Path(output)
for name, data in archives.items():
    (root / name).write_bytes(data)
(root / "report.json").write_text(json.dumps(report, sort_keys=True) + "\\n")
"""


def run_checked(argv, **options):
    return subprocess.run(argv, timeout=60, check=True, **options)


def bind(args):
    for commit in (args.source, args.upstream):
        require(re.fullmatch(r"[a-f0-9]{40}", commit), "expected full commit ID")
        require(git(args.repo, "rev-parse", "--verify", commit + "^{commit}").decode().strip() == commit,
                "commit binding differs")
    require(re.fullmatch(r"[a-f0-9]{64}", args.source_sha256), "expected full source-tar SHA-256")
    for version in (args.base, args.release.split("+from.", 1)[0]):
        require(re.fullmatch(r"(?:0|[1-9][0-9]*)(?:[.](?:0|[1-9][0-9]*)){2}", version),
                "invalid base or release version")
    prefix = args.release.removesuffix("+from." + args.base)
    produced = tuple(map(int, prefix.split("."))) if prefix.count(".") == 2 else ()
    upstream = tuple(map(int, args.base.split(".")))
    require(args.release == prefix + "+from." + args.base and
            produced[:2] == upstream[:2] and produced[2] > upstream[2],
            "invalid release relationship")
    upstream_package = json.loads(blob(args.repo, args.upstream, "package.json"))
    require(isinstance(upstream_package, dict) and upstream_package.get("version") == args.base,
            "upstream commit version differs from accepted base")
    git(args.repo, "merge-base", "--is-ancestor", args.upstream, args.source)
    return manifests(args.repo, args.source, args.release)[0]


def materialize_tar(args, target):
    # Spool before compression so a failed Git command cannot leave a usable tar.
    raw = git(args.repo, "-c", "tar.umask=0022", "archive", "--format=tar",
              f"--prefix=mattpocock-skills-{args.source}/", args.source)
    require(len(raw) <= MAX_BYTES, "source tar exceeds size limit")
    with target.open("xb") as stream:
        run_checked(["gzip", "-n"], input=raw, stdout=stream)
    require(sha256(target.read_bytes()) == args.source_sha256, "source tar SHA-256 mismatch")


def verify_icon(args, temp, icon):
    if icon != "assets/wayfinder.svg":
        return None
    root = temp / "icon"
    for path in ("assets/wayfinder-source.svg", icon):
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob(args.repo, args.source, path))
    script = root / "scripts/build-wayfinder-icon.py"
    script.parent.mkdir()
    checker = CHECKER.read_bytes()
    script.write_bytes(checker)
    run_checked([sys.executable, "-I", script, "--check"])
    return {"checker_sha256": sha256(checker), "verified": True,
            "source_sha256": sha256((root / "assets/wayfinder-source.svg").read_bytes()),
            "icon_sha256": sha256((root / icon).read_bytes())}


def build(args, name):
    started = time.monotonic()
    builder = blob(args.repo, BUILDER_REVISION, BUILDER_PATH)
    require(sha256(builder) == BUILDER_SHA256, "reviewed builder digest differs")
    require(sha256(blob(args.repo, BUILDER_REVISION, PROCEDURE_PATH)) == PROCEDURE_SHA256,
            "reviewed procedure digest differs")
    # Reserve the output once. A failed or interrupted run has no passing receipt.
    args.output.mkdir()
    with tempfile.TemporaryDirectory(prefix="release-archive-provenance-") as directory:
        temp = Path(directory)
        tar = temp / "source.tar.gz"
        materialize_tar(args, tar)
        script = temp / "builder.py"
        script.write_bytes(builder)
        first, second = temp / "first", temp / "second"
        for out in (first, second):
            out.mkdir()
            run_checked([sys.executable, "-I", "-c", BUILD, script, tar, args.source_sha256,
                         args.source, args.base, args.release, out])
        names = {fmt: f"{name}-{args.release}-{fmt}.zip" for fmt in FORMATS}
        expected = {*names.values(), "report.json"}
        require(all({p.name for p in out.iterdir()} == expected for out in (first, second)),
                "unexpected builder outputs")
        for item in sorted(expected):
            require((first / item).read_bytes() == (second / item).read_bytes(),
                    "build outputs differ")
        archives = {
            fmt: verify_archive(args.repo, args.source, args.source_sha256, args.base,
                                args.release, fmt, first / filename)
            for fmt, filename in names.items()
        }
        icon = verify_icon(args, temp, archives["claude"]["icon"])
        report_digest = sha256((first / "report.json").read_bytes())
        for item in sorted(expected):
            (args.output / item).write_bytes((first / item).read_bytes())

    receipt = {
        "status": "passed", "source": args.source, "upstream": args.upstream,
        "base": args.base, "release": args.release, "source_tar_sha256": args.source_sha256,
        "builder_revision": BUILDER_REVISION, "procedure_revision": BUILDER_REVISION, "procedure_sha256": PROCEDURE_SHA256,
        "builder_sha256": BUILDER_SHA256,
        "runner_sha256": sha256(Path(__file__).read_bytes()),
        "verifier_sha256": sha256((HERE / "verify_release_archive.py").read_bytes()),
        "toolchain": {"python": sys.version.split()[0], "pyyaml": yaml.__version__,
                      "git": git(args.repo, "--version").decode().strip(),
                      "gzip": subprocess.check_output(["gzip", "--version"], timeout=10).decode().splitlines()[0]},
        "archives": archives, "builder_report_sha256": report_digest, "icon_derivation": icon,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "cleanup": "temporary build directory removed",
    }
    pending = args.output / "receipt.pending"
    with pending.open("x") as stream:
        json.dump(receipt, stream, indent=2, sort_keys=True)
        stream.write("\n")
    pending.rename(args.output / "receipt.json")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    common = argparse.ArgumentParser(add_help=False)
    for flag in ("repo", "source", "source-sha256", "upstream", "base", "release"):
        common.add_argument("--" + flag, required=True)
    sub = parser.add_subparsers(dest="action", required=True)
    builder = sub.add_parser("build", parents=[common])
    builder.add_argument("--output", required=True, type=Path)
    verifier = sub.add_parser("verify", parents=[common])
    verifier.add_argument("--format", choices=FORMATS, required=True)
    verifier.add_argument("--archive", type=Path, required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    name = bind(args)
    if args.action == "build":
        build(args, name)
    else:
        print(json.dumps(verify_archive(args.repo, args.source, args.source_sha256, args.base,
                                        args.release, args.format, args.archive), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, BadZipFile, OverflowError) as error:
        sys.exit(f"Archive provenance check failed: {error}")
