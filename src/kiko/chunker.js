/** Split a Keep's text into passages that keep their place: transcript time or PDF page. */
const TARGET = 900;

/** @param {any} k @returns {{keepId: string, title: string, n: number, text: string, loc: string, kind: string}[]} */
export function passagesOf(k) {
  const body = [k.note && `Your note: ${k.note}`, k.summary && `Summary: ${k.summary}`, k.text].filter(Boolean).join('\n\n');
  const out = [];
  let loc = ''; let kind = '';
  for (const block of body.split(/\n{2,}|\n(?=\[\d\d:\d\d\])|\n(?=\[Page \d+\])/)) {
    const b = block.trim(); if (!b) continue;
    if (/^Description:/.test(b)) { kind = 'description'; loc = ''; } else if (/^Transcript:/.test(b)) { kind = 'transcript'; }
    const ts = b.match(/^\[(\d\d:\d\d)\]/); const pg = b.match(/^\[Page (\d+)\]/);
    if (ts) loc = ts[1]; else if (pg) loc = `page ${pg[1]}`;
    for (let i = 0; i < b.length; i += TARGET) out.push({ keepId: k.id, title: k.title, n: out.length, text: b.slice(i, i + TARGET + 80), loc: loc || (kind === 'description' ? 'description' : ''), kind });
  }
  return out;
}
