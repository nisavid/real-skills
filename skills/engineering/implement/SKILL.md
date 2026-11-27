---
name: implement
description: "Implement a piece of work based on a spec or set of tickets. Use when implementing a scoped piece of work described by a spec or tickets."
---

Implement the work described by the user in the spec or tickets.

Invocation grants no authority, so reuse an applicable user grant to fetch the ticket or spec, edit code and tests in this checkout, run project checks, and dispatch reviewers with their inputs, reporting any uncovered operation and its target and asking before acting. The user's own request to implement the work, whether they invoked this skill themselves or asked in words, is such a grant for the code and test edits that the work needs in this checkout; the agent's choice to invoke this skill is not. The user's request covers another operation named in this paragraph only where its own words call for it, and the commit follows its own rule below.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at deliberately selected public consumer boundaries, respecting applicable decisions in the request, the ticket, and its parent spec when one exists.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once the implementation is ready, create a task-owned local checkpoint on the current branch through the governing Git workflow only if the active request and governing instructions authorize that commit. Reuse an applicable user grant for the scoped workflow even when the agent invoked this skill. Without commit authority, leave the work uncommitted, report the pending commit, and say that the work has not been reviewed, because `code-review` reads commits only. A review is not a reason to commit without that authority.

Once HEAD contains the work being judged, review it. Call the Skill tool with this collection's own `code-review` skill against the fixed point for this slice: the commit this run started from (the value of `git rev-parse HEAD` before your first change). Where it was installed as a plugin, use the plugin-qualified name this skill was loaded under (`<plugin>:code-review`). A harness built-in that shares the bare name is a different review and does not satisfy this step. For every subsequent correction or refactor, checkpoint its task-owned changes under the same commit authority before the next HEAD-based review; uncommitted changes cannot be credited as reviewed. Resolve findings under the governing review policy. After each completed clean code review, the owning implementation coordinator calls the Skill tool with "improve-codebase-architecture" in automatic mode, subject only to its verified completed-baseline exception. Return the final candidate and assessment for independent review before completion; leaf reviewers do not run this follow-up.

Without commit authority, finish by reporting the pending commit and unreviewed work. With commit authority, finish at the independently reviewed final checkpoint on the current branch. Any later change needs its own authorized checkpoint and fresh affected review. Keep review before push and follow the governing publication authority; a local checkpoint grants no push authority.
