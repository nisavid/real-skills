Skills are organized into bucket folders under `skills/`:

- `engineering/`: daily code work
- `productivity/`: daily non-code workflow tools
- `misc/`: kept around but rarely used, not promoted
- `in-progress/`: beta: public on purpose, feedback wanted, not shipped in the plugin
- `deprecated/`: no longer used

Every skill in `engineering/` or `productivity/` (the **promoted** buckets) must have a reference in the top-level `README.md` and an entry in `.claude-plugin/plugin.json`'s `skills` array (the Claude Code plugin ships exactly the promoted set). Skills in `misc/`, `in-progress/`, and `deprecated/` must not appear in either.

Install commands are copied verbatim from [.agents/install-block.md](./.agents/install-block.md). `.claude-plugin/marketplace.json` makes the repo its own single-plugin marketplace (a fallback the install block explains, not the documented route). For this fork's native manifest generation and package validation, follow [the packaging procedure](./docs/agents/plugin-packaging.md). The upstream distribution decision lives in [.agents/adr/0002-ship-as-a-claude-code-plugin.md](./.agents/adr/0002-ship-as-a-claude-code-plugin.md). Run `claude plugin validate . --strict` after touching either Claude manifest.

Each skill entry in the top-level `README.md` must link the skill name to its `SKILL.md`.

Each bucket folder has a `README.md` that lists every skill in the bucket with a one-line description, with the skill name linked to its `SKILL.md`. The promoted buckets' `README.md`s and the top-level `README.md` group entries into **User-invoked** and **Model-invoked**; non-promoted bucket `README.md`s (`misc/`, `in-progress/`) use a flat list.

Skills in `engineering/` and `productivity/` also have a human-facing docs page at `docs/<bucket>/<skill-name>.md` (the docs tree mirrors those two bucket folders under `skills/`). The published URL is `https://aihero.dev/skills-<skill-name>` regardless of bucket: the docs path is repo organisation only. When you add, rename, or change the behaviour of a skill in `engineering/` or `productivity/`, create or re-sync its docs page following [.agents/writing-docs.md](./.agents/writing-docs.md). A finished page carries four sections: **What it does**, **When to reach for it**, **Common questions**, and **It's working if**. `writing-docs.md` holds the template, the section order, and where to hunt for the questions. Skills in the non-promoted buckets (`misc/`, `in-progress/`, `deprecated/`) get **no** docs page. The one exception is a promoted skill removed outright: its page stays, marked archived (see `writing-docs.md`).

Every `SKILL.md` is either user-invoked (`disable-model-invocation: true` plus `policy.allow_implicit_invocation: false` in `agents/openai.yaml`, reachable only by the human) or model-invoked (model- or user-reachable). See [.agents/invocation.md](./.agents/invocation.md).

[`ask-matt`](./skills/engineering/ask-matt/SKILL.md) is the router that maps every user-reachable skill and how they relate. The same trigger that re-syncs a docs page applies to it: whenever you add, rename, remove, or change how a user-reachable skill fits the flows, re-read `ask-matt`'s `SKILL.md` and update it so the map stays accurate: a new skill it never mentions, or a stale one it still routes to, is a router that lies.

To (re)link every skill outside `deprecated/` and `misc/` into the local harness skill directories (`~/.claude/skills`, `~/.agents/skills`), run `scripts/link-skills.sh`. Each entry is a symlink into this repo, so a `git pull` keeps installed skills current; re-run the script after adding, removing, or renaming a skill.

No em-dashes anywhere in this repo's prose (`SKILL.md` files, docs, `README.md`, `CHANGELOG.md`, ADRs, changesets, code comments). Where a sentence reaches for one, rewrite it instead with a comma, colon, period, parentheses, or a conjunction, whichever the sentence actually wants; never do a blind character substitution.

Every skill that dispatches a subagent says to start it with a fresh context window. Some harnesses (Codex, for one) fork the parent conversation by default, and a fork inherits the parent's context, which is what the subagent was meant to escape.

## Agent skills

### Issue tracker

Track this fork's packaging and maintenance work in `nisavid/real-skills` GitHub Issues. Read `docs/agents/issue-tracker.md` before ticket operations.

### Triage labels

Canonical names, unchanged. See `docs/agents/triage-labels.md`. Use `SCOPE.md` for upstream skill changes; fork packaging and maintenance follow the fork operations guidance below.

### Domain docs

This repo has one domain context. Read `GLOSSARY.md` and relevant ADRs under `.agents/adr/`; see `docs/agents/domain.md`.

## Fork operations

This fork distributes Matt Pocock's promoted engineering and productivity skills. Preserve attribution, the MIT license, and upstream skill bytes. Keep `AGENTS.md` as a symlink to this file.

A skill that exists only in this fork has no page on aihero.dev. When linking to its docs page, use the absolute URL in this repository, `https://github.com/nisavid/real-skills/blob/main/docs/<bucket>/<skill-name>.md`, and do not write an `aihero.dev` link for it. Bucket README entries still link the skill name to its `SKILL.md`. A skill in a non-promoted bucket has no docs page.

Use `fork-ops` before upstream assessment, synchronization, or changes to fork operating policy. Read `.agents/fork-ops.toml` when present; when it is missing, prepare and review the initial configuration before dependent operations. Treat its capability report as evidence only for the named implemented operation.

Complete authorized, reversible repo work autonomously, preserving unrelated changes. Use `checkpointing-and-publishing-git-work` for task-owned commits and publication, and `publishing-reviewable-prs` for pull requests. Review code, configuration, and protected paths with Tricritical before shipping. Agent instructions (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, rule files, and prompt templates) are configuration, including when written in Markdown. Ordinary docs-only and typo changes outside protected paths are exempt. A trivial or mechanical reviewed change needs one independent `review`; a substantive change needs `loop`. Critics and the adjudicator run as independent subagents. Review the final commit before pushing, and finish only with a clean result; changed candidate bytes or material evidence make an affected pass stale. Any separately designated protected path retains its governing review rule.

Stop for unresolved ownership, conflicts, failed required checks or reviews, unavailable authority, and consequential policy choices. Keep account, credential, permission, branch-protection, release, and publication changes within their specifically authorized scope.

Capture reusable packaging and synchronization procedures through `capturing-agent-procedures`. A consumer loads the maintained procedure and verifies its reviewed revision and required evidence before dependent execution.

Before generating the native manifest, checking package drift, changing marketplace routing, or consuming this fork's packaged skills, read [docs/agents/plugin-packaging.md](./docs/agents/plugin-packaging.md). Keep upstream skill sources authoritative; commit generated manifest changes together with their source or generator changes.

### Merge methods

A pull request into a long-lived branch is one of two kinds, and its kind decides how it merges. This fork's long-lived branches are `main` and `unleashed`.

- **Locally developed pull request:** work written for this fork. Squash it. Write the pull request title as a commit subject and keep the subject GitHub builds from it. The description stays on the pull request.

  A squash can collect branch trailers that credit the wrong model. Disable any existing auto-merge request. If you cannot disable it, stop and escalate. Read the pull request's commits at a recorded head SHA and identify their writers from independent records of which model wrote each commit. A commit's own message and trailers cannot verify its writer. Supply an explicit body containing only one `Co-Authored-By` trailer per verified writer, including writers missing from the branch trailers. In your merge report, cite the evidence for each credit and name any writer omitted for lack of evidence. If none can be verified, hold the squash until you can confirm that an explicit empty body leaves out all trailers. Once all required checks have passed, confirm again that no auto-merge request is set, then run `gh pr merge --squash --match-head-commit <SHA>` with the verified body and without `--auto`. If the head moves, verify again. Read back the squash commit's body and compare it with the supplied lines, ignoring trailing whitespace. If they differ, report the mismatch and hold later squashes.

- **Hop:** a pull request that brings the history of one long-lived branch into another: upstream into this fork, `main` into `unleashed`, or a long-lived branch into a branch cut from it. Merge it with a merge commit, so that every commit keeps its identity. Never squash a hop.

Do not use rebase merging for either kind.

A pull request is one kind or the other, and the test is ancestry, not branch names. In a locally developed pull request, every commit it adds to its base is its own work, apart from merge commits that bring in only commits the base already has, whatever branch their message names. A hop adds only commits that are already on the source branch, plus the merge commit that joins the two branches and resolves their conflicts. When a pull request is both, land the other branch's history first by its own hop. The pull request then adds only its own work.

Open a hop from a short-lived branch cut at the exact commit being brought over, not from the source branch itself. The hop then brings what was reviewed even if the source branch moves on, and resolving a conflict adds commits to the short-lived branch, not to the source.

The repository cannot enforce this choice, because its branch rules allow both methods for every pull request. State the method when authorizing or performing a merge.

If a hop was squashed, do not rewrite history, and do not merge the source branch again as it stands. The squash left the merge base where it was before the hop, so a plain merge brings back whatever the target has removed or reverted since. Record the ancestry instead with a hop whose head is cut from the target's tip and merges the squashed pull request's head commit while keeping the target's files (`git merge -s ours <commit>`). Check that the head's tree equals the target's before it merges. Use that exact commit, not the source branch's tip: merged this way, newer source commits would count as merged without their content. Bring them in a later hop.

### Operating prerequisites

Invoke each workflow by its installed skill name. These fork operating tools are separate from the promoted skills distributed by this repository:

- **Fork Ops:** obtain `fork-ops` from the [maintained public source](https://github.com/nisavid/fork-ops). Its README describes local setup; the [operation guide](https://github.com/nisavid/fork-ops/blob/main/plugins/fork-ops/docs/operation-guide.md) defines implemented operations. Confirm skill discovery, plugin health, and the capability report for this fork before relying on an operation. Registration alone does not establish capability.
- **Versionkeeping, Mergecraft, and Tricritical:** follow Provingkit's [preview installation and update guide](https://github.com/nisavid/provingkit/blob/main/docs/preview/install-and-update.md) for the target harness and published preview. Confirm that a fresh task can resolve `checkpointing-and-publishing-git-work`, `publishing-reviewable-prs`, and Tricritical's `review` and `loop`, including their referenced files and required helper tools. Source checkout presence alone does not establish a usable installation.
- **Procedure capture:** `capturing-agent-procedures` is an operator-supplied skill maintained in the [dotfiles skill directory](https://github.com/nisavid/dotfiles/tree/main/home/dot_agents/skills/capturing-agent-procedures). Confirm that the harness can resolve its installed `SKILL.md` and referenced guidance through the operator's managed installation. This is not a request to apply the entire dotfiles repository.

If a prerequisite is unavailable, report the missing skill or operation, its source, and the dependent action that cannot proceed. Continue independent work within the task's authority. Keep the existing review and publication gates; missing tools do not authorize a substitute workflow or automatic installation.
