---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code. Use when implementing a spec as a dependency-aware graph of tickets."
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

Invocation grants no authority, so reuse the user's grant for tracker and external documentation reads, worker dispatch, inputs and shared note writes, worktree creation and cleanup, branch creation, resets and merges, code edits and test runs in those checkouts, and PR references that close the spec or tickets, reporting any uncovered operation and target and asking before acting.

The issue tracker should have been provided to you. If not, call the Skill tool with "setup-matt-pocock-skills" when governing instructions permit; otherwise tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Start every subagent with a fresh context window.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets. Before pushing the branch or opening the PR, check that the active request and governing instructions authorize those operations and the selected target. Reuse an applicable user grant for the scoped workflow; do not require another confirmation just because the agent invoked this skill. If authority is absent, keep the integration branch local and seek it before pushing or opening the PR.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Pass each implementer the ticket and a pointer to the user's request. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - commits its work on its own branch if the grant covers it; otherwise, keeps the uncommitted changes in that worktree, reports the pending commit and unmerged ticket, and asks before committing;
   - after committing, merges the integration branch tip into its own branch before reporting done

5. When an **implementer subagent** or a fixer from step 7 reports done after committing its work and merging the integration branch tip into its own branch as described in step 4, merge its work to the integration branch with a **merger subagent**.

6. After each merge, update the **frontier** and start an **implementer subagent** for each ticket whose last blocker just landed on the integration branch, even if the blocker is still open on the tracker.

7. Once all tickets have merged into the integration branch, review the candidate at the integration branch tip. Call the Skill tool with this collection's own `code-review` skill against the fixed integration baseline. Where it was installed as a plugin, use the plugin-qualified name this skill was loaded under (`<plugin>:code-review`). A harness built-in that shares the bare name is a different review and does not satisfy this step. Resolve findings with the fixer or fixers selected by the governing review policy. Pass each fixer the pointer to the user's request. Apply step 4's base check (reset onto the integration branch if needed), commit, pending-work, and merge-before-reporting instructions to each fixer's work in its own worktree. For each correction, the fixer calls the Skill tool with "tdd" where possible, including quick refactoring after each RED and each GREEN. Every correction or refactor must land through step 5's merger before the next HEAD-based review. Keep review before push. After each completed clean code review, the owning implementation coordinator calls the Skill tool with "improve-codebase-architecture" in automatic mode, subject only to its verified completed-baseline exception. Edits from that run and corrections from its own review follow the same fixer and merger rules. The final candidate and assessment require independent review before completion; leaf reviewers do not initiate this follow-up.

8. Before pushing the final checkpoint, marking a PR ready, or closing tickets, check the same authority for those operations and targets. If a draft PR exists, push the independently reviewed final checkpoint to its branch once all tickets and review fixes have landed, confirm the remote branch head is that checkpoint, then mark it ready for review. Otherwise, resolve only tickets whose work and review fixes have landed, using the issue tracker's usual closing method, and report the integration branch. Report any unmerged ticket or review fix as pending. If authority is absent, report the integration branch and the pending operations instead.

9. Of the worktrees this run created for **implementer subagents** or step 7 fixers, remove only those with no uncommitted work and all their work merged into the integration branch. Keep and report every other worktree.
