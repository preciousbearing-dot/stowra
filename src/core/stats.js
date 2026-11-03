/** Pure numbers for the home charts. Nothing here touches the screen. */
const DAY = 86400000;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {any[]} keeps live Keeps @param {number} [now] */
export function homeStats(keeps, now = Date.now()) {
  const total = keeps.length;
  const weekAgo = now - 7 * DAY;
  const thisWeek = keeps.filter((k) => k.createdAt >= weekAgo).length;
  const lastWeek = keeps.filter((k) => k.createdAt < weekAgo && k.createdAt >= now - 14 * DAY).length;
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const from = startToday.getTime() - i * DAY;
    days.push({ label: WD[new Date(from).getDay()][0], day: WD[new Date(from).getDay()], n: keeps.filter((k) => k.createdAt >= from && k.createdAt < from + DAY).length, today: i === 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  for (const d of days) d.pct = d.n ? Math.max(12, Math.round((d.n / max) * 100)) : 6;
  const bySource = new Map();
  for (const k of keeps) bySource.set(k.source || 'Web', (bySource.get(k.source || 'Web') || 0) + 1);
  const sources = [...bySource].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n, pct: total ? Math.round((n / total) * 100) : 0 }));
  const top = sources.slice(0, 3);
  const rest = sources.slice(3).reduce((s, x) => s + x.n, 0);
  if (rest) top.push({ name: 'Other', n: rest, pct: Math.round((rest / total) * 100) });
  const done = keeps.filter((k) => k.status === 'ready' || k.status === 'partial').length;
  const attention = keeps.filter((k) => k.status === 'attention' || k.status === 'failed').length;
  return { total, thisWeek, lastWeek, delta: thisWeek - lastWeek, days, sources: top, processedPct: total ? Math.round((done / total) * 100) : 0, attention };
}
