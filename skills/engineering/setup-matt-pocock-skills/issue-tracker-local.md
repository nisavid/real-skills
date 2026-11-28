# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Triage:` line near the top of each issue file (see `triage-labels.md` for the role strings). A `Status:` line is reserved for a Wayfinder claim or resolution, so the two never share a line
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Map comments**: one file per comment under `.scratch/<effort>/map-comments/`, named `<UTC timestamp>-<slug>.md`, never edited after it is written and never appended to `map.md`. The map body's editor folds each outstanding comment into `map.md`, then moves its file to `.scratch/<effort>/map-comments/folded/`.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`/`probing`); a `Status:` line records `claimed`/`resolved`; a `Triage:` line, when triage applies, records the triage state and is left alone by Wayfinder.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Provenance**: a `Discovered from: NN`, `Follows: NN`, or `Supersedes: NN` line near the top, written when the file is created. Name an item in another effort by its path. The frontier scan does not read it.
- **Frontier**: scan `.scratch/<effort>/issues/` for files whose `Status:` line is neither `claimed` nor `resolved` and that are unblocked; ignore the `Triage:` line; first by number wins.
- **Claim**: set `Status: claimed` and save before any work, changing no other line.
- **Release**: remove `claimed` from the `Status:` line and save, changing no other line, then append why and what is left under a `## Released` heading. A session releases only a claim it holds. The one exception is the composition contract's, in its section on a parent blocked by its own child: the ticket's planning owner clears a claim that another session left on it, the same way and with the same heading.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved` without touching the `Triage:` line, then record the Decisions-so-far context pointer (gist + link) where Wayfinder's map-body rule (under The map body) directs. A comment on the map is a new file under `map-comments/`.
- **Reopen**: only for a closure that was wrong, as the composition contract's section on a closed issue directs: remove `resolved` from the `Status:` line and append the reason under a `## Reopened` heading. Leave the earlier `## Answer` in place.
