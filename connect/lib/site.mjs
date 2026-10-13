// EduCut Connect pages on the public site: /educut-connect/ (listing of offer cards) and
// /educut-connect/<slug>/ (one page per offer). Pages are generated from connect/site/offers.json (kept
// under connect/, which is not deployed, so unapproved previews never leak through the data file),
// so the website-developer agent only writes content (summary + key points) and never hand-edits HTML.
// The site chrome (nav, footer, stylesheets) is read from the generated /academies/ page, so these pages
// stay in step with scripts/build-pages.mjs.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, readJson, writeJson, nowIso } from './util.mjs';

export const SITE_SECTION = 'educut-connect';
export const UPSKILL_LEAD = 'Want to strengthen your profile for opportunities like this?';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function slugify(s, max = 60) {
  const base = String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : max).replace(/-$/, '');
}

// Offer folder Offer_007 + title → "007-research-scientist-machine-learning". Offer numbers are unique
// across runs (registry), so the slug never collides and stays stable across re-runs.
export function offerSlug(offerName, title) {
  const n = /(\d+)$/.exec(offerName)?.[1] ?? '000';
  return `${n.padStart(3, '0')}-${slugify(title)}`;
}

export const pageUrl = (siteUrl, slug) => `${siteUrl.replace(/\/$/, '')}/${SITE_SECTION}/${slug}/`;

export function deadlineLabel(d) {
  if (!d?.value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.value);
  if (!m) return d.value;
  const t = /T(\d{2}):(\d{2})/.exec(d.value);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}${t ? `, ${t[1]}:${t[2]}` : ''}${d.timezone ? ` (${d.timezone})` : ''}`;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Everything a website page needs, derived from the verified record and the comms package. Written by
// `post-text` as web-brief.json and printed in post_details.txt.
export function webBrief({ offerName, rec, pkg, visual, siteUrl }) {
  const slug = offerSlug(offerName, rec.title.value);
  const m = pkg?.course_match ?? null;
  const loc = [rec.location?.city, rec.location?.country].filter(Boolean).join(', ');
  return {
    opportunity_id: rec.id,
    offer: offerName,
    slug,
    page_url: pageUrl(siteUrl, slug),
    title: rec.title.value,
    institution: rec.institution.name,
    institution_website: rec.institution.website ?? null,
    location: loc || null,
    country_code: rec.location?.country_code ?? null,
    opportunity_type: rec.opportunity_type ?? null,
    employment_type: rec.employment_type ?? null,
    work_arrangement: rec.work_arrangement ?? null,
    field: rec.field ?? null,
    level: rec.seniority ?? null,
    deadline: rec.deadline?.value ?? null,
    deadline_label: deadlineLabel(rec.deadline),
    compensation: rec.compensation ?? null,
    about: rec.description_short ?? null,
    requirements: rec.qualifications ?? [],
    skills: rec.skills ?? [],
    application_url: rec.application_url ?? null,
    source_url: rec.source_url,
    upskill: m
      ? { kind: m.url_type === 'course_anchor_verified' ? 'course' : 'academy', name: m.name, code: m.code ?? null, url: m.url, why: m.rationale ?? [] }
      : { kind: 'website', name: 'EduCut AI', code: null, url: siteUrl, why: [] },
    card_alt: visual?.alt_text || `EduCut Connect card: ${rec.title.value}, ${rec.institution.name}${loc ? `, ${loc}` : ''}.`,
    application_status: rec.application_status,
  };
}

export function briefText(b) {
  const list = (a) => (a.length ? a.map((x) => `- ${x}`).join('\n') : '- not stated');
  return [
    'WEBSITE PAGE (EduCut Connect) — everything the website-developer agent needs; facts come from record.json',
    `Page URL: ${b.page_url}`,
    `Slug: ${b.slug}`,
    `Title: ${b.title}`,
    `Institution: ${b.institution}${b.institution_website ? ` (${b.institution_website})` : ''}`,
    `Location: ${b.location ?? 'not specified'}${b.work_arrangement ? ` · ${cap(b.work_arrangement)}` : ''}`,
    `Type: ${[b.opportunity_type, b.employment_type].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(cap).join(' · ') || 'not specified'}`,
    `Field: ${b.field ?? 'not specified'}`,
    `Level: ${b.level ?? 'not specified'}`,
    `Deadline: ${b.deadline_label ?? 'not specified'}`,
    `Compensation: ${b.compensation ? JSON.stringify(b.compensation) : 'not stated (do not mention pay)'}`,
    `About: ${b.about ?? 'not stated'}`,
    'Requirements:',
    list(b.requirements),
    `Skills: ${b.skills.length ? b.skills.join(', ') : 'not stated'}`,
    `Official application link: ${b.application_url ?? `not found — source page: ${b.source_url}`}`,
    `Upskill link: ${b.upskill.kind === 'website' ? `EduCut AI website (no matching Academy course) — ${b.upskill.url}` : `${b.upskill.name}${b.upskill.code ? ` (${b.upskill.code})` : ''} — ${b.upskill.url}`}`,
    `Card image: card.png (portrait), card-square.png (listing)`,
    `Card alt text: ${b.card_alt}`,
  ].join('\n');
}

// ---------- Entries (offers.json) ----------

const siteDir = (root) => join(root ?? REPO_DIR, SITE_SECTION);
const dataFile = (root) => join(root ?? REPO_DIR, 'connect', 'site', 'offers.json');
export const loadOffers = (root) => readJson(dataFile(root), { schema_version: '1.0', offers: [] });

export function checkEntry(brief, entry, config) {
  const out = [];
  const add = (check, pass, detail) => out.push({ check, pass, detail, owner: 'website-developer' });
  add('entry is for this offer', entry.opportunity_id === brief.opportunity_id, `${entry.opportunity_id} vs ${brief.opportunity_id}`);
  const n = words(entry.summary).length;
  add('summary 35–90 words', n >= 35 && n <= 90, `${n} words`);
  const hl = entry.highlights ?? [];
  add('3–5 key points', Array.isArray(hl) && hl.length >= 3 && hl.length <= 5, `${hl.length} key points`);
  add('key points at most 24 words each', hl.every((h) => words(h).length <= 24), hl.map((h) => words(h).length).join(', '));
  const text = [entry.summary, ...hl].join(' ');
  add('no URLs in the page text (links are added from the brief)', !/https?:\/\/|www\./i.test(text), 'links come from web-brief.json');
  const banned = config.comms.banned_phrases.filter((p) => text.toLowerCase().includes(p.toLowerCase()));
  add('no banned / unsupported claims', banned.length === 0, banned.join(', ') || 'none');
  if (!brief.compensation) add('no salary claimed', !/salary|stipend of|\b(chf|eur|usd|gbp)\b|€|\$|£/i.test(text), 'record has no stated compensation');
  if (!brief.deadline) add('no deadline claimed', !/deadline|closes|apply by/i.test(text), 'record has no verified deadline');
  add('EduCut not presented as employer', !/\b(we|our team) (are|is) (hiring|recruiting)|join (us|our team)/i.test(text), 'EduCut AI only lists the opportunity');
  return out;
}

// Landscape photo for the listing card: centre-cropped to 3:2, at most 1200 px wide, JPEG. Needs
// python3 + Pillow (preinstalled in cloud sessions).
const PHOTO_RATIO = 3 / 2;
function landscapePhoto(src, dest) {
  const py = `import sys
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")
w, h = im.size
r = ${PHOTO_RATIO}
if w / h > r:
    nw = round(h * r); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
else:
    nh = round(w / r); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
if im.width > 1200:
    im = im.resize((1200, round(1200 / r)), Image.LANCZOS)
im.save(sys.argv[2], "JPEG", quality=85, optimize=True, progressive=True)
print(im.width, im.height)`;
  const [w, h] = execFileSync('python3', ['-I', '-c', py, src, dest], { encoding: 'utf8' }).trim().split(' ').map(Number);
  return { width: w, height: h };
}

// photo: the landscape picture for the listing card (Drive Landmarks photo). Defaults to the offer's
// city.jpg / city.png when present; photoAlt describes what it shows.
export function addEntry({ offerDir, root, config, approvedBy = null, preview = false, photo = null, photoAlt = null }) {
  const brief = readJson(join(offerDir, 'web-brief.json'));
  const entry = readJson(join(offerDir, 'site-entry.json'));
  const checks = checkEntry(brief, entry, config);
  const failures = checks.filter((c) => !c.pass);
  if (failures.length) return { ok: false, failures };

  const dir = join(siteDir(root), brief.slug);
  mkdirSync(dir, { recursive: true });
  const images = {};
  for (const f of ['card.png', 'card-square.png']) {
    if (existsSync(join(offerDir, f))) {
      copyFileSync(join(offerDir, f), join(dir, f));
      images[f] = true;
    }
  }
  const photoSrc = photo ?? ['city.jpg', 'city.png', 'photo.jpg'].map((f) => join(offerDir, f)).find((f) => existsSync(f)) ?? null;
  let photoInfo = null;
  if (photoSrc) {
    if (!existsSync(photoSrc)) return { ok: false, failures: [{ check: 'photo file exists', pass: false, detail: photoSrc, owner: 'website-developer' }] };
    photoInfo = { file: 'photo.jpg', ...landscapePhoto(photoSrc, join(dir, 'photo.jpg')), alt: photoAlt || `Photo: ${brief.location ?? brief.institution}` };
  }
  if (!images['card.png'] && !images['card-square.png']) return { ok: false, failures: [{ check: 'card image present', pass: false, detail: `no card.png in ${offerDir}`, owner: 'visual-designer' }] };

  const data = loadOffers(root);
  const prev = data.offers.find((o) => o.opportunity_id === brief.opportunity_id);
  const row = {
    ...brief,
    summary: entry.summary.trim(),
    highlights: entry.highlights.map((h) => h.trim()),
    card: images['card.png'] ? 'card.png' : 'card-square.png',
    card_square: images['card-square.png'] ? 'card-square.png' : 'card.png',
    photo: photoInfo ?? (photoSrc === null && prev?.photo && existsSync(join(dir, prev.photo.file)) ? prev.photo : null),
    preview: Boolean(preview && !approvedBy),
    approved_by: approvedBy ?? prev?.approved_by ?? null,
    added_at: prev?.added_at ?? nowIso(),
    updated_at: nowIso(),
  };
  data.offers = [...data.offers.filter((o) => o.opportunity_id !== brief.opportunity_id), row].sort((a, b) => a.offer.localeCompare(b.offer));
  writeJson(dataFile(root), data);
  return { ok: true, slug: row.slug, page_url: row.page_url, preview: row.preview, photo: row.photo, offers: data.offers.length };
}

export function removeEntry({ key, root }) {
  const data = loadOffers(root);
  const hit = data.offers.find((o) => o.opportunity_id === key || o.slug === key || o.offer === key);
  if (!hit) return { removed: false };
  data.offers = data.offers.filter((o) => o !== hit);
  writeJson(dataFile(root), data);
  rmSync(join(siteDir(root), hit.slug), { recursive: true, force: true });
  return { removed: true, slug: hit.slug };
}

// ---------- Rendering ----------

function chrome(root) {
  const src = join(root ?? REPO_DIR, 'academies', 'index.html');
  if (!existsSync(src)) throw new Error('academies/index.html not found: run scripts/build-pages.mjs first');
  const html = readFileSync(src, 'utf8');
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)" \/>/g)].map((m) => m[1]);
  const nav = (/<nav class="nav">[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '').replace(/ aria-current="page"/g, '');
  const footer = /<footer>[\s\S]*?<\/footer>/.exec(html)?.[0] ?? '';
  return { css, nav, footer };
}

const CSS = `/* EduCut Connect pages: generated by connect/lib/site.mjs (do not edit by hand). */
:root{--cx-red:#d92d20}
.cx-hero .lead{max-width:780px}
.cx-note{max-width:780px;margin:0;padding:14px 16px;border-left:4px solid var(--lime);background:#151515;color:#c9c9c6;font-size:14px;line-height:1.55}
.cx-preview{background:var(--lime);color:var(--ink);font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;padding:10px 0;text-align:center}
.cx-bar{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:28px}
.cx-bar h2{margin:0}
.cx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;margin:0;padding:0;list-style:none}
.cx-card{display:flex;flex-direction:column;height:100%;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none;transition:border-color .15s,transform .15s}
.cx-card:hover,.cx-card:focus-visible{border-color:var(--ink);transform:translateY(-2px)}
.cx-card img{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;background:var(--soft);border-bottom:1px solid var(--line)}
.cx-card img.cx-photo{aspect-ratio:3/2}
.cx-card .cx-body{display:flex;flex-direction:column;gap:8px;padding:16px 18px 18px;flex:1}
.cx-card .cx-kicker{color:var(--blue);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.cx-card h3{font-size:19px;line-height:1.2;letter-spacing:-.02em;margin:0}
.cx-card .cx-inst{color:#5f5f5a;font-size:14px;line-height:1.4;margin:0}
.cx-card .cx-count{margin-top:auto;padding-top:6px;font-weight:700;font-size:17px;letter-spacing:-.01em;color:var(--blue);font-variant-numeric:tabular-nums}
.cx-card .cx-meta{padding-top:10px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5f5f5a}
.cx-card .cx-more{color:var(--ink)}
.is-closed .cx-card img{filter:grayscale(1);opacity:.6}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.is-closed .cx-count,.is-closed .cx-countdown strong{color:var(--cx-red);text-transform:uppercase;letter-spacing:.06em}
.cx-search{display:flex;gap:0;margin:0 0 14px;max-width:640px}
.cx-search input{flex:1;min-width:0;font:inherit;font-size:16px;padding:13px 14px;border:1px solid var(--ink);border-right:0;border-radius:0;background:#fff;color:var(--ink)}
.cx-search input:focus{outline:2px solid var(--blue);outline-offset:-2px}
.cx-search button{font:inherit;font-weight:600;font-size:15px;padding:0 20px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer}
.cx-results{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f5f5a;margin:0 0 24px}
.cx-grid li[hidden]{display:none}
.cx-countdown{margin:0 0 26px;padding:0 0 18px;border-bottom:2px solid var(--ink)}
.cx-countdown strong{display:block;font-size:clamp(30px,4vw,44px);line-height:1.05;letter-spacing:-.03em;color:var(--blue)}
.cx-countdown span{display:block;margin-top:6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#5f5f5a}
.cx-tag{display:inline-block;border:1px solid currentColor;padding:2px 6px;font-size:11px;letter-spacing:.08em}
.cx-empty{padding:28px;border:1px dashed var(--line);background:#fff;color:#5f5f5a}
.cx-offer{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:48px;align-items:start}
.cx-offer figure{margin:0;position:sticky;top:24px}
.cx-offer figure img{display:block;width:100%;height:auto;border:1px solid var(--line);background:#fff}
.cx-offer h2{font-size:28px;margin:0 0 12px}
.cx-summary{font-size:18px;line-height:1.6;margin:0 0 28px}
.cx-points{margin:0 0 32px;padding:0;list-style:none;counter-reset:pt}
.cx-points li{counter-increment:pt;display:grid;grid-template-columns:40px 1fr;gap:8px;padding:12px 0;border-top:1px solid var(--line);font-size:16px;line-height:1.5}
.cx-points li:last-child{border-bottom:1px solid var(--line)}
.cx-points li::before{content:counter(pt,decimal-leading-zero);color:var(--blue);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cx-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin:0 0 32px;border-top:2px solid var(--ink);border-bottom:1px solid var(--ink)}
.cx-facts div{padding:12px 14px 14px 0}
.cx-facts dt{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5f5f5a;margin:0 0 4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cx-facts dd{margin:0;font-size:16px;font-weight:600;line-height:1.35}
.cx-actions{display:grid;gap:14px;margin:0 0 28px}
.cx-upskill{display:block;padding:20px 22px;border:1px solid var(--lime);background:var(--lime);color:var(--ink);text-decoration:none}
.cx-upskill:hover{background:var(--ink);border-color:var(--ink);color:#fff}
.cx-upskill .mono{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.cx-upskill:hover .mono{color:var(--lime)}
.cx-upskill strong{font-size:20px;letter-spacing:-.015em}
.cx-apply{justify-self:start;display:inline-block;padding:13px 20px;border:1px solid var(--ink);background:#fff;color:var(--ink);font-weight:600;font-size:15px;text-decoration:none}
.cx-apply:hover{background:var(--ink);color:#fff}
.cx-apply[aria-disabled]{border-color:var(--line);color:#8d8d88;background:transparent;pointer-events:none}
.cx-disclaimer{font-size:13px;line-height:1.55;color:#5f5f5a;border-top:1px solid var(--line);padding-top:16px;margin:0}
@media (max-width:860px){.cx-offer{grid-template-columns:1fr;gap:28px}.cx-offer figure{position:static;max-width:420px}}
`;

function shell({ root, title, description, canonical, body, noindex }) {
  const c = chrome(root);
  c.nav = c.nav.replace(`<a href="/${SITE_SECTION}/">`, `<a href="/${SITE_SECTION}/" aria-current="page">`);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
${noindex ? '  <meta name="robots" content="noindex" />\n' : `  <link rel="canonical" href="${esc(canonical)}" />\n`}  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="EduCut.ai" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />
${c.css.map((h) => `  <link rel="stylesheet" href="${h}" />`).join('\n')}
  <link rel="stylesheet" href="/${SITE_SECTION}/connect.css" />
</head>
<body>
  ${c.nav}
  <main>
${body}
  </main>
${c.footer}
</body>
</html>
`;
}

const crumbs = (items) =>
  `<nav class="breadcrumb mono" aria-label="Breadcrumb">${items
    .map(([href, label], i) => (i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${href}">${esc(label)}</a><span aria-hidden="true">/</span>`))
    .join('')}</nav>`;

const typeLabel = (o) => [o.opportunity_type, o.employment_type].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(cap).join(' · ');
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : null;
};

// Deadlines are evaluated in the browser, so a static page always shows the current countdown: open
// offers sorted by urgency, offers without a deadline after them, closed ones last and marked CLOSED.
// A date without a time closes at the end of that day (UTC).
export const deadlineMs = (d) => (d ? Date.parse(d.length === 10 ? `${d}T23:59:59Z` : d) : NaN);
function urgencyKey(o, now) {
  const t = deadlineMs(o.deadline);
  if (Number.isNaN(t)) return [1, 0];
  return t < now ? [2, -t] : [0, t];
}
export const byUrgency = (now) => (a, b) => {
  const [x, y] = [urgencyKey(a, now), urgencyKey(b, now)];
  return x[0] - y[0] || x[1] - y[1] || a.offer.localeCompare(b.offer);
};

const DEADLINE_SCRIPT = `<script>
(function(){
  function end(d){if(!d)return NaN;return Date.parse(d.length===10?d+'T23:59:59Z':d);}
  function left(ms){var m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),n=m%60;
    if(d>=2)return d+' days left';if(d===1)return '1 day '+h+' h left';if(h>=1)return h+' h '+n+' min left';return Math.max(n,1)+' min left';}
  function pad(x){return (x<10?'0':'')+x;}
  function dhm(ms){var m=Math.floor(ms/60000);return Math.floor(m/1440)+'d '+pad(Math.floor(m%1440/60))+'h '+pad(m%60)+'m left';}
  function tick(){var now=Date.now();
    document.querySelectorAll('[data-deadline]').forEach(function(el){
      var t=end(el.getAttribute('data-deadline')),c=el.querySelector('[data-countdown]'),suffix=el.getAttribute('data-suffix')||'';
      if(isNaN(t)){el.setAttribute('data-rank','1');if(c)c.textContent='No deadline stated';return;}
      if(t<now){el.classList.add('is-closed');el.setAttribute('data-rank','2');el.setAttribute('data-key',String(-t));if(c)c.textContent='Closed';
        var a=el.querySelector('[data-apply]');if(a&&a.hasAttribute('href')){a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.textContent='Applications closed';}}
      else{el.setAttribute('data-rank','0');el.setAttribute('data-key',String(t));if(c)c.textContent=(el.getAttribute('data-format')==='dhm'?dhm(t-now):left(t-now))+suffix;}
    });}
  function sort(){var list=document.querySelector('[data-offers]');if(!list)return;
    var items=[].slice.call(list.children);
    items.sort(function(a,b){return (+a.getAttribute('data-rank'))-(+b.getAttribute('data-rank'))||(+a.getAttribute('data-key')||0)-(+b.getAttribute('data-key')||0);});
    items.forEach(function(li){list.appendChild(li);});}
  function search(){var q=document.getElementById('cx-q'),list=document.querySelector('[data-offers]'),out=document.getElementById('cx-results');if(!q||!list)return;
    var terms=q.value.toLowerCase().split(/\\s+/).filter(Boolean),shown=0,items=list.children;
    for(var i=0;i<items.length;i++){var hay=items[i].getAttribute('data-search')||'';var ok=terms.every(function(w){return hay.indexOf(w)>-1;});items[i].hidden=!ok;if(ok)shown++;}
    if(out)out.textContent=terms.length?shown+' of '+items.length+' opportunities match':items.length+' opportunities · most urgent first';}
  tick();sort();
  var f=document.getElementById('cx-search');if(f){f.addEventListener('submit',function(e){e.preventDefault();search();});document.getElementById('cx-q').addEventListener('input',search);search();}
  setInterval(tick,15000);
})();
</script>`;

function listingPage(data, root, siteUrl, reviewBuild) {
  const offers = [...data.offers].sort(byUrgency(Date.now()));
  const haystack = (o) => [o.offer.replace('_', ' '), o.title, o.institution, o.location, o.field, o.level, o.opportunity_type, o.employment_type, o.work_arrangement].filter(Boolean).join(' ').toLowerCase();
  const cards = offers
    .map(
      (o) => `        <li data-deadline="${esc(o.deadline ?? '')}" data-format="dhm" data-search="${esc(haystack(o))}"><a class="cx-card" href="/${SITE_SECTION}/${o.slug}/">
          ${o.photo
            ? `<img class="cx-photo" src="/${SITE_SECTION}/${o.slug}/${o.photo.file}" alt="${esc(o.photo.alt)}" width="${o.photo.width}" height="${o.photo.height}" loading="lazy" />`
            : `<img src="/${SITE_SECTION}/${o.slug}/${o.card_square}" alt="${esc(o.card_alt)}" width="600" height="600" loading="lazy" />`}
          <div class="cx-body">
            <span class="mono cx-kicker">${esc(o.offer.replace('_', ' '))}${typeLabel(o) ? ` · ${esc(typeLabel(o))}` : ''}${o.preview ? ' · <span class="cx-tag">Preview</span>' : ''}</span>
            <h3>${esc(o.title)}</h3>
            <p class="cx-inst">${esc(o.institution)}${o.location ? `<br />${esc(o.location)}` : ''}</p>
            <span class="cx-count" data-countdown>${o.deadline ? `Deadline ${esc(shortDate(o.deadline))}` : 'No deadline stated'}</span>
            <div class="mono cx-meta"><span>${o.deadline ? `Deadline ${esc(shortDate(o.deadline))}` : 'Open'}</span><span class="cx-more">View →</span></div>
          </div>
        </a></li>`,
    )
    .join('\n');
  const body = `${reviewBuild ? '    <div class="cx-preview">Review build: offers flagged Preview await approval and are not public</div>\n' : ''}    <header class="page-hero cx-hero">
      <div class="wrap">
        ${crumbs([['/', 'Home'], ['', 'EduCut Connect']])}
        <div class="mono kicker" style="margin-top:34px">EduCut Connect · ${offers.length} ${offers.length === 1 ? 'opportunity' : 'opportunities'}</div>
        <h1>Your next opportunity in Industry &amp; Research</h1>
        <p class="lead">Jobs, fellowships and research positions from around the world, checked against their official pages. Open an offer for the essentials, the official application link and an EduCut AI Academy course that strengthens your profile.</p>
        <p class="cx-note">EduCut AI lists these opportunities for information. We are not the employer or recruiter: always apply through the institution's official page.</p>
      </div>
    </header>

    <section class="page-section" aria-labelledby="cx-list">
      <div class="wrap">
        <div class="cx-bar"><h2 id="cx-list">Current opportunities</h2><span class="mono">Most urgent first</span></div>
${offers.length ? `        <form class="cx-search" id="cx-search" role="search"><label class="sr-only" for="cx-q">Search opportunities</label><input id="cx-q" type="search" placeholder="Search by title, institution, country or field" autocomplete="off" /><button type="submit">Search</button></form>
        <p class="mono cx-results" id="cx-results" aria-live="polite">${offers.length} ${offers.length === 1 ? 'opportunity' : 'opportunities'} · most urgent first</p>
      <ul class="cx-grid" data-offers>\n${cards}\n      </ul>` : '      <p class="cx-empty">New opportunities are added after review. Check back soon.</p>'}
      </div>
    </section>

    <section class="cta"><div class="wrap cta-grid"><h2>Build the AI skills these roles ask for.</h2><a class="btn btn-lg" href="/academies/">Explore the EduCut AI Academy →</a></div></section>
${DEADLINE_SCRIPT}`;
  return shell({
    root,
    title: 'EduCut Connect: opportunities in Industry & Research | EduCut.ai',
    description: 'Jobs, fellowships and research positions worldwide, with the official application link and an EduCut AI Academy course to strengthen your profile.',
    canonical: `${siteUrl}/${SITE_SECTION}/`,
    body,
    noindex: reviewBuild,
  });
}

function offerPage(o, root) {
  const facts = [
    ['Institution', o.institution],
    ['Location', [o.location, o.work_arrangement && cap(o.work_arrangement)].filter(Boolean).join(' · ')],
    ['Type', typeLabel(o)],
    ['Field', o.field],
    ['Level', o.level],
    ['Deadline', o.deadline_label],
  ].filter(([, v]) => v);
  const upskill =
    o.upskill.kind === 'website'
      ? { label: 'Strengthen your profile', name: 'Discover EduCut AI courses and AI learning paths', url: o.upskill.url }
      : { label: `Upskill with EduCut AI Academy${o.upskill.code ? ` · ${o.upskill.code}` : ''}`, name: o.upskill.name, url: o.upskill.url };
  const apply = o.application_url ?? o.source_url;
  const body = `${o.preview ? '    <div class="cx-preview">Preview: this offer is awaiting approval and is not listed publicly yet</div>\n' : ''}    <header class="page-hero cx-hero">
      <div class="wrap">
        ${crumbs([['/', 'Home'], [`/${SITE_SECTION}/`, 'EduCut Connect'], ['', o.title]])}
        <div class="mono kicker" style="margin-top:34px">${esc(o.offer.replace('_', ' '))}${typeLabel(o) ? ` · ${esc(typeLabel(o))}` : ''}</div>
        <h1>${esc(o.title)}</h1>
        <p class="lead">${esc(o.institution)}${o.location ? ` · ${esc(o.location)}` : ''}</p>
      </div>
    </header>

    <section class="page-section alt">
      <div class="wrap cx-offer">
        <figure><img src="/${SITE_SECTION}/${o.slug}/${o.card}" alt="${esc(o.card_alt)}" width="1080" height="1350" /></figure>
        <div data-deadline="${esc(o.deadline ?? '')}" data-suffix=" to apply">
          <p class="cx-countdown"><strong data-countdown>${o.deadline_label ? `Deadline ${esc(o.deadline_label)}` : 'No deadline stated'}</strong>${o.deadline_label ? `<span>Deadline ${esc(o.deadline_label)}</span>` : ''}</p>
          <h2>In short</h2>
          <p class="cx-summary">${esc(o.summary)}</p>
          <ul class="cx-points">
${o.highlights.map((h) => `            <li>${esc(h)}</li>`).join('\n')}
          </ul>
          <dl class="cx-facts">
${facts.map(([k, v]) => `            <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
          </dl>
          <div class="cx-actions">
            <a class="cx-upskill" href="${esc(upskill.url)}"><span class="mono">${esc(upskill.label)}</span><strong>${esc(upskill.name)} →</strong></a>
            <a class="cx-apply" data-apply href="${esc(apply)}" target="_blank" rel="noopener">${o.application_url ? 'Apply on the official page →' : 'See the official listing →'}</a>
          </div>
          <p class="cx-disclaimer">EduCut AI is not the employer, recruiter or a partner of ${esc(o.institution)}. Details are taken from the official page; check them there before applying. EduCut AI courses build skills and do not guarantee selection.</p>
        </div>
      </div>
    </section>
${DEADLINE_SCRIPT}`;
  return shell({
    root,
    title: `${o.title} · ${o.institution} | EduCut Connect`,
    description: o.summary.split(/(?<=\.)\s/)[0].slice(0, 300),
    canonical: o.page_url,
    body,
    noindex: o.preview,
  });
}

// Keep sitemap.xml in step: public offer pages in, previews and removed offers out.
function patchSitemap(root, urls) {
  const file = join(root ?? REPO_DIR, 'sitemap.xml');
  if (!existsSync(file)) return false;
  const marker = `/${SITE_SECTION}/`;
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => !l.includes(marker));
  const end = lines.findIndex((l) => l.trim() === '</urlset>');
  if (end < 0) return false;
  lines.splice(end, 0, ...urls.map((u) => `  <url><loc>${u}</loc></url>`));
  writeFileSync(file, lines.join('\n'));
  return true;
}

// includePreviews: review build (a branch preview, never main). The listing then also shows offers that
// await approval, flagged "Preview", and is marked noindex.
export function buildSite({ root, siteUrl, includePreviews = false }) {
  const dir = siteDir(root);
  mkdirSync(dir, { recursive: true });
  const data = loadOffers(root);
  const pub = { ...data, offers: data.offers.filter((o) => !o.preview) };
  // Previews always get their own page (noindex, with a banner) so they can be reviewed by direct link.
  const listed = includePreviews ? data : pub;
  const reviewBuild = listed.offers.some((o) => o.preview);
  if (existsSync(join(dir, 'offers.json'))) rmSync(join(dir, 'offers.json')); // data lives in connect/site/
  writeFileSync(join(dir, 'connect.css'), CSS);
  writeFileSync(join(dir, 'index.html'), listingPage(listed, root, siteUrl, reviewBuild));
  const written = [`${SITE_SECTION}/index.html`];
  for (const o of data.offers) {
    writeFileSync(join(dir, o.slug, 'index.html'), offerPage(o, root));
    written.push(`${SITE_SECTION}/${o.slug}/index.html`);
  }
  // Folders left behind by removed offers.
  const keep = new Set(data.offers.map((o) => o.slug));
  for (const d of readdirSync(dir, { withFileTypes: true })) if (d.isDirectory() && !keep.has(d.name)) rmSync(join(dir, d.name), { recursive: true });
  // Same URLs as scripts/build-pages.mjs puts in the sitemap: the listing and every approved offer.
  const sitemap = patchSitemap(root, [`${siteUrl}/${SITE_SECTION}/`, ...pub.offers.map((o) => o.page_url)]);
  return { pages: written, listed: listed.offers.length, review_build: reviewBuild, previews: data.offers.filter((o) => o.preview).map((o) => o.slug), sitemap_updated: sitemap, site_dir: dir };
}

