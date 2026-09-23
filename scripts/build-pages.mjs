#!/usr/bin/env node
/* ===================================================================
   EduCut.ai — static public pages generator

   Writes crawlable HTML for the public site structure approved in the
   SEO plan (Step 1):

     /academies/                 Academy hub (18 academies in 5 topic clusters)
     /academies/<slug>/          One page per academy, with its courses
     /ai-learning-paths/         Learning paths + how the assessment works
     /contact/                   Consultation, catalogue and contact emails

   It also refreshes the shared footer inside index.html (between the
   site-footer markers) so the homepage links to every public page.

   Sources — nothing on these pages is written by hand:
     data/academies.txt, data/courses.txt,
     data/assessment-focus.txt              Supabase export (see
                                            scripts/export-catalogue.sql)
     index.html                             design tokens/CSS, and the
                                            paths, method and contact
                                            sections, reused verbatim

   The assessment, consultation and sign-in flows stay in index.html; the
   static pages link to them with /#start-assessment, /#book-consultation,
   /#request-catalogue, /#/signin and /#/signup.

   Usage:  node scripts/build-pages.mjs      (Node 18+, no dependencies)
   =================================================================== */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES } from '../content/guides.mjs';
import { COMPANY, FACULTY, LEGAL } from '../content/about.mjs';
import { DEFAULT_LANGUAGE, LANGUAGES, ALTERNATES } from '../content/i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const write = (p, s) => {
  mkdirSync(dirname(join(ROOT, p)), { recursive: true });
  writeFileSync(join(ROOT, p), s);
};

// Facts that are identical for every public course (verified with the last
// query in scripts/export-catalogue.sql).
const CATALOGUE_FACTS = {
  language: 'English',
  translationAvailable: true,
  certification: 'Certificate awarded upon completion',
  // Confirmed by EduCut.ai (SEO plan, Step 8): a mix of both.
  format: 'Blended: instructor-led online sessions combined with self-paced personal work',
  courseMode: 'Blended',
};

// Academies that are easy to confuse, with the distinction agreed in the
// Step 3 keyword map. Shown on the hub as "Which academy is right for you?".
const COMPARISONS = [
  {
    title: 'Building AI applications',
    rows: [
      ['A011', 'Using AI across everyday software development', 'you write software and want AI-assisted coding, testing, debugging and DevOps automation'],
      ['A012', 'Building LLM applications end to end', 'you build products on large language models: APIs, embeddings, fine-tuning, evaluation and LLMOps'],
      ['A013', 'Grounding AI in your organization\'s knowledge', 'your assistants must answer from your own documents and data with reliable retrieval'],
      ['A014', 'AI systems that plan and act with tools', 'you build agents that use tools, keep memory and run multi-step or multi-agent workflows'],
    ],
  },
  {
    title: 'Trustworthy AI',
    rows: [
      ['A015', 'Principles: ethics, fairness, transparency, privacy', 'you need a shared understanding of how to design and use AI responsibly'],
      ['A016', 'Organizational controls and compliance', 'you own AI policies, risk and impact assessment, EU AI Act compliance, vendors or audit'],
      ['A017', 'Protecting AI systems against attacks', 'you secure AI applications against prompt injection, data leakage and misuse, and run red teaming'],
    ],
  },
  {
    title: 'Leading with AI',
    rows: [
      ['A006', 'The individual executive', 'you are a leader who must set AI strategy, choose use cases, justify ROI and lead people'],
      ['A018', 'The organization-wide program', 'you run an enterprise AI program: readiness, roadmap, operating model, change and value measurement'],
    ],
  },
];

// Topic clusters (SEO plan, Step 5). Each academy belongs to exactly one.
// The pillar is the academy that owns the cluster's broad topic; for
// business functions the hub section itself plays that role. Clusters are
// also the hub's sections, in this order.
const CLUSTERS = [
  { id: 'ai-and-data-foundations', title: 'AI & data foundations', pillar: 'A001', codes: ['A001', 'A002', 'A005'] },
  { id: 'ai-strategy-and-transformation', title: 'AI strategy & transformation', pillar: 'A018', codes: ['A018', 'A006', 'A004'] },
  { id: 'ai-for-business-functions', title: 'AI for business functions', pillar: null, codes: ['A007', 'A008', 'A009', 'A010'] },
  { id: 'building-with-llms', title: 'Building with LLMs', pillar: 'A012', codes: ['A012', 'A013', 'A014', 'A011', 'A003'] },
  { id: 'trustworthy-ai', title: 'Trustworthy AI', pillar: 'A016', codes: ['A016', 'A015', 'A017'] },
];

// "Related academies": pillars list their cluster, spokes lead with their
// pillar (checked below), plus the closest academy in a neighbouring cluster.
const RELATED = {
  A001: ['A002', 'A005', 'A012'], A002: ['A001', 'A005', 'A003'], A005: ['A001', 'A002', 'A008'],
  A018: ['A006', 'A004', 'A016'], A006: ['A018', 'A004', 'A016'], A004: ['A018', 'A006', 'A003'],
  A007: ['A004', 'A003', 'A008'], A008: ['A004', 'A003', 'A005'], A009: ['A004', 'A003', 'A015'], A010: ['A004', 'A003', 'A015'],
  A012: ['A013', 'A014', 'A011', 'A003'], A013: ['A012', 'A014', 'A017'], A014: ['A012', 'A013', 'A017'],
  A011: ['A012', 'A013', 'A014'], A003: ['A012', 'A004', 'A002'],
  A016: ['A015', 'A017', 'A018'], A015: ['A016', 'A017', 'A006'], A017: ['A016', 'A015', 'A014'],
};

// Course-level "See also": where a course falls inside another academy's
// topic (ownership agreed in Step 3). One link per course; 'paths' points to
// the free assessment.
const SEE_ALSO = {
  'A001.16': 'A016', 'A001.17': 'A015', 'A001.18': 'A016',
  'A002.07': 'A003', 'A002.09': 'A014', 'A002.10': 'A014', 'A002.17': 'A017', 'A002.18': 'A016',
  'A003.04': 'A004', 'A003.05': 'A005', 'A003.06': 'A011', 'A003.09': 'A014', 'A003.10': 'A017',
  'A004.06': 'A005', 'A004.10': 'A018',
  'A005.03': 'A001', 'A005.13': 'A015',
  'A006.04': 'A018', 'A006.07': 'A015', 'A006.09': 'A018',
  'A008.10': 'A016', 'A009.09': 'A015', 'A010.09': 'A015',
  'A011.03': 'A003', 'A011.06': 'A013', 'A011.07': 'A014', 'A011.09': 'A017',
  'A012.05': 'A013', 'A012.07': 'A014', 'A012.09': 'A017',
  'A013.06': 'A014', 'A013.09': 'A017', 'A014.06': 'A013', 'A014.09': 'A017',
  'A015.06': 'A017', 'A015.07': 'A016', 'A015.08': 'A016',
  'A016.06': 'A017', 'A017.10': 'A016',
  'A018.02': 'paths', 'A018.08': 'A016',
};

// Search titles and descriptions (SEO plan, Steps 3–4). One primary topic
// per academy; {n} is replaced with the live course count. Keep titles
// under ~60 characters and descriptions under ~155 — the build warns.
const ACADEMY_SEO = {
  A001: ['AI Fundamentals Courses — ML, Deep Learning, NLP', '{n} AI fundamentals courses: machine learning, deep learning, NLP, computer vision, reasoning, AI safety and AI systems. Foundation to intermediate level.'],
  A002: ['Generative AI Course — How Generative AI Works', '{n} generative AI courses on how models are built and used: architecture, pre-training, alignment, prompting, agents, evaluation and multimodal generation.'],
  A003: ['Prompt Engineering Course for Teams', '{n} prompt engineering courses, from writing effective prompts to prompting for data analysis, software development, research, AI agents and RAG.'],
  A004: ['AI Productivity Training — Email, Docs, Excel', '{n} AI productivity courses: AI for email, documents, meetings, research, Excel and planning, plus personal AI workflows and no-code automation.'],
  A005: ['Data Analytics & Statistics Courses for AI', '{n} data analytics courses: statistics, predictive modelling, big data, data preparation, visualisation and responsible analytics for AI-enabled teams.'],
  A006: ['AI for Executives — AI Leadership Training', '{n} AI courses for executives and managers: AI strategy, use cases, AI-driven decisions, ROI, governance and building an AI-ready organization.'],
  A007: ['AI for Marketing Course — Content, SEO, Ads', '{n} AI for marketing courses: strategy, content and copywriting, social media, SEO, advertising, customer insights, analytics and marketing automation.'],
  A008: ['AI for Finance Course — FP&A, Forecasting', '{n} AI for finance courses: financial analysis, budgeting and forecasting, accounting, Excel modelling, fraud detection, FP&A and finance automation.'],
  A009: ['AI for HR Training — Recruitment to Analytics', '{n} AI for HR courses: recruitment, onboarding, L&D, performance, people analytics, workforce planning and responsible AI in HR.'],
  A010: ['AI for Educators — Teaching, Assessment', '{n} AI courses for teachers and academic leaders: course design, classroom engagement, adaptive learning, assessment, research and academic integrity.'],
  A011: ['AI for Developers Course — Coding to Production', '{n} AI courses for developers: AI-assisted coding, testing and debugging, LLM APIs, RAG, AI agents, DevOps automation and production AI systems.'],
  A012: ['LLM Engineering Course — Fine-Tuning to LLMOps', '{n} LLM engineering courses: LLM APIs, embeddings, vector search, RAG, fine-tuning, agents, evaluation, guardrails and production LLMOps.'],
  A013: ['RAG Course — Retrieval-Augmented Generation', '{n} RAG courses: ingestion and chunking, vector search, retrieval and context engineering, agentic and graph RAG, evaluation, security and RAGOps.'],
  A014: ['AI Agents Course — Agentic AI & Multi-Agent', '{n} AI agents courses: agent architecture, tool use and function calling, memory, planning, agentic RAG, multi-agent systems, security and AgentOps.'],
  A015: ['Responsible AI Training — Ethics & Fairness', '{n} responsible AI courses: AI ethics, bias and fairness, explainability, privacy, safety, regulation and building a responsible AI program.'],
  A016: ['AI Governance Training — EU AI Act & Risk', '{n} AI governance courses: EU AI Act and global compliance, AI risk and impact assessment, policies, vendor governance, audit and enterprise programs.'],
  A017: ['AI Security Training — Prompt Injection', '{n} AI security courses: threat modeling, prompt injection and jailbreaks, RAG and agent security, supply chain, AI red teaming and incident response.'],
  A018: ['AI Transformation Program for Organizations', '{n} AI transformation courses: readiness assessment, strategy roadmaps, use cases, operating model redesign, change management, governance and ROI.'],
};
const BRAND = ' | EduCut.ai';

// Production origin for canonical and Open Graph URLs. Change it here if the
// site is served from www.educutai.com instead.
const SITE_URL = 'https://educutai.com';

const HOME_SEO = {
  title: 'AI Training for Companies — Build Your AI Path' + BRAND,
  description: 'Business-focused AI training for companies: {a} academies, {n} courses. Take the free 3-minute assessment and get a 3, 5 or 7-course AI learning path.',
};

function seoHead({ path, title, description }) {
  const url = SITE_URL + path;
  const ogTitle = title.endsWith(BRAND) ? title.slice(0, -BRAND.length) : title;
  if (title.length > 62) console.warn(`warn: title ${title.length} chars on ${path}`);
  const icon = HAS_LOGO ? '\n  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />' : '';
  if (description.length > 158) console.warn(`warn: description ${description.length} chars on ${path}`);
  return `<title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="EduCut.ai" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary" />${icon}${alternatesFor(path).map(([l, u]) => `\n  <link rel="alternate" hreflang="${l}" href="${u}" />`).join('')}`;
}

/* ---------------- Structured data (SEO plan, Step 6) ----------------
   JSON-LD built only from content visible on the page or in the site's
   contact band. No ratings, prices, addresses, people or logos exist, so
   none are declared. Delivery mode (courseMode) is left out until it is
   confirmed. */

const ORG_ID = SITE_URL + '/#organization';
const WEBSITE_ID = SITE_URL + '/#website';

// assets/logo.svg is used as favicon and Organization logo once it exists.
const HAS_LOGO = existsSync(join(ROOT, 'assets/logo.svg'));
const ADDRESS = {
  '@type': 'PostalAddress',
  addressCountry: COMPANY.countryCode,
  ...(COMPANY.streetAddress ? { streetAddress: COMPANY.streetAddress } : {}),
  ...(COMPANY.postalCode ? { postalCode: COMPANY.postalCode } : {}),
  ...(COMPANY.locality ? { addressLocality: COMPANY.locality } : {}),
};
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'EduCut.ai',
  ...(COMPANY.legalName ? { legalName: COMPANY.legalName } : {}),
  url: SITE_URL + '/',
  ...(HAS_LOGO ? { logo: SITE_URL + '/assets/logo.svg' } : {}),
  slogan: 'Bridging AI with Education',
  address: ADDRESS,
  ...(COMPANY.foundingYear ? { foundingDate: String(COMPANY.foundingYear) } : {}),
  ...(COMPANY.sameAs.length ? { sameAs: COMPANY.sameAs } : {}),
  email: 'contact@educutai.com',
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'partnerships', email: 'partners@educutai.com', description: 'B2B partners, universities and companies' },
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@educutai.com', description: 'Help with the platform for existing collaborators' },
    { '@type': 'ContactPoint', contactType: 'general enquiries', email: 'contact@educutai.com' },
  ],
};
const WEBSITE = { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE_URL + '/', name: 'EduCut.ai', inLanguage: 'en', publisher: { '@id': ORG_ID } };
// Subpages reference the organization by @id and repeat its minimal identity.
const ORG_REF = { '@type': 'Organization', '@id': ORG_ID, name: 'EduCut.ai', url: SITE_URL + '/' };

// Serialise for a <script> block: "<" is escaped so "</script>" can never
// close it early.
const jsonLd = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c')}</script>`;

function structuredData({ path, title, description, crumbs, type = 'WebPage', mainEntity, faq, dateModified }) {
  const url = SITE_URL + path;
  const name = title.endsWith(BRAND) ? title.slice(0, -BRAND.length) : title;
  const webPage = {
    '@type': type, '@id': url + '#webpage', url, name, description, inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    ...(path === '/' ? { about: { '@id': ORG_ID } } : {}),
    ...(crumbs ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}),
    ...(mainEntity ? { mainEntity } : {}),
    ...(dateModified ? { dateModified } : {}),
  };
  const graph = path === '/' ? [ORGANIZATION, WEBSITE, webPage] : [ORG_REF, { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE_URL + '/', name: 'EduCut.ai' }, webPage];
  if (crumbs) graph.push({
    '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
    itemListElement: crumbs.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: label, item: SITE_URL + href })),
  });
  if (faq) graph.push({
    '@type': 'FAQPage', '@id': url + '#faq', url, isPartOf: { '@id': url + '#webpage' },
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })),
  });
  return jsonLd(graph);
}

function courseSchema(c, academy) {
  const url = `${SITE_URL}/academies/${academy.slug}/#${c.anchor}`;
  return {
    '@type': 'Course', '@id': url, url,
    name: c.name,
    courseCode: c.code,
    description: c.programme.join(' '),
    educationalLevel: c.level,
    timeRequired: `PT${c.hours}H`,
    inLanguage: 'en',
    educationalCredentialAwarded: CATALOGUE_FACTS.certification,
    provider: { '@id': ORG_ID },
    about: academy.topics,
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: CATALOGUE_FACTS.courseMode, courseWorkload: `PT${c.hours}H` },
  };
}

const stripTags = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Visible questions and answers; the same items feed the FAQPage markup.
function faqSection(id, heading, items) {
  return `<section class="page-section" aria-labelledby="${id}">
      <div class="wrap">
        <h2 id="${id}">${esc(heading)}</h2>
        <div class="faq">${items.map(([q, a]) => `
          <div class="faq-item"><h3>${esc(q)}</h3><p>${a}</p></div>`).join('')}
        </div>
      </div>
    </section>`;
}

const LEVELS = ['Foundation', 'Intermediate', 'Advanced'];

// ['A','B','C'] -> 'A, B and C'
const listText = (items) => items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];

// Same rule as academySlug() in index.html.
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// The catalogue text comes from PDF extraction and carries broken
// hyphenation ("multi- step"); rejoin it. " - " with spaces is left alone.
const tidy = (s) => String(s).replace(/(\w)- (\w)/g, '$1-$2').trim();

/* ---------------- Data ---------------- */

const academies = read('data/academies.txt').trim().split('\n').map((line) => {
  const [code, name, summary, audience, topics] = line.split(' | ');
  return { code, name, summary, audience, topics: topics.split(', '), slug: slugify(name), courses: [] };
});
const byCode = Object.fromEntries(academies.map((a) => [a.code, a]));

read('data/courses.txt').trim().split('\n').forEach((line) => {
  const [code, name, level, hours, online, personal, programme] = line.split(' | ');
  const academy = byCode[code.split('.')[0]];
  if (!academy) throw new Error(`Course ${code} has no academy`);
  academy.courses.push({
    code, name: tidy(name), level,
    hours: Number(hours), online: Number(online), personal: Number(personal),
    programme: programme.split(' ¶ ').map(tidy),
    anchor: code.toLowerCase().replace('.', '-'),
  });
});

const totalCourses = academies.reduce((n, a) => n + a.courses.length, 0);
const courseByCode = Object.fromEntries(academies.flatMap((a) => a.courses.map((c) => [c.code, { ...c, academy: a }])));

// Assessment focus areas (data/assessment-focus.txt).
const focusAreas = read('data/assessment-focus.txt').trim().split('\n').map((line) => {
  const [key, label, codes] = line.split(' | ');
  const courses = codes.split(', ').map((code) => {
    const c = courseByCode[code];
    if (!c) throw new Error(`Focus area ${key}: unknown course ${code}`);
    return c;
  });
  return { key, label, courses };
});

// Export date of the catalogue snapshot (data/catalogue-meta.txt).
const catalogueMeta = Object.fromEntries(read('data/catalogue-meta.txt').trim().split('\n').map((l) => l.split(' | ')));
if (!/^\d{4}-\d{2}-\d{2}$/.test(catalogueMeta.exported || '')) throw new Error('data/catalogue-meta.txt: missing "exported | YYYY-MM-DD"');
const CATALOGUE_DATE = catalogueMeta.exported;
const CATALOGUE_DATE_TEXT = new Date(CATALOGUE_DATE + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Catalogue-wide figures used in FAQs and the homepage block.
const allCourses = academies.flatMap((a) => a.courses);
const levelTotals = LEVELS.map((l) => [l, allCourses.filter((c) => c.level === l).length]);
const durationTotals = [...allCourses.reduce((m, c) => m.set(`${c.hours}|${c.online}|${c.personal}`, (m.get(`${c.hours}|${c.online}|${c.personal}`) || 0) + 1), new Map())]
  .map(([k, n]) => { const [h, o, p] = k.split('|'); return { h, o, p, n }; }).sort((x, y) => y.n - x.n);
const durationSummary = listText(durationTotals.map((d) => `${d.n} courses take ${d.h} hours (${d.o} h online + ${d.p} h personal work)`));

// Consistency checks: every academy in exactly one cluster, spokes list
// their pillar first, pillars list their whole cluster, links resolve.
const clusterOf = {};
for (const cl of CLUSTERS) for (const c of cl.codes) {
  if (!byCode[c]) throw new Error(`Unknown academy ${c} in CLUSTERS`);
  if (clusterOf[c]) throw new Error(`${c} is in two clusters`);
  clusterOf[c] = cl;
}
if (Object.keys(clusterOf).length !== academies.length) throw new Error('CLUSTERS must list every academy once');
for (const a of academies) {
  const cl = clusterOf[a.code], rel = RELATED[a.code];
  if (!rel || rel.some((c) => !byCode[c] || c === a.code)) throw new Error(`${a.code}: bad RELATED entry`);
  if (cl.pillar === a.code && cl.codes.some((c) => c !== a.code && !rel.includes(c))) throw new Error(`${a.code}: pillar must relate to its whole cluster`);
  if (cl.pillar && cl.pillar !== a.code && rel[0] !== cl.pillar) throw new Error(`${a.code}: spoke must list its pillar first`);
}
for (const [code, target] of Object.entries(SEE_ALSO)) {
  if (!courseByCode[code]) throw new Error(`SEE_ALSO: unknown course ${code}`);
  if (target !== 'paths' && (!byCode[target] || target === code.split('.')[0])) throw new Error(`SEE_ALSO ${code}: bad target ${target}`);
}

// Guides (content/guides.mjs): drafts are noindex and unlinked; a guide
// can only be published with a named author, a date and no reviewer notes.
for (const g of GUIDES) {
  if (!['draft', 'published'].includes(g.status)) throw new Error(`Guide ${g.slug}: status must be draft or published`);
  for (const c of g.related) if (!byCode[c]) throw new Error(`Guide ${g.slug}: unknown academy ${c}`);
  if (g.status === 'published') {
    if (!g.author?.name || !g.author?.jobTitle) throw new Error(`Guide ${g.slug}: a published guide needs author.name and author.jobTitle`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.datePublished || '')) throw new Error(`Guide ${g.slug}: a published guide needs datePublished (YYYY-MM-DD)`);
    if ([g.body, g.lead, ...g.faq.flat()].some((t) => t.includes('[['))) throw new Error(`Guide ${g.slug}: resolve every [[reviewer note]] before publishing`);
  }
}
const publishedGuides = GUIDES.filter((g) => g.status === 'published');

// Languages (content/i18n.mjs): only reviewed translations that exist on
// disk may be announced with hreflang.
for (const [enPath, alts] of Object.entries(ALTERNATES)) {
  for (const [lang, altPath] of Object.entries(alts)) {
    if (!LANGUAGES[lang] || lang === DEFAULT_LANGUAGE) throw new Error(`content/i18n.mjs: unknown language ${lang} for ${enPath}`);
    if (!altPath.startsWith(LANGUAGES[lang].prefix + '/')) throw new Error(`content/i18n.mjs: ${altPath} must start with ${LANGUAGES[lang].prefix}/`);
    if (!existsSync(join(ROOT, altPath.slice(1), 'index.html'))) throw new Error(`content/i18n.mjs: ${altPath} is mapped but does not exist`);
  }
}
// [[lang, absoluteUrl]] for a page with reviewed translations, else [].
function alternatesFor(path) {
  const alts = ALTERNATES[path];
  if (!alts || !Object.keys(alts).length) return [];
  return [[DEFAULT_LANGUAGE, SITE_URL + path], ...Object.entries(alts).map(([l, p]) => [l, SITE_URL + p]), ['x-default', SITE_URL + path]];
}

// About page: published only when the required company facts exist.
const ABOUT_PUBLISHED = Boolean(COMPANY.legalName && COMPANY.story);
for (const f of FACULTY) if (!f.name || !f.role || !f.expertise) throw new Error('content/about.mjs: each FACULTY entry needs name, role and expertise');
const LEGAL_PAGES = [['privacy', LEGAL.privacy], ['terms', LEGAL.terms]].filter(([, v]) => v);
for (const [k, v] of LEGAL_PAGES) if (!v.title || !v.html || !/^\d{4}-\d{2}-\d{2}$/.test(v.updated || '')) throw new Error(`content/about.mjs: LEGAL.${k} needs title, html and updated (YYYY-MM-DD)`);

/* ---------------- Reused homepage markup ---------------- */

let index = read('index.html');

function extractBlock(html, startMarker, tag) {
  const start = html.indexOf(startMarker);
  if (start < 0) throw new Error(`index.html: marker not found: ${startMarker}`);
  const open = new RegExp(`<${tag}[\\s>]`, 'g');
  const close = `</${tag}>`;
  let depth = 0, i = start;
  while (i < html.length) {
    open.lastIndex = i;
    const o = open.exec(html);
    const c = html.indexOf(close, i);
    if (c < 0) break;
    if (o && o.index < c) { depth++; i = o.index + 1; }
    else { depth--; i = c + close.length; if (depth === 0) return html.slice(start, i); }
  }
  throw new Error(`index.html: unbalanced <${tag}> after ${startMarker}`);
}

// Buttons that open modals on the homepage become links to it.
const toLinks = (html) => html
  .replace(/\sdata-reveal/g, '')
  .replace(/<button([^>]*?)\sdata-start>([\s\S]*?)<\/button>/g, '<a$1 href="/#start-assessment">$2</a>')
  .replace(/<button([^>]*?)\sdata-consult>([\s\S]*?)<\/button>/g, '<a$1 href="/#book-consultation">$2</a>')
  .replace(/<button([^>]*?)\sdata-catalogue>([\s\S]*?)<\/button>/g, '<a$1 href="/#request-catalogue">$2</a>');

// The homepage copy links to /ai-learning-paths/; drop that self-link there.
const SECTION_PATHS = toLinks(extractBlock(index, '<section id="paths">', 'section'))
  .replace(/\s*<p class="section-more">[\s\S]*?<\/p>/, '');
const SECTION_HOW = toLinks(extractBlock(index, '<section class="how" id="how">', 'section'));
const SECTION_CONSULT = toLinks(extractBlock(index, '<section class="consult-section" id="consultation">', 'section'));
const SECTION_CONTACT = extractBlock(index, '<section class="contact-band"', 'section');
const HERO_COPY = (index.match(/<p class="hero-copy">([\s\S]*?)<\/p>/) || [])[1];
const ACADEMY_INTRO = (index.match(/<section class="academy-section"[\s\S]*?<\/h2><\/div><p>([\s\S]*?)<\/p>/) || [])[1];
if (!HERO_COPY || !ACADEMY_INTRO) throw new Error('index.html: hero or academy intro copy not found');

// Landing CSS: everything in the first <style> block before the
// authentication/admin styles, which public pages do not need.
const styleStart = index.indexOf('<style>') + '<style>'.length;
const styleStop = index.indexOf('/* =========================================================\n   EduCut.ai authentication');
if (styleStart < 7 || styleStop < styleStart) throw new Error('index.html: landing CSS boundaries not found');
write('assets/site.css', '/* Generated by scripts/build-pages.mjs from index.html — do not edit. */\n' + index.slice(styleStart, styleStop).trim() + '\n');

/* ---------------- Layout ---------------- */

const NAV = [
  ['/academies/', 'Academies'],
  ['/ai-learning-paths/', 'AI Paths'],
  ['/contact/', 'Contact'],
];

function nav(current) {
  const links = NAV.map(([href, label]) =>
    `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<nav class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="/">EduCut<span>.ai</span></a>
      <div class="nav-links">
        ${links}<a href="/#/signup">Sign up</a><a href="/#/signin">Sign In</a>
        <a class="btn btn-lime" href="/#start-assessment">Take the 3-min test</a>
      </div>
    </div>
  </nav>`;
}

function footer() {
  const academyLinks = academies.map((a) => `<li><a href="/academies/${a.slug}/">${esc(a.name)}</a></li>`).join('');
  return `<footer>
  <div class="wrap">
    <div class="footer-nav">
      <div>
        <div class="mono">EduCut.ai</div>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/academies/">All academies</a></li>
          <li><a href="/ai-learning-paths/">AI learning paths</a></li>
          <li><a href="/contact/">Contact &amp; consultation</a></li>${publishedGuides.length ? '\n          <li><a href="/guides/">Guides</a></li>' : ''}${ABOUT_PUBLISHED ? '\n          <li><a href="/about/">About EduCut.ai</a></li>' : ''}${LEGAL_PAGES.map(([k, v]) => `\n          <li><a href="/${k}/">${esc(v.title)}</a></li>`).join('')}
        </ul>
        <p class="footer-place">Based in ${esc(COMPANY.country)}</p>
      </div>
      <div class="footer-academies">
        <div class="mono">Academies</div>
        <ul>${academyLinks}</ul>
      </div>
    </div>
    <div class="footer-row"><div>EDUCUT.AI — BRIDGING AI WITH EDUCATION</div><div>FOCUSED • RELEVANT • CONTINUOUSLY EVOLVING</div></div>
  </div>
</footer>`;
}

function breadcrumb(items) {
  return `<nav class="breadcrumb mono" aria-label="Breadcrumb">${items.map(([href, label], i) =>
    i === items.length - 1
      ? `<span aria-current="page">${esc(label)}</span>`
      : `<a href="${href}">${esc(label)}</a><span aria-hidden="true">/</span>`).join('')}</nav>`;
}

const KIT_PAGES = [];
function page({ path, nav: navPath, title, description, body, crumbs, type, mainEntity, faq, dateModified, noindex = false }) {
  if (!noindex) KIT_PAGES.push({ path, title, description, h1: stripTags((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '') });
  // Non-indexable pages (the 404) get no canonical, Open Graph or JSON-LD.
  const head = noindex
    ? `<title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="noindex" />${HAS_LOGO ? '\n  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />' : ''}`
    : `${seoHead({ path, title, description })}
  ${structuredData({ path, title, description, crumbs, type, mainEntity, faq, dateModified })}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${head}
  <link rel="stylesheet" href="/assets/site.css" />
  <link rel="stylesheet" href="/assets/pages.css" />
</head>
<body>
  ${nav(navPath || path)}
  <main>
${body}
  </main>
${footer()}
</body>
</html>
`;
}

const ctaBand = (heading) => `<section class="cta"><div class="wrap cta-grid"><h2>${heading}</h2><a class="btn btn-lg" href="/#start-assessment">Start the free assessment →</a></div></section>`;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ---------------- Academy pages ---------------- */

function durationText(courses) {
  const kinds = [...new Map(courses.map((c) => [`${c.hours}|${c.online}|${c.personal}`, c])).values()];
  return kinds.map((c) => `${c.hours} hours per course (${c.online} h online + ${c.personal} h personal work)`).join('; ');
}

function academyPage(a) {
  const levels = LEVELS.map((level) => ({ level, courses: a.courses.filter((c) => c.level === level) })).filter((g) => g.courses.length);
  const unknown = a.courses.filter((c) => !LEVELS.includes(c.level));
  if (unknown.length) throw new Error(`${a.code}: unexpected level ${unknown[0].level}`);

  // Values are HTML; plain text is escaped here.
  const facts = [
    ['Academy code', esc(a.code)],
    ['Courses', String(a.courses.length)],
    ['Levels', esc(levels.map((g) => `${g.level} (${g.courses.length})`).join(' · '))],
    ['Course duration', esc(durationText(a.courses))],
    ['Language', esc(`${CATALOGUE_FACTS.language}${CATALOGUE_FACTS.translationAvailable ? ' (translation available)' : ''}`)],
    ['Certification', esc(CATALOGUE_FACTS.certification)],
    ['Format', esc(CATALOGUE_FACTS.format)],
    ['Catalogue updated', `<time datetime="${CATALOGUE_DATE}">${CATALOGUE_DATE_TEXT}</time>`],
  ];

  // One self-contained sentence pair that can be quoted on its own.
  const codes = a.courses.map((c) => c.code).sort();
  const audience = a.audience.replace(/\.$/, '').replace(/^([A-Z])(?=[a-z])/, (m) => m.toLowerCase());
  const definition = `The ${a.name} Academy is a set of ${a.courses.length} EduCut.ai courses (${codes[0]}–${codes[codes.length - 1]}) designed for ${audience}. `
    + `It covers ${listText(a.topics)}, from ${levels[0].level.toLowerCase()} to ${levels[levels.length - 1].level.toLowerCase()} level. `
    + `Each course takes ${durationText(a.courses).replace(' per course', '')} and combines instructor-led online sessions with self-paced personal work.`;
  const focus = focusAreas.filter((f) => f.courses.some((c) => c.academy.code === a.code));
  if (focus.length) facts.push(['Free assessment focus area',
    `${focus.map((f) => esc(f.label)).join(' · ')} — <a href="/ai-learning-paths/#focus-areas">see how the assessment recommends courses</a>`]);

  const seeAlso = (c) => {
    const target = SEE_ALSO[c.code];
    if (!target) return '';
    const link = target === 'paths'
      ? '<a href="/ai-learning-paths/">Take the free AI readiness assessment →</a>'
      : `<a href="/academies/${byCode[target].slug}/">${esc(byCode[target].name)} courses →</a>`;
    return `<p class="see-also">See also: ${link}</p>`;
  };

  const crumbs = [['/', 'Home'], ['/academies/', 'Academies'], [`/academies/${a.slug}/`, a.name]];
  const cl = clusterOf[a.code];
  const clusterLink = `<a href="/academies/#${cl.id}">${esc(cl.title)}</a>`;
  const clusterIntro = cl.pillar === a.code
    ? `${esc(a.name)} is the core academy of the ${clusterLink} topic, together with ${listText(cl.codes.filter((c) => c !== a.code).map((c) => `<a href="/academies/${byCode[c].slug}/">${esc(byCode[c].name)}</a>`))}.`
    : cl.pillar
      ? `Part of the ${clusterLink} topic, led by <a href="/academies/${byCode[cl.pillar].slug}/">${esc(byCode[cl.pillar].name)} courses</a>.`
      : `Part of ${clusterLink}, alongside ${listText(cl.codes.filter((c) => c !== a.code).map((c) => `<a href="/academies/${byCode[c].slug}/">${esc(byCode[c].name)}</a>`))}.`;

  const courseHtml = levels.map(({ level, courses }) => `
        <div class="level-group">
          <h3>${esc(level)} level <span class="mono">· ${plural(courses.length, 'course')}</span></h3>
          ${courses.map((c) => `
          <details class="course" id="${c.anchor}">
            <summary>
              <span class="mono code">${esc(c.code)}</span>
              <h4>${esc(c.name)}</h4>
              <span class="course-meta">${esc(c.level)} · ${c.hours} hours (${c.online} h online + ${c.personal} h personal work)</span>
            </summary>
            <div class="course-body">
              <div class="mono">Programme</div>
              <ul>${c.programme.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${seeAlso(c)}
            </div>
          </details>`).join('')}
        </div>`).join('');

  const related = RELATED[a.code].map((code) => byCode[code]);

  const body = `
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">Academy ${esc(a.code)} · ${plural(a.courses.length, 'course')}</div>
        <h1>${esc(a.name)} courses</h1>
        <p class="lead">${esc(a.summary)}</p>
        <div class="audience"><strong>Designed for</strong>${esc(a.audience)}</div>
        <div class="hero-actions">
          <a class="btn btn-lime btn-lg" href="/#start-assessment">Build my free AI Path →</a>
          <a class="btn btn-outline-light btn-lg" href="/#request-catalogue">Request the full catalogue</a>
        </div>
      </div>
    </header>

    <section class="page-section alt" aria-labelledby="glance">
      <div class="wrap">
        <h2 id="glance">${esc(a.name)} at a glance</h2>
        <p class="definition">${esc(definition)}</p>
        <table class="facts"><tbody>
          ${facts.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('\n          ')}
        </tbody></table>
      </div>
    </section>

    <section class="page-section" aria-labelledby="topics">
      <div class="wrap">
        <h2 id="topics">What the ${esc(a.name)} courses cover</h2>
        <ul class="chips">${a.topics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </section>

    <section class="page-section alt" aria-labelledby="courses">
      <div class="wrap">
        <h2 id="courses">Courses in the ${esc(a.name)} Academy</h2>
        <p class="section-intro">${plural(a.courses.length, 'course')}, from ${esc(levels[0].level.toLowerCase())} to ${esc(levels[levels.length - 1].level.toLowerCase())} level. Open a course to see its programme.</p>
        ${courseHtml}
      </div>
    </section>

    <section class="page-section" aria-labelledby="related">
      <div class="wrap">
        <h2 id="related">Related academies</h2>
        <p class="section-intro">${clusterIntro}</p>
        <div class="academy-cards">${related.map(card).join('')}</div>${guidesFor(a.code)}
      </div>
    </section>

    ${ctaBand(`Not sure which ${esc(a.name)} courses fit your team?`)}`;

  const [seoTitle, seoDescription] = ACADEMY_SEO[a.code] || [];
  if (!seoTitle) throw new Error(`${a.code}: missing ACADEMY_SEO entry`);
  return page({
    path: `/academies/${a.slug}/`,
    nav: '/academies/',
    title: seoTitle + BRAND,
    description: seoDescription.replace('{n}', a.courses.length),
    body,
    crumbs,
    type: 'CollectionPage',
    dateModified: CATALOGUE_DATE,
    mainEntity: {
      '@type': 'ItemList',
      name: `Courses in the ${a.name} Academy`,
      numberOfItems: a.courses.length,
      itemListElement: a.courses.map((c, i) => ({ '@type': 'ListItem', position: i + 1, item: courseSchema(c, a) })),
    },
  });
}

function guidesFor(code) {
  const list = publishedGuides.filter((g) => g.related.includes(code));
  if (!list.length) return '';
  return `
        <h3 class="guides-heading">Guides on this topic</h3>
        <ul class="guide-links">${list.map((g) => `<li><a href="/guides/${g.slug}/">${esc(g.title)}</a></li>`).join('')}</ul>`;
}

function card(a) {
  return `<a class="academy-card" href="/academies/${a.slug}/">
            <span class="mono code">${esc(a.code)} · ${plural(a.courses.length, 'course')}</span>
            <h3>${esc(a.name)}</h3>
            <p>${esc(a.summary)}</p>
            <span class="more">Explore ${esc(a.name)} courses →</span>
          </a>`;
}

/* ---------------- Hub, paths, contact ---------------- */

// Answers use only catalogue data and statements already on the site.
const HUB_FAQ = [
  ['How many courses does EduCut.ai offer?', `${totalCourses} courses, organized into ${academies.length} specialized academies — from AI foundations and generative AI to AI for business functions, LLM engineering, RAG, AI agents, responsible AI, governance, security and transformation.`],
  ['What levels are the courses?', `Courses are offered at ${listText(levelTotals.filter(([, n]) => n).map(([l, n]) => `${l.toLowerCase()} (${n} courses)`))} level.`],
  ['How long is a course?', `${durationSummary}.`],
  ['How are the courses delivered?', `${CATALOGUE_FACTS.format}.`],
  ['Do the courses include a certificate?', `Yes. ${CATALOGUE_FACTS.certification}.`],
  ['In which language are the courses taught?', `${CATALOGUE_FACTS.language}${CATALOGUE_FACTS.translationAvailable ? ', and translation is available' : ''}.`],
  ['How do I choose the right courses?', 'Take the free 3-minute assessment to receive personalized 3, 5 and 7-course paths, or <a href="/contact/">book a free one-hour consultation</a> with EduCut.ai.'],
  ['How can I get the full catalogue?', 'Request the complete EduCut.ai catalogue by business email from the <a href="/contact/">contact page</a>.'],
];

const PATHS_FAQ = [
  ['How long does the EduCut.ai assessment take?', 'About 3 minutes. It has 20 focused multiple-choice questions.'],
  ['Is the assessment free?', 'Yes. The recommendation is free and there is no commitment.'],
  ['What do I receive?', 'An AI readiness score and maturity level, your strongest opportunity, and three learning paths — Essential (3 courses), Accelerate (5 courses) and Transform (7 courses) — together with the catalogue and an indicative quotation, free of charge.'],
  ['How are the courses chosen?', `Your answers are scored across ${focusAreas.length} focus areas, such as AI productivity, RAG & enterprise knowledge or responsible AI, governance & security. The paths are built from the exact EduCut.ai courses mapped to your highest-priority areas (<a href="#focus-areas">see the full list</a>).`],
  ['What happens after the assessment?', 'You can book a free one-hour consultation to review your needs with EduCut.ai, or request the full academy catalogue by business email.'],
];

function hubPage() {
  const crumbs = [['/', 'Home'], ['/academies/', 'Academies']];
  const body = `
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">EduCut.ai Academy · ${academies.length} academies · ${totalCourses} courses</div>
        <h1>The EduCut.ai Academy: AI training courses</h1>
        <p class="lead">${ACADEMY_INTRO}</p>
        <p class="mono updated">Catalogue updated <time datetime="${CATALOGUE_DATE}">${CATALOGUE_DATE_TEXT}</time></p>
        <div class="hero-actions">
          <a class="btn btn-lime btn-lg" href="/#start-assessment">Build my free AI Path →</a>
          <a class="btn btn-outline-light btn-lg" href="/#request-catalogue">Request the full catalogue</a>
        </div>
      </div>
    </header>

    <section class="page-section alt">
      <div class="wrap">
        ${CLUSTERS.map((g) => `
        <div class="group-block" id="${g.id}">
          <h2>${esc(g.title)}</h2>
          <div class="academy-cards">${g.codes.map((c) => card(byCode[c])).join('')}</div>
        </div>`).join('')}
      </div>
    </section>

    <section class="page-section" aria-labelledby="compare">
      <div class="wrap">
        <h2 id="compare">Which academy is right for you?</h2>
        <p class="section-intro">Some academies sit close together. This is how they differ.</p>
        ${COMPARISONS.map((g) => `
        <div class="compare-group">
          <h3>${esc(g.title)}</h3>
          <table class="compare">
            <thead><tr><th scope="col">Academy</th><th scope="col">Focus</th><th scope="col">Choose it if…</th></tr></thead>
            <tbody>${g.rows.map(([code, focus, when]) => `
              <tr><th scope="row"><a href="/academies/${byCode[code].slug}/">${esc(byCode[code].name)}</a></th><td data-label="Focus">${esc(focus)}</td><td data-label="Choose it if…">${esc(when)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')}
      </div>
    </section>

    ${faqSection('faq', 'Questions about the EduCut.ai courses', HUB_FAQ)}

    ${ctaBand('Find the right academies for your organization.')}`;

  return page({
    path: '/academies/',
    title: `AI Training Courses — ${academies.length} Academies, ${totalCourses} Courses${BRAND}`,
    description: `Browse ${totalCourses} AI training courses in ${academies.length} academies: AI foundations, prompt engineering, AI for business functions, LLMs, RAG, agents, governance and security.`,
    body,
    crumbs,
    type: 'CollectionPage',
    dateModified: CATALOGUE_DATE,
    faq: HUB_FAQ,
    mainEntity: {
      '@type': 'ItemList',
      name: 'EduCut.ai academies',
      numberOfItems: academies.length,
      itemListElement: CLUSTERS.flatMap((g) => g.codes).map((code, i) => ({
        '@type': 'ListItem', position: i + 1, name: byCode[code].name, url: `${SITE_URL}/academies/${byCode[code].slug}/`,
      })),
    },
  });
}

function pathsPage() {
  const crumbs = [['/', 'Home'], ['/ai-learning-paths/', 'AI learning paths']];
  const body = `
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">Free company assessment · 20 questions · ≈ 3 minutes</div>
        <h1>Free AI readiness assessment &amp; learning paths</h1>
        <p class="lead">${HERO_COPY}</p>
        <div class="hero-actions">
          <a class="btn btn-lime btn-lg" href="/#start-assessment">Build my free AI Path →</a>
          <a class="btn btn-outline-light btn-lg" href="/academies/">Explore the academies</a>
        </div>
      </div>
    </header>

    ${SECTION_PATHS}

    ${SECTION_HOW.replace(/<h2>[\s\S]*?<\/h2>/, '<h2>How the free AI assessment works</h2>')}

    <section class="page-section alt" aria-labelledby="focus-areas">
      <div class="wrap">
        <h2 id="focus-areas">What the assessment can recommend</h2>
        <p class="section-intro">The assessment scores your answers across ${focusAreas.length} focus areas. Your 3, 5 and 7-course paths are built from the courses mapped to your highest-priority areas:</p>
        <table class="facts focus-table"><tbody>
          ${[...focusAreas].sort((x, y) => x.label.localeCompare(y.label)).map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${f.courses.map((c) =>
            `<a href="/academies/${c.academy.slug}/#${c.anchor}">${esc(c.name)}</a> <span class="mono">${esc(c.code)}</span>`).join('<br>')}</td></tr>`).join('\n          ')}
        </tbody></table>
      </div>
    </section>

    ${faqSection('faq', 'Questions about the AI assessment', PATHS_FAQ)}

    ${ctaBand('Build AI capabilities that evolve with technology.')}`;

  return page({
    path: '/ai-learning-paths/',
    title: 'Free AI Readiness Assessment for Companies' + BRAND,
    description: 'Answer 20 questions in about 3 minutes. Get your AI readiness score and Essential, Accelerate and Transform learning paths of 3, 5 and 7 courses.',
    body,
    crumbs,
    faq: PATHS_FAQ,
  });
}

function contactPage() {
  const crumbs = [['/', 'Home'], ['/contact/', 'Contact']];
  const body = `
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">Free · No commitment</div>
        <h1>Contact EduCut.ai</h1>
        <p class="lead">Book a free one-hour consultation, request the complete EduCut.ai catalogue by email, or write to the right team directly.</p>
        <p class="lead-links">Not ready to talk yet? <a href="/academies/">Browse all ${academies.length} academies</a> or <a href="/ai-learning-paths/">take the free AI readiness assessment</a>.</p>
      </div>
    </header>

    ${SECTION_CONSULT}

    ${SECTION_CONTACT}`;

  return page({
    path: '/contact/',
    title: 'Contact EduCut.ai — Free AI Training Consultation',
    description: 'Book a free one-hour consultation, request the full AI course catalogue by email, or contact our partnerships, support and general enquiries teams.',
    body,
    crumbs,
    type: 'ContactPage',
  });
}

function notFoundPage() {
  const body = `
    <header class="page-hero">
      <div class="wrap">
        <div class="mono kicker">Error 404</div>
        <h1>Page not found</h1>
        <p class="lead">The page you are looking for does not exist or has moved. These pages can help:</p>
        <div class="hero-actions">
          <a class="btn btn-lime btn-lg" href="/">EduCut.ai home</a>
          <a class="btn btn-outline-light btn-lg" href="/academies/">All ${academies.length} academies</a>
          <a class="btn btn-outline-light btn-lg" href="/ai-learning-paths/">Free AI assessment</a>
          <a class="btn btn-outline-light btn-lg" href="/contact/">Contact</a>
        </div>
      </div>
    </header>`;
  return page({ path: '/404.html', nav: '', title: 'Page not found' + BRAND, description: 'This page does not exist on EduCut.ai.', body, noindex: true });
}

const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
// Draft-only: reviewer notes are shown highlighted so nothing is missed.
const showNotes = (h) => h.replace(/\[\[([\s\S]*?)\]\]/g, '<mark class="review-note">$1</mark>');

function guidePage(g) {
  const draft = g.status !== 'published';
  const path = `/guides/${g.slug}/`;
  const crumbs = [['/', 'Home'], ['/guides/', 'Guides'], [path, g.title]];
  const byline = draft
    ? '<p class="byline mono">Author and expert reviewer to be confirmed</p>'
    : `<p class="byline">By <strong>${esc(g.author.name)}</strong>, ${esc(g.author.jobTitle)}${g.reviewer ? ` · Reviewed by <strong>${esc(g.reviewer.name)}</strong>, ${esc(g.reviewer.jobTitle)}` : ''} · Published <time datetime="${g.datePublished}">${fmtDate(g.datePublished)}</time>${g.dateModified ? ` · Updated <time datetime="${g.dateModified}">${fmtDate(g.dateModified)}</time>` : ''}</p>`;
  const body = `
    ${draft ? '<div class="draft-banner"><div class="wrap"><strong>DRAFT — pending expert review.</strong> Not published: hidden from search engines and not linked from the site. Highlighted notes are for the reviewer.</div></div>' : ''}
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">EduCut.ai guide</div>
        <h1>${esc(g.title)}</h1>
        <p class="lead">${esc(g.lead)}</p>
        ${byline}
      </div>
    </header>

    <article class="page-section alt">
      <div class="wrap article">
        ${draft ? showNotes(g.body) : g.body}
      </div>
    </article>

    ${faqSection('faq', 'Frequently asked questions', g.faq)}

    <section class="page-section alt" aria-labelledby="related">
      <div class="wrap">
        <h2 id="related">Related EduCut.ai academies</h2>
        <div class="academy-cards">${g.related.map((c) => card(byCode[c])).join('')}</div>
      </div>
    </section>

    ${ctaBand('Turn this into a learning plan for your teams.')}`;

  const article = draft ? null : {
    '@type': 'Article', '@id': SITE_URL + path + '#article',
    headline: g.title, description: g.description, inLanguage: 'en',
    author: { '@type': 'Person', name: g.author.name, jobTitle: g.author.jobTitle, worksFor: { '@id': ORG_ID } },
    publisher: { '@id': ORG_ID },
    datePublished: g.datePublished, dateModified: g.dateModified || g.datePublished,
    mainEntityOfPage: { '@id': SITE_URL + path + '#webpage' },
    about: g.related.map((c) => ({ '@type': 'Thing', name: byCode[c].name })),
  };
  return page({
    path, nav: '/guides/', title: g.seoTitle + BRAND, description: g.description, body, crumbs,
    noindex: draft, faq: g.faq, mainEntity: article || undefined,
  });
}

function guidesIndexPage() {
  const crumbs = [['/', 'Home'], ['/guides/', 'Guides']];
  const list = publishedGuides.length ? publishedGuides : GUIDES;
  const body = `
    ${publishedGuides.length ? '' : '<div class="draft-banner"><div class="wrap"><strong>No guide is published yet.</strong> This page is hidden from search engines until the first guide is reviewed and published.</div></div>'}
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">EduCut.ai guides</div>
        <h1>Guides to AI training and adoption</h1>
        <p class="lead">Practical guides from EduCut.ai on assessing AI readiness, planning AI training and meeting AI regulation.</p>
      </div>
    </header>
    <section class="page-section alt">
      <div class="wrap">
        <div class="guide-cards">${list.map((g) => `
          <a class="academy-card" href="/guides/${g.slug}/">
            <span class="mono code">${g.status === 'published' ? `Guide · ${fmtDate(g.dateModified || g.datePublished)}` : 'Draft · pending review'}</span>
            <h3>${esc(g.title)}</h3>
            <p>${esc(g.description)}</p>
            <span class="more">Read the guide →</span>
          </a>`).join('')}
        </div>
      </div>
    </section>`;
  return page({
    path: '/guides/', title: 'AI Training & Adoption Guides' + BRAND,
    description: 'Practical guides from EduCut.ai on assessing AI readiness, building an AI training plan and preparing teams for AI regulation.',
    body, crumbs, type: 'CollectionPage', noindex: !publishedGuides.length,
  });
}

function aboutPage() {
  const draft = !ABOUT_PUBLISHED;
  const crumbs = [['/', 'Home'], ['/about/', 'About']];
  const missing = (what) => draft ? `<p><mark class="review-note">To be provided by EduCut.ai: ${what}</mark></p>` : '';
  const companyRows = [
    ['Name', 'EduCut.ai'],
    ...(COMPANY.legalName ? [['Legal name', esc(COMPANY.legalName)]] : []),
    ['Country', esc(COMPANY.country)],
    ...(COMPANY.streetAddress ? [['Address', esc([COMPANY.streetAddress, [COMPANY.postalCode, COMPANY.locality].filter(Boolean).join(' '), COMPANY.country].filter(Boolean).join(', '))]] : []),
    ...(COMPANY.foundingYear ? [['Founded', esc(String(COMPANY.foundingYear))]] : []),
    ['Contact', 'contact@educutai.com (general enquiries) · partners@educutai.com (partnerships, universities, companies) · support@educutai.com (platform support)'],
  ];
  const body = `
    ${draft ? '<div class="draft-banner"><div class="wrap"><strong>DRAFT — waiting for company information.</strong> Hidden from search engines and not linked from the site until the legal name and company story are provided.</div></div>' : ''}
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <div class="mono kicker" style="margin-top:34px">About EduCut.ai · Bridging AI with Education</div>
        <h1>About EduCut.ai</h1>
        <p class="lead">EduCut.ai is an AI training provider for companies, universities and professionals, based in ${esc(COMPANY.country)}. It offers ${totalCourses} courses in ${academies.length} specialized academies and a free 3-minute assessment that recommends focused AI learning paths.</p>
      </div>
    </header>

    <section class="page-section alt" aria-labelledby="story">
      <div class="wrap article">
        <h2 id="story">Our story</h2>
        ${COMPANY.story ? `<p>${COMPANY.story}</p>` : missing('who founded EduCut.ai, when, and why (2–4 sentences).')}
        <h2>Our approach</h2>
        <p>EduCut.ai offers AI learning built for business — not a generic course library. The catalogue is AI-only and organized around precise professional needs, from productivity and business functions to LLMs, RAG, agents, governance, security and enterprise transformation, and courses are updated and expanded as AI evolves. Instead of labelling organizations simply “beginner” or “advanced”, a short assessment combines organizational maturity, business priorities, target teams, technical ambition and governance needs into three paths of increasing depth.</p>
      </div>
    </section>

    <section class="page-section" aria-labelledby="offer">
      <div class="wrap">
        <h2 id="offer">What EduCut.ai offers</h2>
        <p class="section-intro">${academies.length} academies in five topic areas:</p>
        <ul class="guide-links">${CLUSTERS.map((g) => `<li><a href="/academies/#${g.id}">${esc(g.title)}</a> — ${listText(g.codes.map((c) => esc(byCode[c].name)))}</li>`).join('')}</ul>
      </div>
    </section>

    <section class="page-section alt" aria-labelledby="faculty">
      <div class="wrap">
        <h2 id="faculty">Faculty and experts</h2>
        ${FACULTY.length ? `<div class="faculty">${FACULTY.map((f) => `
          <div class="faculty-card"><h3>${esc(f.name)}</h3><p class="mono">${esc(f.role)}</p><p>${esc(f.expertise)}</p>${f.credentials ? `<p class="credentials">${esc(f.credentials)}</p>` : ''}${f.profileUrl ? `<a href="${esc(f.profileUrl)}" rel="me noopener">Profile →</a>` : ''}</div>`).join('')}</div>` : missing('the experts who teach, author or review — name, role, expertise, credentials.')}
      </div>
    </section>

    <section class="page-section" aria-labelledby="company">
      <div class="wrap">
        <h2 id="company">Company details</h2>
        <table class="facts"><tbody>${companyRows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>
        ${draft ? missing('legal company name and registered address.') : ''}
      </div>
    </section>

    ${ctaBand('Talk to EduCut.ai about your AI learning needs.')}`;

  const people = FACULTY.map((f) => ({
    '@type': 'Person', name: f.name, jobTitle: f.role, knowsAbout: f.expertise,
    worksFor: { '@id': ORG_ID }, ...(f.profileUrl ? { sameAs: [f.profileUrl] } : {}),
  }));
  return page({
    path: '/about/', nav: '', title: 'About EduCut.ai — AI Training Provider in Switzerland',
    description: `EduCut.ai is an AI training provider based in ${COMPANY.country}: ${totalCourses} courses in ${academies.length} academies for companies, universities and professionals.`,
    body, crumbs, type: 'AboutPage', noindex: draft,
    mainEntity: people.length ? { '@type': 'ItemList', name: 'EduCut.ai faculty', itemListElement: people.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) } : undefined,
  });
}

function legalPage(slug, doc) {
  const crumbs = [['/', 'Home'], [`/${slug}/`, doc.title]];
  const body = `
    <header class="page-hero">
      <div class="wrap">
        ${breadcrumb(crumbs)}
        <h1 style="margin-top:34px">${esc(doc.title)}</h1>
        <p class="byline">Last updated <time datetime="${doc.updated}">${fmtDate(doc.updated)}</time></p>
      </div>
    </header>
    <section class="page-section alt"><div class="wrap article">${doc.html}</div></section>`;
  return page({ path: `/${slug}/`, nav: '', title: doc.title + BRAND, description: `${doc.title} of EduCut.ai.`, body, crumbs });
}

// Every indexable URL, for sitemap.xml. The 404 page is deliberately absent.
const PUBLIC_PATHS = ['/', '/academies/', ...academies.map((a) => `/academies/${a.slug}/`), '/ai-learning-paths/', '/contact/',
  ...(publishedGuides.length ? ['/guides/', ...publishedGuides.map((g) => `/guides/${g.slug}/`)] : []),
  ...(ABOUT_PUBLISHED ? ['/about/'] : []), ...LEGAL_PAGES.map(([k]) => `/${k}/`)];

const ROBOTS = `# EduCut.ai — generated by scripts/build-pages.mjs
# All public pages are open to search engines and AI crawlers.
User-agent: *
Allow: /
# Legacy sign-in paths; sign-in now lives at /#/signin and /#/signup.
Disallow: /signin
Disallow: /signup

Sitemap: ${SITE_URL}/sitemap.xml
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PUBLIC_PATHS.flatMap((p) => [p, ...Object.values(ALTERNATES[p] || {})].map((loc) => `  <url><loc>${SITE_URL}${loc}</loc>${alternatesFor(p).map(([l, u]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${u}"/>`).join('')}</url>`)).join('\n')}
</urlset>
`;

// llms.txt: a plain-text summary for AI tools (an emerging convention).
const LLMS_TXT = `# EduCut.ai

> EduCut.ai is an AI training provider for companies, universities and professionals: ${totalCourses} courses in ${academies.length} specialized academies, and a free 3-minute assessment that recommends 3, 5 and 7-course AI learning paths.

- Format: ${CATALOGUE_FACTS.format}
- Course length: ${durationSummary}
- Levels: ${levelTotals.filter(([, n]) => n).map(([l, n]) => `${l} (${n})`).join(', ')}
- Language: ${CATALOGUE_FACTS.language}${CATALOGUE_FACTS.translationAvailable ? ' (translation available)' : ''}
- Certification: ${CATALOGUE_FACTS.certification}
- Based in: ${COMPANY.country}
- Catalogue updated: ${CATALOGUE_DATE}
- Contact: contact@educutai.com (general), partners@educutai.com (partnerships), support@educutai.com (platform support)

## Main pages

- [Home](${SITE_URL}/): overview of EduCut.ai
- [All academies](${SITE_URL}/academies/): the ${academies.length} academies, a comparison of similar academies and FAQs
- [AI learning paths](${SITE_URL}/ai-learning-paths/): how the free assessment works and what it can recommend
- [Contact](${SITE_URL}/contact/): free consultation and catalogue request
${publishedGuides.map((g) => `- [${g.title}](${SITE_URL}/guides/${g.slug}/): ${g.description}`).join('\n')}

## Academies

${CLUSTERS.map((g) => `### ${g.title}\n\n${g.codes.map((c) => `- [${byCode[c].name}](${SITE_URL}/academies/${byCode[c].slug}/): ${byCode[c].courses.length} courses. ${byCode[c].summary}`).join('\n')}`).join('\n\n')}
`;

/* ---------------- Write ---------------- */

if (existsSync(join(ROOT, 'academies'))) rmSync(join(ROOT, 'academies'), { recursive: true });
write('academies/index.html', hubPage());
for (const a of academies) write(`academies/${a.slug}/index.html`, academyPage(a));
write('ai-learning-paths/index.html', pathsPage());
write('contact/index.html', contactPage());
write('404.html', notFoundPage());
if (existsSync(join(ROOT, 'guides'))) rmSync(join(ROOT, 'guides'), { recursive: true });
write('guides/index.html', guidesIndexPage());
for (const g of GUIDES) write(`guides/${g.slug}/index.html`, guidePage(g));
write('about/index.html', aboutPage());
for (const k of ['privacy', 'terms']) if (existsSync(join(ROOT, k))) rmSync(join(ROOT, k), { recursive: true });
for (const [k, v] of LEGAL_PAGES) write(`${k}/index.html`, legalPage(k, v));
write('robots.txt', ROBOTS);
write('sitemap.xml', SITEMAP);
write('llms.txt', LLMS_TXT);

const FOOTER_START = /<!-- site-footer:start[^>]*-->/;
const FOOTER_END = '<!-- site-footer:end -->';
const fs = index.search(FOOTER_START);
const fe = index.indexOf(FOOTER_END);
if (fs < 0 || fe < fs) throw new Error('index.html: site-footer markers not found');
const startTag = index.match(FOOTER_START)[0];
index = index.slice(0, fs) + startTag + '\n' + footer() + '\n' + index.slice(fe);

const HEAD_START = /<!-- seo-head:start[^>]*-->/;
const HEAD_END = '<!-- seo-head:end -->';
const hs = index.search(HEAD_START);
const he = index.indexOf(HEAD_END);
if (hs < 0 || he < hs) throw new Error('index.html: seo-head markers not found');
const headTag = index.match(HEAD_START)[0];
const homeHead = seoHead({
  path: '/',
  title: HOME_SEO.title,
  description: HOME_SEO.description.replace('{a}', academies.length).replace('{n}', totalCourses),
});
// Homepage "What is EduCut.ai?" block: a self-contained definition and a
// facts table AI systems can quote. Lives between the about-block markers.
const ABOUT_BLOCK = `<section class="about-section" id="about" aria-labelledby="about-title"><div class="wrap">
    <div class="section-head"><div><div class="mono" style="color:var(--blue);margin-bottom:14px">EduCut.ai at a glance</div><h2 id="about-title">What is EduCut.ai?</h2></div>
    <p class="about-lead">EduCut.ai is an AI training provider for companies, universities and professionals. Its catalogue of ${totalCourses} courses is organized into ${academies.length} specialized academies — from AI foundations, generative AI and prompt engineering to AI for business functions, LLM engineering, RAG, AI agents, responsible AI, governance, security and transformation. A free 3-minute assessment recommends Essential, Accelerate and Transform learning paths of 3, 5 and 7 courses.</p></div>
    <table class="facts"><tbody>
      <tr><th scope="row">Catalogue</th><td>${totalCourses} courses in ${academies.length} academies — <a href="/academies/">browse the academies</a></td></tr>
      <tr><th scope="row">Levels</th><td>${esc(levelTotals.filter(([, n]) => n).map(([l, n]) => `${l} (${n})`).join(' · '))}</td></tr>
      <tr><th scope="row">Course length</th><td>${esc(durationSummary)}</td></tr>
      <tr><th scope="row">Format</th><td>${esc(CATALOGUE_FACTS.format)}</td></tr>
      <tr><th scope="row">Language</th><td>${esc(CATALOGUE_FACTS.language)}${CATALOGUE_FACTS.translationAvailable ? ' (translation available)' : ''}</td></tr>
      <tr><th scope="row">Certification</th><td>${esc(CATALOGUE_FACTS.certification)}</td></tr>
      <tr><th scope="row">Free assessment</th><td>20 questions, about 3 minutes: AI readiness score and 3, 5 and 7-course paths — <a href="/ai-learning-paths/">how it works</a></td></tr>
      <tr><th scope="row">Free consultation</th><td>One-hour call, or the full catalogue by email — <a href="/contact/">contact EduCut.ai</a></td></tr>
      <tr><th scope="row">Based in</th><td>${esc(COMPANY.country)}</td></tr>
      <tr><th scope="row">Contact</th><td>partners@educutai.com (partnerships, universities, companies) · support@educutai.com (platform support) · contact@educutai.com (general enquiries)</td></tr>
    </tbody></table>
  </div></section>`;

const AB_START = /<!-- about-block:start[^>]*-->/;
const AB_END = '<!-- about-block:end -->';
const abs = index.search(AB_START), abe = index.indexOf(AB_END);
if (abs < 0 || abe < abs) throw new Error('index.html: about-block markers not found');
index = index.slice(0, abs) + index.match(AB_START)[0] + '\n  ' + ABOUT_BLOCK + '\n  ' + index.slice(abe);

// The homepage's built-in academy copy is what first-time visitors see
// before the live catalogue loads; keep it identical to the catalogue data.
const FALLBACK_RE = /const academyDetailsFallback = (\{.*?\});\n/;
const fallbackMatch = index.match(FALLBACK_RE);
if (!fallbackMatch) throw new Error('index.html: academyDetailsFallback not found');
const fallback = Object.fromEntries(academies.map((a) => [a.code, {
  ...(JSON.parse(fallbackMatch[1])[a.code] || {}),
  title: a.name, summary: a.summary, topics: a.topics, audience: a.audience,
  count: plural(a.courses.length, 'course'),
}]));
index = index.replace(FALLBACK_RE, () => `const academyDetailsFallback = ${JSON.stringify(fallback)};\n`);

// Keep the homepage stats strip in line with the catalogue.
index = index.replace(/(<strong data-stat="courses">)[^<]*(<\/strong>)/, `$1${totalCourses}$2`)
  .replace(/(<strong data-stat="academies">)[^<]*(<\/strong>)/, `$1${academies.length}$2`);

const homeLd = structuredData({ path: '/', title: HOME_SEO.title, description: HOME_SEO.description.replace('{a}', academies.length).replace('{n}', totalCourses) });
index = index.slice(0, hs) + headTag + '\n  ' + homeHead + '\n  ' + homeLd + '\n  ' + index.slice(he);
write('index.html', index);

// --i18n-kit: export every page-level string for translation.
if (process.argv.includes('--i18n-kit')) {
  const words = (x) => stripTags(String(x)).split(/\s+/).filter(Boolean).length;
  const phase1 = {
    // The homepage is the application itself (assessment, sign-in,
    // dashboards); only its search snippet is listed here. Translating its
    // interface is a separate piece of work.
    pages: [{ path: '/', title: HOME_SEO.title, description: HOME_SEO.description.replace('{a}', academies.length).replace('{n}', totalCourses), h1: 'Build the right AI path for your company.' }, ...KIT_PAGES],
    academies: academies.map((a) => ({ code: a.code, name: a.name, summary: a.summary, audience: a.audience, topics: a.topics })),
    faqs: { '/academies/': HUB_FAQ.map(([q, a]) => ({ q, a })), '/ai-learning-paths/': PATHS_FAQ.map(([q, a]) => ({ q, a })) },
    comparisons: COMPARISONS,
  };
  const phase2 = { courses: allCourses.map((c) => ({ code: c.code, name: c.name, programme: c.programme })) };
  // Words of translatable text; codes and paths are not translated.
  const count = (o) => typeof o === 'string' ? words(o)
    : Array.isArray(o) ? o.reduce((n, x) => n + count(x), 0)
    : o && typeof o === 'object' ? Object.entries(o).reduce((n, [k, v]) => n + (k === 'code' || k === 'path' ? 0 : count(v)), 0) : 0;
  write('content/i18n/translation-kit.json', JSON.stringify({
    note: 'Source strings for translation. Phase 1 = core pages and academies; phase 2 = course programmes. Translate meaning and search terms, not word for word.',
    exported: new Date().toISOString().slice(0, 10), phase1, phase2,
  }, null, 2) + '\n');
  console.log(`Translation kit: content/i18n/translation-kit.json (phase 1 ≈ ${count(phase1)} words, phase 2 ≈ ${count(phase2)} words).`);
}

console.log(`Built ${academies.length} academy pages (${totalCourses} courses), hub, paths, contact and 404 pages, robots.txt and sitemap.xml (${PUBLIC_PATHS.length} URLs); refreshed index.html.`);
