/* Placeholder — no real photo library generated yet.
 *
 * Run `node tools/fetch-photos.js` with an Unsplash access key to replace
 * this with ~350 real wedding photographs whose style has been measured from
 * their own pixels. Until then data.js falls back to synthetic placeholders.
 */
const VEIL_PHOTO_LIBRARY = [];
if (typeof window !== 'undefined') window.VEIL_PHOTO_LIBRARY = VEIL_PHOTO_LIBRARY;
if (typeof module !== 'undefined') module.exports = VEIL_PHOTO_LIBRARY;
