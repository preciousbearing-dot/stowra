import { tokensFor } from './tokens.js';

/** First launch look, decided with Precious: Advanced, Bright light. */
export const DEFAULT_PREFS = Object.freeze({ style: 'advanced', theme: 'bright', mode: 'light', onboarded: false });

/**
 * Turn the user's choice into one of the five variants.
 * Night is always dark. Paper and Bright follow `mode` ("light", "dark" or "system").
 * @param {{theme: string, mode: string}} prefs
 * @param {boolean} systemDark
 * @returns {string}
 */
export function resolveVariant(prefs, systemDark) {
  if (prefs.theme === 'night') return 'night';
  const dark = prefs.mode === 'dark' || (prefs.mode === 'system' && systemDark);
  const base = prefs.theme === 'paper' ? 'paper' : 'bright';
  return base + (dark ? 'Dark' : 'Light');
}

/**
 * Apply tokens to a document so every screen picks them up.
 * @param {Document} doc
 * @param {Record<string,string>} tokens
 * @param {string} variant
 * @param {string} style
 */
export function applyTheme(doc, tokens, variant, style) {
  const root = doc.documentElement;
  for (const [k, v] of Object.entries(tokens)) if (k !== 'scheme') root.style.setProperty(`--${k}`, v);
  root.style.colorScheme = tokens.scheme;
  root.dataset.variant = variant;
  root.dataset.style = style;
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tokens.bg);
}

/** @param {Window} win @returns {boolean} */
export function systemPrefersDark(win) {
  return Boolean(win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches);
}

/**
 * Resolve prefs, apply them, and return what was applied.
 * @param {Document} doc @param {Window} win @param {{style: string, theme: string, mode: string}} prefs
 */
export function applyPrefs(doc, win, prefs) {
  const variant = resolveVariant(prefs, systemPrefersDark(win));
  const tokens = tokensFor(variant, prefs.style);
  applyTheme(doc, tokens, variant, prefs.style);
  return { variant, tokens };
}
