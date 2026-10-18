/* Content script: reads OG / Twitter Card meta tags + checks og:image load/size.
   Injected on demand (chrome.scripting, activeTab) only when the user clicks
   "Analyze this page". Read-only — never modifies the page. */
(() => {
  'use strict';

  const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';

  function abs(url) {
    try { return new URL(url, document.baseURI).href; } catch { return ''; }
  }

  function checkImage(url) {
    // Returns a promise resolving {ok, width, height}
    return new Promise((resolve) => {
      if (!url) { resolve({ ok: false, width: 0, height: 0 }); return; }
      const img = new Image();
      const timer = setTimeout(() => resolve({ ok: false, width: 0, height: 0 }), 8000);
      img.onload = () => { clearTimeout(timer); resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { clearTimeout(timer); resolve({ ok: false, width: 0, height: 0 }); };
      img.src = abs(url);
    });
  }

  (async () => {
    const tags = {
      ogTitle: getMeta('meta[property="og:title"]'),
      ogDesc: getMeta('meta[property="og:description"]'),
      ogImage: getMeta('meta[property="og:image"]'),
      ogType: getMeta('meta[property="og:type"]'),
      ogUrl: getMeta('meta[property="og:url"]'),
      ogSite: getMeta('meta[property="og:site_name"]'),
      twCard: getMeta('meta[name="twitter:card"]'),
      twTitle: getMeta('meta[name="twitter:title"]'),
      twDesc: getMeta('meta[name="twitter:description"]'),
      twImage: getMeta('meta[name="twitter:image"]'),
      desc: getMeta('meta[name="description"]'),
    };
    const title = tags.ogTitle || document.title || '';
    const issues = [];

    // --- checks ---
    const imgUrl = abs(tags.ogImage);
    const img = await checkImage(imgUrl);

    if (!tags.ogTitle) issues.push({ sev: 'high', title: 'Missing og:title',
      body: 'No <code>og:title</code> found. Shares fall back to the raw <code>&lt;title&gt;</code>, which may be cut off or off-brand.' });
    if (!tags.ogDesc && !tags.desc) issues.push({ sev: 'high', title: 'Missing og:description',
      body: 'No <code>og:description</code> (and no meta description fallback). Shares will show a guessed snippet or nothing.' });
    if (!tags.ogImage) {
      issues.push({ sev: 'high', title: 'Missing og:image', body: 'No <code>og:image</code> — shares render as text-only links, which get far fewer clicks.' });
    } else if (!img.ok) {
      issues.push({ sev: 'high', title: 'Broken og:image URL', body: 'The og:image URL failed to load (<code>' + tags.ogImage + '</code>). Check the path and hosting.' });
    } else {
      if (img.width < 600) issues.push({ sev: 'medium', title: 'og:image is small (' + img.width + '×' + img.height + 'px)',
        body: 'Recommended minimum is 1200×630px. Small images render blurry or get dropped from large-card layouts.' });
      if (img.width / (img.height || 1) < 1.7) issues.push({ sev: 'low', title: 'og:image aspect ratio',
        body: 'Image is ' + img.width + '×' + img.height + 'px. A 1.91:1 ratio (e.g. 1200×630) crops best on Facebook and LinkedIn.' });
    }
    if (tags.ogTitle && tags.ogTitle.length > 95) issues.push({ sev: 'medium', title: 'og:title may be truncated',
      body: 'og:title is ' + tags.ogTitle.length + ' chars; most platforms cut titles around 90–95 chars.' });
    if (tags.ogDesc && tags.ogDesc.length > 200) issues.push({ sev: 'medium', title: 'og:description may be truncated',
      body: 'og:description is ' + tags.ogDesc.length + ' chars; most platforms cut descriptions around 160–200 chars.' });
    if (!tags.ogType) issues.push({ sev: 'low', title: 'Missing og:type',
      body: 'No <code>og:type</code> — defaults to "website", but "article" unlocks richer previews for content pages.' });
    if (!tags.twCard) issues.push({ sev: 'low', title: 'Missing twitter:card',
      body: 'No <code>twitter:card</code> — X falls back to <code>summary</code> with a small thumbnail instead of a large card.' });
    if (!tags.twImage && tags.ogImage) issues.push({ sev: 'low', title: 'No twitter:image — falls back to og:image',
      body: 'X will use og:image automatically; a dedicated twitter:image is only needed for a different crop.' });

    const twImage = abs(tags.twImage) || imgUrl;
    const twImg = tags.twImage ? await checkImage(twImage) : img;

    const tagCount = Object.values(tags).filter(Boolean).length;
    // Scoring: start at 100, deduct per severity (cap)
    let score = 100;
    for (const i of issues) score -= (i.sev === 'high' ? 18 : i.sev === 'medium' ? 8 : 4);
    score = Math.max(0, Math.min(100, score));

    const platformsOk = [
      !issues.some(i => i.sev === 'high' && /og:/.test(i.body + i.title)),
      tags.twCard || tags.ogImage, tags.ogImage
    ].filter(Boolean).length;

    return {
      ok: true, url: location.href, host: location.host, title,
      tags, issues, score, tagCount, platformsOk,
      images: { fb: { url: imgUrl, ok: img.ok }, x: { url: twImage, ok: twImg.ok } },
    };
  })().then((result) => chrome.runtime.sendMessage({ type: 'OG_SCAN_RESULT', result }));
})();
