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
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`; a `Triage:` line, when triage applies, records the triage state and is left alone by Wayfinder.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files whose `Status:` line is neither `claimed` nor `resolved` and that are unblocked; ignore the `Triage:` line; first by number wins.
- **Claim**: set `Status: claimed` and save before any work, changing no other line.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved` without touching the `Triage:` line, then record the Decisions-so-far context pointer (gist + link) where Wayfinder's map-body rule (under The map body) directs. A comment on the map is a new file under `map-comments/`.
