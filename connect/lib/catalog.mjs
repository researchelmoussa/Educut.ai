// EduCut AI Academy catalog: the only source of course names and URLs the Communications agent may use.
// Parsed exactly as scripts/build-pages.mjs parses it, so names, slugs and anchors match the live pages.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_DIR, normText } from './util.mjs';

const SITE = 'https://educutai.com';
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tidy = (s) => String(s).replace(/(\w)- (\w)/g, '$1-$2').trim();
const read = (p) => readFileSync(join(REPO_DIR, p), 'utf8');

let cached;
export function loadCatalog() {
  if (cached) return cached;
  const academies = read('data/academies.txt').trim().split('\n').map((line) => {
    const [code, name, summary, audience, topics] = line.split(' | ');
    return { code, name, summary, audience, topics: topics.split(', '), slug: slugify(name), courses: [] };
  });
  const byCode = Object.fromEntries(academies.map((a) => [a.code, a]));
  const courses = read('data/courses.txt').trim().split('\n').map((line) => {
    const [code, name, level, , , , programme] = line.split(' | ');
    const academy = byCode[code.split('.')[0]];
    const c = {
      code,
      name: tidy(name),
      level,
      programme: programme.split(' ¶ ').map(tidy),
      academy: academy.name,
      academy_slug: academy.slug,
      anchor: code.toLowerCase().replace('.', '-'),
    };
    c.url = `${SITE}/academies/${academy.slug}/#${c.anchor}`;
    academy.courses.push(c);
    return c;
  });
  cached = { academies, courses, byCode, exported: read('data/catalogue-meta.txt').trim() };
  return cached;
}

// Expansions so "LLM" in a job ad meets "Large Language Model" in a course, and so on.
const SYNONYMS = {
  llm: 'large language model', llms: 'large language models', ml: 'machine learning', ai: 'artificial intelligence',
  nlp: 'natural language processing', rag: 'retrieval augmented generation', cv: 'computer vision',
  genai: 'generative ai', mlops: 'mlops model deployment monitoring', rl: 'reinforcement learning',
  hr: 'human resources', fp: 'financial planning', bi: 'business intelligence', stats: 'statistics',
};
const STOP = new Set(
  ('a an and or the of for to in on with at by from as is are be this that we you our your their its into via per ' +
   'experience years year strong ability knowledge skills skill excellent good team work working role position ' +
   'candidate candidates required preferred plus including related field degree level i ii iii new using use based').split(' '),
);

// Light stemming so "engineer" meets "engineering" and "models" meets "model".
const stem = (w) => (w.length > 5 ? w.replace(/(ings|ing|ers|er|ies|s)$/, '') : w);

const terms = (s) => {
  const words = normText(s).split(' ').filter(Boolean);
  const expanded = words.flatMap((w) => (SYNONYMS[w] ? [w, ...SYNONYMS[w].split(' ')] : [w]));
  return expanded.filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
};

// Ranks courses by overlap between the record's requirements and each course's name and learning
// objectives. This only shortlists; the agent must still justify the match requirement by requirement.
export function courseCandidates(record, limit = 6) {
  const { courses, byCode } = loadCatalog();
  const reqText = [record.title?.value, record.field, ...(record.skills ?? []), ...(record.qualifications ?? [])].join(' ; ');
  const req = new Set(terms(reqText));
  const docs = courses.map((c) => ({
    c,
    name: new Set(terms(c.name)),
    prog: new Set(terms(c.programme.join(' '))),
    topics: new Set(terms(byCode[c.code.split('.')[0]].topics.join(' '))),
  }));
  // Rare terms ("retrieval", "governance") say more about a match than ubiquitous ones ("ai", "system").
  const idf = (t) => Math.log((docs.length + 1) / (1 + docs.filter((d) => d.name.has(t) || d.prog.has(t)).length));
  const scored = docs.map(({ c, name, prog, topics }) => {
    const matched = { name: [], objectives: [], academy_topics: [] };
    let score = 0;
    for (const t of req) {
      const w = idf(t);
      if (name.has(t)) { score += 2 * w; matched.name.push(t); }
      if (prog.has(t)) { score += w; matched.objectives.push(t); }
      if (topics.has(t)) { score += 0.5 * w; matched.academy_topics.push(t); }
    }
    score = Math.round(score * 10) / 10;
    // Foundation courses first on ties: the post addresses people building a profile.
    return { code: c.code, name: c.name, academy: c.academy, level: c.level, url: c.url, score, matched, objectives: c.programme };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (a.level === 'Foundation' ? -1 : 1) - (b.level === 'Foundation' ? -1 : 1))
    .slice(0, limit);
}

// A course link is verified when the course is in the catalog AND its anchor exists in the generated page.
export function checkCourse(code) {
  const { courses } = loadCatalog();
  const c = courses.find((x) => x.code === code);
  if (!c) return { ok: false, reason: `course ${code} is not in data/courses.txt` };
  const page = join(REPO_DIR, 'academies', c.academy_slug, 'index.html');
  if (!existsSync(page)) return { ok: false, reason: `academy page academies/${c.academy_slug}/ not built`, course: c };
  const ok = readFileSync(page, 'utf8').includes(`id="${c.anchor}"`);
  return ok ? { ok: true, course: c } : { ok: false, reason: `anchor #${c.anchor} missing from academies/${c.academy_slug}/`, course: c };
}

export function checkAcademyUrl(url) {
  const m = url.match(/^https:\/\/educutai\.com\/academies\/([a-z0-9-]+)\/$/);
  if (url === `${SITE}/academies/` || url === `${SITE}/academies`) return { ok: existsSync(join(REPO_DIR, 'academies', 'index.html')) };
  if (!m) return { ok: false };
  return { ok: existsSync(join(REPO_DIR, 'academies', m[1], 'index.html')) };
}
