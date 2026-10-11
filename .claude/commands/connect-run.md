---
description: EduCut Connect daily run. Confirm sources, discover up to 10 new opportunities, build image + LinkedIn post per offer, validate, store in Google Drive, and hand the package to the administrator for approval.
---

You are the **EduCut Connect orchestrator**. Run today's pipeline end to end, in order. Never publish.
Never report a step as done without the command or tool output that shows it. `$ARGUMENTS` may contain
extra instructions from the administrator.

Drive layout (IDs in `connect/config/connect.config.json` → `drive`):
```
EduCut Connect/
  links.txt                       approved sources (administrator-owned)
  Logos/                          official brand files
  Scrawling/<YYYY-MM-DD>/run-log.jsonl
  Communication/<YYYY-MM-DD>/00_Review_<date>.md
  Communication/<YYYY-MM-DD>/Offer_NNN/   card.png, city.jpg, card-square.png, linkedin_post.txt, post_details.txt, card.html, record.json, qc-report.json
  Landmarks/                      city photos supplied by the administrator (Geneva.jpg, Cambridge-GB.jpg, …)
  Registry/registry.json          every opportunity ever seen (dedup + status history)
```

## 1. Sources: always ask first
1. Find `links.txt` in the EduCut Connect folder (Google Drive connector `search_files`:
   `parentId = '<root id>' and title = 'links.txt'`), read it, and save it to `$RUN_DIR/links.txt`.
   Run `node connect/cli.mjs sources $RUN_DIR/links.txt` for the numbered list.
2. Show the administrator the numbered list, then **ask with AskUserQuestion** (this is their input box):
   question "Today's EduCut Connect sources: run with these?", options
   "Run with these N sources" / "Skip today's run". They can type into "Other" to paste links to add, or
   write e.g. "remove 3".
3. If they add or remove links, write the new full list to a new Drive file `links.txt` in the root folder,
   keeping the header comments, then trash the old file (Drive files cannot be edited in place). Show the
   final list. If they skip, stop.

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
City photos: for each offer's city, look in Drive `EduCut Connect/Landmarks/` for a photo named
`<City>.jpg|png` or `<City>-<CC>.jpg|png` (e.g. `Geneva.jpg`, `Cambridge-GB.jpg`). If found, download it with the
connector into `$RUN_DIR/landmarks/` and register it:
`node connect/cli.mjs landmark-add "<City>" <CC> <file> --landmark "<what it shows>" --credit "<credit if given>" --run $RUN_DIR`.
The designer's `landmark` step then uses it (otherwise it tries Wikimedia Commons). The renderer copies the
photo into the offer folder as `city.jpg`, and it is uploaded with the card.

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

## 7. Hand-off to the administrator
Reply with a short summary:
- Sources run, and any blocked ones with the reason.
- Per offer: `Offer_NNN · title · institution · city`, status (flag OPEN_LIKELY offers: "verify the
  portal"), course matched, and the Drive folder link.
- Offers that failed validation, and why.
- How to decide: reply "approve Offer_003", "reject Offer_004 <reason>" or "revise Offer_005 <note>", or
  run `/connect-approve`.

Never mark anything PUBLISHED, and never post to LinkedIn: `publishing.enabled` is false.
