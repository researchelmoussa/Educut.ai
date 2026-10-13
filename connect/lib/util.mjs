// Shared helpers: stable IDs, hashing, URL canonicalisation, JSON I/O, logging.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONNECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = join(CONNECT_DIR, '..');

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Query parameters that only track the visitor; everything else can identify the posting.
const TRACKING_PARAMS = /^(utm_.*|gclid|fbclid|mc_[a-z]+|ref|source|src|trk|trackingid|lipi)$/i;

export function canonicalUrl(raw) {
  const u = new URL(raw);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString().replace(/^http:/, 'https:');
}

export const normText = (s) =>
  String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Stable opportunity ID. The canonical application URL identifies a posting best; without one we fall
// back to the institution domain + title + city, so the same post found on two aggregators still collides.
export function opportunityId(rec) {
  const apply = rec.application_url?.value ?? rec.application_url;
  const key = apply
    ? `url:${canonicalUrl(apply)}`
    : `tic:${new URL(rec.institution?.website || rec.source_url).hostname.replace(/^www\./, '')}|${normText(rec.title.value)}|${normText(rec.location?.city)}`;
  return 'opp_' + sha256(key).slice(0, 16);
}

// Secondary key used to catch the same posting listed under different URLs.
export const fingerprint = (rec) =>
  sha256(`${normText(rec.institution?.name)}|${normText(rec.title?.value)}|${normText(rec.location?.city)}`).slice(0, 16);

// Hash over the verified fields only, so packages can prove which version of a record they were built from.
export const CONTENT_FIELDS = [
  'title', 'institution', 'application_url', 'location', 'employment_type', 'work_arrangement', 'field',
  'seniority', 'qualifications', 'skills', 'description_short', 'deadline', 'compensation', 'application_status',
];
export function contentHash(rec) {
  const picked = Object.fromEntries(CONTENT_FIELDS.map((k) => [k, rec[k] ?? null]));
  return 'sha256:' + sha256(stableStringify(picked));
}

export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export const readJson = (p, fallback) => (fallback !== undefined && !existsSync(p) ? fallback : JSON.parse(readFileSync(p, 'utf8')));
export function writeJson(p, v) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
}

export const offerFolderName = (n) => `Offer_${String(n).padStart(3, '0')}`;

export const nowIso =() => new Date().toISOString();

// Structured JSONL logger: one line per event, so a run can be audited or replayed.
export function logger(file) {
  if (file) mkdirSync(dirname(file), { recursive: true });
  return (event, data = {}) => {
    const line = JSON.stringify({ at: nowIso(), event, ...data });
    if (file) appendFileSync(file, line + '\n');
    else process.stderr.write(line + '\n');
  };
}

export const loadConfig = () => readJson(join(CONNECT_DIR, 'config', 'connect.config.json'));
