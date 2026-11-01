import { newId } from './ids.js';
import { STATUS } from './processing.js';
import { UserError } from './errors.js';

/**
 * @typedef {{id: string, url: string, title: string, source: string, why: string, note: string, tags: string[], status: string, thumb: string|null, createdAt: number, updatedAt: number, archivedAt: number|null}} Keep
 */

/**
 * Build a new Keep. A Keep needs a link or a note.
 * @param {{url?: string, title?: string, source?: string, why?: string, note?: string, tags?: string[]}} input
 * @param {number} [now]
 * @returns {Keep}
 */
export function createKeep(input, now = Date.now()) {
  const url = (input.url || '').trim();
  const note = (input.note || '').trim();
  if (!url && !note) throw new UserError('Add a link or a note to keep.', { code: 'empty_keep' });
  return {
    id: newId('k', now),
    url,
    title: (input.title || '').trim(),
    source: input.source || (url ? 'link' : 'note'),
    why: input.why || '',
    note,
    tags: [...new Set((input.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
    status: STATUS.SAVED,
    thumb: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

/** @param {string} name @param {number} [now] */
export function createCollection(name, now = Date.now()) {
  const n = (name || '').trim();
  if (!n) throw new UserError('Give the collection a name.', { code: 'empty_name' });
  return { id: newId('c', now), name: n, keepIds: [], createdAt: now, updatedAt: now };
}
