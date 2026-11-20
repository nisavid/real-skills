---
name: issue-composition
description: "The composition contract for issue-tracker state: which workflow owns each classification axis, which tracker holds the authority for each fact, and how to change one axis without disturbing the others. Use before a skill writes a classification, native status, relation, or issue body on an issue tracker, or when someone asks how these classifications combine."
---

# Issue Composition

Several workflows write to the same issues. This contract lets them compose: each changes only what it owns and leaves the rest as it found it. Load it before writing a classification, a native status, a relation, or an issue body. Invocation grants no tracker authority; the calling workflow's request and governing instructions still decide whether a write may happen.

The project's tracker instructions, reached through its `AGENTS.md` or `CLAUDE.md` pointer, hold the project's policy: which tracker is the authority for each fact, which combinations of axes it permits, and how its labels and native statuses map to the values below. A skill's own label guidance never overrides that policy.

When the tracker instructions state no rule for a question this contract asks, because they have no Tracker policy section or the section is silent on it, first read the project's existing tracker docs for a stated rule and follow it. Where they state nothing, use the setup template's defaults, which make the chosen tracker the authority for every fact it can represent and forbid no combination. Say so in the output, and point to the `setup-matt-pocock-skills` skill. Stop only if the existing docs contradict the action being taken. A fact the chosen tracker cannot represent, such as a mirror's native lifecycle status, has no default authority: leave it as the mirror holds it, and say so.

## Axes

An issue carries only the axes that apply to it. An incoming issue may still be awaiting classification.

| Axis | Values | On one issue | Owning workflow |
| --- | --- | --- | --- |
| Work kind | The project's category roles, such as `bug` and `enhancement` | One applicable value on a triaged issue | `triage` |
| Triage state | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, or the tracker's native equivalent | One value on a triaged issue | `triage` |
| Map structure | A map, or not | Applies or does not | `wayfinder` |
| Decision type | The ticket types `wayfinder` defines | None or one | `wayfinder` |

- Map structure and decision type can coexist on one issue, and a bug can also be a map. Wayfinder's promotion rule decides when a map keeps its decision type.
- Owning triage state does not confer ownership of the issue's whole lifecycle. A tracker can use one field for several stages of work: a native intake state such as Linear's Triage is the triage state, while later lifecycle states such as In Progress or Done are not. Preserve later lifecycle states during unrelated edits, including a change of map classification. An authorized rejection can still perform the project's prescribed closure transition.
- Claims, blockers, parent membership, provenance, holds, and authority are not axes. No workflow changes them as a side effect of writing an axis.

## Ownership

Each axis has one owning workflow, and a skill changes only an axis it owns.

- **Initial values.** A workflow that creates an issue may initialize an axis it does not own when its own instructions provide for that write, the issue meets the criteria for the value, and project policy permits it.
- **Steps of a larger instruction.** The owning workflow may be one step in a larger instruction, such as "file this and dispatch it". Each authorized step applies the properties and relations it owns. An earlier step carries forward every supplied input that a later step, instructed or implied and properly assigned, can apply: the parent, blockers, recipient, and the rest. A step that cannot set a field itself passes it on; it neither drops it nor rejects the whole request.
- **One value per axis.** A tracker may not enforce one value per axis; GitHub does not. The owning workflow keeps its own axis to one value. When an issue carries a genuine conflict on that axis, surface it to the maintainer and pause the affected change.
- **Forbidden combinations.** When project policy forbids the combination an operation would create, write nothing and return the conflict to the policy's owner.

## Authority and projection

- Project policy names the tracker that is the **authority** for each fact. Read and write a fact at its authority, and compute eligibility from the authoritative blocker.
- A copy of a fact in another tracker is a **projection**. A relation missing from a projection is a projection gap. If the authoritative blocker cannot be checked, eligibility is unknown, not clear.
- Leave a valid projected copy alone. If the authoritative value is wrong, handle it at the authority under that tracker's policy. A valid `needs-triage` label copied into Linear beside native Triage still represents one intake state.
- Where a tracker's native intake state holds the triage state, as Linear's Triage does when Linear owns intake, it is sufficient: no skill adds a `needs-triage` label to represent it.
- Where people rely on a projection's view of blockers, project policy may assign a workflow to copy that edge there and verify it.
- A tracker can own a native lifecycle field that the other does not represent. Policy names its authority like any other fact's.

## Writing an axis

1. Read the affected fields from their authoritative tracker.
2. Add or remove only the values this operation owns, one value per write. Never use a write that replaces the whole label set.
3. Read back, and compare with the before-read.

When the basis of the decision changes:

- **Stop and reassess.** If the operation's own axis changed after the decision, drop the pending write and reassess from the new state. If `needs-triage` became `wontfix`, a pending `ready-for-agent` write is dropped.
- **Already done.** If someone already made the intended change and its basis still holds, the operation is done.
- **Interrupted.** If a two-step label change was interrupted, inspect the actual labels before retrying.
- **The remaining window.** A re-read still leaves a window before the write. For ordinary skill-driven label edits, use narrow writes, read back, reassess when the basis changes, and record the race that remains between checking and writing.
- **A known competing writer.** If a known competing writer could invalidate this particular edit and an overwrite would be unacceptable, defer the edit until the writers can coordinate.

This contract adds no lock, adapter, or service.

## Issue bodies

- **One writer per body.** Two writers editing different sections can erase each other's work when both submit the entire body, so the unit is the whole body, not a section. Wayfinder's map-body rule (under The map body) names the editor of a map body, which includes a promoted ticket's body; for a map body, a claim does not.
- **Coordinate the whole cycle.** Coordinate the read, edit, write, and read-back for that issue. Outside a map body, a claim identifies the responsible editor, but it cannot exclude a simultaneous human or sync edit.
- **Without coordination.** Leave the proposed change for the responsible editor, and keep any authoritative blocker where the frontier check reads it.
- **Shared facts.** A fact that several operations write is recorded in native relations, labels, or append-only comments; a body that reflects it, such as a map body, changes only through its responsible editor.
- **Coordination notes.** A coordination note is an append-only comment on an issue that records who is working it and what was checked before work.

## A parent blocked by its own child

A parent is blocked while any child of its own is open, whatever the child's type: it is not picked up, resumed, resolved, or closed. That holds wherever an issue has children, such as a map, a promoted ticket, or a spec with tickets beneath it. The parent and child relationship is the blocker. It needs no edge and no `Blocked by:` line, and any session records it by adding the child.

- **The native edge.** Where the tracker takes a blocking edge from a parent to its own child, add it for each child whose result the parent needs, and read it back in the intended direction; it shows the wait in the tracker's own view. If the tracker rejects the edge, or the read-back does not show it, the open child still blocks its parent, and nothing more is needed.
- **Deciding pickup.** Whatever decides what can be picked up, resumed, resolved, or closed counts every open child among the parent's blockers, reading each fact at its authority, and reads them again immediately before it records a resolution or a closure. If it cannot list them, or cannot verify a child's state, the parent's eligibility is unknown.
- **Ending the wait.** The wait ends when every child is closed. A child that no longer belongs is closed as out of scope, or moved out from under its parent together with any blocker the parent carries on it, before the parent closes. Either is a scoping act for the parent's planning owner, not a way for a session to free the parent.
- **When the last child closes.** The session that closes a parent's last open child hands the parent back to its planning owner, whom Wayfinder names (under Assess and keep the route current). The planning owner reassesses the parent against its own destination and acceptance criteria, then closes it, adds what is still missing, or leaves it open for pickup where it still owns a decision. A session that is its own planning owner, as it is where the project names none, does this in the same turn. Where nothing hands back, as when a merge closes the child, the planning owner's next refresh finds the parent with no open child and reassesses it then.
- **No claim on a parent.** A ticket with an open child of its own holds no claim. The session that gives a ticket its first open child releases its own claim on it in the same step. A claim that another session still holds on such a ticket reserves nothing: its holder releases it at its next pre-work check, and the ticket's planning owner clears it when it reassesses the ticket and leaves it open. While the ticket holds no claim, its body changes only through the editor that Wayfinder's map-body rule names; where the ticket is not a map body, that rule applies to it as though it were one.
- **Any other blocker.** A parent can also wait for a ticket outside its children. Record that like any other blocker: by the native edge, or on a tracker without one, as a `Blocked by:` line that the body's editor writes in the parent's body. A session that can do neither does not rely on a comment, which nothing that decides pickup reads. It gives the parent a `task` child for the prerequisite and records the blocker on that child as it creates it.
- **Never the reverse.** A child does not wait for its own parent, directly or through other tickets, because each would wait for the other. A ticket that needs the parent's result belongs beside the parent, not under it.

## Provenance

Membership says which parent an issue belongs to, and a blocker says what it waits for. **Provenance** says which existing issue a new one came from. It is a third kind of link: nothing that decides pickup, resumption, or resolution reads it, and it never blocks.

- **One line, written at creation.** When a workflow creates an issue that came from an existing issue other than its own parent, it writes one provenance line in the new body, in the creating call: `Discovered from:`, `Follows:`, or `Supersedes:`, then the reference. An issue created under the issue it came from needs no line, because its membership already records that.
- **Discovered from.** Work on the referenced issue surfaced this one, such as a question found while resolving a ticket or a defect found while building one. The referenced issue can be open or closed.
- **Follows.** This issue continues from the referenced one, and the referenced one's closure stands. A new map charted after an earlier map reached its destination follows that map.
- **Supersedes.** This issue replaces the referenced one's decision or route, which no longer holds. The referenced issue stays closed.
- **Where the line goes.** In the body's opening lines, before the first heading, after any line the project's conventions put first, such as a membership marker or a `Blocked by:` line. The line takes one kind, and one or more references of that kind. If more than one kind applies, use the one that says why the issue exists. A reference to an issue in another repository or tracker is a full link.
- **Nothing else is written.** The referenced issue's body is not edited, so its one writer is undisturbed. Where the tracker shows a mention on the referenced issue, that is the link back. A provenance line names an issue that already exists, so it never waits for a later pass that wires relations. A session that is not a body's responsible editor adds no provenance line to an existing body; it leaves the link in a comment.

## A closed issue

A closed issue is a record. Later work adds to that record and does not rewrite it.

- **Reopen only a closure that was wrong.** A closure was wrong when the issue's own question was not answered, or its own acceptance was not met, at the time it closed: it was closed by mistake, on a result that was already false when it was recorded, or while a child of its own was still open. A workflow that may close that issue under the project's policy may reopen it, at the authority for closure, with a comment that gives the reason. Reopening changes closure only; every axis, claim, and relation stays with its owner.
- **Otherwise append.** A closure that was right stays. When the destination has moved, a decision no longer holds, or the work has reached new territory, create a new issue with its provenance line: `Supersedes:` when it replaces the closed issue's decision or route, `Follows:` when it continues from it. The closed issue's body, comments, and resolution stay as they are.
- **Telling the two apart.** Ask whether the closure was wrong when it was made, not whether the same answer would be given today. A new fact that changes the best answer makes a decision superseded; it does not make its closure wrong. When that cannot be established, leave the issue closed and append with a `Follows:` line.
- **What reflects it.** A body that indexes a reopened or superseded decision, such as a map body, changes only through its responsible editor.

## Linear

Linear has no setup template. When a project uses Linear, as its tracker or as a projection of another, apply this mapping under the project's policy. Where Linear mirrors another tracker, a Linear status whose authority that policy does not name falls under the no-default rule above.

- **Intake.** Native Triage. `needs-info` stays in Triage with its label.
- **Acceptance.** When triage accepts an issue, move it to the team's configured post-triage status and keep `ready-for-agent` or `ready-for-human`. Backlog suits a fully specified fix nobody has selected for work yet; Todo suits a project whose policy puts accepted work directly in that queue. An issue already In Progress or In Review keeps that status when its readiness label changes.
- **Rejection.** An authorized `wontfix` maps to Canceled. Canceled alone does not say why an issue closed, so the closing comment gives the reason, such as a declined request or behavior that already existed. Where Linear mirrors GitHub, the `wontfix` label is written on GitHub and shows in Linear only if the sync carries it.
- **Maps.** A map is a parent issue carrying the map label, with native sub-issues. It is not a Linear project.
- **Labels.** Use flat labels. Separate single-choice label groups, one for decision type and one for the label-based triage states, replace them only after the sync is verified to preserve their meaning: setting, replacing, and clearing a value in each enabled sync direction, and a conflicting pair set on GitHub that Linear must not silently resolve and write back. Keep the map label outside the decision-type group, because a map may still own a decision.
- **Planning-only issues.** A planning-only issue moves out of intake at charting. When Wayfinder creates it directly in Linear, it may initialize it in Backlog if project policy permits. When a sync creates the Linear copy in Triage, the workflow authorized to maintain that copy can make the same transition, after confirming that the copy is still in Triage and is solely planning work. Assessing an existing issue gives Wayfinder no general right to change its status. A bug that is also a map can still need triage.

## Behavior not yet verified

Each unverified tracker behavior gates only the feature that relies on it, which ships on its fallback:

- **A parent blocked by its own child.** The native edge is added only where the tracker accepts it. An open child blocks its parent either way.
- **Grouped labels across a sync.** Flat labels until the round trips above pass.
- **Status and closure across a sync.** Whether a label change at the authority moves the projection's status, and how a not-planned closure or a reopening arrives there, are unverified. A step that depends on the projection's status reads it rather than assuming the sync moved it.
- **Coordination notes across a sync.** Whether coordination notes reach a projection is unverified. Read and write them at the authority.
- **Provenance across a sync.** Whether a provenance line's reference still resolves in a projection, and whether the projection shows a mention on the referenced issue, are unobserved. Read and write the line at the authority.
- **Labels new to Linear.** Whether the sync from GitHub creates the `wontfix` or `wayfinder:probing` label in Linear the first time a GitHub issue carries it is unobserved. A rejection's closing comment gives its reason either way.
