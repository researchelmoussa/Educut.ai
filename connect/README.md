# EduCut Connect

Finds new job, academic, fellowship, internship and research opportunities from approved sources. For
each one it produces a branded LinkedIn image and a LinkedIn post that points readers to
EduCut AI and a matching EduCut AI Academy course. Nothing is published without the administrator's
approval, and publishing itself stays manual.

## How it works

| Step | Who | What |
| --- | --- | --- |
| 1 | Administrator | Confirms or extends the sources in Drive `EduCut Connect/links.txt` (asked at the start of each run) |
| 2 | **opportunity-scout** (`.claude/agents/`) | Crawls the sources politely, extracts up to **10 new** opportunities never listed before, verifies application status, registers records |
| 3 | **visual-designer** | Card (1080×1350 PNG + 1200×1200) with a licensed photo of the city's landmark, flag, official logos |
| 3 | **communications** | LinkedIn post (80–130 words), alt hook, first comment, hashtags, one genuinely matching Academy course |
| 4 | `cli.mjs validate` | Title / institution / location identical across record, image and post; deadline verified; URLs and course anchor checked; no invented claims |
| 5 | Orchestrator (`/connect-run`) | Stores each offer in Drive `Communication/<date>/Offer_NNN/` (image + post text) and asks for approval |
| 6 | Administrator (`/connect-approve`) | approve → READY_TO_PUBLISH (after re-checking the deadline); reject; revise; mark published |

Statuses: `DISCOVERED → VERIFIED → CONTENT_GENERATED → UNDER_REVIEW → APPROVED → READY_TO_PUBLISH → PUBLISHED`,
plus `CLOSED`, `EXPIRED`, `REJECTED`, `NEEDS_REVIEW`. Every change is recorded with time, actor and reason
in `registry.json`.

Agents 2 and 3 receive the same immutable record and run in parallel. Each offer folder is their shared
workspace. Where Claude Code Agent Teams are enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), the three
agents can run as teammates with direct messages. The files, contracts and checks stay the same, so
nothing depends on that experimental feature.

## Data contracts (`schemas/`)

- `opportunity.schema.json`: the verified record. Evidence-backed fields carry `evidence_url` plus a
  verbatim `evidence_quote`. Unknown values are `null` and listed in `uncertainties`.
- `visual-package.schema.json`: image outputs, the text read back from the rendered card, assets with
  licences, and QC.
- `comms-package.schema.json`: caption, hook, first comment, hashtags, links, course match with rationale,
  and fact-check.

Both packages carry the `record_content_hash` they were built from. If the source changes later, the
offer is sent back to NEEDS_REVIEW automatically.

## Rules enforced in code

- **Crawling** (`lib/fetch.mjs`):
  - Honours robots.txt (5xx or unreachable counts as disallowed).
  - One request at a time per host, spaced by `rate_limit` or `Crawl-delay`.
  - Retries network errors, 429 and 5xx three times with exponential backoff (2/4/8 s plus jitter),
    honouring `Retry-After`.
  - 401/403, login walls, CAPTCHA and anti-bot pages are reported as blocked and never bypassed.
  - A host is skipped after 5 consecutive failures.
- **Deduplication** (`lib/registry.mjs`):
  - The ID is a hash of the canonical application URL, with tracking parameters removed.
  - A fingerprint of institution, title and city catches the same posting listed on several sites.
  - Every processed URL is remembered, so it never shows up as "new" again.
- **Daily cap**: `daily.max_new_opportunities` (10) counts only genuinely new records.
- **Logos**: only the official files in `config/brand/`. Institution logos only when allowlisted.
- **Landmarks**: Wikimedia Commons photos under CC0 / public domain / CC BY / CC BY-SA, credited on the
  card. If none is found, a neutral band is used.
- **Courses**: only from `data/courses.txt` / `data/academies.txt`. The anchor must exist in the built
  academy page.
- **Publishing**: `publishing.enabled` is `false`. No agent has a tool that posts.

## Adding sources

Add a line to Drive `EduCut Connect/links.txt` (or answer the source question at the start of a run):

```
https://careers.example.edu/jobs | follow=^https://careers\.example\.edu/jobs/\d+
```

Listing pages, RSS/Atom feeds and pages with schema.org `JobPosting` data are handled without code
changes. Sites that forbid crawling in robots.txt or their terms (e.g. LinkedIn Jobs, Indeed) should not
be added.

## Requirements

- **Network**: the cloud environment must allow the source sites, `commons.wikimedia.org` /
  `upload.wikimedia.org` (landmark photos) and `googleapis.com`. Change it in the environment's
  Network access settings.
- **Google Drive**:
  - The Google Drive connector is enough for text files and small images.
  - For direct PNG uploads, set the environment secrets `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET` and
    `GDRIVE_REFRESH_TOKEN`: an OAuth client for the Drive account that owns the folder, scope
    `https://www.googleapis.com/auth/drive`.
- **Node 18+, Chromium/Playwright**: preinstalled in Claude Code cloud sessions. Run `npm install` in
  `connect/` once for the flag set and IBM Plex Mono.

## Commands

```
node connect/cli.mjs help
npm --prefix connect test          # unit tests + end-to-end run against a local fixture site
```
