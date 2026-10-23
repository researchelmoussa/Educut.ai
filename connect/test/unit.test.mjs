import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseRobots, robotsAllows } from '../lib/fetch.mjs';
import { Registry } from '../lib/registry.mjs';
import { bodyWordCount } from '../lib/validate.mjs';
import { canonicalUrl, contentHash, fingerprint, opportunityId } from '../lib/util.mjs';
import { courseCandidates, checkCourse } from '../lib/catalog.mjs';
import { parseLinks } from '../lib/sources.mjs';

export const sampleRecord = (over = {}) => {
  const r = {
    schema_version: '1.0',
    opportunity_type: 'job',
    title: { value: 'Research Scientist, Machine Learning', evidence_url: 'https://jobs.example.org/positions/4821', evidence_quote: 'Research Scientist, Machine Learning' },
    institution: { name: 'Example Institute for Applied Science', website: 'https://www.example.org', logo: { source_url: null, local_path: null, license: 'unknown', permission: 'not_verified' } },
    application_url: 'https://jobs.example.org/positions/4821/apply?utm_source=x',
    source_url: 'https://jobs.example.org/positions/4821',
    source_list_url: 'https://jobs.example.org/positions',
    location: { city: 'Geneva', country: 'Switzerland', country_code: 'CH' },
    employment_type: 'full_time',
    work_arrangement: 'hybrid',
    field: 'Machine Learning',
    seniority: 'mid',
    qualifications: ['PhD in Computer Science, Statistics or a related field'],
    skills: ['Python', 'PyTorch', 'supervised and unsupervised learning'],
    description_short: 'Join the applied ML group to design and evaluate learning methods for scientific data and publish research.',
    published_at: null,
    deadline: { value: '2099-11-15T23:59:00+01:00', timezone: 'Europe/Zurich', evidence_url: 'https://jobs.example.org/positions/4821', evidence_quote: 'Applications close 15 November 2099' },
    compensation: null,
    application_status: 'OPEN_LIKELY',
    status_evidence: ['deadline in the future'],
    pipeline_status: 'DISCOVERED',
    uncertainties: ['compensation not stated'],
    discovered_at: '2026-10-11T09:00:00Z',
    last_verified_at: '2026-10-11T09:00:00Z',
    ...over,
  };
  r.id = opportunityId(r);
  r.fingerprint = fingerprint(r);
  r.content_hash = contentHash(r);
  return r;
};

test('canonical URLs drop tracking params, www and trailing slash', () => {
  assert.equal(canonicalUrl('http://www.Example.org/jobs/1/?utm_source=li&b=2&a=1#x'), 'https://example.org/jobs/1?a=1&b=2');
});

test('the same posting gets the same id whatever the tracking params', () => {
  const a = sampleRecord();
  const b = sampleRecord({ application_url: 'https://jobs.example.org/positions/4821/apply' });
  assert.equal(a.id, b.id);
  assert.match(a.id, /^opp_[0-9a-f]{16}$/);
});

test('robots.txt: longest match wins, agent-specific group preferred', () => {
  const g = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: EduCutConnectBot\nDisallow: /private/\nAllow: /private/jobs/\n', 'EduCutConnectBot/1.0');
  assert.equal(robotsAllows(g, '/jobs/1'), true);
  assert.equal(robotsAllows(g, '/private/x'), false);
  assert.equal(robotsAllows(g, '/private/jobs/2'), true);
  const star = parseRobots('User-agent: *\nDisallow: /search\nCrawl-delay: 5', 'OtherBot');
  assert.equal(robotsAllows(star, '/search?q=1'), false);
  assert.equal(star.delay, 5);
});

test('registry: new, unchanged, updated, duplicate and stale-content handling', () => {
  const reg = new Registry(join(mkdtempSync(join(tmpdir(), 'reg-')), 'r.json'));
  const rec = sampleRecord();
  assert.equal(reg.register(rec).action, 'new');
  assert.equal(reg.get(rec.id).pipeline_status, 'VERIFIED');
  assert.equal(reg.register(rec).action, 'unchanged');
  assert.ok(reg.isKnownUrl('https://www.jobs.example.org/positions/4821/'));

  // Same posting, different URL on an aggregator: caught by fingerprint.
  const mirror = sampleRecord({ application_url: 'https://aggregator.example.net/x/99' });
  assert.equal(reg.register(mirror).action, 'duplicate');

  reg.transition(rec.id, 'CONTENT_GENERATED', 't');
  reg.transition(rec.id, 'UNDER_REVIEW', 't');
  const changed = sampleRecord({ description_short: 'Updated description from the source page.' });
  assert.equal(reg.register(changed).action, 'updated');
  assert.equal(reg.get(rec.id).pipeline_status, 'NEEDS_REVIEW');
  assert.throws(() => reg.transition(rec.id, 'PUBLISHED', 't'), /illegal transition/);
});

test('registry: closed sources never become content, past deadlines expire', () => {
  const reg = new Registry(join(mkdtempSync(join(tmpdir(), 'reg-')), 'r.json'));
  const closed = sampleRecord({ application_status: 'CLOSED', source_url: 'https://jobs.example.org/positions/1', application_url: 'https://jobs.example.org/positions/1/apply', title: { value: 'Closed role', evidence_url: 'https://jobs.example.org/positions/1', evidence_quote: 'Closed role' } });
  reg.register(closed);
  assert.equal(reg.get(closed.id).pipeline_status, 'CLOSED');
  const old = sampleRecord({ deadline: { value: '2020-01-01', timezone: null, evidence_url: 'https://jobs.example.org/positions/4821', evidence_quote: '1 Jan 2020' } });
  reg.register(old);
  assert.deepEqual(reg.expire(), [old.id]);
  assert.equal(reg.assignOfferNumber(old.id), 1);
  assert.equal(reg.assignOfferNumber(old.id), 1);
});

test('links.txt parsing', () => {
  const s = parseLinks('# comment\n\nhttps://a.example.org/jobs | adapter=rss | follow=^https://a\\.example\\.org/j/\n<https://b.example.org/>\nnot a url\n');
  assert.equal(s.length, 2);
  assert.equal(s[0].adapter, 'rss');
  assert.equal(s[1].url, 'https://b.example.org/');
});

test('caption word count ignores hashtags and URLs', () => {
  assert.equal(bodyWordCount('Hello world https://educutai.com #EduCutAI #EduCutConnect'), 2);
});

test('course shortlist and anchor check use the real catalog', () => {
  const c = courseCandidates(sampleRecord(), 3);
  assert.ok(c.some((x) => x.code === 'A001.01'), c.map((x) => x.code).join(','));
  assert.equal(checkCourse('A001.01').course.url, 'https://educutai.com/academies/ai-foundations/#a001-01');
  assert.equal(checkCourse('A999.99').ok, false);
});

test('linkedin: up to 10 posts a day between 07:00 and 22:00, evenly spaced', async () => {
  const { planSlots, localDay } = await import('../lib/linkedin.mjs');
  const tz = 'Europe/Zurich';
  const h = (t) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)));
  const now = new Date('2026-10-20T04:00:00Z'); // 06:00 in Zurich
  const ten = planSlots(10, { now, timeZone: tz }).map(Date.parse);
  assert.equal(ten.length, 10);
  assert.equal(new Set(ten.map((t) => localDay(t, tz))).size, 1);
  for (let i = 1; i < ten.length; i++) assert.ok(ten[i] - ten[i - 1] >= 60 * 60e3);
  assert.ok(ten.every((t) => h(t) >= 7 && h(t) < 22));
  assert.ok(h(ten[0]) <= 8 && h(ten.at(-1)) >= 20, 'the day is used from morning to evening');
  const thirteen = planSlots(13, { now, timeZone: tz }).map(Date.parse);
  const days = {};
  for (const t of thirteen) days[localDay(t, tz)] = (days[localDay(t, tz)] ?? 0) + 1;
  assert.deepEqual(Object.values(days), [7, 6]);
  assert.ok(thirteen.every((t) => h(t) >= 7 && h(t) < 22));
  // Late in the evening: the posts go to the next day; already-scheduled posts are avoided and counted.
  const late = new Date('2026-10-20T19:50:00Z'); // 21:50
  const taken = ['2026-10-21T08:00:00.000Z'];
  const s = planSlots(9, { now: late, timeZone: tz, taken }).map(Date.parse);
  assert.equal(s.length, 9);
  assert.ok(s.every((t) => localDay(t, tz) === '2026-10-21' && Math.abs(t - Date.parse(taken[0])) >= 60 * 60e3));
  assert.equal(planSlots(1, { now: late, timeZone: tz, taken: Array.from({ length: 10 }, (_, i) => `2026-10-21T${String(6 + i).padStart(2, '0')}:00:00.000Z`) }).map((t) => localDay(Date.parse(t), tz))[0], '2026-10-22');
});

test('linkedin: post follows the EduCut Connect format and little-text escaping', async () => {
  const { composePost, littleText, checkPost } = await import('../lib/linkedin.mjs');
  const offer = { title: 'Spring 2027 Internship Program', institution: 'Brookings Institution', location: 'Washington, D.C., USA', country_code: 'US', level: 'Undergraduate & Graduate Students', field: 'Economics, Public Policy', deadline: '2026-11-07', deadline_label: '7 November 2026 (America/New_York)', compensation: { value: 'Paid internship (amount not stated)' }, page_url: 'https://educutai.com/educut-connect/114-spring-2027-internship-program/', summary: 'Paid internships at Brookings.' };
  const parts = {
    headline: 'Paid Internship Opportunities at Brookings Institution, USA',
    intro: 'The Brookings Institution is inviting applications for its Spring 2027 Internship Program, offering students hands-on experience in research, public policy, and global affairs.',
    cta: 'Know someone looking for a research internship in the USA? Share this opportunity!',
    funding: 'Paid Internships',
  };
  const tags = ['#InternshipOpportunities', '#PaidInternship', '#EduCutConnect', '#EduCutAI'];
  const text = composePost(offer, parts, tags);
  assert.equal(
    text,
    [
      '🎓🇺🇸 Paid Internship Opportunities at Brookings Institution, USA!',
      '',
      parts.intro,
      '',
      '📍 Location: Washington, D.C., USA',
      '🎓 Level: Undergraduate & Graduate Students',
      '💰 Funding: Paid Internships',
      '🔬 Fields: Economics, Public Policy',
      '📅 Deadline: 7 November 2026',
      '',
      '🔗 Explore the opportunity and apply:',
      offer.page_url,
      parts.cta,
      tags.join(' '),
    ].join('\n'),
  );
  const cfg = { comms: { banned_phrases: ['dream job'] } };
  assert.ok(checkPost(parts, offer, cfg).every((c) => c.pass), JSON.stringify(checkPost(parts, offer, cfg).filter((c) => !c.pass)));
  const unpaid = { ...offer, compensation: null, summary: 'Internships at Brookings.' };
  assert.ok(checkPost(parts, unpaid, cfg).some((c) => !c.pass && /funding/.test(c.check)));
  assert.ok(checkPost({ ...parts, cta: 'Share it now' }, offer, cfg).some((c) => !c.pass));
  assert.ok(!composePost(unpaid, { ...parts, funding: undefined }, tags).includes('💰'));
  const lt = littleText('At Example (EI) #EduCutAI');
  assert.ok(lt.includes('Example \\(EI\\)') && lt.includes('{hashtag|\\#|EduCutAI}'));
});

test('linkedin: posting kit lists newly scheduled posts once, in order, with numbered card files', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const { buildKit } = await import('../lib/kit.mjs');
  const root = mkdtempSync(j(tmpdir(), 'kit-'));
  mkdirSync(j(root, 'educut-connect', '001-a'), { recursive: true });
  writeFileSync(j(root, 'educut-connect', '001-a', 'card.png'), 'png');
  const posts = [
    { offer: 'Offer_002', slug: '002-b', scheduled_at: '2026-10-21T15:00:00.000Z', text: 'Second <post>', alt_text: 'b', deadline: '2026-11-01' },
    { offer: 'Offer_001', slug: '001-a', scheduled_at: '2026-10-21T06:00:00.000Z', text: 'First post', alt_text: 'a', deadline: '2026-11-01' },
  ];
  const r = buildKit(posts, { outDir: j(root, 'kit'), root, timeZone: 'Europe/Zurich', title: 'Kit' });
  assert.equal(r.posts, 2);
  assert.ok(r.cards[0].endsWith('01_21Oct_08h00_Offer_001.png') && existsSync(r.cards[0]));
  assert.deepEqual(r.missing_images, ['Offer_002']);
  const html = readFileSync(r.page, 'utf8');
  assert.ok(html.indexOf('Offer_001') < html.indexOf('Offer_002') && html.includes('Second &lt;post&gt;'));
  assert.ok(readFileSync(j(root, 'kit', 'posts.md'), 'utf8').includes('### 17:00 · Offer_002'));
});
