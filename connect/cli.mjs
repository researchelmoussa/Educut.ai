#!/usr/bin/env node
// EduCut Connect command line. Agents call these commands instead of hand-editing state, so every
// state change, check and file is produced by code and recorded in the run log.
// Usage: node connect/cli.mjs <command> [args] [--run <run-dir>] [--registry <file>]
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { courseCandidates, checkCourse, loadCatalog } from './lib/catalog.mjs';
import { driveAvailable, ensureFolder, upload, findChild, download } from './lib/drive.mjs';
import { feedItems, jobPostings, links, logoCandidates, looksLikeFeed, pageText, pageTitle } from './lib/extract.mjs';
import { PoliteFetcher } from './lib/fetch.mjs';
import { parseLinks } from './lib/sources.mjs';
import { addLandmark, fetchLandmark, findLandmark } from './lib/landmarks.mjs';
import { Registry, deadlineEnd, emptyRegistry } from './lib/registry.mjs';
import { renderCard } from './lib/render.mjs';
import { checkQuestion, composePost, linkedinConfigured, loadQueue, markPosted, pendingOffers, planSlots, publishPost, saveQueue } from './lib/linkedin.mjs';
import { addEntry, briefText, buildSite, loadOffers, offerSlug, pageUrl, removeEntry, webBrief } from './lib/site.mjs';
import { validateSchema } from './lib/schema.mjs';
import { summarize, validateComms, validateRecord, validateVisual } from './lib/validate.mjs';
import {
  CONNECT_DIR, canonicalUrl, contentHash, fingerprint, loadConfig, logger, nowIso, offerFolderName, opportunityId,
  readJson, sha256, writeJson,
} from './lib/util.mjs';

// Behind an HTTPS proxy (cloud sessions), Node's fetch only uses it when NODE_USE_ENV_PROXY is set:
// re-run ourselves with it so crawling, Commons and Drive requests go through the proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(r.status ?? 1);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const k = rest[i].slice(2);
    flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  } else args.push(rest[i]);
}

const config = loadConfig();
const today = new Date().toISOString().slice(0, 10);
const runDir = resolve(flags.run ?? join(CONNECT_DIR, 'runs', today));
const registryFile = resolve(flags.registry ?? join(runDir, 'registry.json'));
const log = logger(join(runDir, 'log.jsonl'));
const out = (v) => process.stdout.write((typeof v === 'string' ? v : JSON.stringify(v, null, 2)) + '\n');
const fail = (msg, code = 1) => {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
};
const offersDir = join(runDir, 'offers');
// Palette-quantise a PNG in place (about 60% smaller for the flat card design). Needs python3 + Pillow.
const optimizePng = (file) =>
  execFileSync('python3', ['-I', '-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB")\nim.quantize(colors=128,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).save(sys.argv[1],optimize=True)', file]);
const findOffer = (id) => {
  if (!existsSync(offersDir)) return null;
  for (const d of readdirSync(offersDir)) {
    const f = join(offersDir, d, 'record.json');
    if (existsSync(f) && readJson(f).id === id) return join(offersDir, d);
  }
  return null;
};

const commands = {
  help() {
    out(`EduCut Connect CLI
  sources <links.txt>                 List approved sources (numbered) as JSON
  init-run [--registry-src <file>]    Create today's run folder, load registry, expire past deadlines
  discover <list-url> [--follow re] [--limit n]
                                      Polite fetch of a listing page or feed; returns NEW candidate postings only
  extract <url>                       Fetch a posting; save its text; return JSON-LD JobPosting data + logo candidates
  finalize <record.json>              Fill id / fingerprint / content_hash; validate against the schema
  register <record.json>              Add to registry (dedup); prints new | updated | unchanged | duplicate
  prepare <id>                        Assign the offer number and create offers/Offer_NNN/ for both agents
  courses <record.json>               Shortlist Academy courses by requirement overlap
  check-course <code>                 Verify a course exists and its page anchor is live
  landmark <city> <CC> [--query q]    Find/download a licensed landmark photo (Wikimedia Commons) for the city
  landmark-add <city> <CC> <file> [--landmark n] [--credit c] [--license l]
                                      Register an administrator-supplied city photo (Drive Landmarks folder)
  render <spec.json> [--square]       Render card.png (+ square) and write visual-package.json
  page-url <id>                       EduCut Connect page URL of an offer (the link used in the post)
  post-text <id>                      Write linkedin_post.txt, post_details.txt and web-brief.json from comms-package.json
  validate <id>                       Cross-check record, image and caption; advance to UNDER_REVIEW on pass
  review                              Write review.md for every offer in the run
  approve <id> --by <name> | reject <id> --reason <text> | revise <id> --note <text>
  mark-published <id> --url <post-url>
  status                              Registry counts by status
  export [--dest dir]                 Copy validated offers to <dest>/<date>/Offer_NNN/ (default connect/Communication)
  drive-sync                          Upload offers, review and registry to Drive (needs GDRIVE_* secrets)
  drive-pull-registry                 Download Registry/registry.json from Drive into the run
  optimize-png <file>                 Shrink a PNG (palette) for connector uploads
  site-add <offer-dir> --approved-by <name> | --preview [--photo <file> --photo-alt <text>]
                                      Add or update an offer on /educut-connect/ from web-brief.json + site-entry.json;
                                      the photo (default: the offer's city.jpg) becomes the card's 3:2 landscape picture
  site-remove <id|slug|Offer_NNN>     Take an offer off the site
  li-pending                          Offers live on the site, still open, not yet queued for LinkedIn
  li-queue <slug|id> --question <q> [--hashtags "#a #b"]
                                      Compose the LinkedIn post for an offer (draft, not yet timed)
  li-schedule [--reschedule]          Give every draft a time in the next 24 h (spaced, active hours, most
                                      urgent first); --reschedule also re-spreads overdue posts
  li-publish-due [--dry-run] [--max n]
                                      Publish scheduled posts that are due (LinkedIn Posts API; GitHub Action)
  li-status                           Queue overview
  site-build [--include-previews]     Regenerate /educut-connect/ (listing + one page per offer) and the sitemap;
                                      --include-previews lists unapproved offers too (review branches only, never main)`);
  },

  sources() {
    const file = args[0] ?? fail('sources <links.txt>');
    const list = parseLinks(readFileSync(file, 'utf8')).map((s, i) => ({ n: i + 1, ...s }));
    out(list);
  },

  'init-run'() {
    mkdirSync(runDir, { recursive: true });
    if (!existsSync(registryFile)) {
      if (flags['registry-src'] && existsSync(flags['registry-src'])) copyFileSync(flags['registry-src'], registryFile);
      else writeJson(registryFile, emptyRegistry());
    }
    const reg = new Registry(registryFile, log);
    const expired = reg.expire();
    reg.save();
    const run = readJson(join(runDir, 'run.json'), { run_id: `run_${today}`, started_at: nowIso(), new_count: 0 });
    writeJson(join(runDir, 'run.json'), run);
    log('run.init', { run_id: run.run_id, expired });
    out({ run_dir: runDir, registry: registryFile, known: Object.keys(reg.data.opportunities).length, expired, new_today: run.new_count, cap: config.daily.max_new_opportunities });
  },

  async discover() {
    const url = args[0] ?? fail('discover <list-url>');
    const reg = new Registry(registryFile, log);
    const f = new PoliteFetcher({ config, log, cacheDir: join(runDir, 'cache'), rps: flags.rps ? Number(flags.rps) : null });
    const res = await f.get(url);
    if (!res.ok) return out({ url, ok: false, status: res.status ?? null, blocked: Boolean(res.blocked), reason: res.reason });
    let items;
    if (looksLikeFeed(res.content_type, res.body)) {
      items = feedItems(res.body).map((i) => ({ url: i.url, text: i.title, published: i.published }));
    } else {
      const host = new URL(res.final_url ?? url).host;
      items = links(res.body, res.final_url ?? url, flags.follow ?? null)
        .filter((l) => flags.follow || (new URL(l.url).host === host && l.text.split(' ').length >= 3 && new URL(l.url).pathname.split('/').filter(Boolean).length >= 1))
        .map((l) => ({ url: l.url, text: l.text, published: null }));
    }
    const jobsHere = jobPostings(res.body).length;
    const unseen = items.filter((i) => !reg.isKnownUrl(i.url) && canonicalUrl(i.url) !== canonicalUrl(url));
    const fresh = [];
    let disallowed = 0;
    for (const i of unseen) (await f.allowed(i.url)) ? fresh.push(i) : disallowed++;
    const limit = Number(flags.limit ?? 60);
    log('discover', { url, found: items.length, new: fresh.length, jsonld_jobs_on_page: jobsHere });
    out({ url, ok: true, feed: looksLikeFeed(res.content_type, res.body), found: items.length, already_known: items.length - unseen.length, robots_disallowed: disallowed, jsonld_jobs_on_page: jobsHere, candidates: fresh.slice(0, limit) });
  },

  async extract() {
    const url = args[0] ?? fail('extract <url>');
    const f = new PoliteFetcher({ config, log, cacheDir: join(runDir, 'cache'), rps: flags.rps ? Number(flags.rps) : null });
    const res = await f.get(url);
    if (!res.ok) return out({ url, ok: false, status: res.status ?? null, blocked: Boolean(res.blocked), reason: res.reason });
    const text = pageText(res.body);
    const textPath = join(runDir, 'pages', sha256(url).slice(0, 16) + '.txt');
    mkdirSync(join(runDir, 'pages'), { recursive: true });
    writeFileSync(textPath, `URL: ${res.final_url}\nFETCHED: ${nowIso()}\nHTTP: ${res.status}\n\n${text}`);
    out({
      url,
      final_url: res.final_url,
      ok: true,
      status: res.status,
      page_title: pageTitle(res.body),
      text_path: textPath,
      text_chars: text.length,
      job_postings: jobPostings(res.body),
      logo_candidates: logoCandidates(res.body, res.final_url).slice(0, 8),
      outbound_links: links(res.body, res.final_url).filter((l) => /apply|application|candidat|postul|bewerb/i.test(l.url + ' ' + l.text)).slice(0, 15),
    });
  },

  finalize() {
    const file = args[0] ?? fail('finalize <record.json>');
    const rec = readJson(file);
    rec.schema_version = '1.0';
    rec.id = opportunityId(rec);
    rec.fingerprint = fingerprint(rec);
    rec.discovered_at ??= nowIso();
    rec.last_verified_at = nowIso();
    rec.pipeline_status ??= 'DISCOVERED';
    rec.content_hash = contentHash(rec);
    const errors = validateSchema('opportunity', rec);
    writeJson(file, rec);
    out({ id: rec.id, valid: errors.length === 0, errors });
    if (errors.length) process.exitCode = 2;
  },

  register() {
    const rec = readJson(args[0] ?? fail('register <record.json>'));
    const errors = validateSchema('opportunity', rec);
    if (errors.length) fail(`record invalid: ${errors.join('; ')}`, 2);
    const run = readJson(join(runDir, 'run.json'));
    const reg = new Registry(registryFile, log);
    const r = reg.register(rec);
    // Only new opportunities that can become content use up the daily cap.
    if (r.action === 'new' && r.pipeline_status === 'VERIFIED') run.new_count = (run.new_count ?? 0) + 1;
    reg.save();
    writeJson(join(runDir, 'run.json'), run);
    writeJson(join(runDir, 'records', `${r.id}.json`), rec);
    out({ ...r, new_today: run.new_count, cap: config.daily.max_new_opportunities, cap_reached: run.new_count >= config.daily.max_new_opportunities });
  },

  prepare() {
    const id = args[0] ?? fail('prepare <id>');
    const reg = new Registry(registryFile, log);
    const o = reg.get(id) ?? fail(`unknown ${id}`);
    if (o.pipeline_status !== 'VERIFIED') fail(`${id} is ${o.pipeline_status}; only VERIFIED opportunities get content`);
    const n = reg.assignOfferNumber(id);
    reg.save();
    const dir = join(offersDir, offerFolderName(n));
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(runDir, 'records', `${id}.json`), join(dir, 'record.json'));
    out({ id, offer_number: n, offer_dir: dir });
  },

  courses() {
    const rec = readJson(args[0] ?? fail('courses <record.json>'));
    out({ catalog: loadCatalog().exported, min_score: config.comms.course_min_score, candidates: courseCandidates(rec, Number(flags.limit ?? 6)) });
  },

  async landmark() {
    const [city, cc] = args;
    if (!city || !cc) fail('landmark <city> <CC> [--query "Jet d\'Eau Geneva"] [--refresh]');
    const cached = !flags.refresh && !flags.query && findLandmark(city, cc);
    if (cached) return out({ found: true, cached: true, ...cached });
    try {
      const got = await fetchLandmark(city, cc, { query: flags.query, userAgent: config.crawl.user_agent });
      log('landmark', { city, cc, found: Boolean(got), source: got?.source_url });
      out(got ? { found: true, cached: false, ...got } : { found: false, reason: 'no freely licensed landscape photo found; the card will use the neutral band' });
    } catch (e) {
      log('landmark.error', { city, cc, error: e.message });
      out({ found: false, reason: `Wikimedia Commons unreachable (${e.cause?.code ?? e.cause?.message ?? e.message}); check the environment's network access` });
    }
  },

  'landmark-add'() {
    const [city, cc, file] = args;
    if (!city || !cc || !file) fail('landmark-add <city> <CC> <file>');
    out(addLandmark(city, cc, file, { landmark: flags.landmark, credit: flags.credit, license: flags.license, sourceUrl: flags.source }));
  },

  'check-course'() {
    const r = checkCourse(args[0] ?? fail('check-course <code>'));
    out(r.ok ? { ok: true, code: r.course.code, name: r.course.name, academy: r.course.academy, url: r.course.url } : r);
  },

  async render() {
    const specFile = resolve(args[0] ?? fail('render <spec.json>'));
    const spec = readJson(specFile);
    const dir = findOffer(spec.opportunity_id) ?? fail(`no offer folder for ${spec.opportunity_id}; run prepare first`);
    const rec = readJson(join(dir, 'record.json'));
    const offer = Number(basename(dir).split('_')[1]);
    // Fields that must match the record are taken from the record, never retyped by the agent.
    const card = {
      ...spec,
      title: rec.title.value,
      institution: rec.institution.name,
      city: rec.location.city,
      country: rec.location.country,
      country_code: rec.location.country_code,
      offer_label: `Offer ${String(offer).padStart(3, '0')}`,
      deadline_source: rec.deadline?.value ?? null,
      deadline_label: rec.deadline ? spec.deadline_label : null,
      institution_logo: rec.institution.logo.permission === 'allowed' ? spec.institution_logo ?? null : null,
      // The default photo is Drive Landmarks/images/DEFAULT, registered as landmark-add Default DEFAULT <file>.
      // Country photo first (Drive Landmarks/images/<CC>, registered under the country name), even when a
      // city is known; a city photo only if the country has none; the default photo (Landmarks/images/DEFAULT)
      // only when there is no country photo at all.
      landmark: spec.landmark
        ?? (rec.location.country ? findLandmark(rec.location.country, rec.location.country_code) : null)
        ?? (rec.location.city ? findLandmark(rec.location.city, rec.location.country_code) : null)
        ?? findLandmark('Default', 'DEFAULT'),
      variant: spec.variant ?? config.visual.variant,
    };
    writeJson(join(dir, 'spec.json'), card);
    if (card.landmark?.path && existsSync(card.landmark.path)) {
      copyFileSync(card.landmark.path, join(dir, `city${card.landmark.path.slice(card.landmark.path.lastIndexOf('.'))}`));
    }
    const formats = flags.square ? ['portrait', 'square'] : ['portrait'];
    const results = {};
    for (const f of formats) results[f] = await renderCard(card, { outDir: dir, format: f });
    const p = results.portrait;
    const pkg = {
      opportunity_id: rec.id,
      record_content_hash: rec.content_hash,
      outputs: { png_portrait: p.png, png_square: results.square?.png ?? null, source_html: p.html, spec_json: join(dir, 'spec.json') },
      rendered_text: {
        title: p.rendered_text.title, institution: p.rendered_text.institution, location: p.rendered_text.location,
        field: p.rendered_text.field, deadline: p.rendered_text.deadline,
      },
      alt_text: spec.alt_text ?? '',
      assets_used: [
        { role: 'educut_connect_logo', path: 'connect/config/brand/educut_connect_under_cut_light_transparent.svg', license: 'EduCut official brand asset', attribution: null, source_url: null },
        { role: 'educut_ai_logo', path: 'connect/config/brand/newlogo_black_text_transparent.svg', license: 'EduCut official brand asset', attribution: null, source_url: null },
        ...(rec.location.country_code ? [{ role: 'flag', path: `flag-icons/flags/4x3/${rec.location.country_code.toLowerCase()}.svg`, license: 'MIT (flag-icons)', attribution: null, source_url: null }] : []),
        ...(card.landmark?.path ? [{ role: 'landmark', path: card.landmark.path, license: card.landmark.license ?? 'unknown', attribution: card.landmark.credit ?? null, source_url: card.landmark.source_url ?? null }] : []),
        ...(card.institution_logo?.path ? [{ role: 'institution_logo', path: card.institution_logo.path, license: rec.institution.logo.license, attribution: null, source_url: rec.institution.logo.source_url }] : []),
      ],
      qc: Object.values(results).flatMap((r) => r.qc),
      capability_missing: [],
    };
    writeJson(join(dir, 'visual-package.json'), pkg);
    log('render', { id: rec.id, offer: basename(dir), qc_pass: pkg.qc.every((q) => q.pass) });
    out({ offer_dir: dir, png: p.png, qc: pkg.qc, rendered_text: pkg.rendered_text });
  },

  'page-url'() {
    const id = args[0] ?? fail('page-url <id>');
    const dir = findOffer(id) ?? fail(`no offer folder for ${id}`);
    const slug = offerSlug(basename(dir), readJson(join(dir, 'record.json')).title.value);
    out({ id, slug, url: pageUrl(config.links.site_url, slug) });
  },

  'post-text'() {
    const id = args[0] ?? fail('post-text <id>');
    const dir = findOffer(id) ?? fail(`no offer folder for ${id}`);
    const rec = readJson(join(dir, 'record.json'));
    const pkg = readJson(join(dir, 'comms-package.json'));
    writeFileSync(join(dir, 'linkedin_post.txt'), pkg.caption.trim() + '\n');
    const m = pkg.course_match;
    const brief = webBrief({ offerName: basename(dir), rec, pkg, visual: readJson(join(dir, 'visual-package.json'), null), siteUrl: config.links.site_url });
    writeJson(join(dir, 'web-brief.json'), brief);
    writeFileSync(
      join(dir, 'post_details.txt'),
      [
        `${basename(dir)} · ${rec.title.value} · ${rec.institution.name}`,
        `Opportunity ID: ${rec.id}`,
        `Application status: ${rec.application_status}${rec.application_status === 'OPEN_LIKELY' ? '  <-- VERIFY THE APPLICATION PORTAL MANUALLY BEFORE APPROVING' : ''}`,
        `Deadline: ${rec.deadline ? `${rec.deadline.value}${rec.deadline.timezone ? ` (${rec.deadline.timezone})` : ''}` : 'not specified'}`,
        `Official application link: ${rec.application_url ?? 'not found — see source'}`,
        `Source page: ${rec.source_url}`,
        `EduCut link in post: ${pkg.educut_link.url} (${pkg.educut_link.type.replace('_', ' ')})`,
        `Upskill link in post: ${pkg.course_match?.url ?? config.links.educut_website}`,
        '',
        'ALTERNATIVE HOOK',
        pkg.alternative_hook,
        '',
        'FIRST COMMENT',
        pkg.first_comment,
        '',
        'ACADEMY COURSE',
        m ? `${m.name} (${m.code ?? m.url_type}) — ${m.url}\nWhy: ${m.rationale.join(' | ')}` : `No matching course in the catalog: the post points to the EduCut AI website (${config.links.educut_website}).`,
        '',
        `HASHTAGS: ${pkg.hashtags.join(' ')}`,
        ...(() => {
          const vp = readJson(join(dir, 'visual-package.json'), null);
          const photo = vp?.assets_used?.find((a) => a.role === 'landmark');
          return photo ? ['', 'PHOTO CREDIT (not shown on the card; add to the first comment if the licence requires attribution)', `${photo.attribution ?? 'not recorded'} · ${photo.license}${photo.source_url ? ` · ${photo.source_url}` : ''}`] : [];
        })(),
        `FACT CHECK: ${pkg.fact_check.status}${pkg.fact_check.flags.length ? ` — ${pkg.fact_check.flags.join('; ')}` : ''}`,
        '',
        briefText(brief),
        '',
      ].join('\n'),
    );
    out({ written: [join(dir, 'linkedin_post.txt'), join(dir, 'post_details.txt'), join(dir, 'web-brief.json')] });
  },

  validate() {
    const id = args[0] ?? fail('validate <id>');
    const dir = findOffer(id) ?? fail(`no offer folder for ${id}`);
    const rec = readJson(join(dir, 'record.json'));
    const live = readJson(join(runDir, 'records', `${id}.json`));
    const checks = [
      { check: 'record unchanged since content was made', pass: live.content_hash === rec.content_hash, detail: live.content_hash, owner: 'opportunity-scout' },
      ...validateRecord(rec),
    ];
    const vp = join(dir, 'visual-package.json');
    const cp = join(dir, 'comms-package.json');
    if (existsSync(vp)) checks.push(...validateVisual(rec, readJson(vp), readJson(join(dir, 'spec.json'), null)));
    else checks.push({ check: 'visual package present', pass: false, detail: 'visual-package.json missing', owner: 'visual-designer' });
    if (existsSync(cp)) checks.push(...validateComms(rec, readJson(cp), config, pageUrl(config.links.site_url, offerSlug(basename(dir), rec.title.value))));
    else checks.push({ check: 'comms package present', pass: false, detail: 'comms-package.json missing', owner: 'communications' });
    for (const f of ['linkedin_post.txt', 'card.png']) if (!existsSync(join(dir, f))) checks.push({ check: `${f} present`, pass: false, detail: 'missing', owner: f === 'card.png' ? 'visual-designer' : 'communications' });

    const s = summarize(checks);
    writeJson(join(dir, 'qc-report.json'), { opportunity_id: id, at: nowIso(), ...s });
    const reg = new Registry(registryFile, log);
    const o = reg.get(id);
    if (s.status !== 'FAIL' && o.pipeline_status === 'VERIFIED') {
      reg.transition(id, 'CONTENT_GENERATED', 'validator', 'image and caption produced');
      reg.transition(id, 'UNDER_REVIEW', 'validator', `checks ${s.status}`);
      reg.save();
    }
    log('validate', { id, status: s.status, failures: s.failures.length });
    out({ id, offer: basename(dir), status: s.status, failures: s.failures, warnings: s.warnings.map((w) => w.detail), pipeline_status: reg.get(id).pipeline_status });
    if (s.status === 'FAIL') process.exitCode = 3;
  },

  review() {
    const reg = new Registry(registryFile, log);
    const rows = [];
    const dirs = existsSync(offersDir) ? readdirSync(offersDir).sort() : [];
    for (const d of dirs) {
      const dir = join(offersDir, d);
      const rec = readJson(join(dir, 'record.json'));
      const qc = readJson(join(dir, 'qc-report.json'), null);
      const comms = readJson(join(dir, 'comms-package.json'), null);
      rows.push(
        `## ${d} — ${rec.title.value}\n` +
          `**${rec.institution.name}** · ${[rec.location.city, rec.location.country].filter((v, i, a) => v && a.findIndex((x) => String(x).toLowerCase() === String(v).toLowerCase()) === i).join(', ') || 'location not specified'}\n\n` +
          `- Status: **${reg.get(rec.id)?.pipeline_status}** · application ${rec.application_status}${rec.application_status === 'OPEN_LIKELY' ? ' ⚠️ verify the portal manually' : ''}\n` +
          `- Deadline: ${rec.deadline?.value ?? 'not specified'}\n` +
          `- Apply: ${rec.application_url ?? 'n/a'}\n- Source: ${rec.source_url}\n` +
          `- Course: ${comms?.course_match ? `${comms.course_match.name} — ${comms.course_match.url}` : 'none'}\n` +
          `- QC: ${qc ? `${qc.status}${qc.failures.length ? ` — ${qc.failures.map((f) => f.check).join('; ')}` : ''}${qc.warnings.length ? ` · flags: ${qc.warnings.map((w) => w.detail).join('; ')}` : ''}` : 'not validated'}\n` +
          `- Files: Communication/${today}/${d}/ (card.png, linkedin_post.txt, post_details.txt)\n` +
          `- Approve: \`node connect/cli.mjs approve ${rec.id} --by "<name>"\` or reply "approve ${d}"\n\n` +
          (comms ? `> ${comms.caption.replace(/\n/g, '\n> ')}\n` : ''),
      );
    }
    const md = `# EduCut Connect — review ${today}\n\n${rows.length} offer(s) awaiting approval. Nothing is published until you approve, and publishing stays manual.\n\n${rows.join('\n')}`;
    writeFileSync(join(runDir, 'review.md'), md);
    out({ review: join(runDir, 'review.md'), offers: rows.length });
  },

  approve() {
    const id = args[0] ?? fail('approve <id> --by <name>');
    if (!flags.by) fail('--by <name> is required for the audit trail');
    const reg = new Registry(registryFile, log);
    const o = reg.get(id) ?? fail(`unknown ${id}`);
    reg.transition(id, 'APPROVED', `admin:${flags.by}`, flags.note ?? 'approved');
    // Re-check before release: a passed deadline or changed status sends it back.
    if (o.deadline && deadlineEnd(o.deadline) < new Date()) reg.transition(id, 'EXPIRED', 'system', 'deadline passed before release');
    else if (!['OPEN_CONFIRMED', 'OPEN_LIKELY'].includes(o.application_status)) reg.transition(id, 'NEEDS_REVIEW', 'system', `application status ${o.application_status}`);
    else reg.transition(id, 'READY_TO_PUBLISH', 'system', 'approved; status re-checked');
    reg.save();
    out({ id, pipeline_status: reg.get(id).pipeline_status, publishing_enabled: config.publishing.enabled });
  },

  reject() {
    const id = args[0] ?? fail('reject <id> --reason <text>');
    const reg = new Registry(registryFile, log);
    reg.transition(id, 'REJECTED', `admin:${flags.by ?? 'administrator'}`, flags.reason ?? 'rejected');
    reg.save();
    out({ id, pipeline_status: 'REJECTED' });
  },

  revise() {
    const id = args[0] ?? fail('revise <id> --note <text>');
    const reg = new Registry(registryFile, log);
    reg.transition(id, 'VERIFIED', `admin:${flags.by ?? 'administrator'}`, `revision requested: ${flags.note ?? ''}`);
    reg.save();
    out({ id, pipeline_status: 'VERIFIED', note: flags.note ?? '' });
  },

  'mark-published'() {
    const id = args[0] ?? fail('mark-published <id> --url <post-url>');
    if (!flags.url) fail('--url of the LinkedIn post is required');
    const reg = new Registry(registryFile, log);
    reg.transition(id, 'PUBLISHED', `admin:${flags.by ?? 'administrator'}`, `posted at ${flags.url}`);
    reg.get(id).published_url = flags.url;
    reg.save();
    out({ id, pipeline_status: 'PUBLISHED' });
  },

  status() {
    const reg = new Registry(registryFile, log);
    const counts = {};
    for (const o of Object.values(reg.data.opportunities)) counts[o.pipeline_status] = (counts[o.pipeline_status] ?? 0) + 1;
    out({ registry: registryFile, total: Object.keys(reg.data.opportunities).length, last_offer_number: reg.data.last_offer_number ?? 0, counts });
  },

  // Mirror of the Drive layout for GitHub: Communication/<date>/Offer_NNN/ with images and texts.
  export() {
    const day = basename(runDir);
    const dest = join(resolve(flags.dest ?? join(CONNECT_DIR, 'Communication')), day);
    const copied = [];
    for (const name of existsSync(offersDir) ? readdirSync(offersDir).sort() : []) {
      const dir = join(offersDir, name);
      const qc = readJson(join(dir, 'qc-report.json'), null);
      if (!qc || qc.status === 'FAIL') continue; // only validated packages are published for review
      mkdirSync(join(dest, name), { recursive: true });
      for (const f of ['card.png', 'card-square.png', 'city.jpg', 'city.png', 'linkedin_post.txt', 'post_details.txt', 'web-brief.json', 'site-entry.json', 'record.json', 'qc-report.json']) {
        if (existsSync(join(dir, f))) {
          copyFileSync(join(dir, f), join(dest, name, f));
          if (f.startsWith('card') && f.endsWith('.png')) {
            try {
              optimizePng(join(dest, name, f));
            } catch {
              /* Pillow missing: keep the full-size PNG */
            }
          }
          copied.push(`${name}/${f}`);
        }
      }
    }
    if (existsSync(join(runDir, 'review.md'))) {
      copyFileSync(join(runDir, 'review.md'), join(dest, `00_Review_${day}.md`));
      copied.push(`00_Review_${day}.md`);
    }
    out({ dest, files: copied.length, offers: new Set(copied.filter((c) => c.startsWith('Offer_')).map((c) => c.split('/')[0])).size });
  },

  async 'drive-sync'() {
    if (!driveAvailable()) fail('GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN not set; use the Google Drive connector fallback', 4);
    const d = config.drive;
    const uploaded = [];
    const comm = await ensureFolder(d.folders.communication.id, today);
    for (const name of existsSync(offersDir) ? readdirSync(offersDir).sort() : []) {
      const dir = join(offersDir, name);
      const qc = readJson(join(dir, 'qc-report.json'), null);
      if (!qc || qc.status === 'FAIL') continue; // only validated packages reach Drive
      const folder = await ensureFolder(comm.id, name);
      for (const [f, mime] of [['card.png', 'image/png'], ['city.jpg', 'image/jpeg'], ['city.png', 'image/png'], ['card-square.png', 'image/png'], ['linkedin_post.txt', 'text/plain'], ['post_details.txt', 'text/plain'], ['card.html', 'text/html'], ['record.json', 'application/json'], ['qc-report.json', 'application/json']]) {
        if (existsSync(join(dir, f))) uploaded.push({ offer: name, file: f, ...(await upload(folder.id, join(dir, f), mime)) });
      }
    }
    if (existsSync(join(runDir, 'review.md'))) uploaded.push({ file: 'review.md', ...(await upload(comm.id, join(runDir, 'review.md'), 'text/markdown', `00_Review_${today}.md`)) });
    const regFolder = d.folders.registry.id ? { id: d.folders.registry.id } : await ensureFolder(d.root_folder.id, d.folders.registry.name);
    uploaded.push({ file: 'registry.json', ...(await upload(regFolder.id, registryFile, 'application/json', 'registry.json')) });
    const crawl = await ensureFolder(d.folders.crawling.id, today);
    if (existsSync(join(runDir, 'log.jsonl'))) uploaded.push({ file: 'log.jsonl', ...(await upload(crawl.id, join(runDir, 'log.jsonl'), 'text/plain', 'run-log.jsonl')) });
    log('drive.sync', { files: uploaded.length });
    out({ uploaded: uploaded.map((u) => ({ offer: u.offer, file: u.file, link: u.webViewLink })) });
  },

  async 'drive-pull-registry'() {
    if (!driveAvailable()) fail('GDRIVE_* secrets not set; download Registry/registry.json with the connector instead', 4);
    const d = config.drive;
    const regFolder = d.folders.registry.id ? { id: d.folders.registry.id } : await findChild(d.root_folder.id, d.folders.registry.name, { folder: true });
    const file = regFolder && (await findChild(regFolder.id, 'registry.json'));
    if (!file) return out({ pulled: false, reason: 'no registry in Drive yet; starting empty' });
    mkdirSync(runDir, { recursive: true });
    writeFileSync(registryFile, await download(file.id));
    out({ pulled: true, registry: registryFile });
  },

  // EduCut Connect pages on the public site (website-developer agent). --site points at another site
  // root (tests); by default the repository root.
  'site-add'() {
    const dir = resolve(args[0] ?? fail('site-add <offer-dir> --approved-by <name> | --preview'));
    if (!flags['approved-by'] && !flags.preview) fail('--approved-by <name> (offer approved) or --preview (page for review, kept off the listing and sitemap) is required');
    const r = addEntry({ offerDir: dir, root: flags.site ? resolve(flags.site) : undefined, config, approvedBy: flags['approved-by'] || null, preview: Boolean(flags.preview), photo: typeof flags.photo === 'string' ? resolve(flags.photo) : null, photoAlt: typeof flags['photo-alt'] === 'string' ? flags['photo-alt'] : null });
    log('site.add', { offer: basename(dir), ok: r.ok, preview: r.preview ?? null });
    out(r);
    if (!r.ok) process.exitCode = 3;
  },

  'site-remove'() {
    const key = args[0] ?? fail('site-remove <id|slug|Offer_NNN>');
    out(removeEntry({ key, root: flags.site ? resolve(flags.site) : undefined }));
  },

  'site-build'() {
    const r = buildSite({ root: flags.site ? resolve(flags.site) : undefined, siteUrl: config.links.site_url, includePreviews: Boolean(flags['include-previews']) });
    log('site.build', { pages: r.pages.length, previews: r.previews.length });
    out(r);
  },

  // LinkedIn agent. Queue: connect/linkedin/queue.json (committed to main; the GitHub Action reads it).
  'li-pending'() {
    const root = flags.site ? resolve(flags.site) : undefined;
    out(pendingOffers(root).map((o) => ({ slug: o.slug, opportunity_id: o.opportunity_id, offer: o.offer, title: o.title, deadline: o.deadline, summary: o.summary })));
  },

  'li-queue'() {
    const root = flags.site ? resolve(flags.site) : undefined;
    const key = args[0] ?? fail('li-queue <slug|id> --question "<question>"');
    const offer = loadOffers(root).offers.find((o) => o.slug === key || o.opportunity_id === key || o.offer === key) ?? fail(`not on the site: ${key}`);
    if (offer.preview) fail(`${offer.offer} is a preview (not approved): it cannot be posted`);
    const tags = typeof flags.hashtags === 'string' ? flags.hashtags.split(/\s+/).filter(Boolean) : [];
    const checks = checkQuestion(flags.question, offer, config);
    if (tags.length) {
      checks.push({ check: `${config.comms.hashtag_range.join('–')} hashtags`, pass: tags.length >= config.comms.hashtag_range[0] && tags.length <= config.comms.hashtag_range[1], detail: tags.join(' '), owner: 'linkedin' });
      checks.push({ check: 'required hashtags', pass: config.comms.required_hashtags.every((h) => tags.includes(h)), detail: config.comms.required_hashtags.join(' '), owner: 'linkedin' });
      checks.push({ check: 'hashtag format', pass: tags.every((t) => /^#[A-Za-z0-9]+$/.test(t)), detail: tags.join(' '), owner: 'linkedin' });
    }
    const failures = checks.filter((c) => !c.pass);
    if (failures.length) {
      out({ ok: false, failures });
      process.exitCode = 3;
      return;
    }
    const q = loadQueue(root);
    if (q.posts.some((p) => p.opportunity_id === offer.opportunity_id && p.status === 'POSTED')) fail(`${offer.offer} was already posted`);
    q.posts = q.posts.filter((p) => p.opportunity_id !== offer.opportunity_id);
    const post = { opportunity_id: offer.opportunity_id, offer: offer.offer, slug: offer.slug, page_url: offer.page_url, question: flags.question.trim(), hashtags: tags, text: composePost(offer, flags.question, tags), alt_text: offer.card_alt, deadline: offer.deadline ?? null, status: 'DRAFT', scheduled_at: null, queued_at: nowIso() };
    q.posts.push(post);
    saveQueue(q, root);
    log('li.queue', { offer: offer.offer });
    out({ ok: true, offer: offer.offer, chars: post.text.length, text: post.text });
  },

  'li-schedule'() {
    const root = flags.site ? resolve(flags.site) : undefined;
    const q = loadQueue(root);
    const nowD = flags.now ? new Date(flags.now) : new Date();
    // --reschedule: posts whose time passed without being published (e.g. before the token was set) are
    // spread again over the next 24 h.
    if (flags.reschedule) for (const p of q.posts) if (p.status === 'SCHEDULED' && Date.parse(p.scheduled_at) < nowD.getTime()) Object.assign(p, { status: 'DRAFT', scheduled_at: null });
    // Most urgent deadline first; offers without a deadline last.
    const dl = (p) => (p.deadline ? Date.parse(p.deadline.length === 10 ? `${p.deadline}T23:59:59Z` : p.deadline) : Infinity);
    const drafts = q.posts.filter((p) => p.status === 'DRAFT').sort((a, b) => dl(a) - dl(b));
    const L = config.linkedin;
    const taken = q.posts.filter((p) => p.status === 'SCHEDULED').map((p) => p.scheduled_at);
    const slots = planSlots(drafts.length, { now: nowD, leadMinutes: L.lead_minutes, minGapMinutes: L.min_gap_minutes, maxGapMinutes: L.max_gap_minutes, activeHours: L.active_hours, timeZone: L.time_zone, taken });
    drafts.forEach((p, i) => {
      if (slots[i]) Object.assign(p, { status: 'SCHEDULED', scheduled_at: slots[i] });
    });
    saveQueue(q, root);
    const fmt = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: L.time_zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    out({ scheduled: drafts.filter((p) => p.status === 'SCHEDULED').map((p) => ({ offer: p.offer, at: p.scheduled_at, local: `${fmt(p.scheduled_at)} (${L.time_zone})` })), unscheduled: drafts.filter((p) => p.status === 'DRAFT').map((p) => p.offer) });
  },

  async 'li-publish-due'() {
    const root = flags.site ? resolve(flags.site) : undefined;
    const dry = Boolean(flags['dry-run']);
    if (!config.publishing.enabled && !dry) return out({ published: [], reason: 'publishing.enabled is false' });
    if (!linkedinConfigured() && !dry) return out({ published: [], reason: 'LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORGANIZATION_ID not set' });
    const q = loadQueue(root);
    const now = Date.now();
    const due = q.posts.filter((p) => p.status === 'SCHEDULED' && Date.parse(p.scheduled_at) <= now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    const published = [];
    for (const p of due.slice(0, Number(flags.max ?? config.linkedin.max_posts_per_run))) {
      const offer = loadOffers(root).offers.find((o) => o.opportunity_id === p.opportunity_id);
      const closed = offer?.deadline && Date.parse(offer.deadline.length === 10 ? `${offer.deadline}T23:59:59Z` : offer.deadline) < now;
      if (!offer || offer.preview || closed) {
        Object.assign(p, { status: 'SKIPPED', skipped_reason: !offer ? 'no longer on the site' : offer.preview ? 'preview' : 'deadline passed' });
        continue;
      }
      try {
        const r = await publishPost(p, { root, version: config.linkedin.api_version, dryRun: dry });
        if (!dry) markPosted(p, r);
        published.push({ offer: p.offer, url: r.url, dry_run: dry });
      } catch (e) {
        Object.assign(p, { last_error: e.message, attempts: (p.attempts ?? 0) + 1 });
        if (p.attempts >= 3) p.status = 'FAILED';
        published.push({ offer: p.offer, error: e.message });
      }
    }
    if (!dry) saveQueue(q, root);
    log('li.publish', { published: published.length });
    out({ published, due: due.length });
    if (published.some((p) => p.error)) process.exitCode = 5;
  },

  'li-status'() {
    const q = loadQueue(flags.site ? resolve(flags.site) : undefined);
    const counts = {};
    for (const p of q.posts) counts[p.status] = (counts[p.status] ?? 0) + 1;
    out({ counts, next: q.posts.filter((p) => p.status === 'SCHEDULED').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).map((p) => ({ offer: p.offer, at: p.scheduled_at })) });
  },

  'optimize-png'() {
    const file = args[0] ?? fail('optimize-png <file>');
    const before = readFileSync(file).length;
    try {
      optimizePng(file);
    } catch (e) {
      fail(`PIL not available: ${e.message}`);
    }
    out({ file, before, after: readFileSync(file).length });
  },
};

if (!commands[cmd]) {
  commands.help();
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
