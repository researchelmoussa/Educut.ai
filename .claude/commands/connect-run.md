---
description: EduCut Connect daily run. Confirm sources, discover up to 10 new opportunities, build image + LinkedIn post per offer, validate, store in Google Drive, and hand the package to the administrator for approval.
---

You are the **EduCut Connect orchestrator**. Run today's pipeline end to end, in order. Never publish.
Never report a step as done without the command or tool output that shows it. `$ARGUMENTS` may contain
extra instructions from the administrator.

Drive layout (IDs in `connect/config/connect.config.json` → `drive`):
```
EduCut Connect/
  links.txt                       legacy source list (fallback only)
  Scrawling/links                 Google Doc: approved sources, one URL per line (administrator-owned)
  Logos/                          official brand files
  Scrawling/<YYYY-MM-DD>/run-log.jsonl
  Communication/<YYYY-MM-DD>/00_Review_<date>.md
  Communication/<YYYY-MM-DD>/Offer_NNN/   card.png, city.jpg, card-square.png, linkedin_post.txt, post_details.txt, web-brief.json, card.html, record.json, qc-report.json
  Landmarks/                      city photos supplied by the administrator (Geneva.jpg, Cambridge-GB.jpg, …)
  Landmarks/images/<CC>/          one landscape photo per country (images/US/…, images/SA/…): always the first choice
  Landmarks/images/DEFAULT/       default photo, used only when the country has no folder
  Registry/registry.json          every opportunity ever seen (dedup + status history)
```

## 1. Sources (no confirmation: the administrator asked not to be asked)
1. The administrator keeps the sources in the Google Doc **`links`** in the `Scrawling` folder
   (`parentId = '<crawling folder id>' and title = 'links'`). Download it as text
   (`download_file_content`, `exportMimeType: text/plain`), strip the BOM and `\r`, and save it to
   `$RUN_DIR/links.txt` under the header comments of the root `links.txt`. Only if that Doc is missing,
   fall back to `links.txt` in the EduCut Connect root folder.
   Run `node connect/cli.mjs sources $RUN_DIR/links.txt` for the numbered list.
2. `daily.require_source_confirmation` in `connect/config/connect.config.json` is **false**: the administrator
   has said not to ask. Do not ask for confirmation or permission at any step; show the numbered list in
   the final summary and run with it. (Only if that flag is set back to true: ask with AskUserQuestion,
   "Today's EduCut Connect sources: run with these?", options "Run with these N sources" / "Skip today's run".)
3. The administrator edits the `links` Doc to add or remove sources; always use its current content.

## 2. Initialise
1. `npm --prefix connect ci --no-audit --no-fund` (flag set and fonts), then `RUN_DIR=connect/runs/$(date -u +%F)`.
2. Registry:
   - If GDRIVE_* secrets are set, run `node connect/cli.mjs drive-pull-registry --run $RUN_DIR`.
   - Otherwise download `Registry/registry.json` with the connector and save it as `$RUN_DIR/registry.json`.
   - If Drive has no registry yet, start empty and say so.
3. `node connect/cli.mjs init-run --run $RUN_DIR`. It reports known opportunities, past deadlines moved to
   EXPIRED, and today's remaining cap (`daily.max_new_opportunities`, 10).

## 3. Discover (Agent 1)
Launch the **opportunity-scout** subagent with RUN_DIR, the confirmed source list and CAP = 10 − new_today.
Wait for its JSON. If `new_verified` is empty, skip to step 6 and report why (no new items, blocked
sources, network).

## 4. Content (Agents 2 + 3 in parallel)
Card photos come from Drive `EduCut Connect/Landmarks/images/`, **country folder first**:
1. For each country in today's offers, list `Landmarks/images/<CC>/` (CC = `location.country_code`, e.g.
   `CH`, `US`), skip `.DS_Store` and other non-images, download the photo into `$RUN_DIR/landmarks/`
   (if the connector saves the result to a file, decode it with `jq -r .content <file> | base64 -d`), open it
   to see what it shows, and register it under the **country name**, even when the offer has a city:
   `node connect/cli.mjs landmark-add "<Country>" <CC> <file> --landmark "<what it shows>" --credit "Administrator photo (Drive Landmarks/images/<CC>)" --run $RUN_DIR`
   (e.g. `landmark-add "Switzerland" CH … --landmark "Zermatt and the Matterhorn"`).
2. Only if that country has no folder (or no image in it), use the default photo: download
   `Landmarks/images/DEFAULT/default.jpg` once per run and register it with
   `node connect/cli.mjs landmark-add Default DEFAULT <file> --landmark "<what it shows>" --run $RUN_DIR`.
The renderer picks country photo → (city photo, only if the country has none) → default photo by itself.
It copies the photo used into the offer folder as `city.jpg`, which is stored with the card.

For each id in `new_verified`:
1. `node connect/cli.mjs prepare <id> --run $RUN_DIR` → `offer_dir` (Offer_NNN).
2. In **one message**, launch **visual-designer** and **communications** for that offer (RUN_DIR, OFFER_DIR,
   ID). Several offers can be handled in the same message: both agents per offer, up to 5 offers at a time.
   (Where Agent Teams are enabled, run the three agents as teammates instead; the same files and commands
   apply. Communications may message the designer to align wording, and either may message the scout about a
   doubtful record.)

## 5. Validate
For each offer: `node connect/cli.mjs validate <id> --run $RUN_DIR`.
- `PASS` / `PASS_WITH_FLAGS` → the offer is now UNDER_REVIEW.
- `FAIL` → send the failures to the agent named in each failure's `owner`, once (resume that agent if you
  can, else start it again with the failure list). Re-validate. If it still fails, leave the offer out of
  Drive and list it as needing attention.

## 5b. Auto-approval (when `daily.auto_approve` is true)
The administrator chose not to review offers one by one. When `daily.auto_approve` in
`connect/config/connect.config.json` is true, do not wait for a reply: for every offer that validated
`PASS` or `PASS_WITH_FLAGS`, follow `/connect-approve` (approve with `--by "<daily.auto_approve_by>"`, put it
on the website with the website-developer and commit to `main`, then run the linkedin agent to schedule the
posts), after the Drive and GitHub storage in steps 6 and 6b. Offers that failed validation are never
approved. List every auto-approved offer in the hand-off with its "verify the portal" flag, so the
administrator can still `reject Offer_NNN` (this removes the page and its queued post).

## 6. Store in Google Drive
1. `node connect/cli.mjs review --run $RUN_DIR` → `review.md`.
2. If GDRIVE_* secrets are set: `node connect/cli.mjs drive-sync --run $RUN_DIR`. This uploads every validated
   Offer_NNN folder, the review, the registry and the run log, and prints the links.
3. Otherwise use the Google Drive connector:
   - Create `Communication/<date>/` and one `Offer_NNN/` folder per validated offer.
   - Upload `linkedin_post.txt` and `post_details.txt` as text (`disableConversionToGoogleType: true`).
   - Do **not** push images through the connector: large base64 payloads arrive truncated or are refused.
     Instead send `card.png` (and `city.jpg` if present) to the administrator with SendUserFile and say the
     images are not in Drive until the GDRIVE_* secrets are configured.
   - Upload `00_Review_<date>.md` and the run log to `Scrawling/<date>/`.
   - For the registry, create the new `Registry/registry.json`, then trash the previous one.
   Only report a file as stored when its `create_file` call returned an id.

## 6b. Store in GitHub (main): the complete copy, images included
The administrator chose `main` as the permanent home of the Communication folder.
```
W=$(mktemp -d)/main && git fetch origin main && git worktree add --detach "$W" origin/main
node connect/cli.mjs export --run $RUN_DIR --dest "$W/connect/Communication"
cd "$W" && git add connect/Communication && git commit -m "EduCut Connect: Communication outputs for <date>" && git push origin HEAD:main
cd - && git worktree remove "$W"
```
This writes `connect/Communication/<date>/Offer_NNN/` (card.png, card-square.png, city.jpg if any,
linkedin_post.txt, post_details.txt, record.json, qc-report.json) plus `00_Review_<date>.md`.
Only validated offers are exported. If the push is rejected because main moved, fetch, re-create the
worktree and retry once. Give the administrator the GitHub link to the day folder:
https://github.com/researchelmoussa/Educut.ai/tree/main/connect/Communication/<date>

## 7. Hand-off to the administrator
Reply with a short summary:
- Sources run, and any blocked ones with the reason.
- Per offer: `Offer_NNN · title · institution · city`, status (flag OPEN_LIKELY offers: "verify the
  portal"), course matched, and the Drive folder link.
- Offers that failed validation, and why.
- How to decide (only when `daily.auto_approve` is false): reply "approve Offer_003", "reject Offer_004 <reason>" or "revise Offer_005 <note>", or
  run `/connect-approve`.
- Each post links to the offer's EduCut Connect page (`https://educutai.com/educut-connect/<slug>/`). That
  page is created by the website-developer agent when the offer is approved, so a post is never published
  before its page is live.

Never mark anything PUBLISHED, and never post to LinkedIn: `publishing.enabled` is false.
