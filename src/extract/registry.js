/** One module per source. Added as built: youtube, article, github, pdf, image, note. */
import { noteExtractor } from './note.js';
export const EXTRACTORS = { note: noteExtractor, default: noteExtractor };
