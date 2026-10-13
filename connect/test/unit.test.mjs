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
