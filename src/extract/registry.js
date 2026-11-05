/** One module per source. A link kind with no extractor falls back to the article reader. */
import { noteExtractor } from './note.js';
import { articleExtractor } from './article.js';
import { youtubeExtractor } from './youtube.js';
import { githubExtractor } from './github.js';
import { pdfExtractor } from './pdf.js';
import { imageExtractor } from './image.js';
import { videoExtractor } from './video.js';
import { voiceExtractor } from './voice.js';
import { pinterestExtractor } from './pinterest.js';
import { tiktokExtractor, instagramExtractor, facebookExtractor, linkedinExtractor, xExtractor, redditExtractor } from './social.js';

export const EXTRACTORS = {
  note: noteExtractor, youtube: youtubeExtractor, github: githubExtractor, pdf: pdfExtractor, image: imageExtractor, video: videoExtractor, voice: voiceExtractor,
  pinterest: pinterestExtractor, tiktok: tiktokExtractor, instagram: instagramExtractor, facebook: facebookExtractor, linkedin: linkedinExtractor, x: xExtractor, reddit: redditExtractor,
  article: articleExtractor, link: articleExtractor, default: articleExtractor,
};
