/**
 * Design tokens for every look. Source of truth: the design canvas and docs/design-bar.md.
 * Variants: night, paperDark, paperLight, brightLight, brightDark. Styles: simple, advanced.
 */
const SIMPLE = {
  night:       { scheme: 'dark',  bg: '#121110', sf: '#1A1816', rs: '#262321', ln: 'rgba(237,232,223,0.09)', tx: '#EDE8DF', t2: '#A9A398', mu: '#8E887D', ac: '#E9A53F', oa: '#1B1306' },
  paperDark:   { scheme: 'dark',  bg: '#17130E', sf: '#1F1A14', rs: '#2A241C', ln: 'rgba(255,244,220,0.09)', tx: '#F0E6D2', t2: '#B3A790', mu: '#978B75', ac: '#E2A04A', oa: '#1E1306' },
  paperLight:  { scheme: 'light', bg: '#F4EFE5', sf: '#FBF8F1', rs: '#ECE5D6', ln: 'rgba(33,28,21,0.10)',    tx: '#211C15', t2: '#5A5145', mu: '#6F6558', ac: '#9A5508', oa: '#FFFFFF' },
  brightLight: { scheme: 'light', bg: '#FFFFFF', sf: '#FFFFFF', rs: '#F4F2EF', ln: 'rgba(21,20,18,0.09)',    tx: '#151412', t2: '#55514B', mu: '#6B665F', ac: '#A85A05', oa: '#FFFFFF' },
  brightDark:  { scheme: 'dark',  bg: '#000000', sf: '#111111', rs: '#1C1C1C', ln: 'rgba(255,255,255,0.09)', tx: '#F5F5F4', t2: '#A8A7A3', mu: '#8C8B87', ac: '#F2A93B', oa: '#1B1306' },
};

/** Extra tokens for Advanced: bento tiles, metallic hero card, tonal bars. */
const ADVANCED = {
  night:       { bg: '#0A0908', tile: 'linear-gradient(160deg,#1A1816,#131110)', tileSh: 'inset 0 1px 0 rgba(255,255,255,0.05)', track: 'rgba(255,255,255,0.09)', hero: 'linear-gradient(150deg,#2E2B27,#1A1816 55%,#242120)', heroLn: 'rgba(255,255,255,0.12)', heroTx: '#F3EEE4', heroMu: '#B8B1A4', navBg: '#0A0908', ac: '#F0AE48' },
  paperDark:   { bg: '#15110D', tile: 'linear-gradient(160deg,#211C16,#1A1611)', tileSh: 'inset 0 1px 0 rgba(255,244,220,0.05)', track: 'rgba(255,244,220,0.09)', hero: 'linear-gradient(150deg,#322B22,#1F1A14 55%,#2A241C)', heroLn: 'rgba(255,244,220,0.13)', heroTx: '#F6ECD8', heroMu: '#BFB29A', navBg: '#15110D' },
  paperLight:  { bg: '#EFE8DA', tile: 'linear-gradient(160deg,#FBF8F1,#F4EEE2)', tileSh: '0 4px 14px rgba(60,40,10,0.08)', track: 'rgba(33,28,21,0.07)', hero: 'linear-gradient(150deg,#33302B,#1E1B17 55%,#2A2723)', heroLn: 'rgba(255,255,255,0.12)', heroTx: '#F6F1E6', heroMu: '#BDB5A6', navBg: '#EFE8DA' },
  brightLight: { bg: '#F6F5F3', tile: 'linear-gradient(160deg,#FFFFFF,#FAF9F7)', tileSh: '0 1px 2px rgba(21,20,18,0.06), 0 6px 18px rgba(21,20,18,0.06)', track: 'rgba(21,20,18,0.06)', hero: 'linear-gradient(150deg,#2B2A28,#141311 55%,#201F1D)', heroLn: 'rgba(255,255,255,0.12)', heroTx: '#F7F6F3', heroMu: '#B9B6AF', navBg: '#F6F5F3' },
  brightDark:  { bg: '#000000', tile: 'linear-gradient(160deg,#161616,#101010)', tileSh: 'inset 0 1px 0 rgba(255,255,255,0.06)', track: 'rgba(255,255,255,0.09)', hero: 'linear-gradient(150deg,#2A2A2A,#121212 55%,#1E1E1E)', heroLn: 'rgba(255,255,255,0.13)', heroTx: '#F7F7F6', heroMu: '#B3B2AE', navBg: '#000000' },
};

export const VARIANTS = Object.keys(SIMPLE);
export const STYLES = ['simple', 'advanced'];

/**
 * @param {string} variant one of VARIANTS
 * @param {string} style "simple" or "advanced"
 * @returns {Record<string, string>} flat token map, keys become CSS variables (--bg, --tx, ...)
 */
export function tokensFor(variant, style) {
  const base = SIMPLE[variant];
  if (!base) throw new Error(`Unknown variant: ${variant}`);
  const simpleExtras = { tile: base.sf, tileSh: 'none', track: base.rs, hero: base.sf, heroLn: base.ln, heroTx: base.tx, heroMu: base.t2, navBg: base.bg };
  const out = { ...base, ...simpleExtras };
  if (style === 'advanced') Object.assign(out, ADVANCED[variant]);
  return out;
}
