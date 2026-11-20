## What it does

`wayfinder` assesses the route from a request to its **destination**, then keeps that route current before work and after meaningful changes or worker and supplier returns. It reuses an adequate assessment, including one on a parent issue, when that assessment covers the work in front of it.

Assessment does not require a map. A bounded request can proceed with a short assessment and a clear next step. When the route is too large or uncertain to hold in one session, Wayfinder charts a shared **map** of **decision tickets** on the issue tracker. Those tickets resolve questions; they do not authorize implementation.

## When to reach for it

Type `/wayfinder`, or let the agent invoke it on new intake, before work, and when a change or return could alter the route. Sage owns the assessment, directly or through a Sage child using the same effective model and reasoning selection. Invoking the skill does not grant permission to change the tracker or perform the eventual work.

| What you have in front of you | What happens next |
| --- | --- |
| A bounded request with an adequate current assessment | Reuse it and select the next eligible step. |
| A child issue whose parent has been assessed | Check that the parent assessment covers this child's scope and dependencies; membership alone is not enough. |
| A large effort with unresolved decisions | Chart a map and work its decision tickets. |
| A changed input, worker return, or supplier blocker | Refresh the affected assessment and select the next eligible frontier, or record a hold. |
| An unresolved human decision | Use [grilling](https://aihero.dev/skills-grilling), with [domain-modeling](https://aihero.dev/skills-domain-modeling) when the model needs work. |
| A cleared route to a multi-session build | Hand the decisions to [to-spec](https://aihero.dev/skills-to-spec), then [to-tickets](https://aihero.dev/skills-to-tickets), within the separately authorized workflow. |

A small task does not need a submap, and its progress does not wait for an assessment of the whole backlog. [grill-with-docs](https://aihero.dev/skills-grill-with-docs) remains useful when a bounded planning conversation needs a glossary and durable decisions.

## Prerequisites

Map and ticket operations follow the project's tracker instructions, reached through its `AGENTS.md` or `CLAUDE.md` pointer. The tracker policy decides where issues live and how to create, classify, claim, relate, and resolve them. [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) can establish those instructions when the human invokes it.

If that policy is missing, Wayfinder can return an assessment or map draft and identify the missing setup. Local markdown is an option when the project or human selects it, not an automatic substitute for an unconfigured tracker. Tracker writes and research-branch pushes also need an applicable grant for the operation and target.

## The map, the fog, and the frontier

The **map** is an issue labelled `wayfinder:map`, with decision tickets as its children. It is an **index, not a store**: the ticket holds the decision, and the map holds a linked gist. A session loads that low-resolution view and opens related tickets as needed.

- **Destination** names what the map is finding its way to.
- **Notes** carries planning context and relevant skill suggestions, never execution permission.
- **Decisions so far** links to resolved questions.
- **Not yet specified** holds the **fog of war**: in-scope questions that cannot yet be phrased sharply.
- **Out of scope** records work beyond the destination.

A sharp question can become a ticket even while blocked. Fog graduates only when the question becomes clear, and then leaves the fog section. A later change can invalidate part of the route; Wayfinder refreshes that part instead of treating the whole map as either permanently correct or wholly obsolete.

The **frontier** is the open, unblocked, unclaimed children in map order. A session checks live state and claims a ticket before resolving it. A named ticket still needs that check: another worker's claim, an unresolved blocker, an unknown prerequisite state, or a genuine hold keeps it from being eligible.

Native relationships make the route visible in the tracker's own UI. Membership and blocking are separate capabilities, so a fallback for one does not require abandoning the other. When the project uses a body convention, that text is the fallback representation; it is not evidence that a native relationship was created.

## Decisions, classification, and continuation

Each decision ticket has one applicable Wayfinder type:

| Type | What resolves it |
| --- | --- |
| `research` | Facts gathered through [research](https://aihero.dev/skills-research). |
| `prototype` | A cheap, isolated artifact made through [prototype](https://aihero.dev/skills-prototype), with the human deciding what it establishes. |
| `grilling` | A live exchange using [grilling](https://aihero.dev/skills-grilling) and [domain-modeling](https://aihero.dev/skills-domain-modeling). |
| `task` | An observed prerequisite result that a decision needs. Work outside planning scope goes to a separately authorized workflow or the human. |

The type does not replace other applicable issue classifications. GitHub labels may carry independent axes under project policy. A Linear project using native Triage keeps that state instead of duplicating it with a `needs-triage` label. A map can be followed by [triage](https://aihero.dev/skills-triage): knowing the route does not settle an incoming issue's classification or readiness.

After a return, Sage checks what the result changes about the parent outcome. A proposed adapter or new dependency is not automatically necessary just because a worker supplied it. If an existing qualified route still meets the outcome, the extra work can remain follow-up.

Each refresh ends with the next eligible step or a hold that names its owner and exact return trigger. Independent branches can proceed while a blocked branch waits. The interactive map modes still resolve at most one non-research ticket per session; they hand the refreshed frontier to the next session.

## Common questions

**Does every request need a map now?**
No. Assessment can be brief, and a current direct or parent assessment can be reused. A map is for unresolved decisions that need one. Bounded work does not need a submap or a completed assessment of unrelated backlog items.

**Can an assessed parent make all its children ready?**
Only the assessment coverage can be reused. Check the child's scope, assumptions, dependencies, and current evidence. Its claim, blockers, human decisions, readiness, and execution authority remain separate.

**What happens when a worker returns a new blocker?**
The affected route is reassessed before that blocker becomes a required dependency. When the dependency is necessary, the held question, owner, and exact return trigger are recorded. Another eligible branch can continue.

**Does a cleared map mean implementation can start?**
It means the route is clear. Multi-session work can move through [to-spec](https://aihero.dev/skills-to-spec) and [to-tickets](https://aihero.dev/skills-to-tickets); a bounded task may already have enough direction for its execution workflow. In either case, implementation needs an applicable direct human grant. Map Notes, labels, linked artifacts, and worker results cannot supply it. Planning prototypes stay isolated from product code and real services or data.

This is an instruction boundary. Technical prevention depends on the actual harness's tool and credential restrictions.

**Can Wayfinder labels coexist with triage labels?**
Yes, where the project's policy permits the relevant independent classifications. That does not require every axis on every issue, and it does not replace a native workflow state such as Linear Triage. If project policy still makes the labels exclusive, its owner must change that policy before the additional labels are applied.

**Where did `decision-mapping` go?**
It became `wayfinder` in v1.1. The map still consists of decision tickets: questions to resolve, rather than build slices.

## It's working if

- A bounded request reuses a suitable assessment without acquiring an unnecessary map.
- A parent assessment is linked with a clear explanation of what it covers for the child.
- Before work starts, the next step still fits the current inputs, claims, blockers, and holds.
- Worker and supplier returns change only the parts of the route their evidence affects.
- You can identify the next eligible decision, or see who owns the hold and exactly what permits work to resume.
- Independent classifications coexist where useful, and Linear Triage is not duplicated by a label.
- Fog becomes precise questions as evidence arrives; unresolved human choices stay open.
- A cleared map hands off to an authorized workflow, and the next session receives a current frontier.

## Where it fits

`wayfinder` supplies assessment and route maintenance across an effort's lifecycle. Its full map remains a planning tool for decisions that need that shared view. [triage](https://aihero.dev/skills-triage) establishes an incoming issue's classification and readiness, while [to-spec](https://aihero.dev/skills-to-spec) carries settled map decisions into a buildable specification. [ask-matt](https://aihero.dev/skills-ask-matt) routes between those skills and the rest of the set.
