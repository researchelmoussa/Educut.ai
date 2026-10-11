// Renders the EduCut Connect LinkedIn card from a design spec, following the "Datum" identity
// (connect/config/brand/tokens.json): off-white base, hairline grid, numbered sections, cobalt for
// structure, acid on the single call to action, no radius, no shadow, no gradient.
// The page is rendered to PNG with Chromium; the text actually on the card is read back from the DOM
// so the validator compares what was rendered, not what the agent intended.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { CONNECT_DIR } from './util.mjs';

const BRAND = join(CONNECT_DIR, 'config', 'brand');
const tokens = () => JSON.parse(readFileSync(join(BRAND, 'tokens.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const dataUri = (p) => `data:${MIME[extname(p).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(p).toString('base64')}`;

export const FORMATS = { portrait: [1080, 1350], square: [1200, 1200] };

export function flagPath(countryCode) {
  if (!countryCode) return null;
  const p = join(CONNECT_DIR, 'node_modules', 'flag-icons', 'flags', '4x3', `${countryCode.toLowerCase()}.svg`);
  return existsSync(p) ? p : null;
}

function fontFaces() {
  const dir = join(CONNECT_DIR, 'node_modules', '@fontsource', 'ibm-plex-mono', 'files');
  return [400, 500]
    .map((w) => join(dir, `ibm-plex-mono-latin-${w}-normal.woff2`))
    .filter(existsSync)
    .map((p, i) => `@font-face{font-family:"IBM Plex Mono";font-weight:${[400, 500][i]};src:url(${dataUri(p)}) format("woff2");}`)
    .join('\n');
}

export function cardHtml(spec, format = 'portrait') {
  const [W, H] = FORMATS[format];
  const t = tokens();
  const c = t.colors;
  const square = format === 'square';
  const flag = flagPath(spec.country_code);
  const location = [spec.city, spec.country].filter(Boolean).join(', ');

  const photo = spec.landmark?.path
    ? `<figure class="band photo">
         <img src="${dataUri(spec.landmark.path)}" alt="">
         ${spec.landmark.credit ? `<figcaption class="mono credit" data-field="credit">${esc(spec.landmark.credit)}</figcaption>` : ''}
       </figure>`
    : `<figure class="band neutral">
         <div class="neutral-label mono">${flag ? `<img class="flag-lg" src="${dataUri(flag)}" alt="">` : ''}<span>${esc(location.toUpperCase() || 'LOCATION NOT SPECIFIED')}</span></div>
       </figure>`;

  const instLogo = spec.institution_logo?.path
    ? `<img class="inst-logo" src="${dataUri(spec.institution_logo.path)}" alt="">`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>EduCut Connect · ${esc(spec.title)}</title>
<!-- Editable source. Regenerate the PNG with: node connect/cli.mjs render <spec.json> -->
<style>
${fontFaces()}
:root{--paper:${c.offwhite};--ink:${c.obsidian};--cobalt:${c.cobalt};--acid:${c.acid};--grey:${c.grey};--hair:${c.hairline};
  --sans:${t.typography.sans};--mono:${t.typography.mono};}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.card{width:${W}px;height:${H}px;padding:${square ? 56 : 64}px;display:flex;flex-direction:column}
.mono{font-family:var(--mono);text-transform:uppercase;letter-spacing:.14em}
header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;border-bottom:2px solid var(--ink)}
.connect-logo{height:${square ? 92 : 104}px;width:auto;display:block}
.meta{text-align:right;font-size:17px;line-height:1.6}
.meta .code{color:var(--cobalt);font-weight:500}
.meta .grey{color:var(--grey)}
.band{margin-top:28px;position:relative;overflow:hidden;flex:1 1 auto;min-height:160px;border:1px solid var(--hair)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.credit{position:absolute;right:0;bottom:0;background:var(--paper);color:var(--grey);font-size:11px;letter-spacing:.06em;padding:4px 8px;text-transform:none;max-width:80%}
.neutral{background:repeating-linear-gradient(90deg,var(--paper) 0 28px,#EEEEEA 28px 56px)}
.neutral-label{position:absolute;left:24px;bottom:22px;display:flex;align-items:center;gap:16px;font-size:20px;color:var(--ink)}
.flag-lg{height:36px;width:auto;border:1px solid var(--hair)}
.label{font-size:15px;color:var(--grey);margin-top:${square ? 22 : 30}px;padding-bottom:10px;border-bottom:1px solid var(--hair)}
.label b{color:var(--cobalt);font-weight:500}
h1{font-weight:700;letter-spacing:-.035em;line-height:1.04;margin-top:16px;font-size:72px;overflow-wrap:anywhere}
.inst{display:flex;align-items:center;gap:16px;margin-top:14px;font-size:32px;line-height:1.2}
.inst-logo{height:48px;width:auto}
.fields{display:grid;grid-template-columns:1.25fr 1fr 1fr;margin-top:${square ? 20 : 26}px;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.f{padding:14px 18px 16px 0}
.f+.f{padding-left:18px;border-left:1px solid var(--hair)}
.f .k{font-size:13px;color:var(--grey)}
.f .v{font-size:25px;font-weight:700;margin-top:6px;line-height:1.2;display:flex;align-items:center;gap:10px}
.f .v img{height:22px;width:auto;border:1px solid var(--hair);flex:none}
.cta{display:flex;justify-content:space-between;align-items:center;background:var(--ink);color:#fff;padding:20px 26px;font-size:27px;font-weight:700;margin-top:18px;flex:none}
.cta .arrow{color:var(--acid);font-size:34px}
footer{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-top:18px;flex:none}
.educut-logo{height:58px;width:auto;flex:none}
.disclaimer{font-size:12px;line-height:1.5;color:var(--grey);text-align:right;letter-spacing:.08em}
</style></head>
<body><div class="card">
  <header>
    <img class="connect-logo" src="${dataUri(join(BRAND, t.logos.connect_on_light))}" alt="EduCut Connect">
    <div class="meta mono">
      <div class="code" data-field="offer">${esc(spec.offer_label ?? '')}</div>
      <div data-field="type">${esc(spec.type_label ?? '')}</div>
      <div class="grey" data-field="work">${esc(spec.work_label ?? '')}</div>
    </div>
  </header>
  ${photo}
  <div class="label mono"><b>01</b> — Opportunity</div>
  <h1 data-field="title">${esc(spec.title)}</h1>
  <div class="inst">${instLogo}<span data-field="institution">${esc(spec.institution)}</span></div>
  <div class="fields">
    <div class="f"><div class="k mono">Location</div><div class="v">${flag ? `<img src="${dataUri(flag)}" alt="">` : ''}<span data-field="location">${esc(location || 'Not specified')}</span></div></div>
    <div class="f"><div class="k mono">Field</div><div class="v"><span data-field="field">${esc(spec.field ?? 'Not specified')}</span></div></div>
    <div class="f"><div class="k mono">Deadline</div><div class="v"><span data-field="deadline">${esc(spec.deadline_label ?? 'See official page')}</span></div></div>
  </div>
  <div class="cta"><span>Explore it on educutai.com</span><span class="arrow">→</span></div>
  <footer>
    <img class="educut-logo" src="${dataUri(join(BRAND, t.logos.educut_on_light))}" alt="EduCut AI">
    <div class="disclaimer mono" data-field="disclaimer">Shared by EduCut Connect · Not affiliated with<br>${esc(spec.institution)} · Apply via the official link</div>
  </footer>
</div>
<script>
  // Shrink the title until it fits in three lines; the renderer reports anything that still overflows.
  const h1 = document.querySelector('h1');
  let size = 72;
  const lines = () => Math.round(h1.getBoundingClientRect().height / (size * 1.04));
  while (lines() > 3 && size > 44) { size -= 2; h1.style.fontSize = size + 'px'; }
</script>
</body></html>`;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return createRequire(join(root, 'noop.js'))('playwright');
  }
}

// Renders one format. Returns { png, html, rendered_text, qc }.
export async function renderCard(spec, { outDir, format = 'portrait' }) {
  mkdirSync(outDir, { recursive: true });
  const [W, H] = FORMATS[format];
  const html = cardHtml(spec, format);
  const base = format === 'portrait' ? 'card' : 'card-square';
  const htmlPath = join(outDir, `${base}.html`);
  const pngPath = join(outDir, `${base}.png`);
  writeFileSync(htmlPath, html);

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const probe = await page.evaluate(() => {
      const text = Object.fromEntries([...document.querySelectorAll('[data-field]')].map((e) => [e.dataset.field, e.innerText.replace(/\s+/g, ' ').trim()]));
      const card = document.querySelector('.card').getBoundingClientRect();
      const inner = card.bottom - parseFloat(getComputedStyle(document.querySelector('.card')).paddingBottom);
      const overflow = [...document.querySelectorAll('h1,.inst,.fields .v,.cta,footer,header')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().bottom > inner + 0.5)
        .map((e) => e.className || e.tagName.toLowerCase());
      const band = document.querySelector('.band').getBoundingClientRect().height;
      if (band < 161) overflow.push('band squeezed to minimum: text too long');
      const h1 = document.querySelector('h1');
      const titleLines = Math.round(h1.getBoundingClientRect().height / (parseFloat(getComputedStyle(h1).fontSize) * 1.04));
      if (titleLines > 3) overflow.push(`title needs ${titleLines} lines`);
      return { text, overflow, titlePx: parseFloat(getComputedStyle(h1).fontSize) };
    });
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: W, height: H } });
    const qc = [
      { check: `${format}: no clipped text`, pass: probe.overflow.length === 0, detail: probe.overflow.length ? `overflowing: ${probe.overflow.join(', ')}` : 'all text blocks fit' },
      { check: `${format}: title legible on mobile`, pass: probe.titlePx >= 44, detail: `title rendered at ${probe.titlePx}px` },
      { check: `${format}: PNG size`, pass: pngSize(pngPath).join('x') === `${W}x${H}`, detail: pngSize(pngPath).join('x') },
    ];
    return { png: pngPath, html: htmlPath, rendered_text: probe.text, qc };
  } finally {
    await browser.close();
  }
}

// Width/height from the PNG IHDR chunk.
export function pngSize(p) {
  const b = readFileSync(p);
  if (b.toString('ascii', 1, 4) !== 'PNG') return [0, 0];
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

export const ensureDir = (p) => mkdirSync(dirname(p), { recursive: true });
