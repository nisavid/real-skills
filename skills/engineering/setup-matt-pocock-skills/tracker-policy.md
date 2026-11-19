## Tracker policy

This project's tracker policy. Edit it here, not in a skill. What the skills do with each field is in the composition contract (the `issue-composition` skill).

### Authority

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
| Lifecycle status | this tracker, if it has the field | none |

For a mirror, name it under Projections for each fact it copies, and as the Authority for any fact it owns.

- Blocker copying (the workflow that copies blocker edges into a mirror and verifies them): none.

### Forbidden combinations

- Forbidden combinations of classification axes: none.
- Policy owner: the repository's maintainers.

### Native statuses

How each triage state maps to the tracker's native status, if it has one, is in the triage label mapping (`docs/agents/triage-labels.md`), when present (setup writes it if `triage` is installed).
