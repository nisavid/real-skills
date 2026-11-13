---
name: implement
description: "Implement a piece of work based on a spec or set of tickets. Use when implementing a scoped piece of work described by a spec or tickets."
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work. Resolve findings under the governing review policy. After each completed clean code review, the owning implementation coordinator calls the Skill tool with "improve-codebase-architecture" in automatic mode, subject only to its verified completed-baseline exception. Return the final candidate and assessment for independent review before completion; leaf reviewers do not run this follow-up.

Commit your work to the current branch.
