// Polite fetcher used for every crawl request.
// - robots.txt is honoured (RFC 9309): 4xx = no rules, 5xx/unreachable = treat the whole site as disallowed.
// - One request at a time per host, spaced by max(1 / rate_limit_rps, Crawl-delay).
// - Retries network errors, 429 and 5xx with exponential backoff + jitter, honouring Retry-After.
// - 401/403, login walls and CAPTCHA / anti-bot challenges are reported as `blocked` and never retried
//   or worked around.
// - After N consecutive failures a host is skipped for the rest of the run.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHALLENGE = /captcha|cf-chl|challenge-platform|are you a robot|verify you are human|access denied|bot detection|perimeterx|datadome/i;

export function parseRobots(text, agent) {
  // Group rules by user-agent; pick the group naming our agent token, else '*'.
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [], delay: null }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (k === 'allow' || k === 'disallow') current.rules.push({ allow: k === 'allow', path: value });
    if (k === 'crawl-delay') current.delay = Number(value) || null;
  }
  const token = agent.toLowerCase().split('/')[0];
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && token.startsWith(a))) ?? groups.find((g) => g.agents.includes('*'));
  return group ?? { agents: [], rules: [], delay: null };
}

const ruleRegex = (p) =>
  new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));

export function robotsAllows(group, pathWithQuery) {
  // Longest matching rule wins; on a tie, Allow wins. Empty Disallow means allow everything.
  let best = null;
  for (const r of group.rules) {
    if (!r.path) continue;
    if (!ruleRegex(r.path).test(pathWithQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

export class PoliteFetcher {
  constructor({ config, log = () => {}, cacheDir = null, rps = null }) {
    this.cfg = config.crawl;
    this.ua = this.cfg.user_agent;
    this.rps = rps ?? this.cfg.default_rate_limit_rps;
    this.log = log;
    this.cacheDir = cacheDir;
    this.robots = new Map(); // origin -> group | 'DISALLOW_ALL'
    this.nextSlot = new Map(); // host -> timestamp
    this.failures = new Map(); // host -> consecutive failures
    if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  }

  async #robotsFor(origin) {
    if (this.robots.has(origin)) return this.robots.get(origin);
    let group;
    try {
      const res = await this.#raw(`${origin}/robots.txt`, { robots: true });
      if (res.status >= 200 && res.status < 300) group = parseRobots(res.body, this.ua);
      else if (res.status >= 400 && res.status < 500) group = { agents: [], rules: [], delay: null };
      else group = 'DISALLOW_ALL';
      this.log('robots', { origin, status: res.status, rules: group === 'DISALLOW_ALL' ? 'disallow_all' : group.rules.length, crawl_delay: group.delay ?? null });
    } catch (e) {
      group = 'DISALLOW_ALL';
      this.log('robots', { origin, error: String(e.message ?? e), rules: 'disallow_all' });
    }
    this.robots.set(origin, group);
    return group;
  }

  async #wait(host, delaySec) {
    const interval = Math.max(1000 / this.rps, (delaySec ?? 0) * 1000);
    const at = Math.max(Date.now(), this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, at + interval);
    if (at > Date.now()) await sleep(at - Date.now());
  }

  async #raw(url, { robots = false } = {}) {
    const u = new URL(url);
    if (!robots) await this.#wait(u.host, this.robots.get(u.origin)?.delay);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeout_ms);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': this.ua, accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: ctrl.signal,
      });
      const body = await res.text();
      return { status: res.status, final_url: res.url, headers: Object.fromEntries(res.headers), body };
    } finally {
      clearTimeout(t);
    }
  }

  // Whether robots.txt lets us fetch this URL (fetches robots.txt once per origin).
  async allowed(url) {
    const u = new URL(url);
    const group = await this.#robotsFor(u.origin);
    return group !== 'DISALLOW_ALL' && robotsAllows(group, u.pathname + u.search);
  }

  // Returns { ok, url, final_url, status, body, content_type, blocked, reason, attempts, from_cache }.
  async get(url) {
    const u = new URL(url);
    const host = u.host;
    if ((this.failures.get(host) ?? 0) >= this.cfg.domain_failure_threshold) {
      return { ok: false, url, blocked: true, reason: 'host skipped after repeated failures this run' };
    }
    const group = await this.#robotsFor(u.origin);
    if (group === 'DISALLOW_ALL' || !robotsAllows(group, u.pathname + u.search)) {
      this.log('fetch.blocked', { url, reason: 'robots.txt' });
      return { ok: false, url, blocked: true, reason: 'disallowed by robots.txt' };
    }

    const cacheFile = this.cacheDir && join(this.cacheDir, createHash('sha256').update(url).digest('hex').slice(0, 24) + '.json');
    if (cacheFile && existsSync(cacheFile)) return { ...JSON.parse(readFileSync(cacheFile, 'utf8')), from_cache: true };

    const { attempts, base_delay_ms, max_delay_ms } = this.cfg.retry;
    let last;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const started = Date.now();
      try {
        const res = await this.#raw(url);
        const ms = Date.now() - started;
        const content_type = res.headers['content-type'] ?? '';
        if (res.status === 401 || res.status === 403 || ((res.status === 503 || res.status === 429) && CHALLENGE.test(res.body.slice(0, 20000)))) {
          this.log('fetch.blocked', { url, status: res.status, ms, attempt });
          this.failures.set(host, (this.failures.get(host) ?? 0) + 1);
          return { ok: false, url, status: res.status, blocked: true, reason: `access restricted (HTTP ${res.status}); not bypassed`, attempts: attempt };
        }
        if (res.status === 429 || res.status >= 500) {
          last = { ok: false, url, status: res.status, reason: `HTTP ${res.status}` };
          const retryAfter = Number(res.headers['retry-after']);
          const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(max_delay_ms, base_delay_ms * 2 ** (attempt - 1));
          this.log('fetch.retry', { url, status: res.status, attempt, wait_ms: wait });
          if (attempt < attempts) await sleep(wait + Math.random() * 500);
          continue;
        }
        if (res.status >= 200 && res.status < 300 && CHALLENGE.test(res.body.slice(0, 5000)) && res.body.length < 20000) {
          this.log('fetch.blocked', { url, status: res.status, reason: 'challenge page' });
          return { ok: false, url, status: res.status, blocked: true, reason: 'anti-bot challenge page; not bypassed', attempts: attempt };
        }
        this.failures.set(host, 0);
        const out = { ok: res.status >= 200 && res.status < 300, url, final_url: res.final_url, status: res.status, content_type, body: res.body, attempts: attempt };
        this.log('fetch', { url, status: res.status, bytes: res.body.length, ms, attempt });
        if (cacheFile && out.ok) writeFileSync(cacheFile, JSON.stringify(out));
        return out;
      } catch (e) {
        last = { ok: false, url, reason: String(e.cause?.code ?? e.message ?? e) };
        const wait = Math.min(max_delay_ms, base_delay_ms * 2 ** (attempt - 1));
        this.log('fetch.error', { url, attempt, error: last.reason, wait_ms: wait });
        if (attempt < attempts) await sleep(wait + Math.random() * 500);
      }
    }
    this.failures.set(host, (this.failures.get(host) ?? 0) + 1);
    return { ...last, attempts };
  }
}
