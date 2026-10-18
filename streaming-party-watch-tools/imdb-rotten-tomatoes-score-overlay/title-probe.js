/* title-probe.js — injected into the MAIN world on user click only.
 * Reads page metadata and returns the most likely movie/show title.
 * Pure function: takes no input, returns a string. Self-contained. */
(() => {
  'use strict';

  // Common junk suffixes sites append to <title>.
  const SUFFIX_RE = /\s*[-–—|:]\s*(IMDb|Netflix|Prime Video|Disney\+?|Hulu|HBO Max|Apple TV\+?|Rotten Tomatoes|Wikipedia|YouTube|Vimeo|Letterboxd|Metacritic).{0,40}$/i;

  function clean(raw) {
    if (!raw) return '';
    let t = raw.trim().replace(/\s+/g, ' ');
    t = t.replace(SUFFIX_RE, '').trim();
    // Drop trailing year in parens, keep it separate for the year field.
    t = t.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    // Strip common prefixes like "Watch X online".
    t = t.replace(/^(watch|stream)\s+/i, '').trim();
    return t;
  }

  function meta(name, attr) {
    const el = document.querySelector(`meta[${attr || 'property'}="${name}"]`);
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  // Priority: og:title (often cleanest) → twitter:title → h1 → document.title.
  const candidates = [
    meta('og:title'),
    meta('twitter:title'),
    (document.querySelector('h1') || {}).textContent || '',
    document.title || ''
  ];

  for (const raw of candidates) {
    const t = clean(raw);
    if (t && t.length >= 2 && t.length <= 120) return t;
  }
  return '';
})();
