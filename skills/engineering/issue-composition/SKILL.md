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
- Claims, blockers, parent membership, holds, and authority are not axes. No workflow changes them as a side effect of writing an axis.

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

- **One writer per body.** Two writers editing different sections can erase each other's work when both submit the entire body, so the unit is the whole body, not a section. Wayfinder's map-body rule (under The map body) names the editor of a map body.
- **Coordinate the whole cycle.** Coordinate the read, edit, write, and read-back for that issue. A claim identifies the responsible editor, but it cannot exclude a simultaneous human or sync edit.
- **Without coordination.** Leave the proposed change for the responsible editor, and keep any authoritative blocker where the frontier check reads it.
- **Shared facts.** A fact that several operations write belongs in native relations, labels, or append-only comments, not in a body.
- **Coordination notes.** A coordination note is an append-only comment on an issue that records who is working it and what was checked before work.

## A parent blocked by its own child

When a parent depends on one of its own children, create the native blocking edge and read it back in the intended direction. If the tracker rejects the edge, or the read-back does not show it, put a `Blocked by:` line on the parent naming the child, and keep the native parent and child relationship. The workflow that decides what can be picked up reads the `Blocked by:` line in the parent's body or, until the map's editor folds it, in a comment on the parent; if it can verify neither, eligibility is unknown. If it cannot verify the child's state, the parent's eligibility is unknown.

## Linear

Linear has no setup template. When a project uses Linear, as its tracker or as a projection of another, apply this mapping under the project's policy. Where Linear mirrors another tracker, a Linear status whose authority that policy does not name falls under the no-default rule above.

- **Intake.** Native Triage. `needs-info` stays in Triage with its label.
- **Acceptance.** When triage accepts an issue, move it to the team's configured post-triage status and keep `ready-for-agent` or `ready-for-human`. Backlog suits a fully specified fix nobody has selected for work yet; Todo suits a project whose policy puts accepted work directly in that queue. An issue already In Progress or In Review keeps that status when its readiness label changes.
- **Rejection.** An authorized `wontfix` maps to Canceled. Canceled alone does not say why an issue closed, so the `wontfix` label shows beside it and the closing comment gives the reason, such as a declined request or behavior that already existed.
- **Maps.** A map is a parent issue carrying the map label, with native sub-issues. It is not a Linear project.
- **Labels.** Use flat labels. Separate single-choice label groups, one for decision type and one for the label-based triage states, replace them only after the sync is verified to preserve their meaning: setting, replacing, and clearing a value in each enabled sync direction, and a conflicting pair set on GitHub that Linear must not silently resolve and write back. Keep the map label outside the decision-type group, because a map may still own a decision.
- **Planning-only issues.** A planning-only issue moves out of intake at charting. When Wayfinder creates it directly in Linear, it may initialize it in Backlog if project policy permits. When a sync creates the Linear copy in Triage, the workflow authorized to maintain that copy can make the same transition, after confirming that the copy is still in Triage and is solely planning work. Assessing an existing issue gives Wayfinder no general right to change its status. A bug that is also a map can still need triage.

## Behavior not yet verified

Each unverified tracker behavior gates only the feature that relies on it, which ships on its fallback:

- **A parent blocked by its own child.** Use the native edge only where the tracker accepts it; otherwise the `Blocked by:` fallback above.
- **Grouped labels across a sync.** Flat labels until the round trips above pass.
- **Status and closure across a sync.** Whether a label change at the authority moves the projection's status, and how a not-planned closure arrives there, are unverified. A step that depends on the projection's status reads it rather than assuming the sync moved it.
- **Coordination notes across a sync.** Whether coordination notes reach a projection is unverified. Read and write them at the authority.
