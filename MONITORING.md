# EduCut.ai — SEO + GEO monthly monitoring

A 45-minute routine on the first working day of each month. Record the
numbers in one monthly log (a spreadsheet with one tab per area below) so
trends are visible month to month.

Baseline (before the new pages went live), from `scripts/monthly-report.sql`
on 23 September 2026: 10 assessments (9 completed), 3 consultations booked,
8 catalogue requests, 6 leads. Search and AI visibility: no baseline yet —
the first month after deployment becomes the baseline.

## 1. Indexing — Search Console + Bing Webmaster Tools (10 min)

| Metric | Where | Target / alert |
| --- | --- | --- |
| Indexed pages vs submitted | Search Console → Pages; Sitemaps | 22 / 22 indexed. Investigate any "Crawled – not indexed" or "Duplicate" status |
| Pages with errors (404, redirect, server) | Search Console → Pages | 0 |
| Core Web Vitals (mobile) | Search Console → Core Web Vitals | All URLs "Good" |
| Enhancements (breadcrumbs, FAQ) | Search Console → Enhancements | No errors |
| Bing indexed pages / crawl errors | Bing Webmaster Tools → Site Explorer | 22 indexed, 0 errors |

After each deployment: `node scripts/indexnow.mjs`, and resubmit the sitemap
in Search Console if pages were added.

## 2. Search visibility — Search Console → Performance (15 min)

Last 28 days vs previous 28 days:

| Metric | How |
| --- | --- |
| Impressions, clicks, CTR, average position | Totals |
| **Branded** vs **non-branded** | Query filter: contains `educut` vs does not contain `educut` |
| Top 20 queries | Queries tab — note new non-branded queries |
| Top landing pages | Pages tab — each academy page should appear over time |
| Per-page primary topic | For each academy page, is its Step 3 primary topic among its queries (e.g. `/academies/rag-systems/` → "rag course")? |
| Low-CTR pages | Pages with many impressions and CTR < 1 % → review title and description |

## 3. Conversions — Supabase (10 min)

Run the five queries in `scripts/monthly-report.sql` (read-only):

1. Conversions per month — assessments started and completed, consultations
   booked and held, catalogue requests and downloads, new leads
2. Lead journey — first form used and what leads did next
3. AI maturity of assessed organizations
4. Most frequent top focus area — what the market is asking for
5. Recommended path size (3, 5 or 7)

Conversion rates to track: assessments completed / started; consultations
booked / assessments completed; customers / leads.

Channel attribution (organic vs AI vs other) is not recorded yet — see
"Next improvements".

## 4. GEO — AI assistant visibility (15 min)

Ask each question in `seo/geo-prompts.csv` (20 questions) in ChatGPT,
Perplexity, Gemini, Copilot and Claude — logged out or in a fresh chat,
without mentioning EduCut.ai unless the question does. Log one row per
question and assistant in the format of `seo/geo-log-template.csv`:

| Field | Meaning |
| --- | --- |
| `educut_mentioned` | yes / no |
| `educut_page_cited` | yes / no — a link to educutai.com was given |
| `cited_url` | which page |
| `position_in_answer` | 1 = first recommendation |
| `competitors_named` | other providers mentioned |

Monthly KPIs: mention rate (mentions / 100 answers), citation rate, and
whether the cited page matches `expected_page`. Rotate a few questions each
quarter as the catalogue evolves; keep G01–G10 fixed for trend lines.

AI answers vary between runs and users — read trends over several months,
not single answers.

## 5. Authority (5 min)

| Metric | Where |
| --- | --- |
| Referring domains and top linking sites | Search Console → Links; Bing → Backlinks |
| New brand mentions | Google search `"EduCut.ai" -site:educutai.com` |
| Step 13 actions completed this month | Profiles, partner listings, case studies, talks |

## 6. Monthly review (5 min)

Write three lines in the log: what improved, what dropped, one action for
next month (e.g. rewrite a low-CTR title, publish a reviewed guide, pursue a
partner listing).

## Next improvements (not active)

- **Traffic analytics** (cookieless, e.g. Plausible or Cloudflare Web
  Analytics) for AI-referral visits from chatgpt.com, perplexity.ai,
  gemini.google.com, copilot.microsoft.com and claude.ai.
- **Conversion attribution**: store the landing page and referrer with each
  assessment, consultation and catalogue request, so conversions can be
  split by channel.
