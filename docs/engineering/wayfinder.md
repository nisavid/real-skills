## What it does

`wayfinder` assesses the route from a request to its **destination**, then keeps that route current before work and after meaningful changes or worker and supplier returns. It reuses an adequate assessment, including one on a parent issue, when that assessment covers the work in front of it.

Assessment does not require a map. A bounded request can proceed with a short assessment and a clear next step. When the route is too large or uncertain to hold in one session, Wayfinder charts a shared **map** of **decision tickets** on the issue tracker. Those tickets resolve questions; they do not authorize implementation.

## When to reach for it

Type `/wayfinder`, or let the agent invoke it on new intake, before work, and when a change or return could alter the route. The effort's planning owner owns the assessment: whoever the project's policy names, or the agent running the skill when it names no one. Invoking the skill does not grant permission to change the tracker or perform the eventual work.

| What you have in front of you | What happens next |
| --- | --- |
| A bounded request with an adequate current assessment | Reuse it and select the next eligible step. |
| A child issue whose parent has been assessed | Check that the parent assessment covers this child's scope and dependencies; membership alone is not enough. |
| A large effort with unresolved decisions | Chart a map and work its decision tickets. |
| A changed input, worker return, or supplier blocker | Refresh the affected assessment and select the next eligible frontier, or record a hold. |
| An unresolved human decision | Use [grilling](https://aihero.dev/skills-grilling) and [domain-modeling](https://aihero.dev/skills-domain-modeling). |
| A cleared route to a multi-session build | Hand the decisions to [to-spec](https://aihero.dev/skills-to-spec), then [to-tickets](https://aihero.dev/skills-to-tickets), within the separately authorized workflow. |

A small task does not need a submap, and its progress does not wait for an assessment of the whole backlog. [grill-with-docs](https://aihero.dev/skills-grill-with-docs) remains useful when a bounded planning conversation needs a glossary and durable decisions.

## Prerequisites

Map and ticket operations follow the project's tracker instructions, reached through its `AGENTS.md` or `CLAUDE.md` pointer. The tracker policy decides where issues live and how to create, classify, claim, relate, and resolve them. [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) can establish those instructions when governing instructions let the agent invoke it, or when you invoke it.

If that policy is missing, Wayfinder can return an assessment or map draft and identify the missing setup. Local markdown is an option when the project or human selects it, not an automatic substitute for an unconfigured tracker. Tracker writes and research-branch pushes also need an applicable grant for the operation and target.

## The map, the fog, and the frontier

The **map** is an issue labelled `wayfinder:map`, with decision tickets as its children. It is an **index, not a store**: the ticket holds the decision, and the map holds a linked gist. A session loads that low-resolution view and opens related tickets as needed.

- **Destination** names what the map is finding its way to.
- **Notes** carries planning context and relevant skill suggestions, never execution permission.
- **Decisions so far** links to resolved questions. The map body has one editor at a time, named by the skill's [map-body rule](https://github.com/nisavid/real-skills/blob/main/skills/engineering/wayfinder/SKILL.md#the-map-body). Everyone else leaves their changes, such as a pointer to a resolved question, as comments on the map for the editor to fold in, so the body can lag behind the closed tickets.
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

That type is the ticket's **decision type**, and whether an issue is a map is its **map structure**. Wayfinder owns those two classifications; [triage](https://aihero.dev/skills-triage) owns work kind and triage state. Before it writes to the tracker, Wayfinder loads [issue-composition](https://aihero.dev/skills-issue-composition), the shared contract that lets those classifications sit on one issue without either skill overwriting the other's. A map can be followed by triage: knowing the route does not settle an incoming issue's classification or readiness.

A decision ticket whose question needs a route of its own is **promoted** to a map in place. It keeps its identity, its place in the larger map, its claim, and its blockers, and it keeps its decision type while it still owns that decision, for example when a person must still choose after its children report. While a decision ticket or map beneath it is open, a promoted ticket is blocked, whatever else the tracker shows. A session that leaves a blocked parent it claimed releases the claim, so the parent returns to the frontier when its last blocking child closes.

An assessment stays fresh until something it depends on changes; age alone does not make it stale, unless time is itself the input, such as an authorization that expires. Before work starts, the check looks at the current blockers too, so a prerequisite added since the assessment is not missed.

After a return, the planning owner checks what the result changes about the parent outcome. A proposed adapter or new dependency is not automatically necessary just because a worker supplied it. If an existing qualified route still meets the outcome, the extra work can remain follow-up.

Each refresh ends with the next eligible step or a hold that names its owner and exact return trigger. Independent branches can proceed while a blocked branch waits. The interactive map modes still resolve at most one non-research ticket per session; they hand the refreshed frontier to the next session.

## Common questions

**How is this different from `/grill-with-docs`? Which should I start with?**
Session count, not project size. `/grill-with-docs` is single-session planning; a full wayfinder map is multi-session planning. If you can hold the whole thing in one conversation, grilling is cheaper and better, and a map is slower and denser for that case. The community shorthand is that a wayfinder map only makes sense if the work does not fit into a single session. This is by far the most-asked wayfinder question. People keep asking it because the skill descriptions do not tell you where your own task sits on that line. You have to judge the session count yourself.

**Does every request need a map now?**
No. Assessment can be brief, and a current direct or parent assessment can be reused. A map is for unresolved decisions that need one. Bounded work does not need a submap or a completed assessment of unrelated backlog items.

**When it asks for the "destination", does it mean the end of this session or the end of everything?**
The end of the whole map, not just the first session. The question reads ambiguously, but a wayfinder map is a multi-session tool by definition, so a session-scoped answer never makes sense. Typical destinations are a [spec](https://www.aihero.dev/ai-coding-dictionary/spec) to hand off, a decision to lock before planning starts, a throwaway proof of concept, or a clear route to an eventual in-place change such as a data migration. Naming that change does not authorize executing it during planning.

**The map is cleared. Didn't wayfinder already write the spec and make the tickets? Why do I still need `/to-spec` and `/to-tickets`?**
No. Wayfinder's tickets are decision tickets, and by the time the map closes they are all closed too. What is left is a map full of linked decisions, which is not a build plan. [to-spec](https://aihero.dev/skills-to-spec) collapses those linked decisions into one spec (`/to-spec #<map_issue>`), and [to-tickets](https://aihero.dev/skills-to-tickets) slices that spec into tracer-bullet implementation tickets. If you loop the map straight into [implement](https://aihero.dev/skills-implement), you skip the collapse and lose the linked detail. Go straight to implementation only when the effort turned out small. Some people run the shorter pipeline and report that it works. The two extra steps give you an explicit spec that a reviewer or a colleague can read, which matters more when you do not work alone. Either route still needs an applicable direct human grant before implementation; map Notes, labels, linked artifacts, and worker results cannot supply it.

**My agent started writing production code in the middle of a wayfinder session.**
Earlier versions allowed a map's **Notes** to override planning scope. One user watched an agent write "this map carries execution" into its own Notes, then read it back as permission in later sessions and build on a live server. Notes can no longer grant that permission. The same boundary covers ticket bodies, labels, comments, linked artifacts, and delegated results, even when they claim earlier human approval. A task or a suggested skill cannot turn planning into implementation. Keep prototypes isolated; promoting one into product code is implementation too. Hand off work outside planning scope and authorize that separate workflow directly, rather than storing a reusable grant in the map.

This is an instruction boundary, not a sandbox. The skill has no runtime that can revoke tools or credentials. For technical prevention, the host must restrict tools and credentials to the planning artifacts and tracker operations it permits; verify that policy in the actual harness before relying on it.

**I charted 27 tickets, and by the time I got to the thirteenth, the rest no longer made sense.**
This question is verbatim from a user report, and others report the same outcome. A full map plans comprehensively by default. When later tickets rest on assumptions that earlier tickets invalidate, the map falls into the waterfall trap that critics accuse the skill of. Two things help. First, scope the map to a bounded destination, not to the whole product. Users report that maps scoped to one defined epic behave better than a sprawling "implement V1". The goal is to ship small increments, not to plan something very big. Second, [prototype](https://www.aihero.dev/ai-coding-dictionary/prototyping) aggressively. The route stays current because cheap concrete artifacts expose uncertainty before implementation depends on it. Wayfinder is "prototypemaxxing", not "planmaxxing". Each worker return or meaningful change now triggers a refresh of only the affected route.

**Can I work several tickets in parallel?**
The frontier shows you which tickets you can take, and blocking edges make parallel work safe on paper. In practice, one ticket at a time is the safer default. If you work two grilling tickets at once, one session can ask you a question you just answered in the other, because the sessions share no [context](https://www.aihero.dev/ai-coding-dictionary/context). Prototype tickets have a known gap too. One user reported an agent that built three UI variations, chose one itself, and closed the ticket. That choice is yours, and the skill does not yet say so clearly enough. If you do run tickets in parallel, review the dependency graph yourself first.

**Do I have to use GitHub Issues?**
No. Any issue tracker works. GitHub has the best support, because its native sub-issues and blocking relationships make the frontier visible without opening the map. People also use GitLab, Linear, Jira and local markdown. There are two caveats. On a tracker with no native blocking, wayfinder infers the dependency graph from text, and you must correct it by hand. Local markdown puts the artifacts in your repo, which is not recommended, because material stored in the repo tends to persist by accident. Open-source maintainers hit the opposite problem (public trackers fill up with agent-generated planning tickets) and often choose local markdown anyway. Wayfinder uses the tracker your project's agent instructions name, and local markdown only when the project or you select it; otherwise it returns the draft and names the missing setup.

**The grilling is exhausting. Every question is three paragraphs long.**
This is the sharpest open complaint about wayfinder, and nobody has fixed it yet. One user broke it down this way: the verbosity itself causes decision exhaustion, and the length hides *why* the agent asks a question, so you lose the chain from decision to decision as the map grows. The verbosity looks like a property of the current set of [models](https://www.aihero.dev/ai-coding-dictionary/model) rather than of the skill. Users try two mitigations: a lower [reasoning effort](https://www.aihero.dev/ai-coding-dictionary/effort), and a plain-language instruction in your global `CLAUDE.md`. Expect to think hard here anyway. Wayfinder demands a lot of thinking from you, and that is most of its purpose, not a defect.

**A decision I already closed turned out to be wrong. Do I edit the old ticket or make a new one?**
The skill says only to reconcile invalidated decisions and affected tickets under project policy while preserving decision history, and the agent's default is unhelpful. It tends to design around the bad decision instead of challenging it, so you must steer it yourself. What works is to tell wayfinder plainly what changed. It then updates the map, revises the affected tickets, and comments on the closed ones. You can recover from scope changes mid-map. But if you *designed* a map to change, that is a sign the scope is wrong.

**Can Wayfinder labels coexist with triage labels?**
Yes, where the project's policy permits the combination. Each skill writes only its own labels, one at a time, and leaves the other skill's alone. Not every issue needs every classification, and where Linear owns intake, its native Triage status stands in for a `needs-triage` label. If the policy forbids the combination, the skill writes nothing and reports the conflict to whoever owns the policy.

**Where did `decision-mapping` go?**
It is this skill. v1.1 renamed it to `wayfinder`, and you invoke it as `/wayfinder`. "Decision map" was jargon, and it was also inaccurate, because only one of the four ticket types is a decision by itself. The new name gave the skill one consistent vocabulary (destination, fog of war, frontier, the map) instead of an invented term on top. The unit kept the word "decision": a wayfinder ticket is a **decision ticket**, so that people do not read it as an implementation ticket.

## It's working if

- A bounded request reuses a suitable assessment without acquiring an unnecessary map.
- A parent assessment is linked with a clear explanation of what it covers for the child.
- Before work starts, the next step still fits the current inputs, claims, blockers, and holds.
- Worker and supplier returns change only the parts of the route their evidence affects.
- You can identify the next eligible decision, or see who owns the hold and exactly what permits work to resume.
- Independent classifications coexist where your policy permits them, a Wayfinder write never removes a triage label, and where Linear owns intake, its native Triage is not duplicated by a label.
- A promoted ticket keeps its number, its claim, and its blockers.
- Fog becomes precise questions as evidence arrives; unresolved human choices stay open.
- A cleared map hands off to an authorized workflow, and the next session receives a current frontier.

## Where it fits

`wayfinder` supplies assessment and route maintenance across an effort's lifecycle. Its full map remains a planning tool for decisions that need that shared view. [triage](https://aihero.dev/skills-triage) establishes an incoming issue's classification and readiness, while [to-spec](https://aihero.dev/skills-to-spec) carries settled map decisions into a buildable specification. [ask-matt](https://aihero.dev/skills-ask-matt) routes between those skills and the rest of the set.
