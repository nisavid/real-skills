#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { inflateRawSync } from "node:zlib";

const repository = "nisavid/real-skills";
const repositoryId = 1409103617;
const prefix = `/repos/${repository}`;
const controlPath = ".github/wayfinder-label-repair-control.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const markers = new Set(["wayfinder:map", "wayfinder:research", "wayfinder:prototype", "wayfinder:grilling", "wayfinder:task"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
function requireState(ok, reason) { if (!ok) throw new Error(reason); }

function archiveReport(encoded) {
  requireState(typeof encoded === "string" && encoded.length <= 8 * 1024 * 1024, "unsupported-report-archive");
  const zip = Buffer.from(encoded, "base64");
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65_557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  requireState(end >= 0 && end + 22 <= zip.length && zip.readUInt16LE(end + 4) === 0 && zip.readUInt16LE(end + 6) === 0 && zip.readUInt16LE(end + 8) === zip.readUInt16LE(end + 10), "unsupported-report-archive");
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  requireState(count > 0 && count <= 10 && offset < end, "unsupported-report-archive");
  let report = null;
  for (let i = 0; i < count; i++) {
    requireState(offset + 46 <= end && zip.readUInt32LE(offset) === 0x02014b50, "unsupported-report-archive");
    const flags = zip.readUInt16LE(offset + 8), method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20), unpacked = zip.readUInt32LE(offset + 24);
    const nameSize = zip.readUInt16LE(offset + 28), extraSize = zip.readUInt16LE(offset + 30), commentSize = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const next = offset + 46 + nameSize + extraSize + commentSize;
    requireState(next <= end && !(flags & 1) && [0, 8].includes(method) && size <= 4 * 1024 * 1024 && unpacked <= 4 * 1024 * 1024 && local + 30 <= zip.length && zip.readUInt32LE(local) === 0x04034b50, "unsupported-report-archive");
    const name = zip.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    if (name === "report.json") {
      requireState(report === null, "duplicate-attempt-report");
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      requireState(start + size <= offset, "unsupported-report-archive");
      const data = zip.subarray(start, start + size);
      const bytes = method === 8 ? inflateRawSync(data, { maxOutputLength: 4 * 1024 * 1024 }) : data;
      requireState(bytes.length === unpacked, "unsupported-report-archive");
      report = JSON.parse(bytes.toString("utf8"));
    }
    offset = next;
  }
  requireState(object(report), "missing-attempt-report");
  return { report, digest: sha256(zip) };
}

const report = {
  schema_version: 1, command: process.argv[2], offline: false,
  repository, observed_at: new Date().toISOString(), authority: null,
  scan: { complete: false, issues_seen: 0, conflicts: [], unsupported: [], warnings: [], outcomes: [] },
  repair: { health: "unknown", workflow: null, evidence_basis: "operator-record-attestation", unresolved: [], latest_attempt: null, latest_apply_attempt: null, latest_run_attempt: null, latest_complete_apply: null },
  transition: { owner: null, phase: "unknown", ready: false, reasons: [] }, attempts: [], refusals: [],
};

async function main() {
  const command = process.argv[2];
  requireState(["inspect", "status", "apply", "transition-check"].includes(command), "unsupported-command");
  const args = {};
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    requireState(["--offline-transport", "--evidence", "--executor", "--session", "--action"].includes(key) && process.argv[i + 1] && !args[key], "invalid-arguments");
    args[key] = process.argv[i + 1];
  }
  requireState(!args["--action"] || ["drain", "resume"].includes(args["--action"]), "unsupported-transition-action");
  report.offline = Boolean(args["--offline-transport"]);
  if (report.offline) requireState(isAbsolute(args["--offline-transport"]), "offline-transport-must-be-absolute");
  if (args["--executor"] === "automatic") {
    const id = `automatic:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`;
    requireState(/^automatic:[1-9][0-9]*:[1-9][0-9]*$/.test(id), "executor-identity-required");
    report.execution = { id, kind: "automatic", owner: null, state: "stopped", admission_record: "not-admitted:authority-and-evidence-gates", report_record: `actions:${id}`, requests: report.attempts };
  }

  async function request(method, path) {
    requireState(path.startsWith(prefix + "/") || path === prefix, "wrong-repository-request");
    let result;
    if (report.offline) {
      try {
        result = JSON.parse(execFileSync(args["--offline-transport"], [], {
          input: JSON.stringify({ method, path }), encoding: "utf8", timeout: 30_000,
          maxBuffer: 16 * 1024 * 1024, env: { PATH: "/usr/bin:/bin" }, stdio: ["pipe", "pipe", "pipe"],
        }));
      } catch { throw new Error("transport-unavailable-or-unknown"); }
    } else {
      requireState(Boolean(process.env.GH_TOKEN), "missing-gh-token");
      const response = await fetch(`https://api.github.com${path}`, {
        method, redirect: method === "GET" && path.endsWith("/zip") ? "follow" : "error", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      });
      let body = null;
      if (path.endsWith("/zip") && response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        requireState(bytes.length <= 6 * 1024 * 1024, "oversized-report-archive");
        body = { archive_base64: bytes.toString("base64") };
      } else {
        const text = await response.text();
        requireState(text.length <= 8 * 1024 * 1024, "oversized-api-response");
        if (text) { try { body = JSON.parse(text); } catch { if (method !== "DELETE") throw new Error("malformed-api-json"); } }
      }
      result = { status: response.status, headers: Object.fromEntries(response.headers), body };
    }
    requireState(object(result) && Number.isInteger(result.status) && object(result.headers), "malformed-transport-response");
    if (method !== "DELETE") requireState(result.status >= 200 && result.status < 300, `http-${result.status}`);
    return result;
  }
  async function file(path, commit) {
    const response = (await request("GET", `${prefix}/contents/${path}?ref=${commit}`)).body;
    requireState(object(response) && response.type === "file" && response.encoding === "base64" && typeof response.content === "string", "unreadable-authority-file");
    const encoded = response.content.replaceAll(/\s/g, "");
    requireState(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded), "malformed-authority-encoding");
    return Buffer.from(encoded, "base64");
  }
  async function authority() {
    const repo = (await request("GET", prefix)).body;
    requireState(object(repo) && repo.id === repositoryId && repo.full_name === repository && repo.default_branch === "main", "repository-identity-mismatch");
    const ref = (await request("GET", `${prefix}/git/ref/heads/main`)).body;
    requireState(object(ref?.object) && ref.object.type === "commit" && sha(ref.object.sha), "unconfirmed-current-authority");
    const commit = ref.object.sha;
    const control = JSON.parse((await file(controlPath, commit)).toString("utf8"));
    requireState(object(control) && control.schema_version === 1 && positive(control.generation) && ["inspect", "apply"].includes(control.mode), "malformed-control");
    requireState(["unqualified", "qualified"].includes(control.writer_coverage) && Array.isArray(control.authorized_implementations) && Array.isArray(control.fixture_issue_numbers) && control.fixture_issue_numbers.every(positive), "malformed-control");
    requireState(new Set(control.fixture_issue_numbers).size === control.fixture_issue_numbers.length, "malformed-control");
    const sourcePaths = ["scripts/reconcile-wayfinder-labels.mjs", ".github/workflows/wayfinder-label-repair.yml"];
    requireState(control.authorized_implementations.every((approved) => object(approved) && sha(approved.source_revision) && object(approved.manifest) && Object.keys(approved.manifest).length === sourcePaths.length && sourcePaths.every((path) => hash(approved.manifest[path]))), "malformed-implementation-authorization");
    requireState(Array.isArray(control.policy) && control.policy.length > 0 && new Set(control.policy.map((policy) => policy?.path)).size === control.policy.length, "missing-or-malformed-policy");
    for (const policy of control.policy) {
      requireState(object(policy) && ["docs/agents/issue-tracker.md", "docs/agents/triage-labels.md"].includes(policy.path) && hash(policy.sha256), "unsupported-policy");
      requireState(sha256(await file(policy.path, commit)) === policy.sha256, "policy-digest-mismatch");
    }
    report.authority = { commit, generation: control.generation, mode: control.mode, policy: control.policy, writer_coverage: control.writer_coverage, authorized_implementations: control.authorized_implementations, executing: report.authority?.executing ?? null };
    if (control.workflow_id !== null) {
      requireState(positive(control.workflow_id), "malformed-workflow-id");
      const workflow = (await request("GET", `${prefix}/actions/workflows/${control.workflow_id}`)).body;
      requireState(workflow?.id === control.workflow_id && workflow.path === ".github/workflows/wayfinder-label-repair.yml" && typeof workflow.state === "string", "workflow-identity-mismatch");
      report.repair.workflow = workflow;
    }
    report.repair.health = control.mode === "inspect" || report.repair.workflow?.state !== "active" ? "disabled" : "unknown";
    return control;
  }
  function classify(issue) {
    requireState(object(issue) && positive(issue.number) && issue.url === `https://api.github.com${prefix}/issues/${issue.number}` && Array.isArray(issue.labels) && issue.labels.every((label) => object(label) && typeof label.name === "string"), "unreadable-issue");
    if (Object.hasOwn(issue, "pull_request")) return { eligible: false, labels: [] };
    const labels = issue.labels.map((label) => label.name);
    const unknown = labels.filter((name) => name.startsWith("wayfinder:") && !markers.has(name));
    const types = labels.filter((name) => markers.has(name));
    return { labels, eligible: types.length > 0 && unknown.length === 0, unknown, multiple_types: types.length > 1 };
  }
  function observeClassification(issue) {
    const classification = classify(issue);
    function retain(entries, reason) {
      const entry = entries.find((entry) => entry.number === issue.number && entry.reason === reason);
      if (entry) entry.labels = classification.labels;
      else entries.push({ number: issue.number, labels: classification.labels, reason });
    }
    if (classification.multiple_types) retain(report.scan.warnings, "multiple-wayfinder-types");
    if (classification.unknown?.length) retain(report.scan.unsupported, "unknown-wayfinder-classification");
    return classification;
  }
  const control = await authority();
  const implementationPaths = ["scripts/reconcile-wayfinder-labels.mjs", ".github/workflows/wayfinder-label-repair.yml"];
  const manifest = Object.fromEntries(implementationPaths.map((path) => [path, sha256(readFileSync(join(root, path)))]));
  const executing = { checkout_revision: null, source_revision: null, manifest, committed: false, workflow_source: null };
  try {
    const git = (argv) => execFileSync("git", argv, { cwd: root, env: { PATH: process.env.PATH }, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    executing.checkout_revision = git(["rev-parse", "HEAD"]).toString("utf8").trim();
    executing.committed = sha(executing.checkout_revision) && implementationPaths.every((path) => sha256(git(["show", `${executing.checkout_revision}:${path}`])) === manifest[path]);
  } catch { /* Inspection can still report uncommitted or unavailable source identity. */ }
  report.authority.executing = executing;
  async function approvedImplementation(current) {
    requireState(executing.committed, "unconfirmed-or-uncommitted-executing-source");
    const approved = current.authorized_implementations.find((approved) => object(approved) && sha(approved.source_revision) && object(approved.manifest) && Object.keys(approved.manifest).length === implementationPaths.length && implementationPaths.every((path) => approved.manifest[path] === manifest[path]));
    requireState(approved, "executing-implementation-not-authorized");
    for (const path of implementationPaths) requireState(sha256(await file(path, approved.source_revision)) === manifest[path], "reviewed-source-content-mismatch");
    if (args["--executor"] === "automatic") {
      // GitHub's workflow identity describes the running configuration, which
      // can differ from the main checkout used to execute this helper.
      const workflowPath = ".github/workflows/wayfinder-label-repair.yml";
      const workflowRef = process.env.GITHUB_WORKFLOW_REF;
      const workflowRevision = process.env.GITHUB_WORKFLOW_SHA;
      const expectedPrefix = `${repository}/${workflowPath}@`;
      requireState(sha(workflowRevision) && typeof workflowRef === "string" && workflowRef.startsWith(expectedPrefix) && workflowRef.length > expectedPrefix.length && !/\s/.test(workflowRef), "actual-workflow-source-identity-missing-or-mismatched");
      const contentHash = sha256(await file(workflowPath, workflowRevision));
      executing.workflow_source = { ref: workflowRef, revision: workflowRevision, sha256: contentHash };
      requireState(contentHash === approved.manifest[workflowPath], "actual-workflow-content-not-authorized");
    }
    executing.source_revision = approved.source_revision;
  }
  let evidence = control.operating_interval ? structuredClone(control.operating_interval) : null;
  let evidenceReadError = false;
  if (args["--evidence"]) {
    try { evidence = JSON.parse(readFileSync(args["--evidence"], "utf8")); }
    catch { evidence = null; evidenceReadError = true; }
  }
  const unresolved = report.repair.unresolved;
  const reference = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 2048;
  const instant = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
  function manualSessions(current) {
    const sessions = current.operating_interval?.manual_sessions ?? [];
    const owner = current.operating_interval?.transition?.owner;
    requireState(Array.isArray(sessions) && sessions.every((session) => object(session) && reference(session.id) && session.owner === owner && reference(session.admission_record) && Array.isArray(session.issue_numbers) && session.issue_numbers.every(positive)) && new Set(sessions.map((session) => session.id)).size === sessions.length, "malformed-manual-admission-inventory");
    return sessions;
  }
  const assessment = { canonical: null, evidence: null, sessions: [], automaticAdmissionRecord: null, baseValid: false };
  // Shared applicability precedes history collection and every action decision.
  // These assertions are evidence-based operating records, not an enforced lock.
  function assessOperatingEvidence() {
    function interval(value, name) {
      if (!value) { unresolved.push(`${name}-operating-interval-missing`); return null; }
      if (!object(value) || value.schema_version !== 1 || !object(value.history) || !Array.isArray(value.history.executors) || !object(value.transition) || !Array.isArray(value.transition.contenders)) {
        unresolved.push(`${name}-operating-interval-malformed`); return null;
      }
      if (value.repository !== repository || value.authority_generation !== control.generation || !reference(value.interval_id)) unresolved.push(`${name}-authority-binding-mismatch`);
      if (!reference(value.attested_by) || !reference(value.attestation_record)) unresolved.push(`${name}-attestation-reference-missing`);
      const owner = value.transition;
      if (!reference(owner.owner) || owner.accepted !== true || !reference(owner.ownership_record) || owner.contenders.length) unresolved.push(`${name}-exclusive-owner-not-established`);
      if (!object(owner.admission) || !["open", "closed"].includes(owner.admission.automatic) || !["open", "closed"].includes(owner.admission.manual) || !reference(owner.admission.record)) unresolved.push(`${name}-admission-record-missing-or-malformed`);
      return value;
    }
    assessment.canonical = interval(control.operating_interval, "canonical");
    assessment.evidence = interval(evidence, "supplied");
    if (evidenceReadError) unresolved.push("unreadable-evidence");
    if (assessment.canonical && assessment.evidence) {
      if (assessment.canonical.interval_id !== assessment.evidence.interval_id || assessment.canonical.transition.owner !== assessment.evidence.transition.owner) unresolved.push("operating-interval-mismatch");
      try { assessment.sessions = manualSessions(control); }
      catch { unresolved.push("malformed-manual-admission-inventory"); }
      assessment.automaticAdmissionRecord = assessment.canonical.transition.admission?.record ?? null;
    }
    assessment.baseValid = unresolved.length === 0;
  }
  function operatingEvidenceUsable() {
    return assessment.canonical !== null && assessment.evidence !== null && unresolved.length === 0;
  }
  function requestFinished(request, executor) {
    return request.submission === "not-submitted" && reference(request.completion_record) || request.submission === "submitted" && request.outcome === "completed" && positive(request.response_status) && (request.response_status === 200 && request.terminal_observation === "api-200-label-response" || request.response_status === 404 && request.terminal_observation === "api-404-and-absent-readback") && request.executor === executor && sha(request.authority_commit) && positive(request.authority_generation) && reference(request.completion_record);
  }
  function scanValid(scan) {
    return object(scan) && ["inspect", "apply"].includes(scan.mode) && typeof scan.complete === "boolean" && instant(scan.finished_at) && Number.isSafeInteger(scan.conflicts) && scan.conflicts >= 0;
  }
  function reconcileExecutor(known, observed) {
    requireState(object(known) && object(observed) && known.id === observed.id && reference(known.id) && Array.isArray(known.requests) && Array.isArray(observed.requests), "malformed-executor-evidence");
    const id = known.id;
    function incompatible(field) {
      const reason = `${id}:incompatible-${field}`;
      if (!unresolved.includes(reason)) unresolved.push(reason);
    }
    function bindings(left, right, fields) {
      const merged = { ...left, ...right };
      for (const field of fields) {
        if (left[field] !== undefined && left[field] !== null) {
          if (right[field] !== undefined && right[field] !== null && !isDeepStrictEqual(left[field], right[field])) incompatible(field);
          merged[field] = left[field];
        }
      }
      return merged;
    }
    const merged = bindings(known, observed, ["id", "kind", "owner", "admission_record", "authority_generation", "implementation"]);
    const requests = new Map();
    for (const record of [known, observed]) {
      const ids = new Set();
      for (const request of record.requests) {
        requireState(object(request) && reference(request.id) && positive(request.issue_number) && !ids.has(request.id), "malformed-request-evidence");
        ids.add(request.id);
        const prior = requests.get(request.id);
        if (!prior) { requests.set(request.id, request); continue; }
        const combined = bindings(prior, request, ["id", "executor", "issue_number", "owner", "authority_commit", "authority_generation", "policy", "implementation", "response_status", "terminal_observation"]);
        const submitted = ["submitted", "not-submitted"];
        if (submitted.includes(prior.submission) && submitted.includes(request.submission) && prior.submission !== request.submission) incompatible(`${request.id}-submission`);
        const terminal = requestFinished(prior, id) ? prior : requestFinished(request, id) ? request : null;
        if (terminal) {
          for (const field of ["submission", "outcome", "response_status", "terminal_observation", "completion_record"]) combined[field] = terminal[field];
        } else {
          combined.submission = prior.submission === "submitted" || request.submission === "submitted" ? "submitted" : "uncertain";
          combined.outcome = "unknown";
          combined.completion_record = null;
        }
        requests.set(request.id, combined);
      }
    }
    for (const request of known.requests) if (!observed.requests.some((candidate) => candidate.id === request.id)) unresolved.push(`${id}:${request.id}:canonical-request-unaccounted`);
    merged.requests = [...requests.values()];
    for (const record of [known, observed]) if (!["stopped", "active", "queued", "lost"].includes(record.state)) incompatible("executor-state");
    const stopped = [known, observed].find((record) => record.state === "stopped" && reference(record.report_record));
    if (stopped) merged.state = "stopped";
    merged.report_record = reference(observed.report_record) ? observed.report_record : known.report_record;
    if (known.scan && observed.scan) {
      requireState(scanValid(known.scan) && scanValid(observed.scan), "malformed-scan-evidence");
      bindings(known.scan, observed.scan, ["mode", "authority_generation"]);
      const difference = Date.parse(observed.scan.finished_at) - Date.parse(known.scan.finished_at);
      merged.scan = difference > 0 || difference === 0 && !observed.scan.complete ? observed.scan : known.scan;
    } else merged.scan = observed.scan ?? known.scan;
    return merged;
  }
  function reconcileCanonicalHistory() {
    if (!assessment.evidence) return;
    const { history } = assessment.evidence;
    // Newer completion records may settle known work, but cannot omit its identity.
    for (const prior of assessment.canonical?.history.executors ?? []) {
      if (!object(prior) || !reference(prior.id) || !["automatic", "manual"].includes(prior.kind) || !Array.isArray(prior.requests)) { unresolved.push("canonical-executor-inventory-malformed"); continue; }
      const index = history.executors.findIndex((executor) => executor?.id === prior.id && executor.kind === prior.kind);
      if (index < 0 || !Array.isArray(history.executors[index].requests)) { unresolved.push(`${prior.id}:canonical-executor-unaccounted`); continue; }
      history.executors[index] = reconcileExecutor(prior, history.executors[index]);
    }
    assessment.baseValid = assessment.baseValid && unresolved.length === 0;
  }
  function assessHistory() {
    if (!assessment.evidence) return;
    const { history } = assessment.evidence;
    if (history.complete !== true || !reference(history.manual_inventory_record)) unresolved.push("incomplete-admission-inventory");
    if (history.boundary?.covered_automatic_attempts !== undefined) requireState(Array.isArray(history.boundary.covered_automatic_attempts) && history.boundary.covered_automatic_attempts.every((id) => typeof id === "string" && /^automatic:[1-9][0-9]*:[1-9][0-9]*$/.test(id)) && new Set(history.boundary.covered_automatic_attempts).size === history.boundary.covered_automatic_attempts.length, "malformed-covered-attempt-inventory");
    if (history.boundary?.proved !== true || !reference(history.boundary?.record) || !(history.boundary.at === null || instant(history.boundary.at))) unresolved.push("unproved-history-boundary-expand-to-all-history");
    for (const session of assessment.sessions) {
      const executor = history.executors.find((executor) => executor?.kind === "manual" && executor.id === session.id);
      const beginningCurrentApply = command === "apply" && args["--executor"] === "manual" && args["--session"] === session.id;
      if (!executor) {
        if (!beginningCurrentApply) unresolved.push(`${session.id}:canonical-manual-admission-unaccounted`);
      } else if (executor.owner !== session.owner || executor.admission_record !== session.admission_record) {
        unresolved.push(`${session.id}:canonical-manual-admission-mismatch`);
      }
    }
    const ids = new Set();
    const completed = [];
    for (const executor of history.executors) {
      requireState(object(executor) && reference(executor.id) && ["automatic", "manual"].includes(executor.kind) && Array.isArray(executor.requests) && !ids.has(executor.id), "malformed-executor-evidence");
      ids.add(executor.id);
      if (!reference(executor.admission_record)) unresolved.push(`${executor.id}:missing-admission-record`);
      if (!reference(executor.report_record)) unresolved.push(`${executor.id}:missing-or-expired-report`);
      if (!["stopped", "active", "queued", "lost"].includes(executor.state)) unresolved.push(`${executor.id}:unknown-executor-state`);
      if (["active", "queued", "lost"].includes(executor.state)) unresolved.push(`${executor.id}:executor-can-still-submit`);
      const requestIds = new Set();
      let allFinished = true;
      for (const request of executor.requests) {
        requireState(object(request) && reference(request.id) && !requestIds.has(request.id) && positive(request.issue_number), "malformed-request-evidence");
        requestIds.add(request.id);
        const finished = requestFinished(request, executor.id);
        if (!finished) { unresolved.push(`${executor.id}:${request.id}:potentially-outstanding-request`); allFinished = false; }
      }
      if (executor.scan) {
        requireState(scanValid(executor.scan), "malformed-scan-evidence");
        const pass = { executor: executor.id, ...executor.scan };
        if (!report.repair.latest_attempt || Date.parse(pass.finished_at) > Date.parse(report.repair.latest_attempt.finished_at)) report.repair.latest_attempt = pass;
        const latestApply = report.repair.latest_apply_attempt;
        if (pass.mode === "apply" && (!latestApply || Date.parse(pass.finished_at) > Date.parse(latestApply.finished_at) || pass.finished_at === latestApply.finished_at && !pass.complete)) report.repair.latest_apply_attempt = pass;
        if (executor.state === "stopped" && reference(executor.report_record) && allFinished && pass.mode === "apply" && pass.complete) completed.push(pass);
      }
    }
    completed.sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at));
    report.repair.latest_complete_apply = completed[0] ?? null;
  }
  function assessTransition() {
    const transition = assessment.evidence?.transition;
    const reasons = report.transition.reasons;
    report.transition.owner = transition?.owner ?? null;
    report.transition.phase = transition?.phase ?? "unknown";
    if (!operatingEvidenceUsable()) reasons.push("admission-or-request-history-unresolved");
    if (!transition) return;
    if (args["--session"] !== transition.owner) reasons.push("only-accepted-owner-may-drain-or-resume");
    if (transition.admission?.automatic !== "closed" || transition.admission?.manual !== "closed") reasons.push("all-destructive-admission-not-closed");
    if (report.repair.workflow?.state === "active") reasons.push("automatic-workflow-still-active");
    if (control.writer_coverage !== "qualified") reasons.push("writer-coverage-unqualified");
    if (args["--action"] === "resume") {
      if (transition.phase !== "resume-pending" || transition.change_verified !== true || transition.authority_readback_commit !== report.authority.commit || control.mode !== "apply") reasons.push("coherent-cutover-not-verified");
    } else if (transition.phase !== "paused") reasons.push("transition-not-paused");
    report.transition.ready = reasons.length === 0;
  }
  const nativeAttempts = new Map();
  async function collectAutomaticHistory() {
    if (!positive(control.workflow_id)) return;
    const currentId = report.execution?.kind === "automatic" ? report.execution.id : null;
    const runs = [];
    let total = null;
    try {
      for (let page = 1; ; page++) {
        requireState(page <= 10_000, "run-history-limit-incomplete");
        const body = (await request("GET", `${prefix}/actions/workflows/${control.workflow_id}/runs?per_page=100&page=${page}`)).body;
        requireState(object(body) && Number.isSafeInteger(body.total_count) && body.total_count >= 0 && Array.isArray(body.workflow_runs) && body.workflow_runs.length <= 100, "malformed-run-history");
        requireState(total === null || total === body.total_count, "unstable-run-history");
        total = body.total_count;
        runs.push(...body.workflow_runs);
        if (body.workflow_runs.length < 100) break;
      }
      requireState(runs.length === total && new Set(runs.map((run) => run.id)).size === runs.length, "incomplete-run-history");
    } catch { unresolved.push("automatic-run-inventory-unavailable-or-incomplete"); return; }
    const boundary = evidence?.history?.boundary;
    // Only a positively evidenced list of covered attempts can truncate history.
    // Creation/start timestamps do not identify which reruns the boundary drained.
    const covered = assessment.baseValid && boundary?.proved === true && typeof boundary.record === "string" && boundary.record && Array.isArray(boundary.covered_automatic_attempts) ? new Set(boundary.covered_automatic_attempts) : new Set();
    for (const run of runs) {
      if (!object(run) || !positive(run.id) || run.workflow_id !== control.workflow_id || !positive(run.run_attempt) || run.run_attempt > 1000 || !Number.isFinite(Date.parse(run.created_at))) { unresolved.push("malformed-automatic-run"); continue; }
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
        const id = `automatic:${run.id}:${attempt}`;
        try {
          const observed = (await request("GET", `${prefix}/actions/runs/${run.id}/attempts/${attempt}`)).body;
          requireState(object(observed) && observed.id === run.id && observed.workflow_id === control.workflow_id && observed.run_attempt === attempt, "attempt-identity-mismatch");
          nativeAttempts.set(id, { status: observed.status, conclusion: observed.conclusion });
          const observedTime = [observed.run_started_at, observed.updated_at, run.created_at].find((value) => typeof value === "string" && Number.isFinite(Date.parse(value)));
          const latest = report.repair.latest_run_attempt;
          if (!latest || Date.parse(observedTime) > Date.parse(latest.started_or_updated_at) || observedTime === latest.started_or_updated_at && (run.id > latest.run_id || run.id === latest.run_id && attempt > latest.attempt)) {
            report.repair.latest_run_attempt = { id, run_id: run.id, attempt, status: observed.status ?? null, conclusion: observed.conclusion ?? null, started_or_updated_at: observedTime };
          }
          if (covered.has(id)) continue;
          if (id === currentId) { report.repair.current_attempt = { id, status: observed.status }; continue; }
          if (observed.status !== "completed") unresolved.push(`${id}:executor-still-running`);
          const artifacts = [];
          let expected = null;
          for (let page = 1; ; page++) {
            requireState(page <= 10_000, "artifact-inventory-incomplete");
            const body = (await request("GET", `${prefix}/actions/runs/${run.id}/artifacts?per_page=100&page=${page}`)).body;
            requireState(object(body) && Array.isArray(body.artifacts) && Number.isSafeInteger(body.total_count) && body.total_count >= 0 && body.artifacts.length <= 100 && (expected === null || expected === body.total_count), "malformed-artifact-inventory");
            expected = body.total_count;
            artifacts.push(...body.artifacts);
            if (body.artifacts.length < 100) break;
          }
          requireState(artifacts.length === expected, "incomplete-artifact-inventory");
          const matching = artifacts.filter((artifact) => artifact.name === `wayfinder-label-repair-${run.id}-${attempt}`);
          requireState(matching.length === 1 && matching[0].expired === false && positive(matching[0].id) && typeof matching[0].digest === "string" && /^sha256:[a-f0-9]{64}$/.test(matching[0].digest), "missing-or-expired-attempt-report");
          const body = (await request("GET", `${prefix}/actions/artifacts/${matching[0].id}/zip`)).body;
          const saved = archiveReport(body?.archive_base64);
          requireState(`sha256:${saved.digest}` === matching[0].digest && saved.report.schema_version === 1 && saved.report.repository === repository && saved.report.offline === report.offline && saved.report.execution?.id === id && saved.report.execution.kind === "automatic" && saved.report.execution.state === "stopped", "unconfirmed-attempt-report");
          if (evidence && object(evidence.history) && Array.isArray(evidence.history.executors)) {
            const execution = { ...saved.report.execution, report_record: `actions-artifact:${matching[0].id}` };
            const index = evidence.history.executors.findIndex((executor) => executor?.id === id);
            const known = index < 0 ? assessment.canonical?.history.executors.find((executor) => executor?.id === id) : evidence.history.executors[index];
            const reconciled = known ? reconcileExecutor(known, execution) : execution;
            if (index < 0) evidence.history.executors.push(reconciled);
            else evidence.history.executors[index] = reconciled;
          }
        } catch { unresolved.push(`${id}:missing-incomplete-or-unconfirmed-attempt-record`); }
      }
    }
    if (currentId && !report.repair.current_attempt) unresolved.push(`${currentId}:current-attempt-not-observed`);
  }
  assessOperatingEvidence();
  reconcileCanonicalHistory();
  await collectAutomaticHistory();
  assessHistory();
  assessTransition();
  if (report.repair.health !== "disabled") {
    const last = report.repair.latest_complete_apply;
    // Native failure qualifies its own apply, ordered with all retained applies.
    // The latest native observation remains visible even when it is an inspect.
    const applyRun = nativeAttempts.get(report.repair.latest_apply_attempt?.executor);
    const failedRun = applyRun?.status === "completed" && applyRun.conclusion && applyRun.conclusion !== "success";
    if (unresolved.length) report.repair.health = "unknown";
    else if (failedRun || report.repair.latest_apply_attempt?.complete === false) report.repair.health = "failed";
    else if (!last || last.authority_generation !== control.generation) report.repair.health = "missing";
    else report.repair.health = Date.now() - Date.parse(last.finished_at) > 90 * 60_000 ? "stale" : "healthy";
  }
  const listed = new Map();
  for (let page = 1; ; page++) {
    requireState(page <= 10_000, "enumeration-limit-incomplete");
    const response = await request("GET", `${prefix}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`);
    requireState(Array.isArray(response.body) && response.body.length <= 100, "incomplete-enumeration");
    for (const row of response.body) {
      classify(row);
      requireState(!listed.has(row.number), "unstable-enumeration");
      listed.set(row.number, row);
    }
    const link = response.headers.link ?? response.headers.Link ?? "";
    requireState(typeof link === "string", "malformed-pagination");
    const next = link.match(/<([^>]+)>; rel="next"/);
    if (next) {
      const expected = `https://api.github.com${prefix}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page + 1}`;
      requireState(next[1] === expected, "unsupported-pagination-target");
    } else if (response.body.length < 100) break;
  }
  for (const row of listed.values()) {
    const issue = (await request("GET", `${prefix}/issues/${row.number}`)).body;
    const classification = observeClassification(issue);
    report.scan.issues_seen++;
    if (classification.eligible && classification.labels.includes("needs-triage")) report.scan.conflicts.push({ number: issue.number, url: issue.html_url, ...classification });
  }
  report.scan.complete = true;
  if (command === "transition-check" && args["--action"] === "resume" && report.transition.ready) await approvedImplementation(control);
  if (command === "transition-check" && !report.transition.ready) report.refusals.push(...report.transition.reasons);
  if (command === "apply") {
    requireState(report.scan.unsupported.length === 0, "unsupported-classification-refuses-apply");
    requireState(["automatic", "manual"].includes(args["--executor"]), "executor-kind-required");
    const kind = args["--executor"];
    const id = kind === "automatic" ? `automatic:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}` : args["--session"];
    requireState(typeof id === "string" && (kind !== "automatic" || /^automatic:[1-9][0-9]*:[1-9][0-9]*$/.test(id)), "executor-identity-required");
    await approvedImplementation(control);
    function admission(current) {
      requireState(current.mode === "apply", "authority-inspect-only");
      requireState(current.writer_coverage === "qualified", "writer-coverage-unqualified");
      requireState(current.fixture_issue_numbers.length > 0, "no-authorized-fixtures");
      requireState(current.authorized_implementations.some((approved) => object(approved) && approved.source_revision === executing.source_revision && object(approved.manifest) && Object.keys(approved.manifest).length === implementationPaths.length && implementationPaths.every((path) => approved.manifest[path] === manifest[path])), "executing-implementation-not-authorized");
      requireState(operatingEvidenceUsable(), "admission-or-request-history-unresolved");
      const owner = assessment.evidence.transition;
      if (kind === "automatic") {
        requireState(report.repair.current_attempt?.id === id && report.repair.current_attempt.status === "in_progress", "automatic-attempt-not-current");
        requireState(report.repair.workflow?.state === "active" && owner.phase === "steady" && owner.admission?.automatic === "open" && owner.admission?.manual === "closed", "automatic-admission-closed");
      } else {
        const session = assessment.sessions.find((session) => session.id === id);
        requireState(!evidence.history.executors.some((executor) => executor.id === id), "manual-session-already-accounted-or-uncertain");
        requireState(owner.admission?.manual === "closed", "manual-admission-not-closed");
        requireState(session && ["paused", "steady"].includes(owner.phase), "manual-session-not-preadmitted");
      }
    }
    admission(control);
    const currentSession = kind === "manual" ? assessment.sessions.find((session) => session.id === id) : null;
    report.execution = { id, kind, owner: evidence.transition.owner, authority_generation: control.generation, implementation: executing, state: "stopped", admission_record: currentSession?.admission_record ?? assessment.automaticAdmissionRecord, report_record: kind === "automatic" ? `actions:${id}` : null, requests: report.attempts };
    const startingControl = JSON.stringify(control);
    for (const conflict of [...report.scan.conflicts]) {
      if (!control.fixture_issue_numbers.includes(conflict.number) || kind === "manual" && !currentSession.issue_numbers.includes(conflict.number)) {
        report.scan.outcomes.push({ number: conflict.number, result: "outside-authorized-fixtures" });
        continue;
      }
      const current = await authority();
      report.authority.executing = executing;
      requireState(JSON.stringify(current) === startingControl, "authority-changed-during-execution");
      admission(current);
      const before = (await request("GET", `${prefix}/issues/${conflict.number}`)).body;
      const classification = observeClassification(before);
      if (classification.unknown?.length) {
        report.scan.conflicts = report.scan.conflicts.filter((issue) => issue.number !== conflict.number);
        report.scan.outcomes.push({ number: conflict.number, result: "unsupported-classification", labels: classification.labels });
        throw new Error("unsupported-classification-refuses-apply");
      }
      if (!classification.eligible || !classification.labels.includes("needs-triage")) {
        report.scan.outcomes.push({ number: conflict.number, result: classification.eligible ? "already-absent" : "eligibility-changed" });
        report.scan.conflicts = report.scan.conflicts.filter((issue) => issue.number !== conflict.number);
        continue;
      }
      const attempt = { id: `${id}:${conflict.number}`, issue_number: conflict.number, executor: id, owner: evidence.transition.owner, authority_commit: report.authority.commit, authority_generation: current.generation, implementation: executing, policy: current.policy, observed_at: new Date().toISOString(), submission: "uncertain", outcome: "unknown", response_status: null, completion_record: null };
      report.attempts.push(attempt);
      let response;
      try { response = await request("DELETE", `${prefix}/issues/${conflict.number}/labels/needs-triage`); }
      catch { report.repair.unresolved.push(`${id}:${attempt.id}:potentially-outstanding-request`); throw new Error("destructive-request-outcome-unknown"); }
      attempt.submission = "submitted";
      attempt.response_status = response.status;
      if (response.status === 200 && Array.isArray(response.body) && response.body.every((label) => object(label) && typeof label.name === "string")) {
        attempt.outcome = "completed";
        attempt.terminal_observation = "api-200-label-response";
        attempt.completion_record = `report:${attempt.id}`;
      }
      const after = (await request("GET", `${prefix}/issues/${conflict.number}`)).body;
      const final = observeClassification(after);
      if (response.status === 404 && !final.labels.includes("needs-triage")) {
        attempt.outcome = "completed";
        attempt.terminal_observation = "api-404-and-absent-readback";
        attempt.completion_record = `report:${attempt.id}`;
      }
      if (attempt.outcome !== "completed") report.repair.unresolved.push(`${id}:${attempt.id}:potentially-outstanding-request`);
      const result = !final.eligible ? "eligibility-changed" : final.labels.includes("needs-triage") ? "conflict-remains" : response.status === 404 ? "already-absent" : "repaired";
      report.scan.outcomes.push({ number: conflict.number, result, labels: final.labels, response_status: response.status });
      if (!final.eligible || !final.labels.includes("needs-triage")) report.scan.conflicts = report.scan.conflicts.filter((issue) => issue.number !== conflict.number);
      if (!final.eligible) throw new Error("unsupported-concurrent-declassification");
      requireState(attempt.outcome === "completed", "destructive-request-outcome-unknown");
      if (response.status !== 404 && (response.status < 200 || response.status >= 300)) throw new Error(`delete-http-${response.status}`);
    }
    report.execution.scan = { mode: "apply", complete: true, conflicts: report.scan.conflicts.length, finished_at: new Date().toISOString() };
  }
}

try { await main(); }
catch (error) { report.transition.ready = false; report.refusals.push(error instanceof SyntaxError ? "malformed-json" : error.message); }
for (const attempt of report.attempts) {
  if (attempt.outcome !== "completed" && !report.repair.unresolved.some((gap) => gap.includes(attempt.id))) report.repair.unresolved.push(`${attempt.id}:potentially-outstanding-request`);
}
if (report.execution) report.execution.scan = { mode: report.command === "apply" ? "apply" : "inspect", complete: report.scan.complete && report.scan.unsupported.length === 0 && report.refusals.length === 0, authority_generation: report.authority?.generation ?? null, conflicts: report.scan.conflicts.length, finished_at: new Date().toISOString() };
report.result = report.refusals.length ? "refused" : !report.scan.complete || report.scan.unsupported.length || ["inspect", "status"].includes(report.command) && report.repair.unresolved.length ? "incomplete" : report.scan.conflicts.length ? "conflicts" : "clean";
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exitCode = report.result === "refused" ? 3 : report.result === "incomplete" ? 2 : report.result === "conflicts" ? 1 : 0;
