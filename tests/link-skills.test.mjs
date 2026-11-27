import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import test from "node:test";

// Review all destination construction and filesystem writes before updating this digest.
const linkerDigest = "ac25f7280e72cd2221ccd12f3382f6b508c8b417dab16b737839bbc08d1149f8";

function resolveDestination(path, symlinksRemaining = 40) {
  try {
    return realpathSync.native(path);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    const parent = resolveDestination(dirname(path), symlinksRemaining);
    const entry = join(parent, basename(path));
    try {
      if (!lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) return entry;
    } catch (error) {
      if (error.code === "ENOTDIR") return entry;
      throw error;
    }

    assert.ok(symlinksRemaining > 0, `Too many symlinks in destination: ${path}`);
    const target = readlinkSync(entry);
    const namedPath = isAbsolute(target) ? target : `${parent}${sep}${target}`;
    return resolveDestination(namedPath, symlinksRemaining - 1);
  }
}

function fixture(t, launch = spawnSync) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "link-skills-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = mkdtempSync(join(root, "home-"));
  assert.deepEqual(readdirSync(home), []);
  const checkout = join(home, "checkout");
  const script = join(checkout, "scripts/link-skills.sh");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(new URL("../scripts/link-skills.sh", import.meta.url), script);

  function skill(path) {
    const directory = join(checkout, "skills", path);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), "# Stub skill\n");
    return directory;
  }

  const alpha = skill("engineering/alpha");
  const beta = skill("in-progress/beta");
  const claude = join(home, ".claude/skills");
  const agents = join(home, ".agents/skills");

  function checkDestinations(env) {
    assert.equal(env.HOME, home, "The linker fixture requires its fresh temporary HOME");
    assert.equal(realpathSync(env.HOME), home, "Temporary HOME must resolve to itself");
    assert.notEqual(env.HOME, userInfo().homedir);
    assert.notEqual(env.HOME, process.env.HOME);
    for (const destination of [claude, agents]) {
      const fromHome = relative(home, resolveDestination(destination));
      assert.ok(fromHome !== ".." && !fromHome.startsWith(`..${sep}`) && !isAbsolute(fromHome),
        `Destination resolves outside temporary HOME: ${destination}`);
    }
  }

  return {
    root, home, checkout, script, alpha, beta, claude, agents, skill,
    run({ env = { HOME: home, PATH: process.env.PATH }, entrypoint = script } = {}) {
      checkDestinations(env);
      assert.equal(realpathSync(entrypoint), script);
      const digest = createHash("sha256").update(readFileSync(entrypoint)).digest("hex");
      assert.equal(digest, linkerDigest, "Refusing to launch unverified linker source");
      const result = launch("bash", [entrypoint], {
        cwd: checkout, env, encoding: "utf8",
      });
      checkDestinations(env);
      assert.ifError(result.error);
      return result;
    },
  };
}

test("the launcher refuses any byte change to the copied script", (t) => {
  const f = fixture(t, () => assert.fail("The script must never start"));
  const source = readFileSync(f.script, "utf8");
  const hardcoded = source.replace("$HOME/.agents/skills", join(f.root, "outside"));
  assert.notEqual(hardcoded, source);
  for (const changed of [hardcoded, source + "\n"]) {
    writeFileSync(f.script, changed);
    assert.throws(() => f.run(), /Refusing to launch unverified linker source/);
  }
});

test("the launcher refuses an unset or empty HOME", (t) => {
  const f = fixture(t, () => assert.fail("The script must never start"));
  assert.throws(() => f.run({ env: {} }), /requires its fresh temporary HOME/);
  assert.throws(() => f.run({ env: { HOME: "" } }), /requires its fresh temporary HOME/);
});

test("the launcher refuses a destination behind an escaping parent symlink", (t) => {
  const f = fixture(t, () => assert.fail("The script must never start"));
  const outside = join(f.root, "outside");
  mkdirSync(outside);
  symlinkSync(outside, dirname(f.claude));

  assert.throws(() => f.run(), /Destination resolves outside temporary HOME/);
});

test("the launcher refuses a dangling destination that names a path outside HOME", (t) => {
  const f = fixture(t, () => assert.fail("The script must never start"));
  mkdirSync(dirname(f.agents));
  symlinkSync(relative(dirname(f.agents), join(f.root, "outside/missing")), f.agents);

  assert.throws(() => f.run(), /Destination resolves outside temporary HOME/);
});

test("the launcher rejects a result that leaves a destination outside HOME", (t) => {
  const f = fixture(t, () => {
    mkdirSync(dirname(f.agents));
    symlinkSync(outside, f.agents);
    return { status: 0 };
  });
  const outside = join(f.root, "outside");
  mkdirSync(outside);

  assert.throws(() => f.run(), /Destination resolves outside temporary HOME/);
});

function snapshot(path, excludeContentsOf = []) {
  const stat = lstatSync(path);
  const { ino, mode, ctimeMs } = stat;
  const metadata = { ino, mode, ctimeMs };
  if (stat.isSymbolicLink()) {
    return { ...metadata, target: readlinkSync(path) };
  }
  if (stat.isDirectory()) {
    if (excludeContentsOf.includes(path)) return { ino, mode };
    const contents = readdirSync(path).sort().map((name) => [
      name, snapshot(join(path, name), excludeContentsOf),
    ]);
    return { ...metadata, contents };
  }
  if (stat.isFile()) {
    return { ...metadata, contents: readFileSync(path) };
  }
  return metadata;
}

test("a file conflict leaves the whole home unchanged, including the absent first destination", (t) => {
  const f = fixture(t);
  mkdirSync(f.agents, { recursive: true });
  const conflict = join(f.agents, "beta");
  writeFileSync(conflict, "keep this skill\n");
  const before = snapshot(f.home);

  const result = f.run();

  assert.deepEqual(snapshot(f.home), before);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stderr.includes(conflict), result.stderr);
  assert.match(result.stderr, /regular file/);
  assert.match(result.stderr, /nothing was changed/i);
});

test("all conflicting paths and their kinds are reported before any link is changed", (t) => {
  const f = fixture(t);
  const directory = join(f.claude, "alpha");
  const external = join(f.claude, "beta");
  const dangling = join(f.agents, "alpha");
  mkdirSync(directory, { recursive: true });
  mkdirSync(f.agents, { recursive: true });
  writeFileSync(join(directory, "keep.txt"), "keep this directory\n");
  symlinkSync(directory, external);
  symlinkSync("missing", dangling);
  symlinkSync(join(f.checkout, "retired-beta"), join(f.agents, "beta"));
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  const lines = result.stderr.trim().split("\n");
  assert.equal(lines.length, 4, result.stderr);
  for (const [path, kind] of [[directory, "directory"], [external, "symlink"], [dangling, "symlink"]]) {
    const line = lines.find((entry) => entry.includes(path));
    assert.ok(line?.includes(kind), result.stderr);
  }
  assert.match(lines.at(-1), /nothing was changed/i);
});

test("destinations that share a directory check and link each skill once", async (t) => {
  await t.test("an incumbent produces one conflict line", (t) => {
    const f = fixture(t);
    mkdirSync(f.claude, { recursive: true });
    mkdirSync(dirname(f.agents));
    symlinkSync(f.claude, f.agents);
    const incumbent = join(f.claude, "alpha");
    writeFileSync(incumbent, "keep this skill\n");
    const before = snapshot(f.home);

    const result = f.run();

    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(snapshot(f.home), before);
    assert.deepEqual(result.stderr.trim().split("\n"), [
      `error: ${incumbent} is a regular file.`,
      "Nothing was changed.",
    ]);
  });

  await t.test("a clear directory receives one link per name", (t) => {
    const f = fixture(t);
    mkdirSync(f.claude, { recursive: true });
    mkdirSync(dirname(f.agents));
    symlinkSync(f.claude, f.agents);

    const result = f.run();

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split("\n").sort(), [
      `linked alpha -> ${f.alpha} (${f.claude})`,
      `linked beta -> ${f.beta} (${f.claude})`,
    ]);
    assert.equal(realpathSync(join(f.claude, "alpha")), f.alpha);
    assert.equal(realpathSync(join(f.claude, "beta")), f.beta);
  });
});

test("an existing entry of another filesystem kind is preserved and reported", (t) => {
  const f = fixture(t);
  mkdirSync(f.claude, { recursive: true });
  const conflict = join(f.claude, "alpha");
  const fifo = spawnSync("mkfifo", [conflict], { encoding: "utf8" });
  assert.ifError(fifo.error);
  assert.equal(fifo.status, 0, fifo.stderr);
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(conflict), result.stderr);
  assert.match(result.stderr, /another kind of filesystem entry/);
});

test("absent entries and checkout links, including a dangling relative link, are linked", (t) => {
  const f = fixture(t);
  f.skill("misc/ignored");
  mkdirSync(f.claude, { recursive: true });
  symlinkSync(f.beta, join(f.claude, "alpha"));
  const staleTarget = relative(f.claude, join(f.checkout, "skills/missing/old-beta"));
  symlinkSync(staleTarget, join(f.claude, "beta"));

  const result = f.run();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  for (const dest of [f.claude, f.agents]) {
    assert.deepEqual(readdirSync(dest).sort(), ["alpha", "beta"]);
    assert.equal(readlinkSync(join(dest, "alpha")), f.alpha);
    assert.equal(readlinkSync(join(dest, "beta")), f.beta);
  }

  const second = f.run();

  assert.equal(second.status, 0, second.stderr);
  for (const dest of [f.claude, f.agents]) {
    assert.equal(realpathSync(join(dest, "alpha")), f.alpha);
    assert.equal(realpathSync(join(dest, "beta")), f.beta);
  }
});

test("links from an upstream run through a symlinked checkout path are refreshed", (t) => {
  const f = fixture(t);
  const alias = join(f.home, "checkout-alias");
  symlinkSync(f.checkout, alias);
  const alpha = join(alias, relative(f.checkout, f.alpha));
  const beta = join(alias, relative(f.checkout, f.beta));
  for (const dest of [f.claude, f.agents]) {
    mkdirSync(dest, { recursive: true });
    symlinkSync(beta, join(dest, "alpha"));
    symlinkSync(alpha, join(dest, "beta"));
  }

  const result = f.run({ entrypoint: join(alias, "scripts/link-skills.sh") });

  assert.equal(result.status, 0, result.stderr);
  for (const dest of [f.claude, f.agents]) {
    assert.equal(readlinkSync(join(dest, "alpha")), alpha);
    assert.equal(readlinkSync(join(dest, "beta")), beta);
    assert.equal(realpathSync(join(dest, "alpha")), f.alpha);
    assert.equal(realpathSync(join(dest, "beta")), f.beta);
  }
});

test("an aliased rerun refreshes links from a direct run", (t) => {
  const f = fixture(t);
  const alias = join(f.home, "checkout-alias");
  symlinkSync(f.checkout, alias);
  const direct = f.run();
  assert.equal(direct.status, 0, direct.stderr);
  for (const dest of [f.claude, f.agents]) {
    assert.equal(readlinkSync(join(dest, "alpha")), f.alpha);
    assert.equal(readlinkSync(join(dest, "beta")), f.beta);
  }

  const aliased = f.run({ entrypoint: join(alias, "scripts/link-skills.sh") });

  assert.equal(aliased.status, 0, aliased.stderr);
  for (const dest of [f.claude, f.agents]) {
    assert.equal(readlinkSync(join(dest, "alpha")), join(alias, relative(f.checkout, f.alpha)));
    assert.equal(readlinkSync(join(dest, "beta")), join(alias, relative(f.checkout, f.beta)));
  }
});

test("a symlink into another checkout is a conflict even when the paths share a prefix", (t) => {
  const f = fixture(t);
  const otherSkill = join(f.home, "checkout-other/skills/engineering/alpha");
  mkdirSync(otherSkill, { recursive: true });
  writeFileSync(join(otherSkill, "SKILL.md"), "# Other checkout stub skill\n");
  mkdirSync(f.agents, { recursive: true });
  const conflict = join(f.agents, "alpha");
  symlinkSync(otherSkill, conflict);
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(conflict), result.stderr);
});

test("a skill link naming an external alias to the checkout is a conflict", (t) => {
  const f = fixture(t);
  const alias = join(f.root, "alias");
  symlinkSync(f.checkout, alias);
  mkdirSync(f.agents, { recursive: true });
  const conflict = join(f.agents, "alpha");
  symlinkSync(join(alias, "skills/engineering/alpha"), conflict);
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(conflict), result.stderr);
});

test("relative skill links start from a destination symlink's directory outside the checkout", (t) => {
  const f = fixture(t);
  const actual = join(f.home, "custom/nested/skills");
  const alias = join(f.checkout, "destination-alias");
  mkdirSync(actual, { recursive: true });
  mkdirSync(dirname(f.claude), { recursive: true });
  symlinkSync(actual, alias);
  symlinkSync(alias, f.claude);
  symlinkSync(relative(actual, f.beta), join(actual, "alpha"));

  const result = f.run();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readlinkSync(f.claude), alias);
  assert.equal(readlinkSync(join(actual, "alpha")), f.alpha);
});

test("an unsupported live destination chain preserves the checkout and refuses a rerun", (t) => {
  const f = fixture(t);
  const checked = join(f.home, "other-skills");
  mkdirSync(checked);
  const alias = join(f.checkout, "destination-alias");
  symlinkSync(checked, alias);
  mkdirSync(f.claude, { recursive: true });
  symlinkSync(alias, join(f.claude, "alpha"));
  mkdirSync(dirname(f.agents));
  symlinkSync(join(f.claude, "alpha"), f.agents);
  writeFileSync(join(f.alpha, "beta"), "keep this checkout file\n");
  const checkoutBefore = snapshot(f.checkout);
  const checkedDestinations = [f.claude, checked];
  const outsideBefore = snapshot(f.root, checkedDestinations);

  const result = f.run();

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(f.checkout), checkoutBefore);
  assert.deepEqual(snapshot(f.root, checkedDestinations), outsideBefore);
  assert.equal(realpathSync(join(f.claude, "alpha")), f.alpha);
  assert.deepEqual(readdirSync(checked).sort(), ["alpha", "beta"]);
  assert.equal(realpathSync(join(checked, "alpha")), f.alpha);
  assert.equal(realpathSync(join(checked, "beta")), f.beta);

  const beforeRerun = snapshot(f.home);
  const rerun = f.run();

  assert.equal(rerun.status, 1, rerun.stderr);
  assert.deepEqual(snapshot(f.home), beforeRerun);
  assert.ok(rerun.stderr.includes(f.agents), rerun.stderr);
  assert.match(rerun.stderr, /nothing was changed/i);
});

test("a destination symlink into the checkout stops all writes", (t) => {
  const f = fixture(t);
  const alias = join(f.home, "checkout-alias");
  symlinkSync(f.checkout, alias);
  mkdirSync(dirname(f.agents), { recursive: true });
  symlinkSync(join(f.checkout, "skills"), f.agents);
  const before = snapshot(f.home);
  const checkoutBefore = snapshot(f.checkout);

  const result = f.run({ entrypoint: join(alias, "scripts/link-skills.sh") });

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.deepEqual(snapshot(f.checkout), checkoutBefore);
  assert.ok(result.stderr.includes(f.agents), result.stderr);
  assert.match(result.stderr, /writable, searchable directory outside this checkout/);
  assert.match(result.stderr, /nothing was changed/i);
  assert.equal(result.stderr.trim().split("\n").length, 2, result.stderr);
});

test("a dangling destination cannot become a link into the checkout during the run", async (t) => {
  for (const parentExists of [true, false]) {
    await t.test(parentExists ? "target parent exists" : "target parent is missing", (t) => {
      const f = fixture(t);
      if (parentExists) mkdirSync(f.claude, { recursive: true });
      mkdirSync(dirname(f.agents));
      symlinkSync(join(f.claude, "alpha"), f.agents);
      writeFileSync(join(f.alpha, "beta"), "keep this checkout file\n");
      const before = snapshot(f.home);
      const checkoutBefore = snapshot(f.checkout);

      const result = f.run();

      assert.equal(result.status, 1, result.stderr);
      assert.deepEqual(snapshot(f.home), before);
      assert.deepEqual(snapshot(f.checkout), checkoutBefore);
      assert.ok(result.stderr.includes(f.agents), result.stderr);
      assert.match(result.stderr, /writable, searchable directory outside this checkout/);
      assert.match(result.stderr, /nothing was changed/i);
    });
  }
});

test("a destination that is a regular file stops all writes, including the absent destination", (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.agents));
  writeFileSync(f.agents, "keep this file\n");
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(f.agents), result.stderr);
  assert.match(result.stderr, /writable, searchable directory/);
  assert.match(result.stderr, /nothing was changed/i);
});

test("a dangling destination parent stops all writes", (t) => {
  const f = fixture(t);
  symlinkSync(join(f.claude, "alpha"), dirname(f.agents));
  const before = snapshot(f.home);
  const checkoutBefore = snapshot(f.checkout);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.deepEqual(snapshot(f.checkout), checkoutBefore);
  assert.ok(result.stderr.includes(f.agents), result.stderr);
  assert.match(result.stderr, /nothing was changed/i);
});

test("a regular file at the destination parent stops all writes", (t) => {
  const f = fixture(t);
  writeFileSync(dirname(f.agents), "keep this file\n");
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(f.agents), result.stderr);
  assert.match(result.stderr, /nothing was changed/i);
});

test("a searchable read-only destination still reports each conflicting skill", {
  skip: process.getuid() === 0 && "requires a non-root user",
}, (t) => {
  const f = fixture(t);
  mkdirSync(f.agents, { recursive: true });
  const file = join(f.agents, "alpha");
  const directory = join(f.agents, "beta");
  writeFileSync(file, "keep this file\n");
  mkdirSync(directory);
  chmodSync(f.agents, 0o555);
  try {
    const before = snapshot(f.home);
    const result = f.run();

    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(snapshot(f.home), before);
    const lines = result.stderr.trim().split("\n");
    for (const [path, kind] of [[f.agents, "writable, searchable directory"], [file, "regular file"], [directory, "directory"]]) {
      assert.ok(lines.some((line) => line.includes(path) && line.includes(kind)), result.stderr);
    }
    assert.match(result.stderr, /nothing was changed/i);
  } finally {
    chmodSync(f.agents, 0o755);
  }
});

test("a new skill link cannot occupy a path needed for a missing destination", (t) => {
  const f = fixture(t);
  f.skill("engineering/skills");
  mkdirSync(f.claude, { recursive: true });
  symlinkSync(f.claude, dirname(f.agents));
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(join(f.claude, "skills")), result.stderr);
  assert.match(result.stderr, /nothing was changed/i);
});

test("a trailing newline stays part of a skill link's named target", (t) => {
  const f = fixture(t);
  mkdirSync(f.agents, { recursive: true });
  const conflict = join(f.agents, "alpha");
  symlinkSync(`${f.checkout}\n`, conflict);
  const before = snapshot(f.home);

  const result = f.run();

  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(snapshot(f.home), before);
  assert.ok(result.stderr.includes(conflict), result.stderr);
});
