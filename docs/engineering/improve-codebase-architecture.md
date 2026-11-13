## What it does

`improve-codebase-architecture` finds **deepening opportunities**: places where a shallow module exposes too much complexity to its callers. It has an interactive survey and an automatic deep-refactor mode. Automatic work stays within the assigned behavioural surface and preserves its consumer behaviour and invariants.

| Mode | What it produces |
| --- | --- |
| Interactive | A self-contained HTML report, followed by [grilling](https://www.aihero.dev/ai-coding-dictionary/grilling) on the candidate you choose. Code changes happen later through the normal build flow. |
| Automatic | A textual assessment, implemented in-scope Strong recommendations, verification, and independent review of the final candidate together with the assessment. It opens no HTML or browser and asks no routine selection questions. |

Both modes compare a proposed deepening with the smallest adequate alternative, including deletion or inlining. A Strong recommendation needs a demonstrated present design problem and a concrete improvement; a possible future benefit is Speculative.

## When to reach for it

Type `/improve-codebase-architecture`, or the agent can invoke it when the task fits.

The owning implementation coordinator invokes automatic mode after every completed clean code review, unless a verified completed baseline covers the scope and no nontrivial code has changed since it. You can also request that mode explicitly. Invocation supplies no new authority for edits or external actions.

Interactive mode remains available for a wider survey:

| Situation | How it is used |
| --- | --- |
| Routine upkeep | Run it every few days, or when you have a spare moment, so the structure does not decay between features. |
| Before a big build | Point it at the [spec](https://www.aihero.dev/ai-coding-dictionary/spec) and ask "how can we make this change easy?" This is the most effective prompt for it. |
| Brownfield audit | Run it on a large, unstructured or [vibe-coded](https://www.aihero.dev/ai-coding-dictionary/vibe-coding) repo to find out what shape it is in. |
| Legacy test work | Use it to find the missing seams before you write tests against untestable code. |

Where it is confusable with siblings:

- To design one module you have already chosen, use [codebase-design](https://aihero.dev/skills-codebase-design). This skill finds the module to work on, and `codebase-design` is where you design it.
- For a whole effort too big to hold in one session, use [wayfinder](https://aihero.dev/skills-wayfinder).
- For "this specific thing is broken," use [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs). It sends you back here when the real finding is that there is no good seam to lock the bug down.

## Prerequisites

Both modes use [codebase-design](https://aihero.dev/skills-codebase-design) for the architecture vocabulary. If `GLOSSARY.md` or relevant ADRs exist, the skill reads them and uses your domain's own nouns. A candidate then reads as "deepen the Order intake module," not "refactor the FooBarHandler."

| Mode | What must be available |
| --- | --- |
| Interactive | A codebase to inspect. The HTML report goes to `<tmpdir>/architecture-review-<timestamp>.html`, outside the repo. Grilling may update `GLOSSARY.md` and offer an ADR for a lasting decision. |
| Automatic | The assigned behavioural surface, candidate identity, consumer behaviour and invariants, relevant verification evidence, and the completed clean review. Implementation needs the task's existing authority; final acceptance needs independent review. |

## Depth, and the report that hunts for it

The skill rests on one idea: **depth**. A deep module puts a lot of behaviour behind a small, stable interface. A shallow module exposes its implementation through an interface nearly as wide as the code beneath it. The report looks for three forms of shallowness:

- Pure functions extracted only for testability, while the real bugs are in how callers use them (no **locality**).
- Modules that leak across their **seams**.
- A concept you cannot understand without opening five files.

For each one, it proposes the deepening that fixes it.

In interactive mode, each candidate is a card with the files involved, the friction, a plain-English solution, the benefit in terms of **locality** and **leverage**, a before/after diagram, and a strength badge. Automatic mode records the same reasoning as text, with source evidence, preserved behaviour, and the smallest adequate alternative.

| Badge | What it means for you |
| --- | --- |
| `Strong` | A present design problem is demonstrated, and the proposed change reduces caller knowledge or duplicated invariants, or improves a seam, locality, or leverage. It preserves consumer behaviour and beats the smallest adequate alternative. |
| `Worth exploring` | The improvement depends on unresolved facts or a consequential tradeoff. |
| `Speculative` | The benefit depends on a hypothetical future need. |

The interactive report ends with a **Top recommendation**, the candidate it would do first. Then the skill stops and asks which candidate you want to explore. At that point you have decided nothing, and no code has changed. A strength badge does not decide for you or authorize work.

## What happens after you pick one in interactive mode

When you pick a candidate, a [grilling](https://aihero.dev/skills-grilling) session starts on it. It covers the constraints, what goes behind the seam, which tests survive, and what the deepened interface should look like. The output of that session is a decision, not a diff. From there the normal flow applies: take the decision into [to-spec](https://aihero.dev/skills-to-spec), then [to-tickets](https://aihero.dev/skills-to-tickets), then [implement](https://aihero.dev/skills-implement).

## Automatic deep refactoring after review

Automatic mode assesses the clean candidate and implements every eligible Strong recommendation within the assigned behavioural surface. A file changed by the task can still contain adjacent code outside that surface. Wider ideas stay proposals for their actual owner, and consequential unresolved choices return to the person who holds them.

The refactor preserves affected passing consumer assertions and invariants. Any implementation or correction that needs RED and GREEN uses [tdd](https://aihero.dev/skills-tdd), including quick cleanup after each stage. Changed code or relevant evidence inputs require fresh verification and review.

An implemented recommendation is not yet a completed refactor. The final candidate and the assessment receive independent review together. If the selected reviewer reads Git HEAD, the owning implementation coordinator checkpoints the task-owned refactor first and does the same for later corrections. A clean result must cover that final checkpoint; local committing grants no publication authority. Even an assessment that finds no eligible Strong work needs a clean independent review before it establishes a completed baseline.

That baseline records the covered scope, final candidate, assessment, verification inputs and results, and independent review. The owner records it before handling the refactor's own clean-review event, so that event finds an unchanged, already assessed scope and skips another run. Missing or uncertain evidence cannot justify a skip. A new nontrivial implementation or fix invalidates a skip based on the old baseline.

## Common questions

**It grilled me for an hour about one idea instead of showing me options. Can I turn that off?**

Interactive mode presents the report before asking which candidate to discuss. You can ask for the report alone. Automatic mode is the non-interactive route for bounded implementation after a clean review: it uses textual evidence, implements eligible Strong recommendations, and opens no interview or HTML report. It returns a consequential unresolved choice to its actual owner instead of choosing for them.

**The report opened as unstyled raw HTML with no diagrams. What happened?**

The report loads Tailwind and Mermaid from CDNs, so it needs network access when you open it. If something blocks those scripts, the page breaks with no error. In the reported case, a security hook required SRI hashes. The agent added them, but the CDN served different bytes to the browser than to the `curl` that computed the hash, so the browser blocked the script. Offline and locked-down environments have the same problem. The agent cannot see it, because it never renders the page. As a workaround, ask for inline CSS and hand-built SVG diagrams instead of the CDN setup. This is an open issue.

**It gave me twelve candidates. Do I work through them in the same session or start a new one?**

For an interactive survey, choose one candidate to develop at a time. A fresh [session](https://www.aihero.dev/ai-coding-dictionary/session) keeps the report, decisions, and implementation from filling the same [context window](https://www.aihero.dev/ai-coding-dictionary/context-window). Carry the chosen candidate and decisions forward rather than relying on a temporary HTML file.

Automatic mode implements all eligible in-scope Strong recommendations. It returns the others as proposals with their evidence and unresolved choices; it does not enlarge the task to finish a list.

**How should I prompt it?**

Prompt it with the next thing you are building. If a big build is coming up, point it at the spec and ask "how can we make this change easy?" A run with no prompt looks for hot spots on its own. That is fine for routine upkeep, but a direction makes the report actionable.

**Does it work on a large legacy codebase?**

Partly. It works well on big existing codebases that lack consistent structure, and it is the recommended upkeep tool after any one-time structural setup. But users with out-of-control projects report it "helped a little but still doesn't seem to cut it." One developer with an eight-year-old legacy codebase reported that the model went in circles, though the same skill produces a clean graph on a tidy repo. There is no dedicated `/refactor` skill for that case yet. If the codebase has no shared vocabulary, run [grill-with-docs](https://aihero.dev/skills-grill-with-docs) first to create one. That usually makes this skill's output much better.

**How is this different from `/codebase-design`?**

`/codebase-design` is a reference, not a session driver. It supplies the vocabulary (module, interface, depth, seam, adapter, leverage, locality), and this skill uses it. If you give a fresh agent `/codebase-design` as the task, it fails in a known way. It has no process of its own to follow, so the agent invents one, explores the code again, and runs for a very long time before it asks you anything. Run this skill, and let it use that one.

**Will it ever say there is nothing to refactor?**

Yes. The assessment must say when there is no eligible Strong recommendation. A list of speculative possibilities does not justify code changes. In automatic mode, independent review of the no-op assessment is still required before it becomes a completed baseline; the author's own declaration is not enough.

**Does it work in Codex or another harness?**

The exploration instructions use a fresh-context sub-agent without requiring a named harness tool. Automatic mode returns textual evidence rather than opening an HTML report. The chosen harness still needs to support the task's implementation and independent review workflow; an instruction-level procedure does not establish that runtime support.

**How do I actually implement deep modules in TypeScript?**

The skill does not ship a good answer. People often ask for a `TYPESCRIPT.md` with concrete file and module layouts for the principles, and it does not exist. The skill tells you where a deepening belongs and what goes behind the seam. You must turn that into a package or directory structure yourself.

## It's working if

- The candidates name your domain's concepts and cite present friction, rather than offering generic cleanup.
- Each Strong recommendation explains the improvement in caller knowledge, duplicated invariants, a seam, locality, or leverage, and compares a smaller alternative.
- Interactive mode presents the report before asking you to choose, and leaves code implementation to the subsequent build.
- Automatic mode stays within the assigned behavioural surface and produces no HTML, browser interaction, or routine selection interview.
- Implemented Strong recommendations have passing verification and a separate independent review of the final candidate and assessment.
- A no-op has an independently reviewed assessment; a skipped repeat names the verified completed baseline and unchanged scope.
- New nontrivial code changes invalidate an old skip, while the refactor's own clean review does not start the same work again.

## Where it fits

`improve-codebase-architecture` serves two places in the workflow:

- **Periodic maintenance:** interactive mode surveys the codebase and develops a chosen idea with [grilling](https://aihero.dev/skills-grilling) and [domain-modeling](https://aihero.dev/skills-domain-modeling). The decision goes into the normal build flow.
- **After a clean review:** automatic mode assesses the assigned work, implements eligible Strong recommendations, and returns verified changes and an independently reviewed assessment to the owning implementation coordinator.

[codebase-design](https://aihero.dev/skills-codebase-design) supplies the shared vocabulary, [tdd](https://aihero.dev/skills-tdd) supplies the RED/GREEN and quick-refactor discipline, and [code-review](https://aihero.dev/skills-code-review) supplies the review handoff. [ask-matt](https://aihero.dev/skills-ask-matt) routes across the set.
