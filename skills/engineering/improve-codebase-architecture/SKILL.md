---
name: improve-codebase-architecture
description: "Find deepening opportunities in a codebase. Use interactive mode for a visual survey and discussion, or automatic mode after a clean code review to implement in-scope Strong recommendations and obtain independent review."
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This command is _informed_ by the project's domain model and built on a shared design vocabulary:

- Call the Skill tool with "codebase-design" for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Use these terms exactly in every suggestion, and don't drift into "component," "service," "API," or "boundary."
- The domain language in `GLOSSARY.md` gives names to good seams; ADRs in `docs/adr/` record decisions this command should not re-litigate.

## Modes and recommendation strength

Apply the governing model eligibility rules before local work or delegation, and reassess them when the scope changes materially.

- **Interactive** is the default for a survey or discussion. Follow the interactive process below: show the HTML report, let the user choose, and use `grilling` for the decision.
- **Automatic** runs when explicitly requested or invoked by the owning implementation coordinator after a completed clean code review. Follow the automatic process below. Use textual evidence and a handoff, with no HTML, browser, routine selection questions, or dependency on interactive `grilling`.

Use the same strength labels in either mode:

| Strength | Required basis |
| --- | --- |
| **Strong** | A demonstrated present design problem and a concrete improvement in the `codebase-design` terms: less caller knowledge or duplicated invariants, or better seam placement, locality, or leverage. Show how consumer behavior is preserved and compare the smallest adequate alternative, including deletion or inlining. |
| **Worth exploring** | A plausible improvement still depends on unresolved facts or a consequential tradeoff. Name what needs resolving. |
| **Speculative** | The benefit depends on a hypothetical future need. |

Strength supplies no authority. An out-of-scope Strong idea remains a proposal for its actual owner. Keep substantive human choices and external-action gates with their existing owners in both modes.

## Automatic process

### 1. Bind the clean candidate and scope

The owning implementation coordinator runs this process outside the review that produced the clean result. Reviewers return their reports to that owner; they do not start this workflow from inside a review.

Record the assigned behavioral surface, consumer behavior and invariants, candidate identity, relevant evidence inputs, and the completed clean review that triggered the run. A changed file is not permission to refactor adjacent code. Inspect outside the slice only as needed to understand its consumers and invariants; return wider changes for their actual authority.

After every completed clean code review, run this mode unless a verified completed baseline covers the scope and no nontrivial code has changed since it. Missing or uncertain baseline evidence means assess the candidate, not skip. Every new nontrivial implementation or fix invalidates a skip based on the old baseline. Changed assessment inputs or relevant dependencies invalidate affected evidence even when code is unchanged.

A completed baseline records the covered scope, final candidate identity, assessment, verification evidence and its inputs, and the independent clean review of that candidate together with its assessment. Use the owning workflow's existing task state or evidence record; do not create a new ledger merely for this mode. A prior interrupted run, failed review, unreviewed implementation, or author-declared no-op establishes no baseline.

### 2. Assess the assigned work

Read the domain glossary and relevant ADRs, and invoke `codebase-design` for the shared vocabulary. Explore the assigned surface and its callers for demonstrated friction. If delegating exploration, start the worker with a fresh context window and the bounded candidate, scope, and evidence inputs.

Return a textual assessment of each grounded candidate: the present problem and source evidence, proposed improvement, smallest adequate alternative, preserved consumer behavior and invariants, and recommendation strength. State explicitly when there is no eligible Strong recommendation. Do not invent findings to fill a report.

Keep unresolved facts and consequential tradeoffs as Worth exploring. Return reserved choices, unavailable evidence, and out-of-scope proposals to their actual owner without opening an interview or making the choice on their behalf.

### 3. Implement and verify

Implement every eligible in-scope Strong recommendation. Preserve the assigned behavior and invariants, and compare deletion or inlining before adding another abstraction. If implementation reveals a consequential unresolved choice or requires wider authority, stop that branch and return the concrete need to its owner. Continue independent authorized work without claiming the blocked branch is complete.

Use `tdd` for any implementation or correction that needs a RED/GREEN slice, including its quick refactor after each stage. A behavior-preserving refactor starts from affected passing consumer assertions and reruns them; do not manufacture a RED by weakening existing behavior. Keep semantic expectations stable while changing a driver or adapter, and use the consumer-evidence method in `tdd` with its stated qualification limits.

Verify the affected behavior and owning checks on the resulting candidate. Keep evidence tied to its actual source, fixtures, driver, assertions, and relevant dependencies. If these inputs change, refresh the affected evidence. Report implemented recommendations separately from recommendations still awaiting independent review.

### 4. Review, record, and reconcile

Return the final candidate **and its assessment** for independent review through the governing workflow. Review must cover the recommendation strengths, scope, behavior preservation, and final changes. Follow the standing review and adjudication policy; the author cannot declare its own assessment clean. A no-op assessment also requires independent clean review.

If review requires a fix, return to implementation and verification, then independently review the changed candidate and affected assessment. A stalled loop reports its actual cause; a round count does not establish completion.

Only after independent clean review, record the completed baseline **before processing the clean-review event from that review**. The event then finds no nontrivial change since that completed baseline and meets the existing exception. Reconcile overlapping events against candidate identity and covered scope; an event for wider or changed work needs its own assessment. Do not recursively invoke this mode inside a review.

Return a textual handoff containing the assessment, implemented Strong recommendations, verification results and limits, independent review result, completed baseline or reason none exists, and proposals or choices for other owners. Publication, installation, release, and other external actions retain their existing gates.

## Interactive process

### 1. Explore

**Scope before you scan: YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction (a module, a subsystem, a pain point), take it, and skip the inference below.
- Otherwise, walk back a good stretch of the commit history (`git log --oneline`) to find the codebase's hot spots, the files and areas that keep coming up, and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net.

Read the project's domain glossary (`GLOSSARY.md`) and any ADRs in the area you're touching first.

Then spawn a sub-agent with a fresh context window to walk the codebase. Don't follow rigid heuristics; explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it for the user (`xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows) and tell them the absolute path.

The report uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals: use Mermaid when relationships are graph-shaped (call graphs, dependencies, sequences), and hand-built divs/SVG when you want something more editorial (mass diagrams, cross-sections, collapse animations). Each candidate gets a **before/after visualisation**. Be visual.

For each candidate, render a card with:

- **Files**: which files/modules are involved
- **Problem**: why the current architecture is causing friction
- **Solution**: plain English description of what would change
- **Benefits**: explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram**: side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength**: one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use GLOSSARY.md vocabulary for the domain, and the `/codebase-design` vocabulary for the architecture.** If `GLOSSARY.md` defines "Order," talk about "the Order intake module," not "the FooBarHandler," and not "the Order service."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly in the card (e.g. a warning callout: _"contradicts ADR-0007, but worth reopening because…"_). Don't list every theoretical refactor an ADR forbids.

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet. After the file is written, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, call the Skill tool with "grilling" to walk the decision tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize; call the Skill tool with "domain-modeling" to keep the domain model current as you go:

- **Naming a deepened module after a concept not in `GLOSSARY.md`?** Add the term to `GLOSSARY.md`. Create the file lazily if it doesn't exist.
- **Sharpening a fuzzy term during the conversation?** Update `GLOSSARY.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing; skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** Call the Skill tool with "codebase-design" and use its design-it-twice parallel sub-agent pattern.
