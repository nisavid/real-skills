# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only). `gh issue view <n> --json blockedBy` also lists closed blockers, so filter it: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`. An issue's own open children block it too, whatever their labels (the composition contract's section on a parent blocked by its own child). List its open sub-issues: `gh api --paginate "repos/<owner>/<repo>/issues/<n>/sub_issues?per_page=100" --jq '.[] | select(.state == "open") | .number'`. Also list the open issues whose `Part of` marker names exactly this issue, whether or not sub-issues are enabled: `gh api --paginate "repos/<owner>/<repo>/issues?state=open&per_page=100" --jq '.[] | select(.pull_request == null) | select((.body // "") | test("(?m)^Part of #<n>\\b")) | .number'`. An issue with 0 open blockers and nothing on either list is startable. A command here that fails, or a listing that is cut short, leaves the issue's eligibility unknown, not startable.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Work kind**: a label, under the category mapping in `triage-labels.md`. GitHub issue types are not available on a user-owned repository.
- **Close**: post the explanation with `gh issue comment <number> --body "..."`, then `gh issue close <number>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.
- **Reject (`wontfix`)**: keep `wontfix` as the issue's sole triage-state label, post the reason, then close it as not planned: `gh issue close <number> --reason "not planned"`.
- **Provenance**: where the composition contract calls for a provenance line, put `Discovered from: #<n>`, `Follows: #<n>`, or `Supersedes: #<n>` in the opening lines of the new issue's body in the creating call, after any `Part of #<map>` line. Write an issue in another repository as `<owner>/<repo>#<n>`. GitHub then shows the mention on the referenced issue's timeline, which is the link back.
- **Reopen**: only for a closure that was wrong, as the composition contract's section on a closed issue directs: `gh issue reopen <number> --comment "<reason>"`.

The setup draft must record the confirmed `[HOST/]OWNER/REPO` here. Set `GH_REPO` to that exact value for every `gh` command in this document, including `gh api` placeholder expansion. For API requests on a non-default host, also pass `--hostname <confirmed-host>`. Verify `gh repo view "$GH_REPO" --json nameWithOwner` resolves the intended repository before any mutation; never infer the target from remote order.

File issues only into the user's own repo. Never file into `mattpocock/skills` (the repo these skills come from) unless the user owns it. In a fork, verify the confirmed target with `gh repo view "$GH_REPO" --json nameWithOwner` before the first `gh issue create` of a session and confirm it with the user if it is not their repo.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

This flag controls discovery only. Selecting or explicitly naming a PR does not authorize checking out or executing its code in the maintainer environment. Follow the installed `triage` skill's verification boundary before checkout, dependency setup, or tests; without suitable isolation, review the diff and report execution as not run.

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number>`, then `gh pr view <number> --comments` (off a TTY, `--comments` prints only the comments, not the body), and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, put `Part of #<map>` at the top of the child body; its entry in the map body's task list is a map-body change, made where Wayfinder's map-body rule (under The map body) directs. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`/`probing`). Before labelling a probing ticket, create the `wayfinder:probing` label with that exact name if it is missing. Set the `wayfinder:<type>` label in the ticket creation call. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions. A fallback line on a map body, which includes a promoted ticket's body, is written only by that body's editor, whom Wayfinder's map-body rule (under The map body) names. A session that is not the editor records the blocker as the composition contract's section on a parent blocked by its own child directs.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues). Where sub-issues aren't enabled, the children are the issues listed in the map body's task list and the issues whose `Part of #<map>` marker names this map, deduplicated by number; an issue whose marker names another map is not a child of this map. Map order is the task list's order, then unlisted marker children by issue number. Drop any child with an open blocker (see **Count open blockers**, or an open issue in a `Blocked by` line, read where Wayfinder's frontier rule (under Tickets) directs) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Release**: `gh issue edit <n> --remove-assignee @me`, then a comment that says why the claim is released and what is left. A session releases only a claim it holds. The one exception is the composition contract's, in its section on a parent blocked by its own child: the ticket's planning owner clears a claim that another session left on it, with `gh issue edit <n> --remove-assignee <login>` and the same comment.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then record the Decisions-so-far context pointer (gist + link) where Wayfinder's map-body rule (under The map body) directs. A comment on the map is `gh issue comment <map> --body "<pointer>"`.
- **Supersede or reopen**: a decision that no longer holds stays closed; create the ticket that replaces it with a `Supersedes: #<n>` line. A ticket whose closure was wrong is reopened as in **Reopen** above. Either way, the Decisions-so-far line changes where Wayfinder's map-body rule (under The map body) directs.
