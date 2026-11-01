/** Sortable ids: a fixed-width time part then a random part, so ids sort by creation time. */
const ALPHA = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * @param {string} [prefix] short type prefix, for example "k" for a Keep
 * @param {number} [now] epoch milliseconds (injectable for tests)
 * @returns {string}
 */
export function newId(prefix = 'k', now = Date.now()) {
  let t = '';
  let n = Math.floor(now);
  for (let i = 0; i < 9; i++) { t = ALPHA[n % 32] + t; n = Math.floor(n / 32); }
  const bytes = new Uint8Array(6);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let r = '';
  for (const b of bytes) r += ALPHA[b % 32];
  return `${prefix}_${t}${r}`;
}
