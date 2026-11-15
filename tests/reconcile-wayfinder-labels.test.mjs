import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repo, "scripts/reconcile-wayfinder-labels.mjs");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const issue = (number, labels, extra = {}) => ({ number, url: `https://api.github.com/repos/nisavid/real-skills/issues/${number}`, html_url: `https://github.com/nisavid/real-skills/issues/${number}`, labels: labels.map((name) => ({ name })), ...extra });

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "label-repair-offline-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = join(root, "project");
  mkdirSync(join(project, "scripts"), { recursive: true });
  mkdirSync(join(project, ".github/workflows"), { recursive: true });
  writeFileSync(join(project, "scripts/reconcile-wayfinder-labels.mjs"), readFileSync(cli));
  writeFileSync(join(project, ".github/workflows/wayfinder-label-repair.yml"), readFileSync(join(repo, ".github/workflows/wayfinder-label-repair.yml")));
  const gitEnv = { PATH: "/usr/bin:/bin", HOME: root, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Synthetic", GIT_AUTHOR_EMAIL: "synthetic@example.invalid", GIT_COMMITTER_NAME: "Synthetic", GIT_COMMITTER_EMAIL: "synthetic@example.invalid" };
  for (const args of [["init", "--initial-branch=main"], ["add", "."], ["commit", "-m", "synthetic fixture"]]) {
    const r = spawnSync("git", args, { cwd: project, env: gitEnv, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: project, env: gitEnv, encoding: "utf8" }).stdout.trim();
  const implementation = { source_revision: revision, manifest: Object.fromEntries(["scripts/reconcile-wayfinder-labels.mjs", ".github/workflows/wayfinder-label-repair.yml"].map((path) => [path, digest(readFileSync(join(project, path)))])) };
  const policy = "Wayfinder issues carry no triage labels.\n";
  const control = { schema_version: 1, generation: 1, mode: "inspect", workflow_id: null,
    writer_coverage: "unqualified", policy: [{ path: "docs/agents/issue-tracker.md", sha256: digest(policy) }],
    authorized_implementations: [], fixture_issue_numbers: [], ...options.control };
  if (options.qualified) Object.assign(control, { mode: "apply", workflow_id: 123, writer_coverage: "qualified", authorized_implementations: [implementation], fixture_issue_numbers: options.fixtureNumbers ?? [2], operating_interval: options.evidence ?? attestation() });
  const state = { control, policy, implementationFiles: Object.fromEntries(Object.keys(implementation.manifest).map((path) => [path, readFileSync(join(project, path)).toString("base64")])), commit: "a".repeat(40), issues: options.issues ?? [], calls: [], ...options.state };
  writeFileSync(join(root, "state.json"), JSON.stringify(state));
  const transport = join(root, "transport.mjs");
  writeFileSync(transport, `#!${process.execPath}
import { readFileSync, writeFileSync } from "node:fs";
const file = ${JSON.stringify(join(root, "state.json"))};
const s = JSON.parse(readFileSync(file));
const q = JSON.parse(readFileSync(0, "utf8"));
s.calls.push(q);
let status = 200, body;\nlet headers = {};
const prefix = "/repos/nisavid/real-skills";
if (s.failPath && q.path.includes(s.failPath)) { status = 503; body = { message: "synthetic unavailable" }; }\nelse if (q.path === prefix) body = { id: s.repositoryId ?? 1409103617, full_name: "nisavid/real-skills", default_branch: "main" };
else if (q.path === prefix + "/git/ref/heads/main") {\n s.authorityReads = (s.authorityReads ?? 0) + 1;\n if (s.changeAuthorityAfter && s.authorityReads > s.changeAuthorityAfter) s.control.generation++;\n body = { object: { type: "commit", sha: s.commit } };\n}
else if (q.path.startsWith(prefix + "/contents/")) {
 const path = q.path.slice((prefix + "/contents/").length).split("?")[0];
 const ref = new URL("https://api.github.com" + q.path).searchParams.get("ref");
 const workflowContent = path === ".github/workflows/wayfinder-label-repair.yml" ? s.workflowFilesByRevision?.[ref] : undefined;
 const content = workflowContent ?? (path === ".github/wayfinder-label-repair-control.json" ? JSON.stringify(s.control) : s.implementationFiles[path] ? Buffer.from(s.implementationFiles[path], "base64").toString("utf8") : s.policy);
 body = { type: "file", encoding: "base64", content: Buffer.from(content).toString("base64") };
}
else if (q.path === prefix + "/actions/workflows/123") body = { id: 123, path: ".github/workflows/wayfinder-label-repair.yml", state: s.workflowState ?? "active" };\nelse if (q.path.startsWith(prefix + "/actions/workflows/123/runs?")) body = { total_count: (s.runs ?? []).length, workflow_runs: s.runs ?? [] };\nelse if (q.path.includes("/attempts/")) {\n const parts = q.path.split("/");\n const run = (s.runs ?? []).find((r) => r.id === Number(parts.at(-3)));\n body = run ? { ...run, run_attempt: Number(parts.at(-1)) } : null;\n if (!body) status = 404;\n}\nelse if (q.path.includes("/artifacts?")) {\n const run = Number(q.path.split("/").at(-2));\n const artifacts = (s.artifacts ?? []).filter((a) => a.run_id === run);\n body = { total_count: artifacts.length, artifacts };\n}\nelse if (q.path.endsWith("/zip")) {\n const artifact = (s.artifacts ?? []).find((a) => a.id === Number(q.path.split("/").at(-2)));\n body = artifact ? { archive_base64: artifact.archive_base64 } : null;\n if (!body) status = 404;\n}\nelse if (q.method === "DELETE") {\n status = s.deleteStatus ?? 200;\n const number = Number(q.path.split("/").at(-3));\n const row = s.issues.find((i) => i.number === number);\n if (row && s.removeOnDelete !== false) row.labels = row.labels.filter((label) => label.name !== "needs-triage");\n body = status === 200 ? (row?.labels ?? []) : { message: "synthetic error" };\n if (s.disconnectDelete) { writeFileSync(file, JSON.stringify(s)); process.exit(75); }\n}\nelse if (q.path.startsWith(prefix + "/issues?")) {\n const page = Number(new URL("https://api.github.com" + q.path).searchParams.get("page"));\n body = s.pages ? (s.pages[page - 1] ?? []) : s.issues;\n if (s.pages && page < s.pages.length) headers.link = '<https://api.github.com' + q.path.replace('&page=' + page, '&page=' + (page + 1)) + '>; rel="next"';\n}
else if (q.path.startsWith(prefix + "/issues/") && Number.isSafeInteger(Number(q.path.split("/").at(-1)))) {\n const number = Number(q.path.split("/").at(-1));\n s.issueReads ??= {}; s.issueReads[number] = (s.issueReads[number] ?? 0) + 1;\n body = s.issues.find((i) => i.number === number);\n if (s.addUnknownOnReread && s.issueReads[number] === 2) body.labels.push({ name: "wayfinder:future" });\n}
else { status = 404; body = { message: "synthetic missing route" }; }
writeFileSync(file, JSON.stringify(s));
process.stdout.write(JSON.stringify({ status, headers, body }));
`);
  chmodSync(transport, 0o700);
  function run(command = "inspect", args = [], env = {}) {
    if (env.GITHUB_RUN_ID) update((state) => {
      state.runs ??= [];
      const run = { id: Number(env.GITHUB_RUN_ID), workflow_id: 123, run_attempt: Number(env.GITHUB_RUN_ATTEMPT), status: "in_progress", conclusion: null, created_at: "2026-11-15T00:00:00Z" };
      const index = state.runs.findIndex((r) => r.id === run.id);
      if (index < 0) state.runs.push(run); else state.runs[index] = run;
    });
    const result = spawnSync(process.execPath, [join(project, "scripts/reconcile-wayfinder-labels.mjs"), command, "--offline-transport", transport, ...args], {
      cwd: project, env: { ...gitEnv, GH_TOKEN: "synthetic-offline-only", ...(env.GITHUB_RUN_ID ? { GITHUB_WORKFLOW_REF: "nisavid/real-skills/.github/workflows/wayfinder-label-repair.yml@refs/heads/main", GITHUB_WORKFLOW_SHA: revision } : {}), ...env },
      encoding: "utf8", timeout: 15_000,
    });
    return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null, state: JSON.parse(readFileSync(join(root, "state.json"))) };
  }
  function evidence(value) { const path = join(root, "evidence.json"); writeFileSync(path, JSON.stringify(value)); return path; }
  function update(change) { const file = join(root, "state.json"); const state = JSON.parse(readFileSync(file)); change(state); writeFileSync(file, JSON.stringify(state)); }
  return { root, project, revision, gitEnv, control, run, evidence, update };
}

test("inspect reports current Wayfinder conflicts and preserves ordinary intake and pull requests", (t) => {
  const f = fixture(t, { control: { operating_interval: attestation() }, issues: [issue(1, ["needs-triage"]), issue(2, ["wayfinder:task", "needs-triage", "keep"]), issue(3, ["wayfinder:map", "needs-triage"], { pull_request: {} })] });
  const r = f.run();
  assert.equal(r.status, 1, r.stderr + JSON.stringify(r.report));
  assert.deepEqual(r.report.scan.conflicts.map((i) => i.number), [2]);
  assert.equal(r.report.scan.complete, true);
  assert.equal(r.report.repair.health, "disabled");
  assert.ok(r.state.calls.every((q) => q.method === "GET"));
});


test("inspect gathers all pages before reading closed conflicts without filtering a shrinking label set", (t) => {
  const rows = [issue(10, ["wayfinder:task", "needs-triage"]), issue(11, ["wayfinder:map", "needs-triage"], { state: "closed" })];
  const f = fixture(t, { control: { operating_interval: attestation() }, issues: rows, state: { pages: [[rows[0]], [rows[1]]] } });
  const r = f.run();
  assert.equal(r.status, 1, r.stderr + JSON.stringify(r.report));
  assert.deepEqual(r.report.scan.conflicts.map((i) => i.number), [10, 11]);
  const list = r.state.calls.filter((q) => q.path.includes("/issues?"));
  assert.equal(list.length, 2);
  assert.ok(list.every((q) => q.path.includes("state=all") && q.path.includes("sort=created") && !q.path.includes("labels=")));
  const secondPage = r.state.calls.findIndex((q) => q.path.includes("page=2"));
  const firstRead = r.state.calls.findIndex((q) => q.path.endsWith("/issues/10"));
  assert.ok(secondPage < firstRead);
});


const attestation = () => ({ schema_version: 1, repository: "nisavid/real-skills", interval_id: "qualification-1", authority_generation: 1, attested_by: "nisavid", attestation_record: "coordination:qualified-interval",
  transition: { owner: "owner-a", accepted: true, ownership_record: "coordination:owner-a", phase: "paused", contenders: [], admission: { automatic: "closed", manual: "closed", record: "coordination:closure" }, change_verified: false, authority_readback_commit: null },
  history: { complete: true, boundary: { proved: true, at: null, record: "coordination:inception", covered_automatic_attempts: [] }, manual_inventory_record: "coordination:all-manual-sessions", executors: [] },
});

test("status keeps an older uncertain DELETE outstanding after a later clean apply scan", (t) => {
  const f = fixture(t);
  const evidence = attestation();
  evidence.history.executors = [
    { id: "manual:lost", kind: "manual", state: "lost", admission_record: "coordination:lost-admitted", report_record: null, requests: [{ id: "request-1", issue_number: 42, submission: "uncertain", outcome: "unknown" }] },
    { id: "manual:green", kind: "manual", state: "stopped", admission_record: "coordination:green-admitted", report_record: "report:green", requests: [], scan: { mode: "apply", complete: true, finished_at: "2026-11-15T00:00:00Z", conflicts: 0 } },
  ];
  const r = f.run("status", ["--evidence", f.evidence(evidence)]);
  assert.equal(r.report.scan.complete, true);
  assert.equal(r.report.scan.conflicts.length, 0);
  assert.ok(r.report.repair.unresolved.some((gap) => gap.includes("manual:lost")));
  assert.equal(r.report.transition.ready, false);
  assert.equal(r.status, 2);
});


test("an automatically admitted qualified interval removes only needs-triage from allowed current conflicts", (t) => {
  const evidence = attestation();
  evidence.transition.phase = "steady";
  evidence.transition.admission.automatic = "open";
  const f = fixture(t, { qualified: true, evidence, issues: [issue(1, ["needs-triage"]), issue(2, ["wayfinder:task", "needs-triage", "keep"]), issue(3, ["wayfinder:map", "needs-triage"])] });
  const r = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(r.status, 1, r.stderr + JSON.stringify(r.report));
  assert.deepEqual(r.state.issues.map((i) => i.labels.map((label) => label.name)), [["needs-triage"], ["wayfinder:task", "keep"], ["wayfinder:map", "needs-triage"]]);
  assert.deepEqual(r.state.calls.filter((q) => q.method !== "GET"), [{ method: "DELETE", path: "/repos/nisavid/real-skills/issues/2/labels/needs-triage" }]);
  assert.equal(r.report.attempts[0].outcome, "completed");
  assert.equal(r.report.scan.outcomes.find((i) => i.number === 2).result, "repaired");
});


function artifact(id, report) {
  // A stored ZIP at the public Actions download seam, with a valid central directory.
  const data = Buffer.from(JSON.stringify(report));
  const name = Buffer.from("report.json");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + data.length, 16);
  const archive = Buffer.concat([local, name, data, central, name, end]);
  return { id, run_id: Number(report.execution.id.split(":")[1]), name: `wayfinder-label-repair-${report.execution.id.split(":").slice(1).join("-")}`, expired: false, digest: "sha256:" + digest(archive), archive_base64: archive.toString("base64") };
}

test("consecutive automatic repairs share one attested interval and an interrupted attempt later refuses drain", (t) => {
  const evidence = attestation(); evidence.transition.phase = "steady"; evidence.transition.admission.automatic = "open";
  const f = fixture(t, { qualified: true, evidence, issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
  const first = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(first.status, 0, JSON.stringify(first.report));
  f.update((state) => { state.runs[0].status = "completed"; state.runs[0].conclusion = "success"; state.artifacts = [artifact(901, first.report)]; state.issues[0].labels.push({ name: "needs-triage" }); });
  const second = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "502", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(second.status, 0, JSON.stringify(second.report));
  assert.equal(second.report.repair.latest_complete_apply.executor, "automatic:502:1");
  assert.equal(second.state.calls.filter((q) => q.method === "DELETE").length, 2);
  f.update((state) => { state.workflowState = "disabled_manually"; state.control.operating_interval.transition.phase = "paused"; state.control.operating_interval.transition.admission.automatic = "closed"; state.runs[1].status = "completed"; state.runs[1].conclusion = "cancelled"; });
  const interrupted = f.run("transition-check", ["--session", "owner-a", "--action", "drain"]);
  assert.equal(interrupted.status, 3);
  assert.equal(interrupted.report.scan.conflicts.length, 0);
  assert.ok(interrupted.report.repair.unresolved.some((gap) => gap.includes("automatic:502:1")));
  assert.equal(interrupted.report.transition.ready, false);
});


test("a refused automatic attempt retains positive no-submission evidence without becoming an apply success", (t) => {
  const f = fixture(t, { issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
  const r = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(r.status, 3);
  assert.equal(r.report.execution.id, "automatic:501:1");
  assert.equal(r.report.execution.state, "stopped");
  assert.deepEqual(r.report.execution.requests, []);
  assert.equal(r.report.execution.scan.complete, false);
  assert.equal(r.state.calls.filter((q) => q.method !== "GET").length, 0);
});


test("a 500 after a destructive request stays uncertain even when a readback is currently clean", (t) => {
  const evidence = attestation(); evidence.transition.phase = "steady"; evidence.transition.admission.automatic = "open";
  const f = fixture(t, { qualified: true, evidence, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { deleteStatus: 500 } });
  const r = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(r.status, 3);
  assert.equal(r.report.attempts[0].response_status, 500);
  assert.equal(r.report.attempts[0].outcome, "unknown");
  assert.equal(r.report.execution.scan.complete, false);
  assert.ok(r.report.repair.unresolved.some((gap) => gap.includes("potentially-outstanding")));
  assert.deepEqual(r.state.issues[0].labels, [{ name: "wayfinder:task" }]);
});


test("a control-only checkout change retains a separately approved source revision with identical executing bytes", (t) => {
  const evidence = attestation(); evidence.transition.phase = "steady"; evidence.transition.admission.automatic = "open";
  const f = fixture(t, { qualified: true, evidence, issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
  writeFileSync(join(f.project, "control-checkpoint.txt"), "synthetic control-only revision\n");
  for (const args of [["add", "control-checkpoint.txt"], ["commit", "-m", "synthetic control checkpoint"]]) assert.equal(spawnSync("git", args, { cwd: f.project, env: f.gitEnv }).status, 0);
  const r = f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(r.status, 0, JSON.stringify(r.report));
  assert.equal(r.report.authority.executing.source_revision, f.revision);
  assert.notEqual(r.report.authority.executing.checkout_revision, f.revision);
  assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, 1);
});


test("an old run rerun after the drain boundary cannot disappear through its original creation date", (t) => {
  const evidence = attestation(); evidence.history.boundary.at = "2026-11-15T00:00:30Z";
  const f = fixture(t, { qualified: true, evidence, state: { workflowState: "disabled_manually", runs: [{ id: 401, workflow_id: 123, run_attempt: 2, status: "completed", conclusion: "success", created_at: "2026-11-14T00:00:00Z", run_started_at: "2026-11-15T00:01:00Z" }] } });
  const r = f.run("transition-check", ["--session", "owner-a", "--action", "drain"]);
  assert.equal(r.status, 3, JSON.stringify(r.report));
  assert.ok(r.report.repair.unresolved.some((gap) => gap.includes("automatic:401:2")));
  assert.equal(r.report.transition.ready, false);
});


function steady() { const value = attestation(); value.transition.phase = "steady"; value.transition.admission.automatic = "open"; return value; }
function auto(f, id = "501") { return f.run("apply", ["--executor", "automatic"], { GITHUB_RUN_ID: id, GITHUB_RUN_ATTEMPT: "1" }); }

test("an unsupported classification refuses apply rather than silently treating the repository as fully supported", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"]), issue(3, ["wayfinder:unrecognized", "needs-triage"])] });
  const r = auto(f);
  assert.equal(r.status, 3, JSON.stringify(r.report));
  assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, 0);
});

test("one paused owner can drain while a second owner, ambiguous ownership, open admission, and missing boundary cannot", async (t) => {
  for (const scenario of ["owner-a", "owner-b", "two-owners", "lost-owner", "manual-open", "missing-boundary", "incomplete-history"]) await t.test(scenario, (t) => {
    const evidence = attestation();
    if (scenario === "two-owners") evidence.transition.contenders.push("owner-b");
    if (scenario === "lost-owner") evidence.transition.owner = null;
    if (scenario === "manual-open") evidence.transition.admission.manual = "open";
    if (scenario === "missing-boundary") evidence.history.boundary.proved = false;
    if (scenario === "incomplete-history") evidence.history.complete = false;
    const f = fixture(t, { qualified: true, evidence, state: { workflowState: "disabled_manually" } });
    const r = f.run("transition-check", ["--session", scenario === "owner-b" ? "owner-b" : "owner-a", "--action", "drain"]);
    assert.equal(r.status, scenario === "owner-a" ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.report.transition.ready, scenario === "owner-a");
    assert.ok(r.state.calls.every((q) => q.method === "GET"));
  });
});

test("manual fallback works only for a preadmitted bounded session while automatic execution is disabled", async (t) => {
  for (const admitted of [true, false]) await t.test(String(admitted), (t) => {
    const evidence = attestation(); evidence.manual_sessions = admitted ? [{ id: "manual:trial", owner: "owner-a", admission_record: "coordination:preadmitted", issue_numbers: [2] }] : [];
    const f = fixture(t, { qualified: true, evidence, issues: [issue(2, ["wayfinder:task", "needs-triage", "keep"])], state: { workflowState: "disabled_manually" } });
    const r = f.run("apply", ["--executor", "manual", "--session", "manual:trial", "--evidence", f.evidence(evidence)]);
    assert.equal(r.status, admitted ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, admitted ? 1 : 0);
  });
});

test("missing current authority, changed policy, wrong repository, and obsolete implementation never fall back to checkout authority", async (t) => {
  for (const scenario of ["unavailable", "policy", "repository", "implementation", "generation", "unqualified-writer", "no-fixtures", "authority-change"]) await t.test(scenario, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    f.update((state) => {
      if (scenario === "unavailable") state.failPath = "/git/ref/";
      if (scenario === "policy") state.policy = "unapproved policy";
      if (scenario === "repository") state.repositoryId = 1;
      if (scenario === "implementation") state.control.authorized_implementations[0].manifest["scripts/reconcile-wayfinder-labels.mjs"] = "0".repeat(64);
      if (scenario === "generation") state.control.generation++;
      if (scenario === "unqualified-writer") state.control.writer_coverage = "unqualified";
      if (scenario === "no-fixtures") state.control.fixture_issue_numbers = [];
      if (scenario === "authority-change") state.changeAuthorityAfter = 1;
    });
    const r = auto(f);
    assert.equal(r.status, 3, JSON.stringify(r.report));
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, 0);
  });
});

test("a disconnect after DELETE cannot be cleared by a later clean scan or terminal run badge", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { disconnectDelete: true } });
  const uncertain = auto(f);
  assert.equal(uncertain.status, 3);
  assert.equal(uncertain.report.attempts[0].outcome, "unknown");
  f.update((state) => { state.disconnectDelete = false; state.runs[0].status = "completed"; state.runs[0].conclusion = "failure"; state.artifacts = [artifact(901, uncertain.report)]; });
  const later = f.run("status");
  assert.equal(later.report.scan.complete, true);
  assert.equal(later.report.scan.conflicts.length, 0);
  assert.ok(later.report.repair.unresolved.some((gap) => gap.includes("potentially-outstanding-request")));
  assert.equal(later.status, 2);
});

test("DELETE status alone does not settle redirects, forbidden requests, rate limits, or a 404 with triage still present", async (t) => {
  for (const status of [301, 403, 429, 404]) await t.test(String(status), (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { deleteStatus: status, removeOnDelete: false } });
    const r = auto(f);
    assert.equal(r.status, 3, JSON.stringify(r.report));
    assert.equal(r.report.attempts[0].outcome, "unknown");
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, 1);
  });
});

test("a 404 plus a successful matching-issue absent-label readback records the documented absence", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { deleteStatus: 404 } });
  const r = auto(f);
  assert.equal(r.status, 0, JSON.stringify(r.report));
  assert.equal(r.report.attempts[0].terminal_observation, "api-404-and-absent-readback");
  assert.equal(r.report.scan.outcomes[0].result, "already-absent");
});

test("partial issue pagination and transferred targets refuse all mutations", async (t) => {
  for (const scenario of ["page", "transfer"]) await t.test(scenario, (t) => {
    const row = issue(2, ["wayfinder:task", "needs-triage"]);
    if (scenario === "transfer") row.url = "https://api.github.com/repos/other/repo/issues/2";
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [row], state: scenario === "page" ? { pages: [[row], [issue(3, [])]], failPath: "&page=2" } : {} });
    const r = auto(f);
    assert.equal(r.status, 3, JSON.stringify(r.report));
    assert.equal(r.report.scan.complete, false);
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, 0);
  });
});


test("multiple recognized Wayfinder types remain repairable and visible for separate manual handling", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "wayfinder:map", "needs-triage", "keep"])] });
  const r = auto(f);
  assert.equal(r.status, 0, JSON.stringify(r.report));
  assert.deepEqual(r.report.scan.warnings.map((warning) => warning.reason), ["multiple-wayfinder-types"]);
  assert.deepEqual(r.state.issues[0].labels.map((label) => label.name), ["wayfinder:task", "wayfinder:map", "keep"]);
});

test("resume requires the same owner, coherent independent authority readback, and an authorized implementation", async (t) => {
  for (const scenario of ["verified", "partial", "obsolete", "invalid-action"]) await t.test(scenario, (t) => {
    const evidence = attestation(); evidence.transition.phase = "resume-pending"; evidence.transition.change_verified = true; evidence.transition.authority_readback_commit = "a".repeat(40);
    if (scenario === "partial") evidence.transition.authority_readback_commit = "b".repeat(40);
    const f = fixture(t, { qualified: true, evidence, state: { workflowState: "disabled_manually" } });
    if (scenario === "obsolete") f.update((state) => { state.control.authorized_implementations = []; });
    const r = f.run("transition-check", ["--session", "owner-a", "--action", scenario === "invalid-action" ? "unexpected" : "resume"]);
    assert.equal(r.status, scenario === "verified" ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.report.transition.ready, scenario === "verified");
    assert.ok(r.state.calls.every((q) => q.method === "GET"));
  });
});


test("status exposes the latest observed workflow attempt and its conclusion beside retained apply health", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
  const applied = auto(f);
  assert.equal(applied.status, 0, JSON.stringify(applied.report));
  f.update((state) => { state.runs[0].status = "completed"; state.runs[0].conclusion = "failure"; state.artifacts = [artifact(901, applied.report)]; });
  const r = f.run("status");
  assert.equal(r.report.repair.latest_run_attempt.id, "automatic:501:1");
  assert.equal(r.report.repair.latest_run_attempt.conclusion, "failure");
  assert.equal(r.report.repair.latest_complete_apply.executor, "automatic:501:1");
  assert.equal(r.report.repair.health, "failed");
});


test("drain and resume account for every canonical manual admission despite supplied completeness claims", async (t) => {
  for (const action of ["drain", "resume"]) for (const scenario of ["omitted", "omitted-file", "active", "lost", "missing-report", "uncertain-request", "stopped-empty", "stopped-settled"]) await t.test(`${action}: ${scenario}`, (t) => {
    const canonical = attestation();
    canonical.manual_sessions = [{ id: "manual:canonical", owner: "owner-a", admission_record: "coordination:canonical-admission", issue_numbers: [2] }];
    if (action === "resume") Object.assign(canonical.transition, { phase: "resume-pending", change_verified: true, authority_readback_commit: "a".repeat(40) });
    const supplied = structuredClone(canonical);
    const executor = { id: "manual:canonical", kind: "manual", owner: "owner-a", state: "stopped", admission_record: "coordination:canonical-admission", report_record: "coordination:canonical-completion", requests: [] };
    if (!["omitted", "omitted-file"].includes(scenario)) supplied.history.executors.push(executor);
    if (scenario === "omitted-file") supplied.manual_sessions = [];
    if (scenario === "active" || scenario === "lost") executor.state = scenario;
    if (scenario === "missing-report") executor.report_record = null;
    if (scenario === "uncertain-request") executor.requests.push({ id: "canonical-delete", issue_number: 2, submission: "uncertain", outcome: "unknown" });
    if (scenario === "stopped-settled") executor.requests.push({ id: "canonical-delete", executor: executor.id, issue_number: 2, submission: "submitted", outcome: "completed", response_status: 200, terminal_observation: "api-200-label-response", authority_commit: "a".repeat(40), authority_generation: 1, completion_record: "coordination:terminal-response" });
    if (scenario !== "omitted-file") canonical.history = supplied.history;
    const f = fixture(t, { qualified: true, evidence: canonical, state: { workflowState: "disabled_manually" } });
    const args = ["--session", "owner-a", "--action", action];
    if (scenario === "omitted-file") args.push("--evidence", f.evidence(supplied));
    const r = f.run("transition-check", args);
    const complete = scenario === "stopped-empty" || scenario === "stopped-settled";
    assert.equal(r.status, complete ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.report.transition.ready, complete);
    assert.ok(r.state.calls.every((q) => q.method === "GET"));
  });
});


test("automatic apply authorizes the actual workflow source independently of approved checkout bytes", async (t) => {
  for (const scenario of ["different-content", "equivalent-revision", "missing-sha", "missing-ref", "wrong-ref", "malformed-sha", "unavailable-source"]) await t.test(scenario, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    const actualRevision = "b".repeat(40);
    const workflow = readFileSync(join(f.project, ".github/workflows/wayfinder-label-repair.yml"), "utf8");
    f.update((state) => { state.workflowFilesByRevision = { [actualRevision]: workflow + (scenario === "different-content" ? "\n# Synthetic obsolete workflow content.\n" : "") }; if (scenario === "unavailable-source") state.failPath = `?ref=${actualRevision}`; });
    const env = { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1", GITHUB_WORKFLOW_SHA: actualRevision };
    if (scenario === "missing-sha") env.GITHUB_WORKFLOW_SHA = undefined;
    if (scenario === "missing-ref") env.GITHUB_WORKFLOW_REF = undefined;
    if (scenario === "wrong-ref") env.GITHUB_WORKFLOW_REF = "other/repo/.github/workflows/wayfinder-label-repair.yml@refs/heads/main";
    if (scenario === "malformed-sha") env.GITHUB_WORKFLOW_SHA = "not-a-commit";
    const r = f.run("apply", ["--executor", "automatic"], env);
    const usable = scenario === "equivalent-revision";
    assert.equal(r.status, usable ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, usable ? 1 : 0);
    if (usable) {
      assert.equal(r.report.authority.executing.workflow_source.revision, actualRevision);
      assert.equal(r.report.authority.executing.workflow_source.sha256, digest(workflow));
      assert.equal(r.report.authority.executing.checkout_revision, f.revision);
      assert.notEqual(actualRevision, f.revision);
    }
  });
});


test("repair avoids pending replacement and recovers after overlapping started refusals without new attestation", (t) => {
  const workflow = readFileSync(join(repo, ".github/workflows/wayfinder-label-repair.yml"), "utf8");
  assert.equal(/^\s*concurrency:/m.test(workflow), false, "repair must not request the native pending-replacement policy");
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { runs: [501, 502].map((id) => ({ id, workflow_id: 123, run_attempt: 1, status: "in_progress", conclusion: null, created_at: "2026-11-15T00:00:00Z" })) } });
  const interval = JSON.stringify(f.control.operating_interval);
  const first = auto(f, "501");
  const second = auto(f, "502");
  for (const result of [first, second]) {
    assert.equal(result.status, 3, JSON.stringify(result.report));
    assert.equal(result.report.execution.state, "stopped");
    assert.deepEqual(result.report.execution.requests, []);
    assert.ok(result.report.repair.unresolved.some((gap) => gap.includes("executor-still-running")));
    assert.equal(result.state.calls.filter((q) => q.method === "DELETE").length, 0);
  }
  f.update((state) => {
    for (const run of state.runs) Object.assign(run, { status: "completed", conclusion: "failure" });
    state.artifacts = [artifact(901, first.report), artifact(902, second.report)];
  });
  const recovered = auto(f, "503");
  assert.equal(recovered.status, 0, JSON.stringify(recovered.report));
  assert.deepEqual(recovered.report.repair.unresolved, []);
  assert.equal(recovered.state.calls.filter((q) => q.method === "DELETE").length, 1);
  assert.equal(JSON.stringify(recovered.state.control.operating_interval), interval);
  assert.deepEqual(recovered.state.issues[0].labels, [{ name: "wayfinder:task" }]);
});

test("canceled unaccounted or uncertain attempts stay unresolved after replacement avoidance", async (t) => {
  for (const scenario of ["missing-historical-report", "recorded-uncertain-request"]) await t.test(scenario, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    if (scenario === "recorded-uncertain-request") {
      f.update((state) => { state.disconnectDelete = true; });
      const uncertain = auto(f, "501");
      assert.equal(uncertain.report.attempts[0].outcome, "unknown");
      f.update((state) => { state.disconnectDelete = false; state.artifacts = [artifact(901, uncertain.report)]; state.issues[0].labels.push({ name: "needs-triage" }); Object.assign(state.runs[0], { status: "completed", conclusion: "cancelled" }); });
    } else {
      f.update((state) => { state.runs = [{ id: 501, workflow_id: 123, run_attempt: 1, status: "completed", conclusion: "cancelled", created_at: "2026-11-15T00:00:00Z" }]; });
    }
    const r = auto(f, "502");
    assert.equal(r.status, 3, JSON.stringify(r.report));
    assert.ok(r.report.repair.unresolved.some((gap) => gap.includes("automatic:501:1")));
    assert.deepEqual(r.report.execution.requests, []);
    assert.equal(r.state.calls.filter((q) => q.method === "DELETE").length, scenario === "recorded-uncertain-request" ? 1 : 0);
  });
});


test("apply and transitions share canonical applicability and admission-reference refusal", async (t) => {
  for (const action of ["automatic", "drain", "resume"]) for (const defect of ["missing-reference", "empty-reference", "missing-interval", "different-interval", "different-owner", "canonical-unaccepted", "canonical-generation", "supplied-empty-reference"]) await t.test(`${action}: ${defect}`, (t) => {
    const canonical = action === "automatic" ? steady() : attestation();
    if (action === "resume") Object.assign(canonical.transition, { phase: "resume-pending", change_verified: true, authority_readback_commit: "a".repeat(40) });
    const supplied = structuredClone(canonical);
    const f = fixture(t, { qualified: true, evidence: canonical, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: action === "automatic" ? "active" : "disabled_manually" } });
    f.update((state) => {
      const interval = state.control.operating_interval;
      if (defect === "missing-reference") delete interval.transition.admission.record;
      if (defect === "empty-reference") interval.transition.admission.record = "";
      if (defect === "missing-interval") state.control.operating_interval = null;
      if (defect === "different-interval") interval.interval_id = "another-canonical-interval";
      if (defect === "different-owner") interval.transition.owner = "another-canonical-owner";
      if (defect === "canonical-unaccepted") interval.transition.accepted = false;
      if (defect === "canonical-generation") interval.authority_generation = 2;
    });
    if (defect === "supplied-empty-reference") supplied.transition.admission.record = "";
    const args = action === "automatic" ? ["--executor", "automatic"] : ["--session", "owner-a", "--action", action];
    args.push("--evidence", f.evidence(supplied));
    const r = f.run(action === "automatic" ? "apply" : "transition-check", args, action === "automatic" ? { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" } : {});
    assert.equal(r.status, 3, JSON.stringify(r.report));
    assert.equal(r.report.transition.ready, false);
    assert.equal(r.state.calls.filter((call) => call.method === "DELETE").length, 0);
    if (action === "automatic") { assert.equal(r.report.execution.state, "stopped"); assert.deepEqual(r.report.execution.requests, []); }
  });
});

test("matching newer phase closure and completion records remain usable without forgetting canonical requests", async (t) => {
  for (const action of ["drain", "resume"]) for (const update of ["completed", "omitted-executor", "omitted-request"]) await t.test(`${action}: ${update}`, (t) => {
    const canonical = steady();
    canonical.history.executors = [{ id: "manual:prior", kind: "manual", owner: "owner-a", state: "lost", admission_record: "coordination:prior-admitted", report_record: null, requests: [{ id: "prior-delete", executor: "manual:prior", issue_number: 2, submission: "uncertain", outcome: "unknown" }] }];
    const supplied = structuredClone(canonical);
    supplied.transition.phase = action === "resume" ? "resume-pending" : "paused";
    supplied.transition.admission = { automatic: "closed", manual: "closed", record: "coordination:newer-closure" };
    supplied.transition.change_verified = true; supplied.transition.authority_readback_commit = "a".repeat(40);
    const executor = supplied.history.executors[0]; executor.state = "stopped"; executor.report_record = "coordination:positive-completion-report";
    Object.assign(executor.requests[0], { submission: "submitted", outcome: "completed", response_status: 200, terminal_observation: "api-200-label-response", authority_commit: "a".repeat(40), authority_generation: 1, completion_record: "coordination:terminal-response" });
    if (update === "omitted-executor") supplied.history.executors = [];
    if (update === "omitted-request") executor.requests = [];
    const f = fixture(t, { qualified: true, evidence: canonical, state: { workflowState: "disabled_manually" } });
    const r = f.run("transition-check", ["--session", "owner-a", "--action", action, "--evidence", f.evidence(supplied)]);
    assert.equal(r.status, update === "completed" ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.report.transition.ready, update === "completed");
    assert.ok(r.state.calls.every((call) => call.method === "GET"));
  });
});

test("disabled first setup stays inspectable without certifying a first interval or erasing prior unknown use", async (t) => {
  for (const prior of [false, true]) await t.test(String(prior), (t) => {
    const f = fixture(t, { qualified: true, evidence: attestation(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: "disabled_manually" } });
    f.update((state) => {
      state.control.mode = "inspect"; state.control.writer_coverage = "unqualified"; state.control.authorized_implementations = []; state.control.fixture_issue_numbers = []; state.control.operating_interval = null;
      if (prior) state.runs = [{ id: 401, workflow_id: 123, run_attempt: 1, status: "completed", conclusion: "cancelled", created_at: "2026-11-15T00:00:00Z" }];
    });
    const inspected = f.run("inspect");
    assert.equal(inspected.report.scan.complete, true);
    assert.equal(inspected.report.scan.conflicts.length, 1);
    assert.equal(inspected.report.transition.ready, false);
    assert.ok(inspected.report.repair.unresolved.length > 0);
    if (prior) assert.ok(inspected.report.repair.unresolved.some((gap) => gap.includes("automatic:401:1")));
    assert.ok(inspected.state.calls.every((call) => call.method === "GET"));
    const unavailable = f.run("inspect", ["--evidence", join(f.root, "missing-evidence.json")]);
    assert.equal(unavailable.report.scan.complete, true);
    assert.equal(unavailable.report.transition.ready, false);
    assert.ok(unavailable.report.repair.unresolved.includes("unreadable-evidence"));
    const supplied = attestation();
    const checked = f.run("transition-check", ["--session", "owner-a", "--action", "drain", "--evidence", f.evidence(supplied)]);
    assert.equal(checked.status, 3);
    assert.equal(checked.report.transition.ready, false);
  });
});


test("inspection observations never reset apply health and unknown requests still take precedence", async (t) => {
  const anchor = Date.now();
  const time = (secondsAgo) => new Date(anchor - secondsAgo * 1000).toISOString();
  const times = { good: time(60), failed: time(45), inspected: time(30), recovered: time(15) };
  t.diagnostic("Constructed scan times, not live job observations: " + JSON.stringify(times));
  const scan = (id, mode, complete, finished_at, requests = []) => ({ id, kind: "manual", owner: "owner-a", state: "stopped", admission_record: `coordination:${id}:admitted`, report_record: `coordination:${id}:report`, requests, scan: { mode, complete, finished_at, authority_generation: 1, conflicts: 0 } });
  const good = scan("manual:good", "apply", true, times.good);
  const failed = scan("manual:failed", "apply", false, times.failed, [{ id: "settled-delete", executor: "manual:failed", issue_number: 2, submission: "submitted", outcome: "completed", response_status: 200, terminal_observation: "api-200-label-response", authority_commit: "a".repeat(40), authority_generation: 1, completion_record: "coordination:terminal-response" }]);
  const inspected = scan("manual:inspected", "inspect", true, times.inspected);
  const recovered = scan("manual:recovered", "apply", true, times.recovered);
  const unknown = { id: "manual:unknown", kind: "manual", owner: "owner-a", state: "stopped", admission_record: "coordination:unknown-admitted", report_record: "coordination:unknown-report", requests: [{ id: "unknown-delete", executor: "manual:unknown", issue_number: 2, submission: "uncertain", outcome: "unknown" }] };
  for (const [name, records, health] of [
    ["successful apply", [good], "healthy"],
    ["incomplete apply", [good, failed], "failed"],
    ["successful inspection", [good, failed, inspected], "failed"],
    ["successful new apply", [good, failed, inspected, recovered], "healthy"],
    ["unknown still outstanding", [good, failed, inspected, recovered, unknown], "unknown"],
    ["failed inspection only", [good, { ...inspected, scan: { ...inspected.scan, complete: false } }], "healthy"],
  ]) await t.test(name, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [] });
    const evidence = steady(); evidence.history.executors = records;
    const r = f.run("status", ["--evidence", f.evidence(evidence)]);
    assert.equal(r.report.repair.health, health, JSON.stringify(r.report));
    if (name === "successful inspection") {
      assert.equal(r.report.repair.latest_attempt.mode, "inspect");
      assert.equal(r.report.repair.latest_apply_attempt.executor, "manual:failed");
      assert.equal(r.report.repair.latest_complete_apply.executor, "manual:good");
    }
    assert.ok(r.state.calls.every((call) => call.method === "GET"));
  });
});


test("automatic execution retains the validated canonical admission reference", (t) => {
  const canonical = steady(); canonical.transition.admission.record = "coordination:continuing-automatic-admission";
  const supplied = structuredClone(canonical); supplied.transition.admission.record = "coordination:newer-observation";
  const f = fixture(t, { qualified: true, evidence: canonical, issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
  const r = f.run("apply", ["--executor", "automatic", "--evidence", f.evidence(supplied)], { GITHUB_RUN_ID: "501", GITHUB_RUN_ATTEMPT: "1" });
  assert.equal(r.status, 0, JSON.stringify(r.report));
  assert.equal(r.report.execution.admission_record, "coordination:continuing-automatic-admission");
  assert.equal(r.state.calls.filter((call) => call.method === "DELETE").length, 1);
});


test("inspect completion includes explicitly incomplete operating history without preventing a read-only scan", async (t) => {
  for (const complete of [true, false]) await t.test(String(complete), (t) => {
    const evidence = attestation(); evidence.history.complete = complete;
    const f = fixture(t, { qualified: true, evidence, issues: [] });
    const r = f.run("inspect");
    assert.equal(r.report.scan.complete, true);
    assert.equal(r.status, complete ? 0 : 2, JSON.stringify(r.report));
    assert.equal(r.report.result, complete ? "clean" : "incomplete");
    if (!complete) assert.ok(r.report.repair.unresolved.includes("incomplete-admission-inventory"));
    assert.ok(r.state.calls.every((call) => call.method === "GET"));
  });
});


test("an unfamiliar type added on the final reread remains unsupported and cannot establish a complete apply", (t) => {
  const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { addUnknownOnReread: true } });
  const r = auto(f);
  assert.ok(r.status === 2 || r.status === 3, JSON.stringify(r.report));
  assert.ok(r.report.scan.unsupported.some((issue) => issue.number === 2 && issue.labels.includes("wayfinder:task") && issue.labels.includes("wayfinder:future") && issue.labels.includes("needs-triage")));
  assert.equal(r.report.execution.scan.complete, false);
  assert.equal(r.state.calls.filter((call) => call.method === "DELETE").length, 0);
  f.update((state) => { state.runs[0].status = "completed"; state.runs[0].conclusion = "failure"; state.artifacts = [artifact(901, r.report)]; });
  const status = f.run("status");
  assert.equal(status.report.repair.latest_complete_apply, null);
});


test("automatic observations reconcile by identity across canonical supplied and Actions history", async (t) => {
  for (const action of ["automatic", "drain", "resume"]) for (const variant of ["matching", "newer-completion", "supplied-newer", "incompatible", "omitted-request", "supplied-incompatible", "supplied-omitted-request", "supplied-omitted-executor"]) await t.test(`${action}: ${variant}`, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    const first = auto(f, "501");
    assert.equal(first.status, 0, JSON.stringify(first.report));
    const canonical = structuredClone(first.report.execution);
    const saved = structuredClone(first.report);
    let suppliedCompletion = null;
    if (variant === "newer-completion" || variant === "supplied-newer") {
      canonical.state = "lost"; canonical.report_record = null;
      canonical.scan.complete = false;
      canonical.scan.finished_at = new Date(Date.parse(canonical.scan.finished_at) - 1000).toISOString();
      Object.assign(canonical.requests[0], { submission: "uncertain", outcome: "unknown", response_status: null, terminal_observation: null, completion_record: null });
    }
    if (variant === "supplied-newer") {
      suppliedCompletion = structuredClone(first.report.execution);
      saved.execution = { ...structuredClone(canonical), state: "stopped" };
    }
    if (variant.startsWith("supplied-") && variant !== "supplied-newer") {
      suppliedCompletion = structuredClone(first.report.execution);
      if (variant === "supplied-incompatible") Object.assign(suppliedCompletion.requests[0], { response_status: 404, terminal_observation: "api-404-and-absent-readback" });
      if (variant === "supplied-omitted-request") suppliedCompletion.requests = [];
    }
    if (variant === "incompatible") Object.assign(saved.execution.requests[0], { response_status: 404, terminal_observation: "api-404-and-absent-readback" });
    if (variant === "omitted-request") saved.execution.requests = [];
    saved.attempts = structuredClone(saved.execution.requests);
    if (variant === "supplied-newer") { saved.refusals = ["destructive-request-outcome-unknown"]; saved.result = "refused"; }
    if (variant === "incompatible") saved.scan.outcomes = saved.scan.outcomes.map((outcome) => ({ ...outcome, response_status: 404, result: "already-absent" }));
    f.update((state) => {
      Object.assign(state.runs[0], { status: "completed", conclusion: "success" });
      state.control.operating_interval.history.executors = [canonical];
      state.artifacts = [artifact(901, saved)];
      if (action === "automatic") state.issues[0].labels.push({ name: "needs-triage" });
      else {
        state.workflowState = "disabled_manually";
        Object.assign(state.control.operating_interval.transition, { phase: action === "resume" ? "resume-pending" : "paused", admission: { automatic: "closed", manual: "closed", record: "coordination:after-first-closure" }, change_verified: true, authority_readback_commit: "a".repeat(40) });
      }
    });
    const args = action === "automatic" ? ["--executor", "automatic"] : ["--session", "owner-a", "--action", action];
    if (suppliedCompletion) {
      const supplied = structuredClone(f.control.operating_interval);
      if (action !== "automatic") Object.assign(supplied.transition, { phase: action === "resume" ? "resume-pending" : "paused", admission: { automatic: "closed", manual: "closed", record: "coordination:after-first-closure" }, change_verified: true, authority_readback_commit: "a".repeat(40) });
      supplied.history.executors = variant === "supplied-omitted-executor" ? [] : [suppliedCompletion];
      args.push("--evidence", f.evidence(supplied));
    }
    const r = f.run(action === "automatic" ? "apply" : "transition-check", args, action === "automatic" ? { GITHUB_RUN_ID: "502", GITHUB_RUN_ATTEMPT: "1" } : {});
    const usable = ["matching", "newer-completion", "supplied-newer"].includes(variant);
    assert.equal(r.status, usable ? 0 : 3, JSON.stringify(r.report));
    assert.equal(r.report.repair.unresolved.length === 0, usable);
    assert.equal(r.state.calls.filter((call) => call.method === "DELETE").length, usable && action === "automatic" ? 2 : 1);
    if (usable) assert.equal(r.report.repair.latest_complete_apply.executor, action === "automatic" ? "automatic:502:1" : "automatic:501:1");
    if (action !== "automatic") assert.equal(r.report.transition.ready, usable);
  });
});


test("native workflow failure tracks relevant apply identity and chronology without clearing uncertainty", async (t) => {
  for (const scenario of ["manual-recovery", "failed-inspection", "latest-native-apply-failure", "unknown-after-recovery"]) await t.test(scenario, (t) => {
    const session = (id) => ({ id, owner: "owner-a", admission_record: `coordination:${id}:admitted`, issue_numbers: [2] });
    let earlierUnknown = null;
    if (scenario === "unknown-after-recovery") {
      const interval = attestation(); interval.manual_sessions = [session("manual:earlier-uncertain")];
      const lost = fixture(t, { qualified: true, evidence: interval, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: "disabled_manually", disconnectDelete: true } });
      const result = lost.run("apply", ["--executor", "manual", "--session", "manual:earlier-uncertain"]);
      assert.equal(result.status, 3, JSON.stringify(result.report));
      assert.equal(result.report.attempts[0].outcome, "unknown");
      earlierUnknown = { ...result.report.execution, report_record: "coordination:retained-earlier-uncertain-report" };
      t.diagnostic("Synthetic earlier uncertain execution was generated in a separate disposable transport; its retained record is introduced after recovery as newly available history.");
    }
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    function retain(result, conclusion) {
      assert.equal(result.report.execution.scan.authority_generation, 1);
      f.update((state) => {
        const run = state.runs.find((run) => `automatic:${run.id}:${run.run_attempt}` === result.report.execution.id);
        Object.assign(run, { status: "completed", conclusion, created_at: result.report.observed_at, updated_at: result.report.execution.scan.finished_at });
        state.artifacts ??= [];
        state.artifacts.push(artifact(900 + run.id, result.report));
      });
    }
    const first = auto(f, "501");
    assert.equal(first.status, 0, JSON.stringify(first.report));
    assert.equal(first.report.execution.scan.complete, true);
    assert.equal(first.report.attempts[0].outcome, "completed");
    retain(first, scenario === "failed-inspection" ? "success" : "failure");
    let expectedApply = first.report.execution.id;
    if (scenario === "manual-recovery" || scenario === "unknown-after-recovery") {
      f.update((state) => {
        state.workflowState = "disabled_manually";
        const interval = state.control.operating_interval;
        interval.manual_sessions = [session("manual:recovery")];
        Object.assign(interval.transition, { phase: "paused", admission: { automatic: "closed", manual: "closed", record: "coordination:closed-for-recovery" } });
        state.issues[0].labels.push({ name: "needs-triage" });
      });
      const recovered = f.run("apply", ["--executor", "manual", "--session", "manual:recovery"]);
      assert.equal(recovered.status, 0, JSON.stringify(recovered.report));
      assert.equal(recovered.report.execution.scan.authority_generation, 1);
      assert.equal(recovered.report.execution.scan.complete, true);
      assert.equal(recovered.report.attempts[0].outcome, "completed");
      assert.equal(recovered.state.calls.filter((call) => call.method === "DELETE").length, 2);
      expectedApply = recovered.report.execution.id;
      f.update((state) => {
        const interval = state.control.operating_interval;
        interval.history.executors = [{ ...recovered.report.execution, report_record: "coordination:retained-manual-recovery-report" }];
        Object.assign(interval.transition, { phase: "resume-pending", change_verified: true, authority_readback_commit: state.commit });
      });
      const resume = f.run("transition-check", ["--session", "owner-a", "--action", "resume"]);
      assert.equal(resume.status, 0, JSON.stringify(resume.report));
      assert.equal(resume.report.transition.ready, true);
      f.update((state) => {
        state.workflowState = "active";
        Object.assign(state.control.operating_interval.transition, { phase: "steady", admission: { automatic: "open", manual: "closed", record: "coordination:resumed-after-recovery" } });
        if (earlierUnknown) {
          state.control.operating_interval.manual_sessions.push(session(earlierUnknown.id));
          state.control.operating_interval.history.executors.push(earlierUnknown);
        }
      });
    }
    if (scenario === "failed-inspection") {
      f.update((state) => state.issues[0].labels.push({ name: "wayfinder:future" }));
      const inspected = f.run("inspect", ["--executor", "automatic"], { GITHUB_RUN_ID: "502", GITHUB_RUN_ATTEMPT: "1" });
      assert.equal(inspected.status, 2, JSON.stringify(inspected.report));
      assert.equal(inspected.report.execution.scan.mode, "inspect");
      retain(inspected, "failure");
      f.update((state) => { state.issues[0].labels = state.issues[0].labels.filter((label) => label.name !== "wayfinder:future"); });
    }
    const result = f.run("status");
    const health = scenario === "unknown-after-recovery" ? "unknown" : scenario === "latest-native-apply-failure" ? "failed" : "healthy";
    assert.equal(result.report.repair.health, health, JSON.stringify(result.report));
    assert.equal(result.report.repair.latest_apply_attempt.executor, expectedApply);
    assert.equal(result.report.repair.latest_run_attempt.conclusion, "failure");
    assert.equal(result.report.repair.latest_run_attempt.id, scenario === "failed-inspection" ? "automatic:502:1" : "automatic:501:1");
    if (earlierUnknown) assert.ok(result.report.repair.unresolved.some((gap) => gap.includes("potentially-outstanding-request")));
    else assert.deepEqual(result.report.repair.unresolved, []);
  });
});


test("finalized current executions update apply health while inspection keeps separate recency", async (t) => {
  for (const scenario of ["enumeration-failure", "complete-success", "implementation-refusal", "disabled-refusal", "unknown-request"]) await t.test(scenario, (t) => {
    const f = fixture(t, { qualified: true, evidence: steady(), issues: [issue(2, ["wayfinder:task", "needs-triage"])] });
    function retain(result) {
      f.update((state) => {
        const run = state.runs.find((run) => `automatic:${run.id}:${run.run_attempt}` === result.report.execution.id);
        Object.assign(run, { status: "completed", conclusion: result.status === 0 ? "success" : "failure", created_at: result.report.observed_at, updated_at: result.report.execution.scan.finished_at });
        state.artifacts ??= [];
        state.artifacts.push(artifact(900 + run.id, result.report));
      });
    }
    const first = auto(f, "501");
    assert.equal(first.status, 0, JSON.stringify(first.report));
    assert.equal(first.report.execution.scan.complete, true);
    retain(first);
    f.update((state) => {
      state.issues[0].labels.push({ name: "needs-triage" });
      if (scenario === "enumeration-failure") state.failPath = "/issues?";
      if (scenario === "implementation-refusal") state.control.authorized_implementations = [];
      if (scenario === "disabled-refusal") state.control.mode = "inspect";
      if (scenario === "unknown-request") state.disconnectDelete = true;
    });
    const current = auto(f, "502");
    const success = scenario === "complete-success";
    const health = scenario === "disabled-refusal" ? "disabled" : scenario === "unknown-request" ? "unknown" : success ? "healthy" : "failed";
    assert.equal(current.status, success ? 0 : 3, JSON.stringify(current.report));
    assert.equal(current.report.execution.scan.complete, success);
    assert.equal(current.report.execution.scan.authority_generation, 1);
    assert.equal(current.state.calls.filter((call) => call.method === "DELETE").length, success || scenario === "unknown-request" ? 2 : 1);
    assert.equal(current.report.repair.health, health, JSON.stringify(current.report));
    assert.equal(current.report.repair.latest_apply_attempt.executor, "automatic:502:1");
    assert.equal(current.report.repair.latest_apply_attempt.complete, success);
    assert.equal(current.report.repair.latest_complete_apply.executor, success ? "automatic:502:1" : "automatic:501:1");
    retain(current);
    f.update((state) => {
      delete state.failPath; delete state.disconnectDelete;
      // A synthetic external label change permits a clean inspection after failure.
      state.issues[0].labels = [{ name: "wayfinder:task" }];
    });
    const inspected = f.run("inspect", ["--executor", "automatic"], { GITHUB_RUN_ID: "503", GITHUB_RUN_ATTEMPT: "1" });
    assert.equal(inspected.report.execution.scan.complete, true, JSON.stringify(inspected.report));
    assert.equal(inspected.report.execution.scan.mode, "inspect");
    assert.equal(inspected.report.repair.latest_attempt.executor, "automatic:503:1");
    assert.equal(inspected.report.repair.latest_attempt.mode, "inspect");
    assert.equal(inspected.report.repair.latest_apply_attempt.executor, "automatic:502:1");
    assert.equal(inspected.report.repair.health, health, JSON.stringify(inspected.report));
    assert.equal(inspected.state.calls.filter((call) => call.method === "DELETE").length, success || scenario === "unknown-request" ? 2 : 1);
  });
});


test("preadmitted manual refusals retain the identified stopped invocation through later inspection", async (t) => {
  for (const failure of ["enumeration", "implementation"]) await t.test(failure, (t) => {
    const interval = attestation();
    const session = { id: "manual:early-refusal", owner: "owner-a", admission_record: "coordination:early-preadmission", issue_numbers: [2] };
    interval.manual_sessions = [session];
    const f = fixture(t, { qualified: true, evidence: interval, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: "disabled_manually" } });
    f.update((state) => {
      if (failure === "enumeration") state.failPath = "/issues?";
      else state.control.authorized_implementations = [];
    });
    const refused = f.run("apply", ["--executor", "manual", "--session", session.id]);
    assert.equal(refused.status, 3, JSON.stringify(refused.report));
    assert.equal(refused.state.calls.filter((call) => call.method === "DELETE").length, 0);
    assert.equal(refused.report.execution?.id, session.id, JSON.stringify(refused.report));
    assert.equal(refused.report.execution.owner, session.owner);
    assert.equal(refused.report.execution.admission_record, session.admission_record);
    assert.equal(refused.report.execution.state, "stopped");
    assert.deepEqual(refused.report.execution.requests, []);
    assert.equal(refused.report.execution.scan.complete, false);
    assert.equal(refused.report.repair.latest_apply_attempt.executor, session.id);
    assert.equal(refused.report.repair.latest_apply_attempt.complete, false);
    assert.equal(refused.report.repair.health, "disabled");
    f.update((state) => {
      delete state.failPath;
      state.control.operating_interval.history.executors = [{ ...refused.report.execution, report_record: "coordination:retained-early-refusal" }];
      // Synthetic current labels permit conflict-free inspection without a DELETE.
      state.issues[0].labels = [{ name: "wayfinder:task" }];
    });
    const inspected = f.run("inspect");
    assert.equal(inspected.status, 0, JSON.stringify(inspected.report));
    assert.equal(inspected.report.repair.latest_apply_attempt.executor, session.id);
    assert.equal(inspected.report.repair.latest_apply_attempt.complete, false);
    assert.deepEqual(inspected.report.repair.unresolved, []);
    const drained = f.run("transition-check", ["--session", "owner-a", "--action", "drain"]);
    assert.equal(drained.status, 0, JSON.stringify(drained.report));
    assert.equal(drained.report.transition.ready, true);
    assert.ok(drained.state.calls.every((call) => call.method === "GET"));
  });
});

test("an accounted uncertain manual session is not replaced by a fresh empty refusal record", (t) => {
  const interval = attestation();
  const session = { id: "manual:already-active", owner: "owner-a", admission_record: "coordination:already-active-admitted", issue_numbers: [2] };
  interval.manual_sessions = [session];
  interval.history.executors = [{ ...session, kind: "manual", state: "active", report_record: "coordination:earlier-active-report", requests: [{ id: "earlier-delete", executor: session.id, issue_number: 2, submission: "uncertain", outcome: "unknown" }] }];
  const f = fixture(t, { qualified: true, evidence: interval, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: "disabled_manually" } });
  const refused = f.run("apply", ["--executor", "manual", "--session", session.id]);
  assert.equal(refused.status, 3, JSON.stringify(refused.report));
  assert.equal(refused.report.execution, undefined);
  assert.ok(refused.report.repair.unresolved.some((gap) => gap.includes("potentially-outstanding-request")));
  assert.ok(refused.state.calls.every((call) => call.method === "GET"));
});


test("equivalent timestamp instants keep tied incomplete apply evidence in either history order", async (t) => {
  const at = Math.floor((Date.now() - 30_000) / 1000) * 1000;
  const canonical = new Date(at).toISOString();
  const timezone = new Date(at + 2 * 60 * 60_000).toISOString().replace("Z", "+02:00");
  const noFraction = canonical.replace(".000Z", "Z");
  t.diagnostic("Constructed procedural timestamps, not live workflow observations: " + JSON.stringify({ canonical, timezone, noFraction }));
  for (const [spelling, alternate] of [["literal", canonical], ["timezone", timezone], ["fractional", noFraction]]) for (const incompleteFirst of [false, true]) await t.test(`${spelling}: ${incompleteFirst ? "incomplete-first" : "complete-first"}`, (t) => {
    assert.equal(Date.parse(canonical), Date.parse(alternate));
    const execution = (id, complete, finished_at) => ({ id, kind: "manual", owner: "owner-a", state: "stopped", admission_record: `coordination:${id}:admitted`, report_record: `coordination:${id}:retained-report`, requests: [], scan: { mode: "apply", complete, authority_generation: 1, finished_at, conflicts: 0 } });
    const good = execution("manual:tied-complete", true, canonical);
    const failed = execution("manual:tied-incomplete", false, alternate);
    const interval = steady(); interval.history.executors = incompleteFirst ? [failed, good] : [good, failed];
    const f = fixture(t, { qualified: true, evidence: interval });
    const result = f.run("status");
    assert.deepEqual(result.report.repair.unresolved, []);
    assert.equal(result.report.repair.health, "failed", JSON.stringify(result.report));
    assert.equal(result.report.repair.latest_apply_attempt.executor, failed.id);
    assert.equal(result.report.repair.latest_apply_attempt.complete, false);
    assert.equal(result.report.repair.latest_complete_apply.executor, good.id);
    assert.ok(result.state.calls.every((call) => call.method === "GET"));
  });
});


test("canonical fresh manual identity remains reportable when supplied evidence refuses admission", async (t) => {
  for (const defect of ["unreadable", "different-interval"]) await t.test(defect, (t) => {
    const canonical = attestation();
    const session = { id: "manual:identified-refusal", owner: "owner-a", admission_record: "coordination:identified-preadmission", issue_numbers: [2] };
    canonical.manual_sessions = [session];
    const f = fixture(t, { qualified: true, evidence: canonical, issues: [issue(2, ["wayfinder:task", "needs-triage"])], state: { workflowState: "disabled_manually" } });
    const supplied = structuredClone(canonical); supplied.interval_id = "different-interval";
    const path = defect === "unreadable" ? join(f.root, "missing-evidence.json") : f.evidence(supplied);
    const refused = f.run("apply", ["--executor", "manual", "--session", session.id, "--evidence", path]);
    assert.equal(refused.status, 3, JSON.stringify(refused.report));
    assert.ok(refused.report.repair.unresolved.length > 0);
    assert.ok(refused.report.refusals.includes("admission-or-request-history-unresolved"));
    assert.equal(refused.report.execution?.id, session.id, JSON.stringify(refused.report));
    assert.equal(refused.report.execution.owner, session.owner);
    assert.equal(refused.report.execution.admission_record, session.admission_record);
    assert.deepEqual(refused.report.execution.requests, []);
    assert.equal(refused.report.execution.scan.complete, false);
    assert.equal(refused.report.repair.latest_apply_attempt.executor, session.id);
    assert.ok(refused.state.calls.every((call) => call.method === "GET"));
  });
});
