---
description: Record the administrator's decision on EduCut Connect offers (approve / reject / revise / published) with an audit trail, and sync the registry to Drive.
---

Apply the administrator's decisions in `$ARGUMENTS`, e.g. `approve Offer_003 Offer_005`,
`reject Offer_004 duplicate of an older post`, `revise Offer_002 shorten the hook`,
`published Offer_003 https://www.linkedin.com/feed/update/...`.

1. Find the run folder holding each Offer_NNN (`connect/runs/*/offers/Offer_NNN/record.json`) and read the
   opportunity id. If the run folder is not on disk (new session), download that offer's `record.json` and
   `Registry/registry.json` from Drive into `connect/runs/<date>/` first.
2. Use "EduCut administrator" as the approver unless a name is given (do not ask), then run per offer
   (`--run connect/runs/<date>`):
   - approve → `node connect/cli.mjs approve <id> --by "<name>"`. This re-checks the deadline and status,
     then sets READY_TO_PUBLISH, or EXPIRED / NEEDS_REVIEW if something changed. Report the resulting status.
     When it is READY_TO_PUBLISH, put the offer on the website: launch the **website-developer** subagent with
     the offer folder and `--approved-by "<name>"`. Its page is the link used in the LinkedIn post, so it
     must be live before the post goes out. Then commit `educut-connect/` and `sitemap.xml` to `main` the
     same way as `connect/Communication` (see `/connect-run` step 6b, commit message
     "EduCut Connect: list Offer_NNN on the website") and give the administrator the page URL.
     Then launch the **linkedin** subagent: it writes the post for each newly listed offer (card image +
     🎓🇺🇸 headline + intro + 📍🎓💰🔬📅 facts + offer page link + share line + hashtags) and schedules every
     one of them on the "EduCut Connect" page between 07:00 and 22:00, at most 10 a day (more than 10 →
     spread over 2 days), and builds the day's **posting kit** (`connect/linkedin/kits/<date>/`).
     Hand the kit to the administrator, who posts by hand until the LinkedIn API token exists:
     - publish `connect/linkedin/kits/<date>/index.html` with the Artifact tool, title
       "EduCut Connect posting kit, <date>", with every `cards/*.png` passed in `files` (same relative paths);
     - send all `cards/*.png` with SendUserFile (`display: attach`), in posting order, because images
       cannot be saved from the artifact page;
     - give the GitHub link https://github.com/researchelmoussa/Educut.ai/tree/main/connect/linkedin/kits/<date>
     When the administrator says posts are scheduled or live, run `node connect/cli.mjs li-done <Offer_NNN…>`.
   - reject → `node connect/cli.mjs reject <id> --reason "<text>" --by "<name>"`; if the offer is on the website,
     `site-remove <id>` + `site-build` and commit that to `main` too.
   - revise → `node connect/cli.mjs revise <id> --note "<text>" --by "<name>"`, then rerun the responsible agent
     (visual-designer and/or communications) for that offer and `validate` again.
   - published → `node connect/cli.mjs mark-published <id> --url <post-url> --by "<name>"`. Only after a human
     has posted it.
3. Upload the updated `registry.json` to Drive (`drive-sync`, or connector: create new, trash old).
4. Reply with one line per offer: `Offer_NNN → <new status>`.

Nothing here posts to LinkedIn.
