/** Models sometimes wrap JSON in prose or code fences. Pull the first object out, or return null. @param {string} s */
export function parseJsonLoose(s) {
  const t = String(s || '').replace(/```(?:json)?/gi, '');
  try { return JSON.parse(t); } catch (e) { /* try to find an object */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
  return null;
}
