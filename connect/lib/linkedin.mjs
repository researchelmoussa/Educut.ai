// EduCut Connect on LinkedIn: compose a post per offer that is live on /educut-connect/, schedule every
// new post between 07:00 and 22:00 (at most 10 a day, so a bigger batch spreads over the following days),
// and publish due posts on the "EduCut Connect" page through the LinkedIn Posts API. The linkedin agent
// writes only the headline, the intro sentence and the call to share; the facts, the flag and the link
// come from the site entry (connect/site/offers.json), so the post always matches the live page.
// Publishing runs from .github/workflows/linkedin-publish.yml with the page's access token.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, nowIso, readJson, writeJson } from './util.mjs';
import { SITE_SECTION, loadOffers } from './site.mjs';

export const POST_FORMAT = 2;

const queueFile = (root) => join(root ?? REPO_DIR, 'connect', 'linkedin', 'queue.json');
export const loadQueue = (root) => readJson(queueFile(root), { schema_version: '1.0', posts: [] });
export const saveQueue = (q, root) => writeJson(queueFile(root), q);

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 🇺🇸 from "US": two regional indicator symbols.
export const flagEmoji = (cc) => (/^[A-Za-z]{2}$/.test(cc ?? '') ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');

// "7 November 2026" (the post shows the date only; the offer page carries the time zone).
export function postDeadline(o) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(o.deadline ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (o.deadline_label ?? null);
}

// Pay / funding may be claimed only when the offer states it.
const FUNDING_WORDS = /\b(paid|unpaid|funded|funding|stipend|salary|scholarship|tuition|grant|remuneration|allowance)\b|€|\$|£|¥|\b(chf|eur|usd|gbp|aud|sgd|dkk|jpy)\b/i;
export const fundingEvidence = (o) => Boolean(o.compensation?.value) || FUNDING_WORDS.test([o.summary, o.about, ...(o.highlights ?? [])].join(' '));

export function checkPost(p, offer, config) {
  const out = [];
  const add = (check, pass, detail) => out.push({ check, pass, detail, owner: 'linkedin' });
  const all = [p.headline, p.intro, p.cta, p.funding, p.fields, p.level].filter(Boolean).join(' ');
  const hw = words(p.headline).length;
  add('headline 4–16 words', hw >= 4 && hw <= 16, p.headline ?? '(missing)');
  const inst = words(String(offer.institution ?? '').replace(/[(),:;]/g, ' ')).filter((w) => w.length > 3 && !/^(the|of|and|for|university|institute|school|center|centre)$/i.test(w));
  add('headline names the institution', !inst.length || inst.some((w) => (p.headline ?? '').toLowerCase().includes(w.toLowerCase())), offer.institution);
  add('headline without "?", URL or hashtag', !/[?#]|https?:\/\//.test(p.headline ?? ''), 'the template adds the emoji, the flag and the "!"');
  const iw = words(p.intro).length;
  add('intro 15–50 words, 1–2 sentences', iw >= 15 && iw <= 50 && (p.intro ?? '').split(/[.!?](\s|$)/).filter((x) => x?.trim()).length <= 2, `${iw} words`);
  const cw = words(p.cta).length;
  add('share line: one question then "Share this opportunity!"', cw >= 8 && cw <= 30 && (p.cta?.match(/\?/g) ?? []).length === 1 && /Share this opportunity!$/.test(p.cta?.trim() ?? ''), p.cta ?? '(missing)');
  add('no URL or hashtag in the text', !/https?:\/\/|#\w/.test([p.intro, p.cta].join(' ')), 'links and hashtags are added by the template');
  const banned = config.comms.banned_phrases.filter((b) => all.toLowerCase().includes(b.toLowerCase()));
  add('no banned / unsupported claims', banned.length === 0, banned.join(', ') || 'none');
  if (!fundingEvidence(offer)) add('no pay or funding claimed', !FUNDING_WORDS.test([p.headline, p.intro, p.cta, p.funding].join(' ')), 'the offer states no pay or funding');
  return out;
}

// Post text, in the EduCut Connect house format:
//   🎓🇺🇸 <headline>!
//   <intro>
//   📍 Location / 🎓 Level / 💰 Funding / 🔬 Fields / 📅 Deadline
//   🔗 Explore the opportunity and apply: <offer page>
//   <share line>
//   #Hashtags
export function composePost(offer, { headline, intro, cta, funding, fields, level }, hashtags = []) {
  const facts = [
    ['📍 Location', offer.location],
    ['🎓 Level', level?.trim() || offer.level],
    ['💰 Funding', funding?.trim() || offer.compensation?.value],
    ['🔬 Fields', fields?.trim() || offer.field],
    ['📅 Deadline', postDeadline(offer)],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  return [
    `🎓${flagEmoji(offer.country_code)} ${headline.trim().replace(/[.!\s]+$/, '')}!`,
    '',
    intro.trim(),
    '',
    ...facts,
    '',
    '🔗 Explore the opportunity and apply:',
    offer.page_url,
    cta.trim(),
    ...(hashtags.length ? [hashtags.join(' ')] : []),
  ].join('\n');
}

// ---------- scheduling ----------

// UTC instant of a wall-clock time in `timeZone` (two passes cover the DST switch).
function zoned(y, mo, d, h, mi, timeZone) {
  const parts = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(t).map((x) => [x.type, Number(x.value)]));
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t));
    t += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return t;
}
export const localDay = (t, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

// Times for n new posts. Each day's active window (07:00–22:00 local) takes at most `maxPerDay` posts,
// counting the ones already scheduled that day; a batch bigger than that is split evenly over the
// following days (13 posts → 7 today, 6 tomorrow). Inside a day the posts are evenly spread over the
// window, never closer than minGap to each other or to an already-scheduled post. Today's window starts
// `leadMinutes` from now; if too little of it is left, the posts move to the next day.
export function planSlots(n, { now = new Date(), leadMinutes = 30, minGapMinutes = 60, activeHours = [7, 22], timeZone = 'Europe/Zurich', maxPerDay = 10, taken = [], maxDays = 60 } = {}) {
  const step = 15 * 60e3;
  const gap = minGapMinutes * 60e3;
  const busy = taken.map((t) => Date.parse(t));
  const slots = [];
  let left = n;
  const [y0, m0, d0] = localDay(now, timeZone).split('-').map(Number);
  for (let day = 0; left > 0 && day < maxDays; day++) {
    const [y, mo, d] = [y0, m0, d0 + day];
    const open = zoned(y, mo, d, activeHours[0], 0, timeZone);
    const close = zoned(y, mo, d, activeHours[1], 0, timeZone);
    const from = Math.max(open, Math.ceil((now.getTime() + leadMinutes * 60e3) / step) * step);
    if (from >= close) continue;
    const dayBusy = busy.filter((b) => b >= open && b < close);
    const room = Math.min(maxPerDay - dayBusy.length, Math.floor((close - from) / gap));
    const k = Math.min(room, Math.ceil(left / Math.ceil(left / maxPerDay)));
    if (k <= 0) continue;
    const spacing = (close - from) / k;
    const used = [...dayBusy];
    const free = (t) => t >= from && t < close && used.every((b) => Math.abs(b - t) >= gap);
    for (let i = 0; i < k; i++) {
      const ideal = Math.round((from + spacing * (i + 0.5)) / step) * step;
      let t = null;
      for (let j = 0; t === null && j <= (close - from) / step; j++) for (const c of [ideal + j * step, ideal - j * step]) if (t === null && free(c)) t = c;
      if (t === null) break;
      used.push(t);
      slots.push(t);
      left--;
    }
  }
  return slots.sort((a, b) => a - b).map((t) => new Date(t).toISOString());
}

// Offers on the site that are approved (not previews), still open, and not yet queued or posted. Posts
// queued in an older format and not yet published are listed again so they get rewritten.
export function pendingOffers(root, now = new Date()) {
  const queued = new Set(loadQueue(root).posts.filter((p) => p.format === POST_FORMAT || !['DRAFT', 'SCHEDULED'].includes(p.status)).map((p) => p.opportunity_id));
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
