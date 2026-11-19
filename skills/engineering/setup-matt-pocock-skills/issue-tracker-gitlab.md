# Issue tracker: GitLab

Issues and specs for this repo live as GitLab issues. Use the [`glab`](https://gitlab.com/gitlab-org/cli) CLI for all operations.

## Conventions

- **Create an issue**: `glab issue create --title "..." --description "..."`. Use a heredoc for multi-line descriptions. Pass `--description -` to open an editor.
- **Read an issue**: `glab issue view <number> --comments`. Use `-F json` for machine-readable output.
- **List issues**: `glab issue list -O json` with appropriate `--label` filters.
- **Comment on an issue**: `glab issue note <number> --message "..."`. GitLab calls comments "notes".
- **Apply / remove labels**: `glab issue update <number> --label "..."` / `--unlabel "..."`. Multiple labels can be comma-separated or by repeating the flag.
- **Close**: `glab issue close <number>`. `glab issue close` does not accept a closing comment, so post the explanation first with `glab issue note <number> --message "..."`, then close.
- **Merge requests**: GitLab calls PRs "merge requests". Use `glab mr create`, `glab mr view`, `glab mr note`, etc., the same shape as `gh pr ...` with `mr` in place of `pr` and `note`/`--message` in place of `comment`/`--body`.

The setup draft must record the confirmed host, project URL and numeric project ID here. Pass `--repo <confirmed-project-url>` to every supported `glab issue`, `glab mr`, and `glab label` command in this document. For `glab api`, pass `--hostname <confirmed-host>` and use the confirmed numeric project ID in place of `:id`; never rely on checkout-derived placeholders. Verify `glab repo view <confirmed-project-url>` resolves the intended project before any mutation. If a command cannot target the confirmed project explicitly, stop rather than infer another remote.

## Merge requests as a triage surface

**MRs as a request surface: no.** _(Set to `yes` if this repo treats external merge requests as feature requests; `/triage` reads this flag.)_

This flag controls discovery only. Selecting or explicitly naming an MR does not authorize checking out or executing its code in the maintainer environment. Follow the installed `triage` skill's verification boundary before checkout, dependency setup, or tests; without suitable isolation, review the diff and report execution as not run.

When set to `yes`, MRs run through the same labels and states as issues, using the `glab mr` equivalents:

- **Read an MR**: `glab mr view <number> --comments` and `glab mr diff <number>` for the diff.
- **List external MRs for triage**: `glab mr list --output json`, then keep only MRs whose author is not a project member/owner (a contributor's MR, not a maintainer's in-flight work).
- **Comment / label / close**: `glab mr note`, `glab mr update --label`/`--unlabel`, `glab mr close`.

Unlike GitHub, GitLab numbers issues and MRs separately, so `#42` is unambiguous once you know which surface the maintainer means.

## When a skill says "publish to the issue tracker"

Create a GitLab issue.

## When a skill says "fetch the relevant ticket"

Run `glab issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `glab issue create --label wayfinder:map`. (On GitLab tiers with native epics, an epic may hold the map instead; a labelled issue works everywhere.)
- **Child ticket**: an issue carrying `Part of #<map>` at the top of its description, linked to the map (`glab issue create --linked-issues <map> --link-type relates_to`), and labels `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Set the `wayfinder:<type>` label in the creating call. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitLab's **native blocking link**, the canonical, UI-visible representation. Add it with the `/blocked_by #<n>` quick action, posted as a note (`glab issue note <child> --message "/blocked_by #<blocker>"`). Native blocking links are a Premium/Ultimate feature; on the free tier (or where unavailable) fall back to a `Blocked by: #<n>, #<n>` line at the top of the description. A ticket is unblocked when every blocker is closed. A ticket's own open decision tickets and maps block it as well, with no link and no line needed (the composition contract's section on a parent blocked by its own child). A fallback line on a map body, a promoted ticket's included, is written only by that body's editor, whom Wayfinder's map-body rule (under The map body) names. A session that is not the editor records the blocker as that section directs.
- **Frontier query**: a ticket's children are the issues whose `Part of` marker names exactly that ticket, whatever their labels. Its own parent and its other linked issues are not its children, so the link listing does not define them. Read them completely: `glab api --paginate --output ndjson "projects/:id/issues?state=opened&per_page=100" | jq -c 'select((.description // "") | test("(?m)^Part of #<n>\\b")) | {iid, labels}'` lists the open children of ticket `<n>`. A listing that fails or is cut short leaves the ticket's eligibility unknown, not empty; run the pipeline with `set -o pipefail` and read a nonzero status as unknown. Among the map's open children, keep those carrying a `wayfinder:` label, a map's included; drop any with an open blocker: a native `blocked_by` link to an open issue (`glab api projects/:id/issues/<child-iid>/links`), or an open issue in a `Blocked by` line, read where Wayfinder's frontier rule (under Tickets) directs, or an open child of its own that carries a `wayfinder:` label, or an assignee; first in map order wins.
- **Claim**: `glab issue update <n> --assignee @me`, the session's first write.
- **Resolve**: `glab issue note <n> --message "<answer>"`, then `glab issue close <n>`, then record the Decisions-so-far context pointer (gist + link) where Wayfinder's map-body rule (under The map body) directs. A comment on the map is `glab issue note <map> --message "<pointer>"`.
