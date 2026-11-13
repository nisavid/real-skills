---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

TDD is the red → quick refactor → green → quick refactor loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle: consult them before and during the loop, not after.

Apply the governing model eligibility rules before local work or delegation, and reassess them when the scope changes materially.

When exploring the codebase, read `GLOSSARY.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?" Give each proposed seam a one-line note on what it catches and what it misses.

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Consumer contract and evidence

Before choosing an example, name the consumer, the outcome they need, supported inputs, and what failure means. At the agreed seam, state which real behavior executes, which effects are replaced, and what the observation cannot prove. Keep semantic assertions separate from driver or adapter details, with expected outcomes specified independently of the implementation.

Use the smallest existing specification language that expresses those distinctions. Qualify a new driver for the claim it makes: deliberately wrong expected outcomes must fail, and refusal must remain distinguishable from successful operation entry. A mocked successful subprocess does not establish that the real consumer accepts its command.

Retain each slice's source and input identities, command, original output, and exit result. Preserve RED evidence when GREEN arrives. A changed source, fixture, driver, assertion, or relevant dependency invalidates affected evidence; rerun the observation it supported.

This applies the consumer-specification method from `nisavid/provingkit` at `c80ec471b25acbf07e441f22de161eec182c273c`, `docs/agents/consumer-specifications.md` (SHA-256 `c946471f1b40d076ffe257fa5b16d88ed006e9d9fe047c92bb92348df5e64c3b`). Its established qualification covers offline Python CLI compatibility. Applying the method to another surface requires evidence for that surface; it does not inherit live-operation or agent-workflow qualification.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **RED before GREEN.** Write one failing test and witness it fail for the intended unmet requirement. An import error or unavailable environment is not that RED. Only then write enough code to pass it.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle. Don't anticipate future tests or add speculative features.
- **Quick refactor after every RED and every GREEN.** Inspect the slice for a concrete simplification, then make the warranted cleanup within its authorized behavioral surface. If nothing warrants refactoring, say so for that stage. This applies to review corrections as well as initial implementation.
- **Keep RED meaningful.** Cleanup after RED preserves the unmet requirement and prior passing behavior. It must not implement the missing behavior or weaken the assertion. If cleanup changes relevant inputs, witness the intended RED again before implementation.
- **Keep GREEN meaningful.** Cleanup after GREEN preserves affected passing behavior and invariants. Rerun the affected assertions; never weaken one to keep the result green.
- **Keep deeper work with its owner.** Quick cleanup does not expand the assigned scope. Return wider design choices to the owning workflow. After every completed clean code review, the owning implementation coordinator runs the automatic deep-refactor mode of `improve-codebase-architecture`, subject only to its verified completed-baseline exception. Leaf reviewers do not run it.
