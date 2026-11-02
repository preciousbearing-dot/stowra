import { retrieve } from './retrieve.js';
import { RULES, verify } from './trust.js';
import { UserError } from '../core/errors.js';

/** @typedef {{type: 'keep'|'keeps'|'collection'|'trove', ids?: string[], collectionId?: string, label: string}} Scope */

/** Resolve a scope to the Keeps inside it. The scope is shown on screen and never changes silently. @param {any} keeps @param {Scope} scope */
export async function keepsInScope(keeps, scope) {
  if (scope.type === 'trove') return keeps.list({});
  if (scope.type === 'collection') return keeps.list({ collection: scope.collectionId });
  const out = []; for (const id of scope.ids || []) { const k = await keeps.get(id); if (k && !k.deletedAt) out.push(k); }
  return out;
}

export function scopeLabel(scope, n) {
  return { trove: 'Whole Trove', keep: 'This Keep', keeps: `${(scope.ids || []).length} selected Keeps`, collection: `Collection: ${scope.label || ''}` }[scope.type] + (scope.type === 'trove' ? ` (${n})` : '');
}

/**
 * Ask Kiko. Only matching passages from the scope are sent. The answer is checked before it is shown.
 * @param {{ai: any, keeps: any}} d @param {{scope: Scope, question: string, history?: {role: string, content: string}[], signal?: AbortSignal}} o
 */
export async function ask({ ai, keeps }, o) {
  const inScope = await keepsInScope(keeps, o.scope);
  const q = o.question.trim();
  if (!q) throw new UserError('Type a question first.');
  const passages = retrieve(inScope, q);
  const ctx = passages.length ? passages.map((p) => `[${p.id}] From "${p.title}"${p.loc ? `, ${p.loc}` : ''}:\n${p.text}`).join('\n\n') : '(No passages in this scope matched the question.)';
  const history = (o.history || []).slice(-6);
  const { text, provider, model } = await ai.chat({ json: true, max: 1400, signal: o.signal, system: `${RULES}\n\nScope: ${o.scope.type === 'trove' ? 'the whole Trove' : o.scope.type === 'collection' ? `the Collection "${o.scope.label}"` : 'the selected Keeps'}. Keeps in scope: ${inScope.length}.`, messages: [...history, { role: 'user', content: `Passages from the user's Keeps:\n\n${ctx}\n\nQuestion: ${q}` }] });
  const v = verify(text, passages, inScope.map((k) => k.title));
  if (!passages.length) { v.parts = v.parts.map((p) => (p.source === 'keeps' ? { ...p, source: 'unsupported', cites: [] } : p)); v.noEvidence = true; }
  return { ...v, provider, model, sent: passages.length, scope: o.scope, inScope: inScope.length };
}

/** Turn a long natural-language question into keywords for the search box. */
export async function rewriteQuery(ai, question) {
  const { text } = await ai.chat({ max: 60, system: 'Turn the question into 2 to 6 search keywords separated by spaces. Reply with the keywords only.', messages: [{ role: 'user', content: question }] });
  return text.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Creation types and how to ask for each. */
export const CREATION_TYPES = [
  { id: 'note', label: 'Note', ask: 'Write a clear note' },
  { id: 'summary', label: 'Summary', ask: 'Write a concise summary' },
  { id: 'comparison', label: 'Comparison', ask: 'Write a comparison of the items, with a short list of differences' },
  { id: 'report', label: 'Research report', ask: 'Write a short research report with headings' },
  { id: 'checklist', label: 'Checklist', ask: 'Write a checklist, one action per line starting with "- "' },
  { id: 'plan', label: 'Project plan', ask: 'Write a project plan with phases and next steps' },
  { id: 'guide', label: 'Implementation guide', ask: 'Write a step by step implementation guide' },
  { id: 'reference', label: 'Reference sheet', ask: 'Write a compact reference sheet' },
  { id: 'terms', label: 'Terminology list', ask: 'Write a list of terms with one plain line of meaning each' },
];

/** Make a Creation from the Keeps in scope. Every claim should be backed by the passages; sources are saved with it. */
export async function makeCreation({ ai, keeps }, { scope, type, request }) {
  const t = CREATION_TYPES.find((x) => x.id === type) || CREATION_TYPES[0];
  const r = await ask({ ai, keeps }, { scope, question: `${t.ask}. ${request || ''}`.trim() });
  const body = r.parts.map((p) => p.text).join('\n\n');
  const sources = [...new Set(r.parts.flatMap((p) => p.cites.map((c) => c.keepId)))];
  return { body, sources, type: t.id, label: t.label, flagged: r.parts.some((p) => p.flagged || p.source === 'unsupported') };
}
