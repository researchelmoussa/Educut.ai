// LinkedIn posting kit: the day's scheduled posts laid out for posting by hand on the EduCut Connect page
// (LinkedIn's own scheduler), for as long as the API publisher has no access token. One folder per day:
//   index.html   one card per post: date and time, card image, the post text with a copy button
//   posts.md     the same list as plain text (readable on GitHub)
//   cards/       the card images, named NN_<day><Mon>_<HH>h<MM>_Offer_NNN.png in posting order
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR } from './util.mjs';
import { SITE_SECTION } from './site.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parts = (t, timeZone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );

export function buildKit(posts, { outDir, root, timeZone = 'Europe/Zurich', title = 'Posting kit' }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'cards'), { recursive: true });
  const items = [...posts]
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .map((p, i) => {
      const d = parts(p.scheduled_at, timeZone);
      const image = `${String(i + 1).padStart(2, '0')}_${d.day}${d.month}_${d.hour}h${d.minute}_${p.offer}.png`;
      const src = join(root ?? REPO_DIR, SITE_SECTION, p.slug, 'card.png');
      if (existsSync(src)) copyFileSync(src, join(outDir, 'cards', image));
      return { ...p, image, has_image: existsSync(src), day: `${d.weekday} ${Number(d.day)} ${d.month} ${d.year}`, date: `${d.day} ${d.month} ${d.year}`, time: `${d.hour}:${d.minute}` };
    });
  const days = Map.groupBy ? Map.groupBy(items, (p) => p.day) : items.reduce((m, p) => m.set(p.day, [...(m.get(p.day) ?? []), p]), new Map());

  const md = [`# ${title}`, '', `${items.length} posts, times in ${timeZone}. Attach the image from \`cards/\`, paste the text, schedule at the time shown.`, ''];
  for (const [day, ps] of days) {
    md.push(`## ${day}`, '');
    for (const p of ps) md.push(`### ${p.time} · ${p.offer}`, '', `Image: \`cards/${p.image}\``, '', '```', p.text, '```', '');
  }
  writeFileSync(join(outDir, 'posts.md'), md.join('\n'));

  const card = (p) => `
      <article class="post" id="${p.offer}">
        <div class="when">
          <span class="time">${p.time}</span>
          <span class="date">${esc(p.date)}</span>
          <label class="done"><input type="checkbox" id="done-${p.offer}" data-k="${p.offer}"> Scheduled</label>
        </div>
        <a class="img" href="cards/${p.image}" target="_blank" rel="noopener"><img src="cards/${p.image}" alt="${esc(p.alt_text)}" loading="lazy" width="1080" height="1350"></a>
        <div class="body">
          <div class="meta"><span class="offer">${p.offer.replace('_', ' ')}</span><span>Deadline ${esc(p.deadline?.slice(0, 10) ?? 'not stated')}</span></div>
          <p class="file">Image file: <code>${p.image}</code>${p.has_image ? '' : ' (missing: no card on the site)'}</p>
          <pre id="t-${p.offer}">${esc(p.text)}</pre>
          <div class="actions">
            <button type="button" class="copy" data-t="t-${p.offer}">Copy post text</button>
            <details><summary>Image alt text</summary><p>${esc(p.alt_text)}</p></details>
          </div>
        </div>
      </article>`;
  const sections = [...days].map(([day, ps]) => `
  <section class="day">
    <h2>${esc(day)} <span>${ps.length} post${ps.length > 1 ? 's' : ''}</span></h2>
    <div class="list">${ps.map(card).join('')}
    </div>
  </section>`).join('');

  const html = `<title>${esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,600&display=swap">
<style>
/* Layout: a schedule sheet. One row per post: time column, card thumbnail, ready-to-copy text. */
:root{--bg:#f3f5f6;--surface:#ffffff;--fg:#14212b;--muted:#5b6b77;--line:#d8dfe4;--accent:#0b6e6e;--accent-fg:#ffffff;--ok:#2f7d32;
--display:"Fraunces",Georgia,serif;--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1519;--surface:#172128;--fg:#e4ecf0;--muted:#94a5b0;--line:#2a3843;--accent:#4fc1bd;--accent-fg:#06231f;--ok:#7fcf83;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1519;--surface:#172128;--fg:#e4ecf0;--muted:#94a5b0;--line:#2a3843;--accent:#4fc1bd;--accent-fg:#06231f;--ok:#7fcf83;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 var(--sans);margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:32px 64px}
.wrap{max-width:1040px;margin:0 auto;display:grid;gap:40px}
header{display:grid;gap:14px}
.kicker{font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
h1{font:600 clamp(28px,5vw,40px)/1.1 var(--display);margin:0;text-wrap:balance}
header p{margin:0;max-width:68ch;color:var(--muted)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:6px 0 0;padding:0;list-style:none;counter-reset:s}
.steps li{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px 14px;counter-increment:s;font-size:14px}
.steps li::before{content:counter(s);font:600 12px var(--mono);color:var(--accent);display:block;margin-bottom:2px}
.progress{font:500 14px var(--mono);color:var(--muted)}
.progress b{color:var(--fg)}
.day{display:grid;gap:14px}
h2{font:600 22px/1.2 var(--display);margin:0;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;position:sticky;top:env(safe-area-inset-top,0px);background:var(--bg);padding:8px 0;z-index:2;border-bottom:1px solid var(--line)}
h2 span{font:400 13px var(--mono);color:var(--muted)}
.list{display:grid;gap:14px}
.post{display:grid;grid-template-columns:92px 150px minmax(0,1fr);gap:18px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px}
.post.is-done{opacity:.55}
.when{display:grid;align-content:start;gap:2px}
.time{font:600 26px/1 var(--mono);font-variant-numeric:tabular-nums}
.date{font:400 12px var(--mono);color:var(--muted)}
.done{margin-top:12px;font-size:13px;display:flex;gap:6px;align-items:center;cursor:pointer}
.img img{display:block;width:100%;height:auto;border-radius:6px;border:1px solid var(--line);background:var(--bg)}
.body{min-width:0;display:grid;gap:10px;align-content:start}
.meta{display:flex;gap:12px;flex-wrap:wrap;font:500 12px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.offer{color:var(--accent)}
.file{margin:0;font-size:13px;color:var(--muted)}
code{font:13px var(--mono);color:var(--fg);word-break:break-all}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font:14px/1.5 var(--sans);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:12px 14px;max-height:260px;overflow:auto}
.actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:14px}
button{font:600 14px var(--sans);background:var(--accent);color:var(--accent-fg);border:0;border-radius:6px;padding:9px 14px;cursor:pointer}
button.ok{background:var(--ok)}
button:focus-visible,a:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
details summary{cursor:pointer;color:var(--muted)}
details p{margin:6px 0 0;font-size:13px;color:var(--muted);max-width:60ch}
@media (max-width:640px){.post{grid-template-columns:1fr 110px}.when{grid-column:1;grid-row:1}.img{grid-column:2;grid-row:1}.body{grid-column:1/-1}.time{font-size:22px}}
</style>
<div class="wrap">
  <header>
    <span class="kicker">EduCut Connect · LinkedIn</span>
    <h1>${esc(title)}</h1>
    <p>${items.length} post${items.length === 1 ? '' : 's'}, one per offer, timed between 07:00 and 22:00 ${esc(timeZone)}, newest offers first. Schedule each one on the EduCut Connect page with LinkedIn's own scheduler.</p>
    <ol class="steps">
      <li>On the EduCut Connect page, click <b>Start a post</b>, then the image icon, and attach the card file named under the post (the card images are sent with this kit).</li>
      <li>Click <b>Copy post text</b> and paste it into the post.</li>
      <li>Click the clock icon next to <b>Post</b>, set the date and time shown here, then <b>Schedule</b>.</li>
      <li>Tick <b>Scheduled</b> here to keep track, and tell Claude which offers are scheduled.</li>
    </ol>
    <div class="progress" id="progress"></div>
  </header>
${sections}
</div>
<script>
const KEY='educut-kit-done';let done={};try{done=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const boxes=[...document.querySelectorAll('input[data-k]')];
function paint(){let c=0;for(const b of boxes){b.checked=!!done[b.dataset.k];b.closest('.post').classList.toggle('is-done',b.checked);if(b.checked)c++}document.getElementById('progress').innerHTML='<b>'+c+'</b> of '+boxes.length+' scheduled on LinkedIn'}
boxes.forEach(b=>b.addEventListener('change',()=>{done[b.dataset.k]=b.checked;try{localStorage.setItem(KEY,JSON.stringify(done))}catch(e){}paint()}));
paint();
document.querySelectorAll('button.copy').forEach(btn=>btn.addEventListener('click',()=>{const pre=document.getElementById(btn.dataset.t);
const ok=()=>{btn.textContent='Copied';btn.classList.add('ok');setTimeout(()=>{btn.textContent='Copy post text';btn.classList.remove('ok')},1800)};
const sel=()=>{const r=document.createRange();r.selectNodeContents(pre);const s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='Selected: press Ctrl/Cmd+C'};
try{navigator.clipboard.writeText(pre.textContent).then(ok,sel)}catch(e){sel()}}));
</script>
`;
  writeFileSync(join(outDir, 'index.html'), html);
  return { dir: outDir, posts: items.length, page: join(outDir, 'index.html'), cards: items.map((p) => join(outDir, 'cards', p.image)), missing_images: items.filter((p) => !p.has_image).map((p) => p.offer) };
}
