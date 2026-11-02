import { getJson, getText, pictureAsThumb } from './http.js';
import { ExtractionError } from '../core/errors.js';

/** @param {string} url @returns {{owner: string, repo: string}|null} */
export function repoOf(url) {
  try { const p = new URL(url).pathname.split('/').filter(Boolean); if (p.length >= 2) return { owner: p[0], repo: p[1].replace(/\.git$/, '') }; } catch (e) { /* none */ }
  return null;
}

/** GitHub repository: description, language, README and top-level layout, from the public API. @param {any} k */
export async function githubExtractor(k) {
  const r = repoOf(k.url);
  if (!r) throw new ExtractionError('Not a repository link.', { code: 'not_repo' });
  const api = `https://api.github.com/repos/${r.owner}/${r.repo}`;
  const h = { Accept: 'application/vnd.github+json' };
  let info;
  try { info = await getJson(api, { headers: h }); } catch (e) {
    if (e.code === 'http_403' || e.code === 'http_429') { const x = new ExtractionError('GitHub is limiting requests from this phone for now. Try again in an hour.', { code: 'rate' }); x.userText = x.message; throw x; }
    if (e.code === 'http_404') throw new ExtractionError('This repository is private or does not exist.', { code: 'missing' });
    throw e;
  }
  let readme = ''; let tree = '';
  try { readme = await getText(`${api}/readme`, { headers: { Accept: 'application/vnd.github.raw+json' } }); } catch (e) { /* no README */ }
  try { const t = await getJson(`${api}/contents`, { headers: h }); tree = t.map((x) => (x.type === 'dir' ? `${x.name}/` : x.name)).join(', '); } catch (e) { /* skip */ }
  const thumb = await pictureAsThumb(`https://opengraph.githubassets.com/1/${r.owner}/${r.repo}`) || await pictureAsThumb(info.owner && info.owner.avatar_url);
  const facts = [`Repository: ${info.full_name}`, info.description && `About: ${info.description}`, info.language && `Main language: ${info.language}`, info.topics && info.topics.length && `Topics: ${info.topics.join(', ')}`, `Stars: ${info.stargazers_count}`, info.license && info.license.name && `License: ${info.license.name}`, tree && `Top level: ${tree}`, info.pushed_at && `Last pushed: ${info.pushed_at.slice(0, 10)}`].filter(Boolean).join('\n');
  return { title: `${info.full_name}${info.description ? `: ${info.description}` : ''}`.slice(0, 120), thumb, text: `${facts}\n\nREADME:\n${readme.slice(0, 60000)}`, status: readme ? 'ready' : 'partial', how: readme ? 'README and details from GitHub' : 'Details from GitHub. This repository has no README', meta: { language: info.language || '', stars: info.stargazers_count, tools: true } };
}
