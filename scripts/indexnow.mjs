#!/usr/bin/env node
/* ===================================================================
   IndexNow — tell Bing (and other IndexNow engines) which pages changed.

   Run after each deployment, once the new files are live:

     node scripts/indexnow.mjs                  every URL in sitemap.xml
     node scripts/indexnow.mjs /academies/ …    only these paths
     node scripts/indexnow.mjs --dry-run        print the request, send nothing

   The key is the name of the <key>.txt file at the site root, which must be
   deployed with the site (https://educutai.com/<key>.txt). Google does not
   use IndexNow; use Search Console for Google.

   Node 18+, no dependencies.
   =================================================================== */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'educutai.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const keyFiles = readdirSync(ROOT).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  console.error(`Expected exactly one IndexNow key file (<32 hex>.txt) at the site root, found ${keyFiles.length}.`);
  process.exit(1);
}
const key = keyFiles[0].slice(0, -4);
if (readFileSync(join(ROOT, keyFiles[0]), 'utf8').trim() !== key) {
  console.error(`${keyFiles[0]} must contain exactly its own key.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const paths = args.filter((a) => a.startsWith('/'));

const sitemapUrls = [...readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urlList = paths.length ? paths.map((p) => `https://${HOST}${p}`) : sitemapUrls;
const unknown = urlList.filter((u) => !sitemapUrls.includes(u));
if (unknown.length) {
  console.error(`Not in sitemap.xml (not public, or mistyped): ${unknown.join(', ')}`);
  process.exit(1);
}

const body = { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList };

if (dryRun) {
  console.log(`POST ${ENDPOINT}\n${JSON.stringify(body, null, 2)}`);
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
// 200 = accepted, 202 = accepted (key validation pending).
const meaning = {
  200: 'accepted', 202: 'accepted, key validation pending',
  400: 'bad request', 403: 'key not valid (is the key file deployed?)',
  422: 'URLs do not belong to the host or key mismatch', 429: 'too many requests — try later',
}[res.status] || 'unexpected response';
console.log(`IndexNow: ${res.status} ${meaning} — ${urlList.length} URL(s).`);
process.exit(res.ok ? 0 : 1);
