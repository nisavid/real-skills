## What it does

`issue-composition` is the contract that lets several [skills](https://www.aihero.dev/ai-coding-dictionary/skill) write to the same issue without overwriting each other. It names four independent **classification axes**, gives each one owning workflow, says which tracker is the **authority** for each fact, and describes the **narrow write** that changes one axis while leaving everything else as it was.

It never decides what an issue should be. [triage](https://aihero.dev/skills-triage) decides work kind and triage state, and [wayfinder](https://aihero.dev/skills-wayfinder) decides map structure and decision type. This skill only says how their writes combine, so a Wayfinder map can also be a triaged bug, and a triage pass leaves the map's claim, blockers, and decision type where they were.

## When to reach for it

Type `/issue-composition`, or let the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) invoke it. Most of the time you won't call it yourself: `wayfinder`, `triage`, [to-spec](https://aihero.dev/skills-to-spec) and [to-tickets](https://aihero.dev/skills-to-tickets) load it before they write to the tracker. Invoking it grants no permission to write anything.

Reach for it directly when you want to know how the classifications combine, for example before you write your project's tracker policy, or when two skills seem to disagree about an issue's labels.

## Prerequisites

The contract reads the project's tracker policy, which [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) writes into `docs/agents/`. That policy says which tracker holds the authority for each fact, which combinations of axes the project permits, and how its labels and native statuses map to the canonical values. If that policy is missing, the tracker-writing skills point you to the setup instead of guessing.

## Four axes, four owners

| Axis | What it says | Owner |
| --- | --- | --- |
| Work kind | What kind of work this is, such as `bug` or `enhancement` | `triage` |
| Triage state | Where an incoming issue stands in triage | `triage` |
| Map structure | Whether this issue is a Wayfinder map | `wayfinder` |
| Decision type | How a decision [ticket](https://www.aihero.dev/ai-coding-dictionary/ticket)'s question gets resolved | `wayfinder` |

An issue carries only the axes that apply to it. A skill changes only the axes it owns; a skill that creates an issue may set starting values where its own workflow provides for that and the project's policy allows it. Claims, blockers, parent membership, holds, and authority are not axes at all, so no classification change moves them.

When the project's policy forbids a combination, the skill writes nothing and hands the conflict to whoever owns the policy. It does not invent an exception for the one issue in front of it.

## Authority and projection

Many teams keep the same issues in two trackers, such as GitHub issues mirrored into Linear. The contract treats each fact as living in one place, its authority. The copy in the other tracker is a **projection**: useful to read, but not where the fact is decided. A blocker that the mirror lost is a projection gap, not a cleared blocker. Where Linear owns intake, its native Triage status is the triage state, and nothing adds a `needs-triage` label to say the same thing twice.

## Narrow writes

A label change reads the affected fields first, adds or removes only the one value it owns, and reads back. It never replaces the whole label set. If the decision's basis changed underneath it, for example someone closed the issue as `wontfix` while a `ready-for-agent` write was pending, it drops the write and reassesses. An issue body has one writer at a time, because two writers that each submit the whole body can erase each other's sections.

## Common questions

**Why did Wayfinder and triage fight over the same issue before?**
Wayfinder allowed only its own labels on a map, while triage required a work kind and a triage state on every triaged issue. Running one after the other led to proposals for extra labels instead of a coherent answer. The contract makes the two sets of labels independent axes with separate owners, and lets the project's policy decide which combinations it allows.

**An issue ended up with two triage states. Which skill is wrong?**
Often neither skill. One observed cause is an unattended automation that adds a label without reading the ones already there. The owning workflow keeps its own axis to one value, and when it finds a genuine conflict it surfaces it to the maintainer and pauses rather than picking one.

## It's working if

- Running `wayfinder` and then `triage` on the same issue leaves both skills' classifications, plus its claim and blockers, intact.
- Where Linear owns intake, an issue in its native Triage never gains a duplicate `needs-triage` label from a skill.
- When your tracker policy forbids a combination, the run reports the conflict and the tracker shows no change.
- A label change shows up as one added or removed label, not a rewritten label set.

## Where it fits

`issue-composition` is a **reference underneath** the tracker-writing skills, like [domain-modeling](https://aihero.dev/skills-domain-modeling) and [codebase-design](https://aihero.dev/skills-codebase-design) are for their vocabularies. [wayfinder](https://aihero.dev/skills-wayfinder) and [triage](https://aihero.dev/skills-triage) are its main readers because they own the axes; [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) records the policy it reads. [ask-matt](https://aihero.dev/skills-ask-matt) routes the whole set.
