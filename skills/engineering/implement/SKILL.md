---
name: implement
description: "Implement a piece of work based on a spec or set of tickets. Use when implementing a scoped piece of work described by a spec or tickets."
---

Implement the work described by the user in the spec or tickets.

Invocation grants no authority, so reuse an applicable user grant to fetch the ticket or spec, edit code and tests in this checkout, run project checks, and dispatch reviewers with their inputs, reporting any uncovered operation and its target and asking before acting.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, review the work. Call the Skill tool with this collection's own `code-review` skill. Where it was installed as a plugin, use the plugin-qualified name this skill was loaded under (`<plugin>:code-review`). A harness built-in that shares the bare name is a different review and does not satisfy this step.

Commit your work to the current branch only if the active request and governing instructions authorize that commit. Reuse an applicable user grant for the scoped workflow even when the agent invoked this skill. Without commit authority, leave the work uncommitted, report the pending commit, and say that `code-review` could not cover those changes. Do not commit just to enable the review.
