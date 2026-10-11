// Location imagery for the card's photo band: one documentary photograph of a recognisable landmark
// of the opportunity's city (e.g. Geneva -> Jet d'Eau). Photos come from Wikimedia Commons with a
// free licence and are credited on the card; the library is cached in connect/assets/landmarks/.
// When nothing suitable is found the card falls back to the neutral band; nothing is invented.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONNECT_DIR, normText, readJson, writeJson } from './util.mjs';

const DIR = join(CONNECT_DIR, 'assets', 'landmarks');
const INDEX = join(DIR, 'landmarks.json');

// Default subject per city. The Designer agent may pass any other well-known landmark with --query.
export const DEFAULT_LANDMARKS = {
  geneva: "Jet d'Eau Geneva", lausanne: 'Lausanne Cathedral', zurich: 'Grossmünster Zürich', bern: 'Zytglogge Bern', basel: 'Basel Minster Rhine',
  paris: 'Eiffel Tower', lyon: 'Basilica of Notre-Dame de Fourvière', london: 'Tower Bridge London', cambridge: "King's College Chapel Cambridge",
  oxford: 'Radcliffe Camera Oxford', edinburgh: 'Edinburgh Castle', dublin: "Ha'penny Bridge Dublin", berlin: 'Brandenburg Gate',
  munich: 'Munich Frauenkirche', amsterdam: 'Amsterdam canal houses', brussels: 'Atomium Brussels', vienna: 'St. Stephen\'s Cathedral Vienna',
  rome: 'Colosseum Rome', milan: 'Milan Cathedral', madrid: 'Puerta de Alcalá Madrid', barcelona: 'Sagrada Família', lisbon: 'Belém Tower',
  copenhagen: 'Nyhavn Copenhagen', stockholm: 'Gamla stan Stockholm', oslo: 'Oslo Opera House', helsinki: 'Helsinki Cathedral',
  dubai: 'Burj Khalifa', 'abu dhabi': 'Sheikh Zayed Grand Mosque', doha: 'Doha skyline Corniche', riyadh: 'Kingdom Centre Riyadh',
  'new york': 'Manhattan skyline', boston: 'Boston Back Bay skyline', 'san francisco': 'Golden Gate Bridge', washington: 'United States Capitol',
  toronto: 'CN Tower Toronto', montreal: 'Notre-Dame Basilica Montreal', singapore: 'Marina Bay Singapore', tokyo: 'Tokyo Tower',
  sydney: 'Sydney Opera House', casablanca: 'Hassan II Mosque', rabat: 'Hassan Tower Rabat', cairo: 'Giza pyramids',
};

// Free licences only; "fair use" or unknown licences are never used.
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? \d(\.\d)?)/i;

export const loadIndex = () => readJson(INDEX, { entries: [] });
const key = (city, cc) => `${(cc ?? '').toLowerCase()}-${normText(city).replace(/ /g, '-')}`;

export function findLandmark(city, countryCode) {
  if (!city) return null;
  const e = loadIndex().entries.find((x) => x.key === key(city, countryCode));
  return e && existsSync(join(DIR, e.file)) ? { ...e, path: join(DIR, e.file) } : null;
}

const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Register a photo supplied by the administrator (e.g. downloaded from Drive "EduCut Connect/Landmarks").
export function addLandmark(city, countryCode, file, { landmark, credit, license, sourceUrl }) {
  mkdirSync(DIR, { recursive: true });
  const ext = file.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const name = `${key(city, countryCode)}.${ext}`;
  writeFileSync(join(DIR, name), readFileSync(file));
  const entry = {
    key: key(city, countryCode), city, country_code: countryCode, landmark: landmark ?? null, file: name,
    license: license ?? 'Provided by EduCut (rights confirmed by administrator)', license_url: null,
    credit: credit ?? null, source_url: sourceUrl ?? null, kind: 'photo', added_at: new Date().toISOString(),
  };
  const idx = loadIndex();
  idx.entries = idx.entries.filter((e) => e.key !== entry.key).concat(entry);
  writeJson(INDEX, idx);
  return { ...entry, path: join(DIR, name) };
}

// Search Wikimedia Commons for a freely licensed landscape photo, download it, add it to the library.
export async function fetchLandmark(city, countryCode, { query, userAgent }) {
  const q = query ?? DEFAULT_LANDMARKS[normText(city)] ?? `${city} landmark`;
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: '1600',
  }).forEach(([k, v]) => api.searchParams.set(k, v));
  const res = await fetch(api, { headers: { 'user-agent': userAgent } });
  if (!res.ok) throw new Error(`Commons search failed: HTTP ${res.status}`);
  const pages = Object.values((await res.json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!ii || !/jpeg|png/.test(ii.mime) || !ALLOWED.test(license)) continue;
    if (ii.width < 1200 || ii.width < ii.height) continue; // landscape, large enough for a 1080px band
    const img = await fetch(ii.thumburl ?? ii.url, { headers: { 'user-agent': userAgent } });
    if (!img.ok) continue;
    mkdirSync(DIR, { recursive: true });
    const file = `${key(city, countryCode)}.${ii.mime.includes('png') ? 'png' : 'jpg'}`;
    writeFileSync(join(DIR, file), Buffer.from(await img.arrayBuffer()));
    const artist = strip(meta.Artist?.value) || 'Unknown author';
    const entry = {
      key: key(city, countryCode),
      city,
      country_code: countryCode,
      landmark: q,
      file,
      license,
      license_url: strip(meta.LicenseUrl?.value) || null,
      credit: `Photo: ${artist} · ${license} · Wikimedia Commons`,
      source_url: ii.descriptionurl,
      kind: 'photo',
      added_at: new Date().toISOString(),
    };
    const idx = loadIndex();
    idx.entries = idx.entries.filter((e) => e.key !== entry.key).concat(entry);
    writeJson(INDEX, idx);
    return { ...entry, path: join(DIR, file) };
  }
  return null;
}
