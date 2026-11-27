import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import test from "node:test";

// Review all destination construction and filesystem writes before updating this digest.
const linkerDigest = "8076cf2acfd7a9adc40e7df13f04f42a27e9330d12f4339ce8a3dd8f4586e2cf";

function resolveDestination(path, symlinksRemaining = 40) {
  try {
    return realpathSync.native(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = resolveDestination(dirname(path), symlinksRemaining);
    const entry = join(parent, basename(path));
    if (!lstatSync(entry, { throwIfNoEntry: false })?.isSymbolicLink()) return entry;

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

function snapshot(path) {
  const stat = lstatSync(path);
  const { ino, mode, ctimeMs } = stat;
  const metadata = { ino, mode, ctimeMs };
  if (stat.isSymbolicLink()) {
    return { ...metadata, target: readlinkSync(path) };
  }
  if (stat.isDirectory()) {
    const contents = readdirSync(path).sort().map((name) => [
      name, snapshot(join(path, name)),
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
  assert.match(result.stderr, /destination symlink into this checkout/);
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
      assert.match(result.stderr, /destination symlink/);
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
