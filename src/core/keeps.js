import { createKeep, createCollection } from './models.js';
import { UserError } from './errors.js';
import { classify, normalizeUrl, splitShare } from '../capture/classify.js';
import { createBus } from './events.js';
import { FILTERS } from '../capture/classify.js';

const DAY = 86400000;
export const BIN_DAYS = 30;

/**
 * Everything the screens do with Keeps and Collections. Storage and events only; no UI here.
 * @param {ReturnType<typeof import('../storage/repository.js').createRepository>} repo
 */
export function createKeepService(repo) {
  const bus = createBus();
  const changed = (what) => bus.emit('changed', what);

  /** Save a Keep right away. Reading, thumbnails and summaries come after and never block this. */
  async function add(input) {
    const raw = (input.text || '').trim();
    const split = splitShare(raw);
    const url = (input.url || split.url || '').trim();
    const note = (input.note ?? split.note ?? '').trim();
    if (!url && !note && !input.file) throw new UserError('Add a link or a note to keep.', { code: 'empty_keep' });
    const info = url ? classify(url) : { kind: input.file ? (input.file.mime === 'application/pdf' ? 'pdf' : 'image') : 'note', label: input.file ? (input.file.mime === 'application/pdf' ? 'PDF' : 'Image') : 'Note', host: '' };
    if (url) {
      const norm = normalizeUrl(url);
      const dup = (await repo.keeps.all()).find((k) => k.url && !k.deletedAt && normalizeUrl(k.url) === norm);
      if (dup) return { keep: dup, duplicate: true };
    }
    const k = createKeep({ url, note, why: input.why || '', title: input.title || '', source: input.source || info.label, kind: info.kind });
    if (!k.title) k.title = input.file?.name || (url ? info.host || url : note.split('\n')[0].slice(0, 80));
    if (input.file) { k.meta.file = { name: input.file.name || 'file', mime: input.file.mime, size: input.file.size || 0 }; await repo.chunks.put({ id: `file:${k.id}`, blob: input.file.blob }); }
    await repo.keeps.put(k);
    changed({ type: 'add', id: k.id });
    return { keep: k, duplicate: false };
  }

  async function update(id, patch) {
    const k = await repo.keeps.get(id);
    if (!k) throw new UserError('That Keep is no longer here.', { code: 'missing' });
    const n = { ...k, ...patch, updatedAt: Date.now() };
    if (patch.tags) n.tags = [...new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    await repo.keeps.put(n);
    changed({ type: 'update', id });
    return n;
  }

  const archive = (id) => update(id, { archivedAt: Date.now() });
  const unarchive = (id) => update(id, { archivedAt: null });
  const trash = (id) => update(id, { deletedAt: Date.now() });
  const restore = (id) => update(id, { deletedAt: null, archivedAt: null });

  async function purge(id) {
    await repo.keeps.delete(id);
    await repo.chunks.delete(`file:${id}`);
    for (const c of await repo.collections.all()) if (c.keepIds.includes(id)) await repo.collections.put({ ...c, keepIds: c.keepIds.filter((x) => x !== id) });
    changed({ type: 'purge', id });
  }

  /** Remove bin items older than 30 days. */
  async function sweepBin(now = Date.now()) {
    const old = (await repo.keeps.all()).filter((k) => k.deletedAt && now - k.deletedAt > BIN_DAYS * DAY);
    for (const k of old) await purge(k.id);
    return old.length;
  }

  /**
   * @param {{view?: 'active'|'archive'|'bin', filter?: string, collection?: string, tag?: string, sort?: 'new'|'old'|'title', status?: string}} [o]
   */
  async function list(o = {}) {
    const view = o.view || 'active';
    let out = await repo.keeps.all();
    out = out.filter((k) => (view === 'bin' ? k.deletedAt : view === 'archive' ? !k.deletedAt && k.archivedAt : !k.deletedAt && !k.archivedAt));
    const f = FILTERS.find((x) => x.id === o.filter);
    if (f && f.kinds) out = out.filter((k) => f.kinds.includes(k.kind));
    if (o.tag) out = out.filter((k) => k.tags.includes(o.tag));
    if (o.status) out = out.filter((k) => k.status === o.status);
    if (o.collection) { const c = await repo.collections.get(o.collection); const ids = new Set(c ? c.keepIds : []); out = out.filter((k) => ids.has(k.id)); }
    const sort = o.sort || 'new';
    out.sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title) : sort === 'old' ? (a, b) => a.createdAt - b.createdAt : (a, b) => b.createdAt - a.createdAt);
    return out;
  }

  async function tags() {
    const m = new Map();
    for (const k of await list()) for (const t of k.tags) m.set(t, (m.get(t) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ tag: t, n }));
  }

  const collections = () => repo.collections.all().then((a) => a.sort((x, y) => x.name.localeCompare(y.name)));
  async function addCollection(name) { const c = createCollection(name); await repo.collections.put(c); changed({ type: 'collection' }); return c; }
  async function renameCollection(id, name) { const c = await repo.collections.get(id); if (!name.trim()) throw new UserError('Give the collection a name.'); await repo.collections.put({ ...c, name: name.trim(), updatedAt: Date.now() }); changed({ type: 'collection' }); }
  /** Deleting a Collection never deletes Keeps. */
  async function deleteCollection(id) { await repo.collections.delete(id); changed({ type: 'collection' }); }
  async function addToCollection(id, keepIds) { const c = await repo.collections.get(id); await repo.collections.put({ ...c, keepIds: [...new Set([...c.keepIds, ...keepIds])], updatedAt: Date.now() }); changed({ type: 'collection' }); }
  async function removeFromCollection(id, keepIds) { const c = await repo.collections.get(id); await repo.collections.put({ ...c, keepIds: c.keepIds.filter((x) => !keepIds.includes(x)), updatedAt: Date.now() }); changed({ type: 'collection' }); }
  async function collectionsOf(keepId) { return (await repo.collections.all()).filter((c) => c.keepIds.includes(keepId)); }

  async function bulk(ids, action, arg) {
    for (const id of ids) {
      if (action === 'archive') await archive(id);
      else if (action === 'trash') await trash(id);
      else if (action === 'restore') await restore(id);
      else if (action === 'purge') await purge(id);
      else if (action === 'tag') { const k = await repo.keeps.get(id); await update(id, { tags: [...k.tags, arg] }); }
    }
    if (action === 'collection') await addToCollection(arg, ids);
  }

  return { bus, add, update, get: (id) => repo.keeps.get(id), archive, unarchive, trash, restore, purge, sweepBin, list, tags, collections, addCollection, renameCollection, deleteCollection, addToCollection, removeFromCollection, collectionsOf, bulk, repo };
}
