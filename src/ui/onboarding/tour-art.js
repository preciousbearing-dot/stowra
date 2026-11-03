/**
 * Artwork for the four welcome tour slides. Constant markup only (no user data), copied from the approved design canvas.
 * Layout and motion live in src/ui/theme/tour.css, so nothing here uses inline styles.
 */
const DROP = '<svg viewBox="0 0 108 108" aria-hidden="true"><path d="M54 19C54 19 30 44 30 62a24 24 0 0 0 48 0C78 44 54 19 54 19Z" fill="#E9A53F"/><rect x="43" y="50" width="22" height="26" rx="6" transform="rotate(-10 54 63)" fill="#FBF1D9"/></svg>';
const CK = (c) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="an ck ${c}" d="M5 12l5 5 9-10"/></svg>`;

export const BRAND = `<span class="tr-brand-drop">${DROP}</span><span class="tr-brand-name">Stowra</span>`;

const S1 = `<div class="tr-card an i4">
<div class="tr-ring"></div>
<div class="tr-play"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></div>
<div class="tr-l1"></div><div class="tr-l2"></div>
<div class="tr-src">TikTok</div>
<div class="an i16 tr-share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>Share</div>
</div>
<div class="an i22 tr-pillrow"><div class="tr-pill">${DROP}Stowra</div></div>
<div class="an i28 tr-jar"><svg width="160" height="220" viewBox="0 -40 160 220" aria-hidden="true">
<defs>
<linearGradient id="trAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC85A"/><stop offset="1" stop-color="#C97A1A"/></linearGradient>
<linearGradient id="trBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3C27C"/><stop offset="1" stop-color="#A97C34"/></linearGradient>
<clipPath id="trJarClip"><path d="M48 46V62C48 70 28 76 28 94V138A22 22 0 0 0 50 160H110A22 22 0 0 0 132 138V94C132 76 112 70 112 62V46Z"/></clipPath>
</defs>
<ellipse cx="80" cy="166" rx="46" ry="5" fill="#000" opacity="0.14"/>
<path class="tr-glass" d="M48 46V62C48 70 28 76 28 94V138A22 22 0 0 0 50 160H110A22 22 0 0 0 132 138V94C132 76 112 70 112 62V46Z" stroke-width="1.6" stroke-linejoin="round"/>
<g clip-path="url(#trJarClip)"><rect class="an t-fill" x="26" y="124" width="108" height="38" fill="url(#trAmber)"/></g>
<ellipse class="an t-rip" cx="80" cy="124" rx="9" ry="2.4" fill="none" stroke="#FFC85A" stroke-width="1.4"/>
<path d="M36 100C34 112 34 124 36 134" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
<g class="an t-drop"><path d="M80 -10C80 -10 70 3 70 12a10 10 0 0 0 20 0C90 3 80 -10 80 -10Z" fill="url(#trAmber)"/></g>
<g class="an t-lid"><rect x="42" y="30" width="76" height="18" rx="6" fill="url(#trBrass)"/><rect x="46" y="52" width="68" height="4" rx="2" fill="url(#trBrass)"/></g>
<g class="an t-seal"><circle cx="80" cy="102" r="14" fill="#FBF1D9" stroke="#E9A53F" stroke-width="1.6"/><path d="M80 94C80 94 75 100 75 104a5 5 0 0 0 10 0C85 100 80 94 80 94Z" fill="#E9A53F"/></g>
</svg></div>
<div class="an i64 tr-stowedrow"><div class="tr-stowed">Stowed. Reading starts in the background.</div></div>`;

const S2 = `<div class="tr-pad">
<div class="an i4 tr-tile tr-searchbar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><span class="an t-type">that pricing page video</span></div>
<div class="an i22 tr-count">3 Keeps match</div>
<div class="an i28 tr-tile tr-res on"><div class="tr-th c1"></div><div class="tr-rt"><div class="tr-rn">How to price a small app</div><div class="tr-rs">YouTube, kept 3 weeks ago</div><div class="tr-hit">Mentions pricing at 06:40</div></div></div>
<div class="an i40 tr-tile tr-res"><div class="tr-th c2"></div><div class="tr-rt"><div class="tr-rn">Pricing tiers that convert</div><div class="tr-rs">Instagram, kept last month</div></div></div>
<div class="an i52 tr-tile tr-res"><div class="tr-th c3"></div><div class="tr-rt"><div class="tr-rn">Pricing notes</div><div class="tr-rs">Your note, kept 2 days ago</div></div></div>
</div>`;

const S3 = `<div class="tr-pad">
<div class="an i4 tr-bubble-me">Will this work for my app?</div>
<div class="tr-kikorow">
<div class="an i16 tr-kavatar"><span></span></div>
<div class="tr-kbody">
<div class="an i16 t-dotsbox tr-tile tr-dots"><span class="an t-dot d1"></span><span class="an t-dot d2"></span><span class="an t-dot d3"></span></div>
<div class="an i34 tr-tile tr-bubble-k">Yes, if your list stays small. The video says the trouble starts past a few hundred rows, and gives one fix.</div>
</div></div>
<div class="an i46 tr-tile tr-source on"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><div class="tr-stxt"><div class="tr-sn">Keep 129, at 04:12</div><div class="tr-ss">Source it used. Tap to play from there.</div></div></div>
<div class="an i58 tr-note">Kiko answers from your Keeps and shows where</div>
</div>`;

const S4 = `<div class="tr-pad">
<div class="an i4 tr-herorow"><div class="tr-hth"></div><div class="tr-htx"><div class="tr-hl">Why you saved this</div><div class="tr-hv">To make something</div></div></div>
<div class="an i16 tr-arrow"><svg width="16" height="28" viewBox="0 0 16 28" aria-hidden="true"><path d="M8 2v20M3 17l5 6 5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<div class="an i22 tr-tile tr-creation">
<div class="tr-chead"><div class="tr-ctitle">Screen review checklist</div><span class="tr-badge">Creation</span></div>
<div class="an i34 tr-item"><span class="tr-box">${CK('k34')}</span><span>Check spacing on a 4 point grid</span></div>
<div class="an i42 tr-item"><span class="tr-box">${CK('k42')}</span><span>Cut the stock gradients</span></div>
<div class="an i50 tr-item last"><span class="tr-box">${CK('k50')}</span><span>Rewrite vague button copy</span></div>
</div>
<div class="an i64 tr-note low">Saved in Creations, next to its source</div>
</div>`;

export const ART = [S1, S2, S3, S4];

export const COPY = [
  { title: 'Share it. It is stowed.', body: 'Tap Share in TikTok, YouTube or any app and pick Stowra. A sheet seals it in your Trove without taking you away from the video.', cta: 'Next' },
  { title: 'Find it again, fast.', body: 'Search by what you remember, not what you named it. Every Keep keeps its source, its thumbnail and its moment.', cta: 'Next' },
  { title: 'Ask Kiko about it.', body: 'Kiko answers only from what you have kept and shows exactly where each answer came from.', cta: 'Next' },
  { title: 'Then put it to work.', body: 'Turn a Keep into a checklist, a plan or a comparison, and keep it next to its source.', cta: 'Choose your look' },
];
