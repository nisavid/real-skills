# Triage Labels

The skills speak in terms of canonical triage roles: two category roles, which name an issue's work kind, and five state roles, which name its triage state. This file maps those roles to the actual label strings used in this repo's issue tracker.

## Category roles

| Canonical role | Label in our tracker | Meaning                    |
| -------------- | -------------------- | -------------------------- |
| `bug`          | `bug`                | Something is broken        |
| `enhancement`  | `enhancement`        | New feature or improvement |

## State roles

| Label in mattpocock/skills | Label in our tracker | Native status | Meaning                                  |
| -------------------------- | -------------------- | ------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | none          | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | none          | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | none          | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | none          | Requires human implementation            |
| `wontfix`                  | `wontfix`            | none          | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

Fill the "Native status" column when the tracker that is the authority for triage state has a native status for a role: for example Linear's Triage for `needs-triage`, or the post-triage status, such as Backlog or Todo, that an accepted issue moves to. Where the native status alone represents a role, write `none` in its label column.
