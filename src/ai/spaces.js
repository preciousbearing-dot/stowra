import { parseJsonLoose } from './json.js';
import { clusterVectors } from '../retrieval/hybrid.js';
import { heuristicSpaces } from '../core/discover.js';

/**
 * Groups worth a Space, named and described by AI. Groups come from meaning vectors when Smart search has them, otherwise from shared tags.
 * Only titles and tags go to the model. Nothing is created here; the person approves each one.
 * @param {{ai: any, smart: any, keeps: any[], existing: Set<string>}} o
 * @returns {Promise<{name: string, reason: string, keepIds: string[], byAi: boolean}[]>}
 */
export async function suggestSpacesAI({ ai, smart, keeps, existing }) {
  const live = keeps.filter((k) => !k.deletedAt && !k.archivedAt);
  const byId = new Map(live.map((k) => [k.id, k]));
  let groups = [];
  if (smart && smart.on) {
    const items = []; for (const k of live) { const v = await smart.vectorOf(k.id); if (v) items.push({ id: k.id, v }); }
    groups = clusterVectors(items).filter((g) => g.length >= 3).slice(0, 8);
  }
  if (!groups.length) return heuristicSpaces(keeps, existing).map((x) => ({ ...x, byAi: false }));
  if (!ai.ready()) return groups.map((ids) => ({ name: byId.get(ids[0]).title.slice(0, 40), reason: `${ids.length} Keeps are close in meaning`, keepIds: ids, byAi: false }));
  const listing = groups.map((ids, i) => `Group ${i + 1}:\n` + ids.slice(0, 12).map((id) => `- ${byId.get(id).title}${byId.get(id).tags.length ? ` [${byId.get(id).tags.slice(0, 4).join(', ')}]` : ''}`).join('\n')).join('\n\n');
  const system = 'You name groups of saved items. For each group give a short plain name (2 to 4 words, title case, no punctuation tricks) and one plain sentence saying what ties them together. Do not use dashes or emoji. Reply as JSON only: {"spaces":[{"group":1,"name":"","reason":""}]}';
  let named = [];
  try { const r = await ai.chat({ system, messages: [{ role: 'user', content: listing }], json: true, max: 900 }); named = (parseJsonLoose(r.text) || {}).spaces || []; } catch (e) { named = []; }
  const out = [];
  groups.forEach((ids, i) => {
    const n = named.find((x) => Number(x.group) === i + 1);
    const name = String((n && n.name) || '').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 40) || byId.get(ids[0]).title.slice(0, 40);
    if (existing.has(name.toLowerCase())) return;
    out.push({ name, reason: String((n && n.reason) || `${ids.length} Keeps are close in meaning`).replace(/[\u2013\u2014]/g, '-').slice(0, 160), keepIds: ids, byAi: Boolean(n) });
  });
  return out;
}
