"""Deposit verified release archives in a distribution folder by reflink clone only.

Each archive is cloned with the Linux FICLONE ioctl into a name the tool creates
exclusively in the folder. No code path copies archive bytes: when the clone is
refused, the archive is reported as not made and nothing is left at its name.
"""

import argparse
import errno
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path

from verify_release_archive import EDITIONS, FORMATS

# _IOW(0x94, 9, int) from linux/fs.h; the fcntl module names it only from Python 3.12.
FICLONE = 0x40049409
NAME = re.compile(r"(?:{})-[^/\x00-\x1f\x7f]+-(?:{})\.zip".format(
    "|".join(map(re.escape, sorted(EDITIONS))), "|".join(map(re.escape, FORMATS))))
DIGEST = re.compile(r"[0-9a-f]{64}")
DEPOSITED, PRESENT, NOT_MADE = "deposited", "already present", "not made"


class NotRegular(Exception):
    """The entry at a name is not a regular file."""


def ficlone(source_fd, target_fd):
    """Share the source's extents with the target; raise OSError when refused."""
    if not sys.platform.startswith("linux"):
        raise OSError(errno.EOPNOTSUPP, "FICLONE is available only on Linux")
    import fcntl
    fcntl.ioctl(target_fd, FICLONE, source_fd)


def describe(error):
    if error.errno in errno.errorcode:
        return f"{os.strerror(error.errno)} [{errno.errorcode[error.errno]}]"
    return str(error)


def result(status, name, digest, reason=None):
    return {"status": status, "name": name, "sha256": digest, "reason": reason}


def line(entry):
    text = f"{entry['status']}: {entry['name']} sha256={entry['sha256']}"
    return text + (f" ({entry['reason']})" if entry["reason"] else "")


def digest_fd(fd):
    hasher = hashlib.sha256()
    os.lseek(fd, 0, os.SEEK_SET)
    while chunk := os.read(fd, 1 << 20):
        hasher.update(chunk)
    return hasher.hexdigest()


def open_regular(path, dir_fd=None):
    """Open a regular file for reading without following a symbolic link."""
    try:
        if not stat.S_ISREG(os.stat(path, dir_fd=dir_fd, follow_symlinks=False).st_mode):
            raise NotRegular
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
                     dir_fd=dir_fd)
    except OSError as error:
        if error.errno == errno.ELOOP:
            raise NotRegular from None
        raise
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise NotRegular
    return fd


def existing(name, digest, folder_fd):
    """Judge an entry already at the name; never change it."""
    try:
        fd = open_regular(name, dir_fd=folder_fd)
    except NotRegular:
        return result(NOT_MADE, name, digest, "an entry that is not a regular file is at that name")
    except FileNotFoundError:
        return result(NOT_MADE, name, digest, "the entry at that name changed during the deposit")
    try:
        present = digest_fd(fd)
    finally:
        os.close(fd)
    if present == digest:
        return result(PRESENT, name, digest)
    return result(NOT_MADE, name, digest,
                  f"a different file is at that name, sha256={present}; it was left untouched")


def withdraw(name, digest, folder_fd, target_fd, reason):
    """Remove the file this call created at the name, and nothing else."""
    created = os.fstat(target_fd)
    try:
        current = os.stat(name, dir_fd=folder_fd, follow_symlinks=False)
    except FileNotFoundError:
        current = None
    if current is not None and (current.st_dev, current.st_ino) == (created.st_dev, created.st_ino):
        os.unlink(name, dir_fd=folder_fd)
    elif current is not None:
        reason += "; the entry at that name changed and was left in place"
    return result(NOT_MADE, name, digest, reason)


def place(source_fd, name, digest, folder_fd, clone):
    try:
        os.stat(name, dir_fd=folder_fd, follow_symlinks=False)
    except FileNotFoundError:
        pass
    else:
        return existing(name, digest, folder_fd)
    flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC
    try:
        target_fd = os.open(name, flags, 0o644, dir_fd=folder_fd)
    except FileExistsError:
        # An entry appeared between the look and the write: judge it, never replace it.
        return existing(name, digest, folder_fd)
    try:
        try:
            clone(source_fd, target_fd)
        except OSError as error:
            return withdraw(name, digest, folder_fd, target_fd,
                            f"the clone was refused: {describe(error)}")
        try:
            deposited = digest_fd(target_fd)
        except OSError as error:
            return withdraw(name, digest, folder_fd, target_fd,
                            f"the deposited file could not be read back: {describe(error)}")
        if deposited != digest:
            return withdraw(name, digest, folder_fd, target_fd,
                            f"the deposited bytes hash to {deposited}, not the verified digest")
        return result(DEPOSITED, name, digest)
    except BaseException:
        withdraw(name, digest, folder_fd, target_fd, "interrupted")
        raise
    finally:
        os.close(target_fd)


def deposit_one(path, digest, folder_fd, clone):
    name = path.name
    if not NAME.fullmatch(name):
        return result(NOT_MADE, name, digest,
                      "the name is not <plugin>-<version>-<claude|agent-plugins>.zip "
                      "for a known plugin")
    if not DIGEST.fullmatch(digest):
        return result(NOT_MADE, name, digest, "the verified digest is not a lowercase SHA-256")
    try:
        source_fd = open_regular(path)
    except NotRegular:
        return result(NOT_MADE, name, digest, "the archive is not a regular file")
    try:
        if digest_fd(source_fd) != digest:
            return result(NOT_MADE, name, digest, "the archive does not match its verified digest")
        return place(source_fd, name, digest, folder_fd, clone)
    finally:
        os.close(source_fd)


def deposit(archives, folder, clone=ficlone):
    """Apply the deposit rule to each (path, verified SHA-256) pair, one result each."""
    archives = [(Path(path), digest) for path, digest in archives]
    try:
        folder_fd = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    except OSError as error:
        reason = f"the distribution folder is missing or is not a directory: {describe(error)}"
        return [result(NOT_MADE, path.name, digest, reason) for path, digest in archives]
    results, seen = [], set()
    try:
        for path, digest in archives:
            if path.name in seen:
                results.append(result(NOT_MADE, path.name, digest,
                                      "the same name was given more than once"))
                continue
            seen.add(path.name)
            try:
                results.append(deposit_one(path, digest, folder_fd, clone))
            except OSError as error:
                results.append(result(NOT_MADE, path.name, digest, describe(error)))
    finally:
        os.close(folder_fd)
    return results


def receipt_archives(path):
    """List the archives and digests a passed provenance receipt verified."""
    receipt = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(receipt, dict):
        raise ValueError("not a passed provenance receipt")
    entries = receipt.get("archives")
    if (receipt.get("status") != "passed" or not isinstance(receipt.get("release"), str)
            or not isinstance(entries, dict) or not entries
            or not all(isinstance(entry, dict) and isinstance(entry.get("name"), str)
                       and isinstance(entry.get("sha256"), str) for entry in entries.values())):
        raise ValueError("not a passed provenance receipt")
    return [(path.parent / f"{entry['name']}-{receipt['release']}-{fmt}.zip", entry["sha256"])
            for fmt, entry in sorted(entries.items())]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--folder", required=True, type=Path,
                        help="existing distribution folder; never created")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--archive", nargs=2, action="append", metavar=("SHA256", "PATH"),
                        help="a verified archive and the digest its build verified")
    source.add_argument("--receipt", type=Path,
                        help="the receipt of a passed local provenance build")
    args = parser.parse_args(argv)
    if args.receipt:
        try:
            archives = receipt_archives(args.receipt)
        except (OSError, ValueError) as error:
            parser.error(f"--receipt: {error}")
    else:
        archives = [(path, digest) for digest, path in args.archive]
    results = deposit(archives, args.folder)
    for entry in results:
        print(line(entry))
    return 0 if all(entry["status"] != NOT_MADE for entry in results) else 1


if __name__ == "__main__":
    sys.exit(main())
