---
name: implement
description: "Implement a piece of work based on a spec or set of tickets. Use when implementing a scoped piece of work described by a spec or tickets."
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, review the work. Call the Skill tool with this collection's own `code-review` skill. Where it was installed as a plugin, use the plugin-qualified name this skill was loaded under (`<plugin>:code-review`). A harness built-in that shares the bare name is a different review and does not satisfy this step.

Commit your work to the current branch only if the active request and governing instructions authorize that commit. Otherwise, leave the work uncommitted and report the pending commit.
