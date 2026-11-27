## What it does

`implement-spec` takes a [spec](https://www.aihero.dev/ai-coding-dictionary/spec) and its [tickets](https://www.aihero.dev/ai-coding-dictionary/ticket) and uses your existing grant to land them in one run, reporting any uncovered operation and target and asking before acting. The orchestrating [agent](https://www.aihero.dev/ai-coding-dictionary/agent) hands each ticket to an implementer [subagent](https://www.aihero.dev/ai-coding-dictionary/subagent) working in its own git worktree, merges each finished branch into a single **integration branch**, runs this collection's own [code-review](https://aihero.dev/skills-code-review) over the result, and resolves the tickets. Where the collection was installed as a plugin, it calls that review by its plugin-qualified name, because a built-in can share the bare name `code-review`.

It reads the tickets as a **task graph**, not a list. Blocking edges decide what can start, so at any moment there is a **frontier** of tickets whose blockers have all landed, and every ticket on the frontier runs at once. That is the difference from working the tickets one by one. The graph's shape sets the pace, not the tickets' order on the tracker.

Once every ticket has merged, the integration branch tip contains the candidate for the HEAD-based review. Before re-review, each correction or refactor must be committed on the fixer's own branch under your grant and land through the merger. This includes automatic refactoring and corrections from its review. The completed refactor baseline names the independently reviewed final revision and assessment. Local checkpoints do not authorize publication.

## When to reach for it

Type `/implement-spec`, or the agent can invoke it when the task fits. Pushing, opening or readying a PR, and closing tickets require authority for the operation and target; without it, the agent stops at the integration branch and reports the pending operations.

| Your situation | Reach for |
| --- | --- |
| A spec, split into tickets with blocking edges, that you want landed in one run | `/implement-spec` |
| One ticket at a time, in your own [context window](https://www.aihero.dev/ai-coding-dictionary/context-window), [clearing](https://www.aihero.dev/ai-coding-dictionary/clearing) between tickets | [implement](https://aihero.dev/skills-implement) |
| A spec that isn't split into tickets yet | [to-tickets](https://aihero.dev/skills-to-tickets) first |
| A small piece of work with no real graph to it | [implement](https://aihero.dev/skills-implement) directly |

## Prerequisites

- **An issue tracker.** The skill reads the tickets from, and resolves them on, the tracker [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) configured. If none has been configured, it runs setup-matt-pocock-skills when governing instructions permit; otherwise it stops and tells you to run that first rather than guessing.
- **Tickets with blocking edges**, as [to-tickets](https://aihero.dev/skills-to-tickets) writes them. Without edges the graph is flat and every ticket starts at once.
- **A [harness](https://www.aihero.dev/ai-coding-dictionary/harness) that runs subagents in the background and gives each one a git worktree.** The skill exists to run tickets at the same time, so on a harness that runs subagents one at a time, it is only a slower `implement`.

## The integration branch

The integration branch holds the tickets and review fixes that have merged. The orchestrator points each implementer and each fixer the governing review policy selects to your request so it can check its authority to commit to its own branch. The run keeps and reports every worktree with uncommitted or unmerged work. Each implementer:

1. confirms its worktree is based on the integration branch before it starts and resets onto it if needed,
2. builds its ticket with [tdd](https://aihero.dev/skills-tdd), red-green one slice at a time,
3. after committing, merges the integration branch tip into its own branch before reporting done, so landing it is a fast-forward.

Each fixer follows steps 1 and 3.

The tracker, and your authority for remote and tracker operations, decide whether a pull request exists at all. If your tracker closes work through PRs, or you ask for one, the skill opens a draft PR after the first merge. Once all tickets and review fixes have landed, it pushes the independently reviewed final checkpoint to the PR branch and confirms the remote branch head is that checkpoint before marking it ready. Without a draft PR, the run stops on the integration branch with each fully merged ticket resolved and any unmerged work reported the way your tracker closes work, which works fully offline against a local markdown tracker. Without authority to push, open or ready the PR, or close tickets, the run stops on the integration branch and lists the pending operations.

Implementers talk to the orchestrator through [context pointers](https://www.aihero.dev/ai-coding-dictionary/context-pointer) (the spec, the ticket, shared exploration notes, earlier commits) rather than pasted summaries. This keeps each subagent's prompt small and leaves room in the orchestrator's window for the graph.

## Common questions

**How is this different from running `/implement` on each ticket myself?**

This is the question the skill exists to answer. Before it shipped, people kept building their own versions, and one user described the need: they wanted "subagents implement the tickets" instead of having "to individually create new session and tell them to implement a ticket one by one, when a spec may contain over 5 tickets." With `implement` you are the dispatcher: one [session](https://www.aihero.dev/ai-coding-dictionary/session) per ticket, clearing in between, and keeping track yourself of which tickets are unblocked. `implement-spec` hands that job to one orchestrating session. The price is that you no longer read each ticket's work as it lands; you review the integration branch at the end. To start a run, clear the context and type `/implement-spec` with a pointer to the spec (an issue number or a file path). For a small change with no real graph, skip it and use `implement` directly.

**Does it need GitHub? I want it to stop at the branch.**

No, not any more. One user who liked the in-progress version had exactly this complaint: "it creates a PR at the end, which requires an online repository like GitHub. I wish it could do the same work offline and stop at the branch where all the work is merged." The run now ends on the integration branch. A PR opens only when the configured tracker closes work through PRs or you ask for one, so on a local markdown tracker the run resolves the tickets whose work has merged and reports any still pending. Closing tickets, and any push or PR, still require authority; without it the run lists them as pending.

**Its review and fix loop ran for hours, or kept "fixing" tickets that hadn't been built yet.**

A review of the whole spec before all its tickets land can mistake unbuilt work for a defect. Review the integrated result once its tickets are implemented, then resolve valid findings under the governing review policy. Corrections retain quick cleanup after each RED and each GREEN. Every completed clean code review sends the owning implementation coordinator to automatic [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture): assess the assigned surface, implement eligible Strong recommendations, and independently review the final candidate together with its assessment. That skill's verified completed-baseline exception prevents repeating unchanged work. Leaf reviewers do not start this follow-up, and elapsed rounds do not establish completion.

**Does it drive tdd like implement does?**

It does now, though it didn't at first. Users running the in-progress version noticed that "the implementer subagents don't inherit the /tdd directive", so red-green stopped as soon as they scaled up from one ticket to a whole spec. Each implementer now builds its ticket with `tdd`. There is still no step where you agree seams interactively, as there is in an `implement` session, so name the seams in the spec or the tickets if you want them pinned.

**Two implementers running in parallel collided on the same file, or picked different names for the same thing.**

Worktrees don't remove collisions; they postpone them to merge time. A blocking edge written from ticket text is a guess about which files each ticket will touch, and two tickets on "different parts of the codebase" still share a message catalogue, a config registry, or a type. Each implementer sees only its own ticket and the shared notes, never the other's work in progress, so one user's web and mobile tickets added the same string as `blockedSince` and `blockedOn`. When two frontier tickets touch one shared file, either add a blocking edge between them so they run one after the other, or have the exploration notes fix the exact names each ticket adds.

**Blocked tickets never start, even after their blocker has merged.**

This is a known problem on GitHub. The tracker's blocked-by count only drops when a blocker *closes*, and tickets typically close when the PR merges, which is the end of the run. The tracker is the right source for the starting graph but a stale one mid-run. After each merge, the orchestrator starts any ticket whose last blocker landed on the integration branch, even if the tracker still shows the blocker as open.

**Does this replace Sandcastle or an AFK script?**

No. People ask because the skills now reach into implementation: "is Sandcastle still relevant? Your skills now seem to be able to handle implementation as well." `implement-spec` puts an agent in charge of orchestration inside one harness session, which needs no infrastructure and lets you watch and steer. For work that is truly [AFK](https://www.aihero.dev/ai-coding-dictionary/afk), a deterministic loop ([Sandcastle](https://github.com/mattpocock/sandcastle), a shell script, a CI job) is faster, cheaper, and more reliable, because no agent makes the orchestration decisions.

**A ticket's key test was skipped inside its worktree, and it reported green.**

A worktree holds only what git tracks. Tests that read gitignored fixtures, local databases, or credentials can silently skip there. For a ticket whose verification depends on untracked material, tell the orchestrator to run it in the main checkout instead.

## It's working if

- Several implementers are running at once whenever the graph allows, not one after another.
- A ticket starts as soon as its last blocker lands on the integration branch, not when the whole run ends.
- Every ticket's trace shows `tdd` running, with a failing test before the code.
- Merges into the integration branch are fast-forwards, not conflict resolutions.
- The run ends on one branch with every ticket resolved and a PR only if your tracker wanted one, or, without authority for those operations, with the pending operations listed.

## Where it fits

`implement-spec` is the build step of the main chain, as the parallel alternative to running [implement](https://aihero.dev/skills-implement) once per ticket:

```txt
grill-with-docs → to-spec → to-tickets → implement-spec → retro
```

Its neighbours are [to-tickets](https://aihero.dev/skills-to-tickets), which declares the blocking edges it reads as a task graph, and [code-review](https://aihero.dev/skills-code-review), which it runs over the integration branch before closing out. [ask-matt](https://aihero.dev/skills-ask-matt) is the router over the whole set when you are not sure which flow you are in.
