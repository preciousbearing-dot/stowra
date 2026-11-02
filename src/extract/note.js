/** Notes need no reading: the text is already the Keep. */
export async function noteExtractor(k) { return { text: k.note, how: k.kind === 'note' ? '' : 'Link saved. Page text not read yet' }; }
