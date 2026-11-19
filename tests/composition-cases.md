# Composition contract acceptance cases

These ten cases are the maintained acceptance cases for the composition contract that the `issue-composition` skill carries and that `wayfinder`, `triage`, `to-spec`, and `to-tickets` load before they write tracker state. They are instruction-driven: an agent runs a candidate build's skills against a fixed tracker state and a fixed prompt, and the run is judged by the state it leaves behind. Package unit tests and plugin discovery exercise none of this.

The cases were decided in [Define composition acceptance cases and axis ownership](https://github.com/nisavid/real-skills/issues/72#issuecomment-6990630784) (cases 1 to 7) and [Define assessment freshness and concurrent axis updates](https://github.com/nisavid/real-skills/issues/74#issuecomment-6998229070) (cases 8 to 10), and their evidence rules in [Define composition qualification and maintained ownership](https://github.com/nisavid/real-skills/issues/75). Each case below fixes four things, so a reviewed fixture can be built from it: the starting state, the prompt, the fields and relations the run intends to change, and the state that must survive. The starting states and prompts elaborate the decided case statements; a fixture author refines them, and the fixture's reviewer checks them against those decisions. Unless a case says otherwise, the state that must survive is everything the run does not intend to change: the other classification axes, claims, blockers, parent membership, later lifecycle state, holds, and authority.

## Status

The design is agreed. None of the ten cases has been run on any build. Record a demonstration separately from this agreement, with the evidence below; an agreed case is not a demonstrated one.

## Running a case

- **Fixture.** A run counts only against a fixture whose prompt, expected observations, and permitted actions were fixed before the run and reviewed by someone other than its author. Give the agent under test the inputs, not the expected observations.
- **Tracker pair.** Run every case except case 6 and case 7's role-based form on a dedicated private fixture repository, synced to one Linear fixture team, whose tracker policy permits a bug to be a map. Its provisioning is a separately authorized qualification step. A dedicated pair keeps test traffic out of working Linear teams.
- **Provider.** Record which provider actually supplied each skill. A bare skill call on a host with two providers installed can load the other provider's copy.

### What counts as success

- **An isolated run** passes when the intended changes landed at the authoritative tracker and every unrelated field matches the before-read.
- **A concurrent run** passes when both writers' intended changes survived. A before-and-after comparison alone cannot tell who changed a field, or reveal an intervening edit that was overwritten, so a concurrent case needs the controlled interleaving its fixture specifies.

### What a passing run leaves behind

Each run record carries:

- the artifact digest, the source revision, the release or snapshot identity, the client, and which provider supplied each skill;
- the authoritative before-and-after state of every field and relation the case names, and of the surviving state;
- every material fact the run could not establish.

### Carrying a result to a later build

Rerun any case whose result could change on the later build. That includes a change to a packaged skill or reference, the manifest, provider resolution, the client, the tracker policy, or the sync configuration the case relies on. Identical skill text can still load from the wrong provider. A case carried forward unchanged points to its original build and run. The first acceptance of the contract requires all ten cases, with their variants, to pass on one identified installed build.

## Cases

### 1. Wayfinder followed by triage on a GitHub map

- **Starting state.** A GitHub map with `wayfinder:map`, one claimed child decision ticket with a decision type, and one open blocker on that child. A new incoming implementation request linked to the map carries no triage state.
- **Prompt.** Assess the incoming request with Wayfinder, then triage it.
- **Intends to change.** Wayfinder records its assessment pointer and coverage on the request or the map. Triage sets the request's work kind and one triage state.
- **Must survive.** The map label and membership, the child's decision type, claim, and blocker, and every field of the request that neither step owns. The request does not become a decision ticket by being linked to the map.

### 2. Wayfinder followed by triage on a Linear projection

- **Starting state.** As in case 1, under a fixture policy in which GitHub is the authority for work kind, triage state, map structure, decision type, parent membership, blockers, claim, and closure, and the fixture Linear team is its projection and the authority only for the lifecycle statuses GitHub cannot represent: Backlog, Todo, In Progress, and In Review. The incoming request carries `needs-triage` on GitHub, projected into its Linear copy, which is in native Triage. A second, already accepted Issue on the map is In Progress in Linear.
- **Prompt.** Assess the incoming request with Wayfinder, then triage it. Separately, change the map classification of the In Progress Issue.
- **Intends to change.** The request's work kind and triage state at GitHub; on acceptance, its Linear status, which Linear holds, moves to the team's configured post-triage status. The second Issue's map classification at GitHub.
- **Must survive.** The request's Linear copy uses native Triage for intake. No skill edits the projected `needs-triage` label in Linear, which changes only at GitHub, and no skill adds a `needs-triage` label in Linear to duplicate native Triage. The second Issue keeps In Progress through its map classification change. Other projected copies stay as the sync left them.

### 3. A bug that is also a map

- **Starting state.** On the fixture GitHub repository, whose policy permits a bug to be a map, an Issue triaged as `bug` with a triage state.
- **Prompt.** Chart this bug's route as a Wayfinder map.
- **Intends to change.** Map structure: the map label and the map body, and any children Wayfinder creates.
- **Must survive.** The work kind `bug` and the triage state, the Issue's claim, blockers, and parent membership.

### 4. A decision ticket promoted in place to a map

- **Starting state.** A claimed decision ticket with a decision type and one open blocker, a member of a larger map. Its question needs several children, one of them a probing ticket.
- **Prompt.** Promote this ticket to a map and chart its children.
- **Intends to change.** Map structure on the ticket; the new child tickets; a blocking edge from the ticket to each child whose result it actually needs.
- **Must survive.** The ticket's identity, its membership in the larger map, its claim, and its existing blocker. It keeps its decision type while it still owns the decision that type describes; the fixture fixes whether a person must still choose after the children report, and the expected type follows from that.
- **Depends on.** The probing decision type, which comes from [Add probing and the probing decision type to Real Skills [Leashed]](https://github.com/nisavid/real-skills/issues/115). The case cannot run until that type is in the build under test.

### 5. Triage changes only the triage state

- **Starting state.** A triaged Issue with a work kind and a triage state, which also carries a decision type, a claim, and a blocker.
- **Prompt.** Move this Issue to a different triage state.
- **Intends to change.** The triage state, by one narrow write.
- **Must survive.** Everything else: work kind, decision type, map structure, claim, blocker, membership, and later lifecycle state.

### 6. Project policy forbids the coexistence

- **Starting state.** The Real Skills tracker, under a policy where Wayfinder Issues carry no triage labels, and a Wayfinder Issue there.
- **Prompt.** Triage this Wayfinder Issue.
- **Intends to change.** Nothing.
- **Must survive.** Every field and relation. The skill writes nothing and returns the conflict to the policy's owner.
- **Depends on.** The venue's tracker policy forbidding the coexistence of Wayfinder classification and triage labels when the case runs.

### 7. Creation inside a map

Three forms. In each, the parent, blockers, recipient, and other supplied inputs reach the step that uses them.

- **Ordinary creation.** Starting state: a map with an open child. Prompt: create a new ticket under this map, blocked by that child. Intends to change: the new ticket, its membership, its blocker, and any initial values its creator is permitted to set. Must survive: the map and existing children.
- **File and dispatch, with specialist roles.** Run in Proto-Factory. The initiating thread hands the whole instruction to the appropriate Sage through the established fallback, and intake, triage, and dispatch follow project policy under [the Proto-Factory intake contract](https://github.com/nisavid/provingkit/issues/1009). Starting state: a map with an open child, and a named recipient able to work a ticket of this kind. Prompt: file a ticket under this map, blocked by that child, and dispatch it to the named recipient. Intends to change: the new ticket, its membership, its blocker, any initial values its creator is permitted to set, and the recipient's start on that ticket. Must survive: the map, its existing children, and their claims and blockers.
- **File and dispatch, without specialist roles.** Run in a disposable Claude Code profile that holds only the build under test. The receiving thread performs the steps it owns and is authorized to perform. Starting state: a map with an open child, and a named recipient that the profile can start. Prompt: file a ticket under this map, blocked by that child, and dispatch it to the named recipient. Intends to change: the new ticket, its membership, its blocker, any initial values its creator is permitted to set, and the recipient's start on that ticket. Must survive: the map, its existing children, and their claims and blockers.

In both file-and-dispatch forms, the case passes only when the intended recipient has actually started on the named ticket. A filed issue, an assignee, or a sent message alone does not demonstrate that. Filing the ticket and dropping the dispatch fails the case, and so does rejecting the whole request because the first thread cannot itself set a field.

### 8. Two writers at once

- **Starting state.** An Issue with a triage state and a decision type.
- **Prompt.** Triage changes the triage state while Wayfinder changes the decision type.
- **Intends to change.** The triage state, written by triage, and the decision type, written by Wayfinder, each by one narrow write.
- **Interleaving.** Both writers read the same starting state before either writes. Two agents that merely start around the same time can run in sequence by accident and pass a broken implementation.
- **Must survive.** At the authoritative tracker, both intended changes, and every unrelated field.

### 9. A stale decision, and an interrupted write

Two variants, observed separately.

- **Stale decision.** The operation's own axis changes between its decision and its write. Starting state: an Issue in `needs-triage`, with triage's decision to move it to `ready-for-agent` made but not yet written; before that write, the triage state becomes `wontfix`. Prompt: finish moving this Issue to `ready-for-agent`. Intends to change: nothing is written; the pending write is dropped and the operation reassesses from the new state. Must survive: the `wontfix` label and every other field.
- **Interrupted write.** A two-step label change is interrupted after its first step. Starting state: an Issue whose change from `needs-triage` to `ready-for-agent` stopped after one step, so it carries both states or neither, as the fixture fixes. Prompt: complete the triage state change. Intends to change: the triage state, to exactly `ready-for-agent`, written only after the operation inspects the actual labels. Must survive: every other field.

### 10. Freshness

Three variants.

- **New blocker.** Starting state: an assessed ticket and one independent sibling under the same assessment, with a blocker added to the ticket after the assessment. Prompt: resume work from the assessment. Intends to change: a record of the failed pre-work check on the ticket, which holds its dependent action, and work on the independent sibling. Must survive: the new blocker, the ticket's claim, and every other field.
- **Unverifiable input.** Starting state: an assessed ticket whose action depends on a material input the run cannot verify, and an independent sibling. Prompt: resume work from the assessment. Intends to change: the dependent action stays pending, with that recorded; work on the independent sibling proceeds. Must survive: the assessment, claims, blockers, and every other field.
- **Expired authorization.** Starting state: an assessed ticket whose action relied on an authorization that has since expired. Prompt: resume work from the assessment. Intends to change: the pre-work check catches the expiry as a time input and holds the action that depended on it. Must survive: every field; the expired authorization is not treated as current.
