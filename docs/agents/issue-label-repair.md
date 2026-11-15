# Issue-label repair

Use this procedure to inspect Wayfinder label conflicts, run authorized repair or manual fallback, and coordinate changes that can end Wayfinder eligibility or alter repair authority.

This is a disabled qualification candidate. Keep the control in inspect mode, writers unqualified, implementation and fixture authorization empty, and the workflow disabled until the separately authorized qualification steps require otherwise. Source preparation and offline evaluation can proceed in that state. This page grants no live trial, integration change, or production enablement. The candidate's hard-disabled job guard also requires a reviewed, authorized source change before any receiving-workflow trial; enabling the workflow in GitHub alone is insufficient.

## Scope and entry conditions

The repair removes only `needs-triage` from eligible GitHub issues in `nisavid/real-skills`, repository ID `1409103617`. GitHub's current labels and the authorized [tracker policy](issue-tracker.md) determine eligibility. Open and closed issues are supported; pull requests are excluded.

The recognized labels are `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task`. Multiple recognized labels still satisfy this narrow eligibility predicate, but their malformed combination needs manual handling. An unfamiliar Wayfinder label or otherwise unresolved classification permits inspection only. The helper preserves all other labels and ordinary issues, including legitimate ordinary-intake `needs-triage`. Other prohibited triage labels remain a separate manual duty under [triage-labels.md](triage-labels.md).

Before dependent execution, load this procedure at its reviewed revision and record that revision. Verify the operation's authority, repository identity, current control and policy, and executing implementation. Read-only inspection does not require an apply grant. Apply requires a qualified operating interval and current authorization; transition work additionally requires its one accepted owner.

The maintained source is this page, reached from the tracker instructions. The candidate proposes Real Skills fork maintenance as maintainer and Real Skills Dispatch as status consumer. Record their acceptance before relying on operational coverage. Ivan retains the trial and production-enablement decisions.

## Current authority and operating evidence

The canonical authority is [`.github/wayfinder-label-repair-control.json`](../../.github/wayfinder-label-repair-control.json) at `refs/heads/main` in the configured repository. Every apply executor resolves that ref through the live GitHub API, verifies repository identity and the default branch, and reads the control and referenced policy from the resolved commit. It compares actual executing bytes with the authorized implementation manifest. Repeat this lookup before each destructive submission. A cached control or internally consistent old checkout cannot authorize itself.

For automatic execution, also bind authorization to the service-provided source identity and content of the workflow configuration actually executing the job. Verify that content against the authorized workflow content; an approved checkout and its working-copy workflow are insufficient when a retained executing configuration differs. Missing or inconsistent actual-source identity refuses apply before DELETE. A different source revision with identical authorized workflow content remains usable when the other gates hold.

The control's `operating_interval` carries the continuing, evidence-based attestation for ordinary automatic operation. The accepted coordinating owner establishes it from the writer inventory, current controls, native coordination records, the evidenced admission/history boundary, and the admitted manual-session inventory. Bind it to the repository, authority generation, owner/session, and covered executors and requests. Check those bindings against current authority and the records that remain applicable. An issue body, label event, actor name, or copied approval cannot supply attestation authority.

Automatic event and scheduled runs use that continuing interval; they do not require a new human attestation or `--evidence` file for every run. Each run gathers prior admitted GitHub run/attempt reports from Actions artifacts and produces its own request evidence. Automatic inspection and refusals before admission also retain a stopped, no-request attempt record. Its identity is `automatic:<GITHUB_RUN_ID>:<GITHUB_RUN_ATTEMPT>`. Missing, interrupted, or expired records remain unresolved.

For manual fallback or a transition, an authorized actor supplies additional records through `--evidence FILE`. Use the maintained [synthetic operator-evidence specimen](../../tests/fixtures/wayfinder-label-repair/operator-evidence.json) for the accepted input shape. It is test data, not usable live evidence or an approval. Establish each live assertion from the applicable GitHub records and native coordination history, identify its authorized author, and account for automatic attempts and admitted manual sessions. A manual `--session` must match its previously admitted bounded session; a transition `--session` identifies the accepted owner.

The helper checks structure, consistency, applicability, and claimed coverage. It does not independently establish the truth of an attestation or enforce a repository-wide lock. An assertion cannot override missing records, ambiguous admission, or an uncertain DELETE. Existing supported records and authorized attestations may suffice; this procedure requires no new ledger, attestation service, or particular evidence-producing program.

## Inspect conflicts and repair health

Run the [maintained CLI](../../scripts/reconcile-wayfinder-labels.mjs) from the reviewed checkout:

```sh
node scripts/reconcile-wayfinder-labels.mjs inspect
node scripts/reconcile-wayfinder-labels.mjs status
```

Both commands are read-only. Read the report's current conflicts and coverage together with authority, workflow state, operating interval, transition state, and unresolved execution evidence. A clean current label read does not discharge an earlier uncertain request. Missing records remain visible even after a later successful run. An inspect-only success does not establish successful apply health.

The CLI returns JSON. Exit `0` means clean, `1` means observed conflicts, `2` means incomplete coverage, and `3` means refusal. Retain the report and inspect its limits rather than reducing it to a successful process exit.

The status consumer checks repair when entering operational coverage and before relying on labels for triage or frontier decisions. On disabled, failed, stale, missing, or unknown repair, inspect the affected issues and evidence, then arrange an authorized repair or manual fallback. Record actual observation times and any accepted inspection cadence. A schedule is an opportunity to run, not a maximum repair delay; absent consumer coverage supplies no unattended detection promise.

Inspection is complete when the report identifies observed conflicts, supported scan coverage, authority and implementation identity, and every known uncertainty relevant to repair or transition. An unreadable repository or incomplete history is a reported limit, not a clean state.

## Run automatic repair

Automatic apply is available only after separate authorization and qualification. The apply workflow invokes `node scripts/reconcile-wayfinder-labels.mjs apply --executor automatic` with automatic execution identity. It obtains ordinary operating evidence as described above.

Issue events, completion of the existing intake and needs-info workflows, scheduling, and manual dispatch are wake-up hints. Every admitted run reconciles current repository state. Workflow-token additions need their qualified completion-trigger or later reconciliation route; the label event alone is insufficient coverage.

The workflow requests no shared concurrency policy that replaces pending runs. Recovery qualification uses overlapping started attempts, settled no-submission/refusal reports, and a later nonoverlapping automatic pass in place of deliberate coalescing recovery. Every started attempt stays represented. Once the applicable records establish that those attempts have stopped with no outstanding requests, a successful later pass can remove eligible conflicts under the same continuing interval without fresh human attestation. Historical replaced, canceled, or otherwise unaccounted attempts remain unresolved until positively accounted; removing the policy does not erase that history. Recovery depends on settled history and a successful later pass, with no maximum delay or guaranteed recovery from unknown mutations.

A repair pass:

1. Resolves current authority and validates the qualified interval, implementation, policy, admission, and execution history.
2. Enumerates all supported issues with pagination, collecting identities before removals. It excludes pull requests and reads each candidate's current labels.
3. Checks eligibility and any authorized fixture allowlist. Immediately before a removal, it resolves current authority again and records the executor, attempt, target, authority, and submission.
4. Removes only the named `needs-triage` label, then reads back the issue and retains the outcome. It never replaces the label set or follows a mutation redirect into another repository.
5. Retains the complete report, including partial scans, failed reads, unresolved attempts, and conflicts that remain.

A 404 requires a successful readback before reporting the relevant absence. A timeout after submission, runner loss, missing response, or ambiguous retry leaves a potentially outstanding request. A terminal job badge, cancellation, elapsed time, credential expiry, or later clean scan cannot settle that uncertainty.

A pass is complete when all supported pages and candidates are accounted for and every attempted operation has its observed outcome or explicit unknown. Report remaining conflicts and incomplete coverage separately. Lasting convergence requires a successful pass after the last conflicting write while eligibility remains stable; repeated additions can prevent it.

## Pause, drain, change, and resume

Use this transition before removing the last recognized Wayfinder marker, changing classification definitions, transferring an affected issue, changing governing policy or authority, changing authorized implementation, or making `needs-triage` legitimate under a new policy. Human, agent, bulk-replacement, repository-label, and integration routes that can make those changes must participate. Ordinary additive label writes require no new lock.

1. **Establish one owner.** Record one accepted repository-wide owner/session in the existing coordination context. That owner controls admission closure, drain, changes, verification, and resume. A second transition waits. A handoff transfers the complete active state explicitly; ambiguous or lost ownership keeps repair paused. No timeout grants takeover.
2. **Close admission.** Disable the repair workflow and read back its disabled state. Close the sole manual-admission route. Account for already admitted automatic and manual executors and stop them taking further work. Eligibility and policy changes wait. Disabling a workflow alone does not close manual admission or finish submitted requests.
3. **Account for the history.** Inventory every potentially admitted executor, queued run, attempt, retry, and manual session since the last evidenced drain boundary, retaining that boundary's supporting records. Cross-check supplied completion history against the canonical preadmitted manual-session inventory in current control. Every canonical session must be represented; a completeness assertion cannot override an omitted session. If the boundary cannot be established, expand the history to all potentially admitted work. Missing coverage prevents a positive drain.
4. **Establish completion.** For each executor, establish either that it stopped before submission or that all submitted destructive requests have definitively finished and it can submit no more. Run `transition-check --action drain` through the maintained CLI with the owner's `--session` and applicable `--evidence FILE`. Its result checks the supplied account; it does not replace the owner's evidence assessment.
5. **Make the authorized change.** Proceed only with exclusive ownership, closed admission, and a positive drain supported by the records. Verify resulting labels. For policy or implementation cutover, publish a coherent new control generation and policy with the authorized implementation manifest, remove obsolete authorization, and independently read the result back through the API.
6. **Verify resume.** The same owner completes all accepted transition work, checks the current authority and writer controls, repeats the canonical manual-inventory cross-check against supplied completion history, and runs `transition-check --action resume` with the applicable owner and evidence. Only that owner may then reopen authorized admission and relinquish the transition. The check itself is not an enablement action or permission.

If any ownership, admission, or submitted-request outcome is unresolved, keep repair paused and hold the affected reclassification or cutover. That hold may be indefinite; positive completion evidence may be unrecoverable. Current issue labels and a later green run cannot clear it.

Rollback is another authorized transition. Moving the repository, ref, or authority path is a separately qualified migration that retires apply authorization at the old locator before enabling the new one. Fresh and rerun executors must resolve current authority; the drain protects requests already admitted under the old generation.

## Use manual fallback

Manual fallback uses the same eligibility rule, live authority, implementation checks, and request accounting as automatic apply. Disabling automatic execution does not authorize a manual session. The current preadmitted session may begin its own apply without first being recorded as stopped; that admission exception cannot establish drain or resume readiness.

The owner admits one bounded manual session before closing further admission, records its identity and scope, and holds eligibility and policy stable while it runs. Invoke `apply --executor manual --session ID --evidence FILE` through the maintained CLI using that admitted identity and established records. Remove only confirmed eligible `needs-triage`, read back each issue, and retain every submission and outcome.

Account for the manual session and earlier automatic work until each can submit no more and every request is settled. A lost session or response leaves the drain unresolved. Restore ordinary-intake labels only as an explicitly authorized transition change after drain, never as automatic compensation for an uncertain removal.

## Qualify the candidate and its consumers

Keep source preparation, offline evidence, service qualification, and adoption distinct. Neither a settings inventory nor a passing source review establishes writer compliance. Resolve actual eligibility-changing routes before destructive operation; an integration's issue-write permission identifies a route to assess, while a suspension button or a one-way issue-creation setting does not establish a safe drain.

Use `capturing-agent-procedures` and the repository's independent review route for this maintained procedure. Producer self-use evaluates the candidate revision directly without depending on its own completed capture. Evaluate discovery separately from application:

| Evaluation | Required observation |
| --- | --- |
| Conflict, repair-health, manual-fallback, declassification, or policy-cutover request | The consumer reaches this page from tracker guidance and loads the reviewed revision before dependent execution. |
| Ordinary issue triage or an unrelated additive label edit | The consumer follows ordinary tracker guidance without unnecessarily invoking repair. |
| Inspection with no conflicts | The procedure is invoked; the consumer reports a no-op with coverage and evidence limits. This is not a negative-discovery case. |
| Two consecutive automatic runs with synthetic eligible conflicts | Each can submit the permitted fake DELETE under the continuing qualified interval without a fresh human attestation. |
| Ordinary intake, closed issues, pull requests, unknown classification, and allowlist exclusions | Only eligible supported targets can receive the narrow removal; ordinary and unrelated labels remain intact. |
| Delayed additions and missed, reordered, or duplicate triggers | Current-state reconciliation recovers without replaying stale payload decisions. |
| Overlapping started attempts followed by a nonoverlapping pass | The workflow requests no replacement-producing concurrency policy. All started attempts remain represented, conservative no-submission/refusal reports settle, and the later automatic pass performs the permitted fake DELETE under the same interval without fresh human attestation. |
| Two owners, a late manual admission, lost ownership, or an obsolete rerun | The consumer preserves exclusive control and refuses unsafe transition, admission, or obsolete apply. |
| Missing attempt/report, uncertain DELETE, expired evidence, or an unproved history boundary | Status retains the uncertainty and drain is refused, including after a later clean scan. |
| Canonical manual sessions omitted from supplied history, active or lost sessions, missing reports, or uncertain requests | Both drain and resume refuse despite completeness assertions. Positively stopped sessions with settled or no submissions permit readiness when the other gates hold. |
| Approved checkout with different actual executing-workflow content; identical content at another revision; missing or inconsistent actual-source identity | Different executing content or unresolved identity refuses before DELETE. Identical authorized workflow content remains usable at another revision when the other gates hold. |
| Authorized manual fallback and coherent cutover | The consumer uses the admitted session, accounts for all requests, verifies current authority, and resumes only through the same owner. |

Run deterministic cases only through the test transport. `--offline-transport ABSOLUTE_EXECUTABLE` belongs to offline tests and supplies no live qualification. Retain the actual trace, candidate revision, inputs, result, and missing evidence for each selected evaluation.

Before production enablement, require accepted ownership and transition constraints, demonstrated writer and admission controls, current independent authority, complete conservative accounting, clean review and selected offline passes on the final revision, separately authorized service qualification, verified publication/discovery, and a naturally useful consumer invocation. Changed candidate bytes or material evidence invalidate affected passes.

At this candidate stage, installed procedure discovery, actual Actions behavior, live transition controls, and consumer adoption remain unestablished. Report those gaps while continuing authorized preparation. After authorized publication or installation, the consumer reads back the invocation chain and reviewed revision it actually loaded, then retains one useful application's observed result. A pointer alone is not adoption, and synthetic success is not live service evidence.
