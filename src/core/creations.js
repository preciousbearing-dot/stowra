import { newId } from './ids.js';
import { createBus } from './events.js';

/** Creations: things made with Kiko. Linked to source Keeps by id. Deleting a Creation never deletes Keeps; deleting a Keep never deletes a Creation. */
export function createCreationService(repo) {
  const bus = createBus();
  return {
    bus,
    async add({ title, type, label, body, sources }) {
      const now = Date.now();
      const c = { id: newId('r', now), title: (title || label || 'Creation').slice(0, 120), type: type || 'note', label: label || 'Note', body: body || '', sources: sources || [], createdAt: now, updatedAt: now };
      await repo.creations.put(c); bus.emit('changed'); return c;
    },
    get: (id) => repo.creations.get(id),
    async list() { return (await repo.creations.all()).sort((a, b) => b.updatedAt - a.updatedAt); },
    async update(id, patch) { const c = await repo.creations.get(id); const n = { ...c, ...patch, updatedAt: Date.now() }; await repo.creations.put(n); bus.emit('changed'); return n; },
    async remove(id) { await repo.creations.delete(id); bus.emit('changed'); },
    /** Which of a Creation's sources still exist. @param {{sources: string[]}} c */
    async sourceStatus(c) { const out = []; for (const id of c.sources) { const k = await repo.keeps.get(id); out.push({ id, title: k && !k.deletedAt ? k.title : '', gone: !k || Boolean(k.deletedAt) }); } return out; },
  };
}
