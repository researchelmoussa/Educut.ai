// Direct Google Drive uploads (REST v3) for the daily run.
// Binary files (PNGs) are too large to pass through a chat connector efficiently, so the run uploads
// them here when OAuth credentials are configured as environment secrets:
//   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN   (scope: https://www.googleapis.com/auth/drive)
// Without them, `driveAvailable()` is false and the orchestrator falls back to the Google Drive connector.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const FOLDER = 'application/vnd.google-apps.folder';
let cachedToken = null;

export const driveAvailable = () =>
  Boolean(process.env.GDRIVE_CLIENT_ID && process.env.GDRIVE_CLIENT_SECRET && process.env.GDRIVE_REFRESH_TOKEN);

async function token() {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GDRIVE_CLIENT_ID,
      client_secret: process.env.GDRIVE_CLIENT_SECRET,
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Drive auth failed: ${j.error ?? res.status} ${j.error_description ?? ''}`);
  cachedToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedToken.value;
}

async function api(url, init = {}, attempt = 1) {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${await token()}`, ...init.headers } });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    return api(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`Drive ${init.method ?? 'GET'} ${url.split('?')[0]} -> ${res.status} ${await res.text()}`);
  return res;
}

const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function findChild(parentId, name, { folder = false } = {}) {
  const query = `name = '${q(name)}' and '${parentId}' in parents and trashed = false${folder ? ` and mimeType = '${FOLDER}'` : ''}`;
  const res = await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return (await res.json()).files[0] ?? null;
}

export async function ensureFolder(parentId, name) {
  const existing = await findChild(parentId, name, { folder: true });
  if (existing) return existing;
  const res = await api('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
  });
  return res.json();
}

// Creates the file, or replaces the content of a same-named file in the folder (keeping its link).
export async function upload(parentId, filePath, mimeType, name = basename(filePath)) {
  const existing = await findChild(parentId, name);
  const boundary = 'educutconnect' + Date.now();
  const meta = existing ? { name } : { name, parents: [parentId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`),
    readFileSync(filePath),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true';
  const res = await api(url, { method: existing ? 'PATCH' : 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body });
  return res.json();
}

export async function download(fileId) {
  const res = await api(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await res.arrayBuffer());
}
