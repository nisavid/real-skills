## What it does

`issue-composition` is the contract that lets several [skills](https://www.aihero.dev/ai-coding-dictionary/skill) write to the same issue without overwriting each other. It names four independent **classification axes**, gives each one owning workflow, says which tracker is the **authority** for each fact, and describes the **narrow write** that changes one axis while leaving everything else as it was.

It never decides what an issue should be. [triage](https://aihero.dev/skills-triage) decides work kind and triage state, and [wayfinder](https://aihero.dev/skills-wayfinder) decides map structure and decision type. This skill only says how their writes combine, so a Wayfinder map can also be a triaged bug, and a triage pass leaves the map's claim, blockers, and decision type where they were.

## When to reach for it

Type `/issue-composition`, or let the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) invoke it. Most of the time you won't call it yourself: `wayfinder`, `triage`, [to-spec](https://aihero.dev/skills-to-spec) and [to-tickets](https://aihero.dev/skills-to-tickets) load it before they write to the tracker. Invoking it grants no permission to write anything.

Reach for it directly when you want to know how the classifications combine, for example before you write your project's tracker policy, or when two skills seem to disagree about an issue's labels.

## Prerequisites

The contract reads the project's tracker instructions, which [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) configures under `docs/agents/`. Their **Tracker policy** section is where the project states which tracker is the authority for each fact and which combinations of axes it forbids. The triage label mapping says how labels and native statuses map to the canonical values.

If that section is missing, or silent on a question, the skills first follow any rule your existing tracker docs state. Where those say nothing, they use setup's defaults, which make the chosen tracker the authority for every fact it can represent and forbid no combination, say so in their output, and point you to setup. They stop only when your existing docs contradict the action they are about to take. A fact the chosen tracker cannot represent, such as a Linear mirror's lifecycle status, gets no default authority: the skills leave it as the mirror holds it and say so.

## Four axes, four owners

| Axis | What it says | Owner |
| --- | --- | --- |
| Work kind | What kind of work this is, such as `bug` or `enhancement` | `triage` |
| Triage state | Where an incoming issue stands in triage | `triage` |
| Map structure | Whether this issue is a Wayfinder map | `wayfinder` |
| Decision type | How a decision [ticket](https://www.aihero.dev/ai-coding-dictionary/ticket)'s question gets resolved | `wayfinder` |

An issue carries only the axes that apply to it. A skill changes only the axes it owns; a skill that creates an issue may set starting values where its own workflow provides for that and the project's policy allows it. Claims, blockers, parent membership, provenance, holds, and authority are not axes at all, so no classification change moves them.

When the project's policy forbids a combination, the skill writes nothing and hands the conflict to whoever owns the policy. It does not invent an exception for the one issue in front of it.

## Authority and projection

Many teams keep the same issues in two trackers, such as GitHub issues mirrored into Linear. The contract treats each fact as living in one place, its authority. The copy in the other tracker is a **projection**: useful to read, but not where the fact is decided. A blocker that the mirror lost is a projection gap, not a cleared blocker. Where Linear owns intake, its native Triage status is the triage state, and nothing adds a `needs-triage` label to say the same thing twice.

## Narrow writes

A label change reads the affected fields first, adds or removes only the one value it owns, and reads back. It never replaces the whole label set. If the decision's basis changed underneath it, for example someone closed the issue as `wontfix` while a `ready-for-agent` write was pending, it drops the write and reassesses. An issue body has one writer at a time, because two writers that each submit the whole body can erase each other's sections.

## Parents and their children

An issue with children of its own, such as a map, a promoted ticket, or a spec with tickets beneath it, is **blocked** while any of those children is open, whatever the child's type or labels. Nothing picks it up, resumes it, resolves it, or closes it until every child is closed, or has been closed as out of scope or moved out from under it by the parent's planning owner.

A parent with an open child also holds no **claim**. The session that gives a ticket its first child releases its own claim on it in the same step, so claims sit only on work someone can do now. When the last child closes, the parent goes back to its planning owner, which reassesses it and then closes it, adds what is still missing, or leaves it open for pickup.

## Provenance and closed issues

Besides membership and blockers, an issue can carry one more kind of link: **provenance**. It is a single line near the top of a new issue's body that names the issue it was `Discovered from:`, `Follows:`, or `Supersedes:`. The skill that creates the issue writes the line as it creates it. The line never blocks anything, and the older issue's body is left alone.

A closed issue is treated as a record. A skill reopens one only when the closure was wrong at the time, for example when it was closed by mistake. When a decision simply no longer holds, the old issue stays closed and a new one supersedes it.

## Common questions

**Why did Wayfinder and triage fight over the same issue before?**
Wayfinder allowed only its own labels on a map, while triage required a work kind and a triage state on every triaged issue. Running one after the other led to proposals for extra labels instead of a coherent answer. The contract makes the two sets of labels independent axes with separate owners, and lets the project's policy decide which combinations it allows.

**An issue ended up with two triage states. Which skill is wrong?**
Often neither skill. One observed cause is an unattended automation that adds a label without reading the ones already there. The owning workflow keeps its own axis to one value, and when it finds a genuine conflict it surfaces it to the maintainer and pauses rather than picking one.

**A map's open children carry no `wayfinder:` label. Do they still keep it open?**
Yes. Any open child blocks its parent, whatever its labels, so a map cannot close over build tickets that are still open. A child that no longer belongs is closed as out of scope, or moved out from under the map, before the map closes.

**A decision we closed last month no longer holds. Should the skill reopen it?**
No. The closure was right when it was made, so the ticket stays closed as the record of that decision. The skill creates a new ticket whose opening lines say `Supersedes:` and name the old one. Reopening is for a closure that was wrong, such as a ticket closed by mistake.

## It's working if

- Running `wayfinder` and then `triage` on the same issue leaves both skills' classifications, plus its claim and blockers, intact.
- Where Linear owns intake, an issue in its native Triage never gains a duplicate `needs-triage` label from a skill.
- When your tracker policy forbids a combination, the run reports the conflict and the tracker shows no change.
- A label change shows up as one added or removed label, not a rewritten label set.
- A map or promoted ticket stays open, and unassigned, while any child beneath it is open.
- A ticket created because of another ticket names it on a provenance line, and the older ticket's body is unchanged.
- A decision that no longer holds stays closed, and the ticket that replaces it says `Supersedes:`.

## Where it fits

`issue-composition` is a **reference underneath** the tracker-writing skills, like [domain-modeling](https://aihero.dev/skills-domain-modeling) and [codebase-design](https://aihero.dev/skills-codebase-design) are for their vocabularies. [wayfinder](https://aihero.dev/skills-wayfinder) and [triage](https://aihero.dev/skills-triage) are its main readers because they own the axes; [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) records the policy it reads. [ask-matt](https://aihero.dev/skills-ask-matt) routes the whole set.
