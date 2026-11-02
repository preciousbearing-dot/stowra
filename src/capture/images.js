/**
 * Shrink an image file to a small JPEG data URL for thumbnails. Thumbnails are copied to the phone at save time because platform links expire.
 * @param {Blob} blob @param {number} [max] longest side in pixels @returns {Promise<string>}
 */
export async function readImageFile(blob, max = 640) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}
