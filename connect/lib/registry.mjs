// Opportunity registry: deduplication, state machine and audit trail.
// The registry is one JSON file. Its durable copy lives in Drive (EduCut Connect/Registry); each run
// downloads the latest version, works on a local copy, and uploads the new version at the end.
import { canonicalUrl, contentHash, fingerprint, nowIso, opportunityId, readJson, writeJson } from './util.mjs';

export const TRANSITIONS = {
  DISCOVERED: ['VERIFIED', 'CLOSED', 'NEEDS_REVIEW', 'REJECTED'],
  VERIFIED: ['CONTENT_GENERATED', 'NEEDS_REVIEW', 'CLOSED', 'EXPIRED', 'REJECTED'],
  CONTENT_GENERATED: ['UNDER_REVIEW', 'VERIFIED', 'NEEDS_REVIEW', 'CLOSED', 'EXPIRED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'VERIFIED', 'NEEDS_REVIEW', 'CLOSED', 'EXPIRED'],
  APPROVED: ['READY_TO_PUBLISH', 'NEEDS_REVIEW', 'CLOSED', 'EXPIRED'],
  READY_TO_PUBLISH: ['PUBLISHED', 'NEEDS_REVIEW', 'CLOSED', 'EXPIRED'],
  PUBLISHED: ['CLOSED', 'EXPIRED'],
  NEEDS_REVIEW: ['VERIFIED', 'CLOSED', 'EXPIRED', 'REJECTED'],
  CLOSED: [],
  EXPIRED: [],
  REJECTED: [],
};

export const ELIGIBLE_APPLICATION_STATUS = ['OPEN_CONFIRMED', 'OPEN_LIKELY'];

// A date-only deadline with no stated timezone is treated as ending at 23:59 in the last timezone on
// Earth (UTC-12), so nothing is expired while it might still be open somewhere.
export const deadlineEnd = (value) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59-12:00` : value);

export const emptyRegistry =() => ({ schema_version: '1.0', updated_at: nowIso(), opportunities: {}, seen_urls: {} });

export class Registry {
  constructor(file, log = () => {}) {
    this.file = file;
    this.log = log;
    this.data = readJson(file, emptyRegistry());
    this.data.seen_urls ??= {};
  }

  save() {
    this.data.updated_at = nowIso();
    writeJson(this.file, this.data);
  }

  get(id) {
    return this.data.opportunities[id];
  }

  // True when a posting or listing URL was already processed in any earlier run, whatever its outcome.
  // The Scout calls this before extracting a page, so known postings cost one lookup, not a fetch.
  isKnownUrl(url) {
    try {
      return Boolean(this.data.seen_urls[canonicalUrl(url)]);
    } catch {
      return false;
    }
  }

  markSeen(url, id) {
    this.data.seen_urls[canonicalUrl(url)] = id ?? true;
  }

  // Insert or update a verified record. Returns what happened so the run can count only genuinely new items.
  register(record, actor = 'opportunity-scout') {
    const id = opportunityId(record);
    if (record.id !== id) throw new Error(`record.id ${record.id} does not match computed id ${id}`);
    const fp = fingerprint(record);
    const hash = contentHash(record);
    if (record.content_hash !== hash) throw new Error(`record.content_hash is stale; expected ${hash}`);

    const dup = Object.values(this.data.opportunities).find((o) => o.fingerprint === fp && o.id !== id);
    for (const u of [record.source_url, record.application_url].filter(Boolean)) this.markSeen(u, dup?.id ?? id);
    if (dup) {
      this.log('dedup.fingerprint', { id, duplicate_of: dup.id });
      return { action: 'duplicate', id: dup.id };
    }

    const existing = this.get(id);
    const summary = {
      id,
      fingerprint: fp,
      title: record.title.value,
      institution: record.institution.name,
      city: record.location.city,
      country: record.location.country,
      source_url: record.source_url,
      source_list_url: record.source_list_url,
      application_url: record.application_url,
      application_status: record.application_status,
      deadline: record.deadline?.value ?? null,
      content_hash: hash,
      last_verified_at: record.last_verified_at,
    };

    if (!existing) {
      this.data.opportunities[id] = { ...summary, pipeline_status: 'DISCOVERED', first_seen: nowIso(), history: [] };
      this.#event(id, null, 'DISCOVERED', actor, 'first seen');
      const target = ELIGIBLE_APPLICATION_STATUS.includes(record.application_status)
        ? 'VERIFIED'
        : record.application_status === 'CLOSED' ? 'CLOSED' : 'NEEDS_REVIEW';
      this.transition(id, target, actor, `application_status=${record.application_status}`);
      return { action: 'new', id, pipeline_status: this.get(id).pipeline_status };
    }

    const changed = existing.content_hash !== hash;
    Object.assign(existing, summary);
    if (changed) {
      this.#event(id, existing.pipeline_status, existing.pipeline_status, actor, 'record content changed');
      // Content built from the old version is stale: send it back for regeneration.
      if (['CONTENT_GENERATED', 'UNDER_REVIEW', 'APPROVED', 'READY_TO_PUBLISH'].includes(existing.pipeline_status)) {
        this.transition(id, 'NEEDS_REVIEW', actor, 'source record changed after content was generated');
      }
    }
    if (record.application_status === 'CLOSED' && TRANSITIONS[existing.pipeline_status].includes('CLOSED')) {
      this.transition(id, 'CLOSED', actor, 'source reports closed');
    }
    return { action: changed ? 'updated' : 'unchanged', id, pipeline_status: existing.pipeline_status };
  }

  transition(id, to, actor, reason = '') {
    const o = this.get(id);
    if (!o) throw new Error(`unknown opportunity ${id}`);
    const from = o.pipeline_status;
    if (from === to) return o;
    if (!TRANSITIONS[from]?.includes(to)) throw new Error(`illegal transition ${from} -> ${to} for ${id}`);
    o.pipeline_status = to;
    this.#event(id, from, to, actor, reason);
    return o;
  }

  #event(id, from, to, actor, reason) {
    const e = { at: nowIso(), from, to, actor, reason };
    this.get(id).history.push(e);
    this.log('registry.transition', { id, ...e });
  }

  // Offer numbers name the Drive folders (Offer_001, Offer_002, ...). They are assigned once, when an
  // opportunity first gets content, and never reused, so folders from different days never collide.
  assignOfferNumber(id) {
    const o = this.get(id);
    if (!o) throw new Error(`unknown opportunity ${id}`);
    if (!o.offer_number) {
      this.data.last_offer_number = (this.data.last_offer_number ?? 0) + 1;
      o.offer_number = this.data.last_offer_number;
      this.log('registry.offer_number', { id, offer_number: o.offer_number });
    }
    return o.offer_number;
  }

  // Deadlines that have passed move to EXPIRED. Run at the start of every daily run.
  expire(today = new Date()) {
    const expired = [];
    for (const o of Object.values(this.data.opportunities)) {
      if (!o.deadline || !TRANSITIONS[o.pipeline_status].includes('EXPIRED')) continue;
      if (deadlineEnd(o.deadline) < today) {
        this.transition(o.id, 'EXPIRED', 'system', `deadline ${o.deadline} passed`);
        expired.push(o.id);
      }
    }
    return expired;
  }
}
