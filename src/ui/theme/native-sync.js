import { native } from '../../platform/native.js';

/**
 * Tell Android about the current look: bar colours and the share sheet's colours.
 * @param {Record<string,string>} tokens
 */
export function syncNative(tokens) {
  native.setBars(tokens.bg, tokens.scheme === 'light');
  const { scheme, ...rest } = tokens;
  native.setOverlayTheme({ ...rest, scheme });
}
