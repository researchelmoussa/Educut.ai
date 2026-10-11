// End-to-end pipeline against a local fixture site (fictional institution), exercising the same CLI
// commands the agents use: discover -> extract -> finalize -> register -> prepare -> render ->
// comms package -> post-text -> validate -> review -> approve.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, 'fixtures', 'site');
const cli = join(here, '..', 'cli.mjs');
const run = mkdtempSync(join(tmpdir(), 'connect-run-'));
let server;
let base;

const sh = (...a) => {
  try {
    return JSON.parse(execFileSync('node', [cli, ...a, '--run', run], { encoding: 'utf8' }));
  } catch (e) {
    if (e.stdout) return { exit: e.status, ...JSON.parse(e.stdout) };
    throw e;
  }
};

// The fixture server runs in its own process: the CLI calls below are synchronous and would block it.
before(async () => {
  server = spawn('python3', ['-I', '-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', site], { stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await new Promise((resolve, reject) => {
    const onData = (d) => {
      const m = String(d).match(/port (\d+)/);
      if (m) resolve(m[1]);
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('error', reject);
  });
  base = `http://127.0.0.1:${port}`;
});
after(() => server.kill());

test('full pipeline on a fixture site', { timeout: 120_000 }, () => {
  sh('init-run');

  const disc = sh('discover', `${base}/jobs/index.html`, '--follow', '/jobs/\\d+\\.html$', '--rps', '50');
  assert.equal(disc.ok, true);
  assert.deepEqual(disc.candidates.map((c) => new URL(c.url).pathname), ['/jobs/101.html', '/jobs/102.html']);

  const ex = sh('extract', `${base}/jobs/101.html`, '--rps', '50');
  assert.equal(ex.job_postings[0].title, 'Research Scientist, Machine Learning');
  assert.equal(ex.job_postings[0].locations[0].city, 'Geneva');
  assert.ok(readFileSync(ex.text_path, 'utf8').includes('Applications close 15 November 2099'));

  // robots.txt disallows /private/: the fetcher must refuse it.
  const blocked = sh('extract', `${base}/private/internal.html`, '--rps', '50');
  assert.equal(blocked.blocked, true);
  assert.match(blocked.reason, /robots/);

  // What the Scout writes from the extraction (every value is on the page).
  const src = `${base}/jobs/101.html`;
  const record = {
    opportunity_type: 'job',
    title: { value: 'Research Scientist, Machine Learning', evidence_url: src, evidence_quote: 'Research Scientist, Machine Learning' },
    institution: { name: 'Example Institute for Applied Science', website: 'https://www.example.org', logo: { source_url: `${base}/static/logo-180.png`, local_path: null, license: 'unknown', permission: 'not_verified' } },
    application_url: `${base}/jobs/101/apply`,
    source_url: src,
    source_list_url: `${base}/jobs/index.html`,
    location: { city: 'Geneva', country: 'Switzerland', country_code: 'CH' },
    employment_type: 'full_time',
    work_arrangement: 'hybrid',
    field: 'Machine Learning',
    seniority: null,
    qualifications: ['PhD in Computer Science, Statistics or a related field', 'publication record in machine learning'],
    skills: ['Python', 'PyTorch', 'supervised and unsupervised learning'],
    description_short: 'Join the applied ML group to design and evaluate learning methods for scientific data.',
    published_at: { value: '2026-10-02', evidence_url: src, evidence_quote: '"datePosted":"2026-10-02"' },
    deadline: { value: '2099-11-15T23:59:00+01:00', timezone: 'CET', evidence_url: src, evidence_quote: 'Applications close 15 November 2099, 23:59 CET.' },
    compensation: null,
    application_status: 'OPEN_LIKELY',
    status_evidence: ['Published deadline 2099-11-15 is in the future', 'Apply page not independently confirmed'],
    uncertainties: ['compensation not stated', 'seniority not stated'],
  };
  const recFile = join(run, 'draft.json');
  writeFileSync(recFile, JSON.stringify(record));
  const fin = sh('finalize', recFile);
  assert.equal(fin.valid, true, JSON.stringify(fin.errors));

  const reg1 = sh('register', recFile);
  assert.equal(reg1.action, 'new');
  assert.equal(reg1.pipeline_status, 'VERIFIED');
  assert.equal(sh('register', recFile).action, 'unchanged');
  // Already-registered URLs disappear from discovery the next time.
  assert.deepEqual(sh('discover', `${base}/jobs/index.html`, '--follow', '/jobs/\\d+\\.html$', '--rps', '50').candidates.map((c) => new URL(c.url).pathname), ['/jobs/102.html']);

  const prep = sh('prepare', fin.id);
  assert.match(prep.offer_dir, /Offer_001$/);

  // Visual Designer
  const spec = {
    opportunity_id: fin.id,
    field: 'Machine Learning',
    deadline_label: '15 Nov 2099',
    type_label: 'Job · Full-time',
    work_label: 'Hybrid',
    alt_text: 'EduCut Connect card: Research Scientist, Machine Learning at Example Institute for Applied Science in Geneva, Switzerland. Deadline 15 November 2099.',
  };
  const specFile = join(prep.offer_dir, 'design-input.json');
  writeFileSync(specFile, JSON.stringify(spec));
  const r = sh('render', specFile);
  assert.ok(r.qc.every((q) => q.pass), JSON.stringify(r.qc));
  assert.equal(r.rendered_text.title, record.title.value);

  // Communications
  const course = sh('check-course', 'A001.01');
  const caption = [
    'Machine learning researchers: a new opening in Geneva 🇨🇭',
    '',
    'Example Institute for Applied Science is hiring a Research Scientist, Machine Learning, in its applied ML group (hybrid).',
    '',
    'The role asks for a PhD in Computer Science, Statistics or a related field and a publication record in machine learning.',
    '',
    '📅 Applications close 15 November 2099 (CET).',
    '',
    "Explore this opportunity through EduCut Connect: https://educutai.com (EduCut AI's main site; the official application link is in the first comment).",
    '',
    `Want to strengthen your profile for opportunities like this? Explore ${course.name} at EduCut AI Academy: ${course.url}`,
    '',
    '#MachineLearning #ResearchJobs #AIResearch #Geneva #EduCutAI #EduCutConnect',
  ].join('\n');
  const recNow = JSON.parse(readFileSync(join(prep.offer_dir, 'record.json'), 'utf8'));
  writeFileSync(
    join(prep.offer_dir, 'comms-package.json'),
    JSON.stringify({
      opportunity_id: fin.id,
      record_content_hash: recNow.content_hash,
      caption,
      alternative_hook: 'Publishing in machine learning and looking at research roles in Switzerland? This one is worth a look.',
      first_comment: `Official application page: ${record.application_url}. What made the biggest difference in your research applications?`,
      hashtags: ['#MachineLearning', '#ResearchJobs', '#AIResearch', '#Geneva', '#EduCutAI', '#EduCutConnect'],
      educut_link: { url: 'https://educutai.com', type: 'general_website' },
      official_application_url: record.application_url,
      course_match: { code: course.code, name: course.name, academy: course.academy, url: course.url, url_type: 'course_anchor_verified', rationale: ["'supervised and unsupervised learning' -> objectives: supervised learning; unsupervised learning"] },
      fact_check: { status: 'PASS_WITH_FLAGS', flags: ['OPEN_LIKELY: verify the application portal manually'] },
    }),
  );
  sh('post-text', fin.id);
  assert.ok(readFileSync(join(prep.offer_dir, 'linkedin_post.txt'), 'utf8').startsWith('Machine learning researchers'));

  const v = sh('validate', fin.id);
  assert.equal(v.status, 'PASS_WITH_FLAGS', JSON.stringify(v.failures, null, 1));
  assert.equal(v.pipeline_status, 'UNDER_REVIEW');

  const rev = sh('review');
  assert.equal(rev.offers, 1);
  assert.match(readFileSync(rev.review, 'utf8'), /verify the portal manually/);

  const ap = sh('approve', fin.id, '--by', 'Test Admin');
  assert.equal(ap.pipeline_status, 'READY_TO_PUBLISH');
  assert.equal(ap.publishing_enabled, false);
});

test('validator rejects a caption that invents a salary and drops the title', { timeout: 60_000 }, () => {
  const dir = join(run, 'offers', 'Offer_001');
  const pkg = JSON.parse(readFileSync(join(dir, 'comms-package.json'), 'utf8'));
  pkg.caption = pkg.caption.replace('Research Scientist, Machine Learning', 'ML Scientist').replace('📅', 'Salary CHF 120k. 📅');
  writeFileSync(join(dir, 'comms-package.json'), JSON.stringify(pkg));
  const id = JSON.parse(readFileSync(join(dir, 'record.json'), 'utf8')).id;
  const v = sh('validate', id);
  assert.equal(v.status, 'FAIL');
  const failed = v.failures.map((f) => f.check);
  assert.ok(failed.includes('exact job title in caption'));
  assert.ok(failed.includes('no salary claimed'));
});
