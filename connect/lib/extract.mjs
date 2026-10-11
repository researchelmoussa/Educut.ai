// Dependency-free extraction from fetched pages. Nothing here guesses: every value returned is
// copied from the page, and the Scout cites the page URL as evidence.

const decode = (s) =>
  String(s ?? '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

export function pageText(html) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function pageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]).trim() : null;
}

export function links(html, baseUrl, follow = null) {
  const out = new Map();
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let url;
    try {
      url = new URL(decode(m[1]), baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/.test(url)) continue;
    if (follow && !new RegExp(follow).test(url)) continue;
    const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!out.has(url) || (text && !out.get(url))) out.set(url, text);
  }
  return [...out].map(([url, text]) => ({ url, text }));
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      /* malformed block: ignore, the page text is still available */
    }
  }
  const flat = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      flat.push(n);
      if (n['@graph']) walk(n['@graph']);
    }
  };
  walk(blocks);
  return flat;
}

const isType = (n, t) => [].concat(n['@type'] ?? []).some((x) => String(x).toLowerCase() === t.toLowerCase());
const str = (v) => (v == null ? null : typeof v === 'string' ? decode(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null);

// schema.org JobPosting -> raw fields (not yet a record). Values are exactly what the page publishes.
export function jobPostings(html) {
  return jsonLdBlocks(html)
    .filter((n) => isType(n, 'JobPosting'))
    .map((n) => {
      const org = [].concat(n.hiringOrganization ?? [])[0] ?? {};
      const locs = [].concat(n.jobLocation ?? []).map((l) => l?.address ?? {}).filter(Boolean);
      const salary = n.baseSalary?.value;
      return {
        title: str(n.title),
        institution_name: str(typeof org === 'string' ? org : org.name),
        institution_website: str(org.sameAs ?? org.url),
        institution_logo: str(typeof org.logo === 'string' ? org.logo : org.logo?.url),
        description_text: str(n.description),
        date_posted: str(n.datePosted),
        valid_through: str(n.validThrough),
        employment_type: [].concat(n.employmentType ?? []).map(String),
        remote: str(n.jobLocationType),
        locations: locs.map((a) => ({
          city: str(a.addressLocality),
          region: str(a.addressRegion),
          country: str(typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry?.name),
        })),
        apply_url: str(n.url ?? n.directApply?.url),
        qualifications: str(n.qualifications),
        skills: str(n.skills),
        experience: str(n.experienceRequirements?.description ?? n.experienceRequirements),
        education: str(n.educationRequirements?.credentialCategory ?? n.educationRequirements),
        salary: salary
          ? { currency: n.baseSalary?.currency ?? null, min: salary.minValue ?? salary.value ?? null, max: salary.maxValue ?? null, unit: salary.unitText ?? null }
          : null,
        identifier: str(n.identifier?.value ?? n.identifier),
      };
    });
}

export function feedItems(xml) {
  const items = [];
  const re = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const pick = (tag) => {
      const t = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return t ? decode(t[1].replace(/<!\[CDATA\[|\]\]>/g, '')).trim() : null;
    };
    const href = block.match(/<link[^>]*href\s*=\s*["']([^"']+)["']/i)?.[1];
    items.push({
      title: pick('title'),
      url: pick('link') || (href ? decode(href) : null),
      published: pick('pubDate') ?? pick('published') ?? pick('updated') ?? pick('dc:date'),
      summary: pick('description') ?? pick('summary'),
    });
  }
  return items.filter((i) => i.url);
}

// Candidate logo sources for the institution. The Designer still treats them as `not_verified`
// unless the domain is in the logo allowlist.
export function logoCandidates(html, baseUrl) {
  const out = [];
  const abs = (h) => {
    try {
      return new URL(decode(h), baseUrl).toString();
    } catch {
      return null;
    }
  };
  for (const m of html.matchAll(/<link[^>]+rel\s*=\s*["'][^"']*(apple-touch-icon|icon)[^"']*["'][^>]*>/gi)) {
    const h = m[0].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (h) out.push({ kind: m[1].toLowerCase(), url: abs(h) });
  }
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    if (!/logo/i.test(m[0])) continue;
    const h = m[0].match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
    if (h) out.push({ kind: 'img[logo]', url: abs(h) });
  }
  const og = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1];
  if (og) out.push({ kind: 'og:image', url: abs(og) });
  return out.filter((c) => c.url);
}

export const looksLikeFeed = (contentType, body) =>
  /xml|rss|atom/i.test(contentType ?? '') || /^\s*<\?xml[\s\S]{0,200}<(rss|feed)\b/i.test(body.slice(0, 500));
