// Quality gate run before any package reaches the administrator. Deterministic: every check states
// what it compared, so a failure can be sent back to the responsible agent with the exact reason.
import { existsSync } from 'node:fs';
import { checkAcademyUrl, checkCourse } from './catalog.mjs';
import { deadlineEnd, ELIGIBLE_APPLICATION_STATUS } from './registry.mjs';
import { pngSize } from './render.mjs';
import { validateSchema } from './schema.mjs';
import { contentHash, opportunityId } from './util.mjs';

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);
const EMOJI = /\p{Extended_Pictographic}/gu;

// Body words: the caption without hashtags and URLs, which LinkedIn readers skim past.
export const bodyWordCount = (caption) => words(caption.replace(/https?:\/\/\S+/g, '').replace(/#[A-Za-z0-9]+/g, '')).length;

// Hashtags start a word; "#a001-01" inside a course URL is an anchor, not a hashtag.
export const hashtagsIn = (text) => [...text.replace(/https?:\/\/\S+/g, ' ').matchAll(/(?:^|\s)(#[A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]);

export function validateRecord(rec, now = new Date()) {
  const out = [];
  const add = (check, pass, detail, severity = 'fail') => out.push({ check, pass, detail, owner: 'opportunity-scout', severity });
  const schemaErrors = validateSchema('opportunity', rec);
  add('record matches opportunity.schema.json', schemaErrors.length === 0, schemaErrors.slice(0, 8).join('; ') || 'ok');
  if (schemaErrors.length) return out;
  add('stable id', rec.id === opportunityId(rec), `expected ${opportunityId(rec)}`);
  add('content hash current', rec.content_hash === contentHash(rec), 'recompute with `cli.mjs finalize`');
  add('eligible application status', ELIGIBLE_APPLICATION_STATUS.includes(rec.application_status), rec.application_status);
  add('description ≤ 45 words', words(rec.description_short).length <= 45, `${words(rec.description_short).length} words`);
  if (rec.deadline) add('deadline in the future', deadlineEnd(rec.deadline.value) > now, rec.deadline.value);
  // Flags, not failures: they reach the administrator on the review sheet.
  add('application portal independently confirmed', rec.application_status === 'OPEN_CONFIRMED', 'OPEN_LIKELY: verify the application portal manually before approval', 'warn');
  add('official application URL present', Boolean(rec.application_url), rec.application_url ?? 'missing: post will point to the source page only', 'warn');
  return out;
}

export function validateComms(rec, pkg, config) {
  const out = [];
  const add = (check, pass, detail, severity = 'fail') => out.push({ check, pass, detail, owner: 'communications', severity });
  const c = config.comms;
  const schemaErrors = validateSchema('comms-package', pkg);
  add('package matches comms-package.schema.json', schemaErrors.length === 0, schemaErrors.slice(0, 8).join('; ') || 'ok');
  if (schemaErrors.length) return out;

  add('built from current record', pkg.record_content_hash === rec.content_hash && pkg.opportunity_id === rec.id, pkg.record_content_hash);
  const cap = pkg.caption;
  add('exact job title in caption', cap.includes(rec.title.value), rec.title.value);
  add('institution name in caption', cap.includes(rec.institution.name), rec.institution.name);
  if (rec.location.city) add('city in caption', cap.includes(rec.location.city), rec.location.city);

  const n = bodyWordCount(cap);
  add(`caption length ${c.word_hard_range.join('–')} words`, n >= c.word_hard_range[0] && n <= c.word_hard_range[1], `${n} words`);
  add(`caption length ideally ${c.word_range.join('–')} words`, n >= c.word_range[0] && n <= c.word_range[1], `${n} words`, 'warn');

  const emojis = (cap.match(EMOJI) ?? []).length;
  add(`at most ${c.max_emojis} emojis`, emojis <= c.max_emojis, `${emojis} emoji(s)`);

  const tags = hashtagsIn(cap);
  add(`${c.hashtag_range.join('–')} hashtags`, tags.length >= c.hashtag_range[0] && tags.length <= c.hashtag_range[1], `${tags.length}: ${tags.join(' ')}`);
  add('required hashtags', c.required_hashtags.every((h) => tags.includes(h)), c.required_hashtags.join(' '));
  add('no repeated hashtags', new Set(tags.map((t) => t.toLowerCase())).size === tags.length, tags.join(' '));
  add('hashtags field matches caption', pkg.hashtags.join(' ') === tags.join(' '), 'hashtags[] must list the caption hashtags in order');

  add('EduCut website CTA', cap.includes(config.links.educut_website), config.links.educut_website);
  add('CTA says it is not the application link', /official appl|not the appl|general (EduCut|website)|EduCut AI'?s (main|general)/i.test(cap), 'caption must say educutai.com is EduCut’s site, not the application page');
  add('official application URL carried', pkg.official_application_url === rec.application_url, String(rec.application_url));

  const lower = `${cap} ${pkg.alternative_hook} ${pkg.first_comment}`.toLowerCase();
  const banned = c.banned_phrases.filter((p) => lower.includes(p.toLowerCase()));
  add('no banned / unsupported claims', banned.length === 0, banned.join(', ') || 'none');

  if (!rec.deadline) add('no deadline claimed', !/deadline|closes|apply by/i.test(cap), 'record has no verified deadline');
  if (!rec.compensation) add('no salary claimed', !/salary|\b(chf|eur|usd|gbp)\b|€|\$|£/i.test(cap), 'record has no stated compensation');

  const m = pkg.course_match;
  if (m) {
    if (m.url_type === 'course_anchor_verified') {
      const r = checkCourse(m.code);
      add('course exists and its page anchor is live', r.ok, r.reason ?? r.course.url);
      if (r.ok) {
        add('course name matches catalog', r.course.name === m.name, r.course.name);
        add('course URL matches catalog', r.course.url === m.url, r.course.url);
      }
    } else {
      add('fallback Academy URL exists', checkAcademyUrl(m.url).ok, m.url);
      add('fallback labelled as such in caption', /Academy (catalog|page)|course catalog/i.test(cap), 'caption must say it links to the catalog, not a specific course');
    }
    add('course URL in caption', cap.includes(m.url), m.url);
    add('no employment guarantee', !/guarantee|ensure(s)? (you|selection)|get (the|this) job/i.test(lower), 'courses never promise selection');
  }
  return out;
}

export function validateVisual(rec, pkg, spec) {
  const out = [];
  const add = (check, pass, detail, severity = 'fail') => out.push({ check, pass, detail, owner: 'visual-designer', severity });
  const schemaErrors = validateSchema('visual-package', pkg);
  add('package matches visual-package.schema.json', schemaErrors.length === 0, schemaErrors.slice(0, 8).join('; ') || 'ok');
  if (schemaErrors.length) return out;
  add('built from current record', pkg.record_content_hash === rec.content_hash && pkg.opportunity_id === rec.id, pkg.record_content_hash);
  if (pkg.capability_missing.length) {
    add('rendering capability available', false, `missing: ${pkg.capability_missing.join(', ')}; design brief only`);
    return out;
  }
  const t = pkg.rendered_text;
  add('title on image identical to record', t.title === rec.title.value, `image: "${t.title}"`);
  add('institution on image identical to record', t.institution === rec.institution.name, `image: "${t.institution}"`);
  const loc = [rec.location.city, rec.location.country].filter(Boolean).join(', ');
  add('location on image matches record', t.location === (loc || 'Not specified'), `image: "${t.location}"`);
  if (!rec.deadline) add('no deadline on image', t.deadline === 'See official page', `image: "${t.deadline}"`);
  else add('deadline on image is the verified date', spec?.deadline_source === rec.deadline.value, `spec.deadline_source=${spec?.deadline_source} record=${rec.deadline.value}`);
  const png = pkg.outputs.png_portrait;
  add('portrait PNG exists at 1080×1350', Boolean(png) && existsSync(png) && pngSize(png).join('x') === '1080x1350', String(png));
  add('render QC passed', pkg.qc.every((q) => q.pass), pkg.qc.filter((q) => !q.pass).map((q) => q.detail).join('; ') || 'ok');
  add('alt text names title and institution', pkg.alt_text.includes(rec.title.value) && pkg.alt_text.includes(rec.institution.name), 'alt text');
  const logo = rec.institution.logo;
  if (spec?.institution_logo) add('institution logo permitted', logo.permission === 'allowed', `permission=${logo.permission}`);
  for (const a of pkg.assets_used.filter((x) => x.role === 'landmark')) {
    add('landmark image licensed', Boolean(a.license && a.license !== 'unknown'), `${a.license}${a.attribution ? ` · ${a.attribution}` : ''}`);
  }
  return out;
}

export function summarize(checks) {
  const failures = checks.filter((c) => !c.pass && c.severity !== 'warn');
  const warnings = checks.filter((c) => !c.pass && c.severity === 'warn');
  return { status: failures.length ? 'FAIL' : warnings.length ? 'PASS_WITH_FLAGS' : 'PASS', failures, warnings, checks };
}
