## What it does

`tdd` builds a feature or fixes a bug test-first: one failing test, a quick refactor, just enough code to pass the test, and another quick refactor before the next behaviour. It carries the standards that make that loop produce tests worth keeping: what a good test is, where tests go, what mocks are for, and the three anti-patterns that make a suite worthless.

It writes no test at a seam you have not agreed to first. Before any test exists, it names the public boundaries it intends to test at and stops for your confirmation. Testing effort is finite, and this step spends it on the critical paths instead of on every edge case. `tdd` is also a **reference**, not a driver. It contains the rules of the loop, and something else (you, or [implement](https://aihero.dev/skills-implement)) runs the [session](https://www.aihero.dev/ai-coding-dictionary/session) that applies them.

## When to reach for it

Type `/tdd`, or the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) reaches for it automatically when a task fits: building a feature or fixing a bug test-first, or when you say "red-green-refactor".

Reach for it when there is a concrete behaviour to build, with an input and an observable output, and you want tests that survive a refactor.

| Your situation | Where to go |
| --- | --- |
| A behaviour with defined inputs and outputs (business logic, a request/response contract, a transformation, validation) | `tdd` |
| The behaviour isn't pinned down yet | [to-spec](https://aihero.dev/skills-to-spec), which also agrees the test seams before any code is written |
| The question is really the shape of the interface, not the tests | [codebase-design](https://aihero.dev/skills-codebase-design) |
| You have a [spec](https://www.aihero.dev/ai-coding-dictionary/spec) or [tickets](https://www.aihero.dev/ai-coding-dictionary/ticket) and want the whole build run for you | [implement](https://aihero.dev/skills-implement), which drives `tdd` per ticket |
| Config, wiring, glue, type annotations, straight CRUD delegation | Nothing here fits well; see the open gap below |

That last row is a real gap. The skill decides *where* the seams go, but nothing in it decides *whether* a change is worth the loop at all. If you run it on a change with no independent source of truth to assert against, you get a test that restates the implementation. That is the tautological anti-pattern the skill warns about, reached from the other direction. It is [issue #746](https://github.com/mattpocock/skills/issues/746), and it is open. Until it closes, you make that call yourself, or write the rule into your `CLAUDE.md`.

## Prerequisites

[codebase-design](https://aihero.dev/skills-codebase-design) needs to be installed. `tdd` used to carry its own deep-module and interface-design notes; v1.0 deleted them in favour of the shared skill, and `tdd` now uses its interface-design vocabulary. Nothing else; the skill is [stateless](https://www.aihero.dev/ai-coding-dictionary/stateless) and writes no files of its own.

## The loop, and the seam it runs at

The skill rests on three terms.

**Red-green.** Write one test and witness it fail for the intended unmet requirement, then write only enough code to pass it. A quick refactor follows each RED and each GREEN. After RED, cleanup preserves the missing behaviour and the tests that already passed; if cleanup changes relevant inputs, the agent witnesses RED again. After GREEN, it preserves passing behaviour and reruns the affected assertions. When nothing warrants cleanup, the agent says so for that stage.

**Vertical slice.** Write one test at one seam, then the minimal implementation, then repeat. The first cycle is a **tracer bullet** that proves a single path end to end. The opposite is horizontal slicing: all the tests first, then all the code. Tests written in bulk verify *imagined* behaviour. They check the shape of things rather than what a user does, and they commit you to a test structure before you understand the implementation.

**Pre-agreed seam.** A seam is the public boundary you observe behaviour at without reaching inside. The rule has no exceptions. No test goes at an unconfirmed seam. In the full chain the seams are agreed earlier, during [to-spec](https://aihero.dev/skills-to-spec): "`/tdd` is told to only work at pre-agreed test seams, `/code-review` checks that only agreed-upon test seams were used." Invoked on its own, `tdd` asks you directly.

The three anti-patterns it is written to prevent:

| Anti-pattern | The tell |
| --- | --- |
| Implementation-coupled | The test breaks when you rename an internal function, though behaviour did not change. Mocked internal collaborators, asserted call counts, database queries used to verify instead of the interface. |
| Tautological | The expected value is computed the way the code computes it, so the test passes by construction. Expected values have to come from somewhere else: a known-good literal, a worked example, the spec. |
| Horizontal slicing | A batch of tests landed before any implementation. |

Mocks are for system boundaries only: external APIs, time, randomness, sometimes the filesystem or the database. Never mock your own modules.

The evidence belongs to the consumer's contract. The agent states what real behaviour ran, which effects were replaced, and what the result cannot establish. A test that receives a mocked successful process result has not shown that the real command is accepted. Original RED evidence stays available when GREEN arrives, and changed inputs require the affected observation again.

## Common questions

**When does it refactor?**

After every RED and every GREEN, including review corrections. These are quick cleanups within the behaviour being built, such as removing duplication or clarifying a name. They preserve what that stage proves; the assertion never gets weaker to make cleanup pass.

Deeper work follows every completed clean code review. The owning implementation coordinator invokes [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) in automatic mode, implements eligible Strong recommendations, and gets the final candidate and assessment independently reviewed. It skips only when a verified completed baseline covers the same scope and no nontrivial code has changed since it. A new nontrivial implementation or fix makes that old skip unavailable.

**It asked me to choose a test seam and I had no idea which to pick.**

This is the most-reported friction with the skill ([issue #607](https://github.com/mattpocock/skills/issues/607)). The prompt lists candidate seams by name only, with nothing about what each one catches or misses, so you are choosing between labels. There is no fix shipped yet. The practical workaround is to ask the agent for the trade-offs before answering: what does the component-level seam miss that the integration seam catches, and how much slower is it. It is also why the chain agrees seams up front in `to-spec`, where you have the whole feature in view rather than one prompt.

**It wrote the implementation before the test, even though the skill says red first.**

The sequence has not established RED. The agent must show that the assertion detects the intended missing behaviour, preserve that result, and then show GREEN on the implementation. An import error or an unavailable environment does not count as the intended failure. Instruction text alone cannot guarantee compliance, so the run's evidence matters.

**Should it write browser or end-to-end tests first?**

Usually not, and the skill will not stop it. A user reported the agent writing a Playwright test first, then spending a long loop re-running it and concluding the *test* was broken for a feature that did not exist yet. Browser tests are slow enough that the red-green feedback loop stops paying for itself. State in your repo's `CLAUDE.md` that browser tests come after the behaviour works.

**Does `/tdd` replace `/implement`, or the course's `/do-work`?**

No. `/tdd` documents the methodology; `/implement` is a simple work→feedback→commit loop and is the direct stand-in for `/do-work`. The course's single `/do-work` step is now split across `/implement`, `/tdd` and `/code-review`. If you are asking which one to run against a ticket, the answer is almost always `/implement`.

**Where did the deep-modules and interface-design guidance go?**

[codebase-design](https://aihero.dev/skills-codebase-design) supplies the shared vocabulary. `tdd` owns the quick cleanup at each RED and GREEN stage. [code-review](https://aihero.dev/skills-code-review) checks the resulting diff and carries the Fowler smell baseline; a clean review triggers the automatic deeper assessment.

**Does it know about my other tickets?**

No. Run against one ticket, it can propose work that belongs to a sibling ticket, because it has no view of the rest of the issue graph ([issue #129](https://github.com/mattpocock/skills/issues/129)). This is not `tdd`'s job. Passing the spec alongside the ticket helps; right-sizing the tickets in the first place helps more.

## It's working if

- It stops and names the seams it intends to test at, and waits, before any test file exists.
- One test appears and fails for the intended reason. Quick cleanup preserves that failure, the smallest implementation makes it pass, and another quick cleanup preserves GREEN before the next test appears.
- Each RED and GREEN has a cleanup result, including an explicit statement when nothing warrants refactoring.
- The original failure and later passing result identify the source and inputs they actually exercised.
- Test names read as capabilities ("user can checkout with valid cart"), not as internals ("checkout calls paymentService.process").
- Expected values in assertions are literals you can trace to the spec, not values recomputed the way the code computes them.
- Renaming an internal function breaks nothing in the suite.
- Mocks appear only at external boundaries (the payment API, the clock) and never around your own modules.

## Where it fits

`tdd` runs inside the build step of the main chain; it is not a step of its own:

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review → retro
```

[to-spec](https://aihero.dev/skills-to-spec) agrees the test seams up front, [implement](https://aihero.dev/skills-implement) drives `tdd` per ticket, and [code-review](https://aihero.dev/skills-code-review) checks the resulting diff. Every clean review sends the owning implementation coordinator to [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) for automatic deep refactoring, subject to its verified completed-baseline exception. Its other neighbour is [codebase-design](https://aihero.dev/skills-codebase-design), the shared source of the seam and deep-module vocabulary that `tdd` uses. You can also reach for it on its own, whenever there is a concrete behaviour to build and no full spec in play. When you are unsure which skill fits your situation, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.
