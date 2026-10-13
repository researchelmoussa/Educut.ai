// links.txt: one URL per line, optional " | adapter=... | follow=..." settings, '#' comments.
export function parseLinks(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [url, ...opts] = l.split(/\s+\|\s+/);
      const o = Object.fromEntries(opts.map((x) => x.split('=').map((s) => s.trim())));
      return { url: url.replace(/^<|>$/g, ''), adapter: o.adapter ?? 'auto', follow: o.follow ?? null };
    })
    .filter((s) => /^https?:\/\//.test(s.url));
}
