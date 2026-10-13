---
description: Record the administrator's decision on EduCut Connect offers (approve / reject / revise / published) with an audit trail, and sync the registry to Drive.
---

Apply the administrator's decisions in `$ARGUMENTS`, e.g. `approve Offer_003 Offer_005`,
`reject Offer_004 duplicate of an older post`, `revise Offer_002 shorten the hook`,
`published Offer_003 https://www.linkedin.com/feed/update/...`.

1. Find the run folder holding each Offer_NNN (`connect/runs/*/offers/Offer_NNN/record.json`) and read the
   opportunity id. If the run folder is not on disk (new session), download that offer's `record.json` and
   `Registry/registry.json` from Drive into `connect/runs/<date>/` first.
2. Ask who is approving if no name is known, then run per offer
   (`--run connect/runs/<date>`):
   - approve → `node connect/cli.mjs approve <id> --by "<name>"`. This re-checks the deadline and status,
     then sets READY_TO_PUBLISH, or EXPIRED / NEEDS_REVIEW if something changed. Report the resulting status.
   - reject → `node connect/cli.mjs reject <id> --reason "<text>" --by "<name>"`
   - revise → `node connect/cli.mjs revise <id> --note "<text>" --by "<name>"`, then rerun the responsible agent
     (visual-designer and/or communications) for that offer and `validate` again.
   - published → `node connect/cli.mjs mark-published <id> --url <post-url> --by "<name>"`. Only after a human
     has posted it.
3. Upload the updated `registry.json` to Drive (`drive-sync`, or connector: create new, trash old).
4. Reply with one line per offer: `Offer_NNN → <new status>`.

Nothing here posts to LinkedIn.
