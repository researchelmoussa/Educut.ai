// EduCut Connect on LinkedIn: compose a post per offer that is live on /educut-connect/, spread the new
// posts over the next 24 hours, and publish due posts on the "EduCut Connect" page through the LinkedIn
// Posts API. The linkedin agent writes only the opening question; everything else comes from the site
// entry (connect/site/offers.json), so the post always matches the live page.
// Publishing runs from .github/workflows/linkedin-publish.yml with the page's access token.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, nowIso, readJson, writeJson } from './util.mjs';
import { SITE_SECTION, loadOffers, offerFacts } from './site.mjs';

const queueFile = (root) => join(root ?? REPO_DIR, 'connect', 'linkedin', 'queue.json');
export const loadQueue = (root) => readJson(queueFile(root), { schema_version: '1.0', posts: [] });
export const saveQueue = (q, root) => writeJson(queueFile(root), q);

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean);

export function checkQuestion(q, offer, config) {
  const out = [];
  const add = (check, pass, detail) => out.push({ check, pass, detail, owner: 'linkedin' });
  add('one question, ending with "?"', /\?\s*$/.test(q ?? '') && (q.match(/\?/g) ?? []).length === 1, q ?? '(missing)');
  const n = words(q).length;
  add('question 6–30 words', n >= 6 && n <= 30, `${n} words`);
  add('no URL or hashtag in the question', !/https?:\/\/|#\w/.test(q ?? ''), 'links and hashtags are added by the template');
  const banned = config.comms.banned_phrases.filter((p) => (q ?? '').toLowerCase().includes(p.toLowerCase()));
  add('no banned / unsupported claims', banned.length === 0, banned.join(', ') || 'none');
  if (!offer.compensation) add('no salary claimed', !/salary|stipend of|\b(chf|eur|usd|gbp)\b|€|\$|£/i.test(q ?? ''), 'record has no stated compensation');
  return out;
}

// Post text: question, title, the facts shown on the offer page, the offer page link, the Academy link.
export function composePost(offer, question, hashtags = []) {
  const facts = offerFacts(offer).map(([k, v]) => `${k}: ${v}`);
  const up = offer.upskill;
  const upskill =
    up.kind === 'website'
      ? `Upskill with EduCut AI: ${up.url}`
      : /catalog/i.test(up.name)
        ? `Upskill with the EduCut AI Academy catalog: ${up.url}`
        : `Upskill with EduCut AI Academy (${up.name.replace(/^the\s+/i, '').replace(/\s+page$/i, '').replace(/\s+Academy$/i, '')}): ${up.url}`;
  return [question.trim(), '', offer.title, ...facts, '', `Offer details and official application link: ${offer.page_url}`, upskill, ...(hashtags.length ? ['', hashtags.join(' ')] : [])].join('\n');
}

// Times for n new posts: first slot after `leadMinutes`, then spread as evenly as possible inside the
// next 24 hours (active hours only, in the configured time zone), never closer than minGap.
export function planSlots(n, { now = new Date(), leadMinutes = 30, minGapMinutes = 60, maxGapMinutes = 180, activeHours = [7, 22], timeZone = 'Europe/Zurich', taken = [] } = {}) {
  if (n <= 0) return [];
  const hourIn = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(d));
  const step = 15 * 60e3;
  const start = Math.ceil((now.getTime() + leadMinutes * 60e3) / step) * step;
  const end = now.getTime() + 24 * 3600e3;
  const busy = taken.map((t) => Date.parse(t));
  const candidates = [];
  for (let t = start; t <= end; t += step) {
    const h = hourIn(new Date(t));
    if (h >= activeHours[0] && h < activeHours[1] && busy.every((b) => Math.abs(b - t) >= minGapMinutes * 60e3)) candidates.push(t);
  }
  if (!candidates.length) return [];
  // Spread over active time only (the night does not count), as far apart as maxGap allows and never
  // closer than minGap: if n posts do not fit, the first ones that fit are scheduled.
  const stepMin = step / 60e3;
  const fit = Math.floor(((candidates.length - 1) * stepMin) / minGapMinutes) + 1;
  const m = Math.min(n, fit);
  const stride = m > 1 ? Math.min((candidates.length - 1) / (m - 1), maxGapMinutes / stepMin) : 0;
  const slots = [];
  for (let i = 0; i < m; i++) slots.push(candidates[Math.min(candidates.length - 1, Math.round(i * stride))]);
  return slots.map((t) => new Date(t).toISOString());
}

// Offers on the site that are approved (not previews), still open, and not yet queued or posted.
export function pendingOffers(root, now = new Date()) {
  const queued = new Set(loadQueue(root).posts.map((p) => p.opportunity_id));
  return loadOffers(root).offers.filter((o) => {
    if (o.preview || queued.has(o.opportunity_id)) return false;
    const t = o.deadline ? Date.parse(o.deadline.length === 10 ? `${o.deadline}T23:59:59Z` : o.deadline) : Infinity;
    return t > now.getTime();
  });
}

// ---------- LinkedIn API (Posts API + Images API) ----------

export function linkedinConfigured() {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID);
}

async function api(path, { method = 'GET', body, version, raw } = {}) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'linkedin-version': version,
      'x-restli-protocol-version': '2.0.0',
      ...(raw ? {} : { 'content-type': 'application/json' }),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) throw new Error(`LinkedIn ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

const orgUrn = () => {
  const id = String(process.env.LINKEDIN_ORGANIZATION_ID);
  return id.startsWith('urn:') ? id : `urn:li:organization:${id}`;
};

// LinkedIn "little text": reserved characters are escaped; hashtags become hashtag templates.
export const littleText = (t) =>
  t.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`).replace(/(^|\s)\\#(\w+)/g, (m, pre, tag) => `${pre}{hashtag|\\#|${tag}}`);

export async function publishPost(post, { root, version, dryRun = false } = {}) {
  const image = join(root ?? REPO_DIR, SITE_SECTION, post.slug, 'card.png');
  if (!existsSync(image)) throw new Error(`card image missing: ${image}`);
  if (dryRun) return { urn: null, url: null, dry_run: true };
  const init = await (await api('/rest/images?action=initializeUpload', { method: 'POST', version, body: { initializeUploadRequest: { owner: orgUrn() } } })).json();
  const { uploadUrl, image: imageUrn } = init.value;
  const up = await fetch(uploadUrl, { method: 'PUT', headers: { authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}` }, body: readFileSync(image) });
  if (!up.ok) throw new Error(`image upload: HTTP ${up.status}`);
  const res = await api('/rest/posts', {
    method: 'POST',
    version,
    body: {
      author: orgUrn(),
      commentary: littleText(post.text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: imageUrn, altText: post.alt_text?.slice(0, 4000) ?? '' } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    },
  });
  const urn = res.headers.get('x-restli-id');
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
}

export const markPosted = (post, r) => Object.assign(post, { status: 'POSTED', posted_at: nowIso(), post_urn: r.urn, post_url: r.url });
