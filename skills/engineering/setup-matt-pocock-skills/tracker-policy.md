## Tracker policy

The skills that write to the tracker read this section through the composition contract (the `issue-composition` skill). It is this project's policy: edit it here, not in a skill.

### Authority

Each fact is read and written at its authority. A copy of it in another tracker is a projection, and a relation missing from the copy is a projection gap.

| Fact | Authority | Projections |
| --- | --- | --- |
| Work kind | this tracker | none |
| Triage state | this tracker | none |
| Map structure | this tracker | none |
| Decision type | this tracker | none |
| Parent membership | this tracker | none |
| Blockers | this tracker | none |
| Claim | this tracker | none |
| Closure | this tracker | none |
| Lifecycle status | this tracker | none |

When another tracker mirrors this one, name it under Projections for each fact it copies, and as the Authority for any fact it owns, such as a lifecycle status this tracker cannot represent. If people rely on the mirror's view of blockers, name the workflow assigned to copy those edges there and verify them:

- Blocker copying: none.

### Permitted combinations

Every applicable axis may coexist on one issue: a work kind, a triage state, map structure, and a decision type. A bug can also be a map. List each combination this project forbids; a skill that would create one writes nothing and returns the conflict to the owner named here.

- Forbidden combinations: none.
- Policy owner: the repository's maintainers.

### Native statuses

How each triage state maps to the tracker's native status, if it has one, is in the triage label mapping (`docs/agents/triage-labels.md`).
