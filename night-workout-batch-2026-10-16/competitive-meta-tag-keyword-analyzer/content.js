/* MetaTag Keyword Analyzer — content script (on-demand injected, click-only)
   Self-audit of the CURRENT page's own meta tags + keyword density. Read-only, 100% local. */
(() => {
  'use strict';

  // ---- meta tag extraction ----
  function metaContent(sel) {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute('content') || '').trim() : '';
  }

  const title = document.title || '';
  const description = metaContent('meta[name="description"]');
  const keywordsTag = metaContent('meta[name="keywords"]');
  const canonical = (document.querySelector('link[rel="canonical"]') || {}).href || '';
  const robots = metaContent('meta[name="robots"]');
  const ogTitle = metaContent('meta[property="og:title"]');
  const ogDesc = metaContent('meta[property="og:description"]');
  const ogImage = metaContent('meta[property="og:image"]');

  // ---- body text → keyword density ----
  const stop = new Set(('a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,can,could,should,may,might,must,this,that,these,those,it,its,i,you,we,they,he,she,not,no,yes,all,any,each,more,most,other,some,such,only,own,same,so,than,too,very,just,also,into,over,after,before,between,through,during,about,up,out,down,off,our,your,their,his,her,my,me,us,him,them,what,which,who,whom,whose,where,when,why,how,because,while,until,again,once,here,there').split(','));
  const text = (document.body ? document.body.innerText : '') || '';
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([w, c]) => ({ word: w, count: c, density: words.length ? +(c / words.length * 100).toFixed(2) : 0 }));

  // ---- checks (guidelines are heuristics, clearly labeled as such) ----
  const checks = [];
  const score = { value: 100 };
  function deduct(points, sev, title_, fix) {
    score.value = Math.max(0, score.value - points);
    checks.push({ sev, title: title_, fix });
  }

  if (!title) deduct(25, 'error', 'Missing <title>', 'Add a unique, descriptive title of 30–60 characters.');
  else if (title.length < 30) deduct(8, 'warning', 'Title too short (' + title.length + ' chars)', 'Aim for 30–60 characters so it reads well in search results.');
  else if (title.length > 60) deduct(8, 'warning', 'Title too long (' + title.length + ' chars)', 'Aim for 30–60 characters; search engines may truncate longer titles.');
  else checks.push({ sev: 'ok', title: 'Title length OK (' + title.length + ' chars)', fix: '' });

  if (!description) deduct(20, 'error', 'Missing meta description', 'Add a 120–158 character summary with your primary keyword.');
  else if (description.length < 120) deduct(6, 'warning', 'Meta description short (' + description.length + ' chars)', 'Aim for 120–158 characters.');
  else if (description.length > 158) deduct(6, 'warning', 'Meta description long (' + description.length + ' chars)', 'Aim for 120–158 characters; longer text is usually truncated.');
  else checks.push({ sev: 'ok', title: 'Meta description length OK (' + description.length + ' chars)', fix: '' });

  if (topKeywords.length && title) {
    const top = topKeywords[0].word;
    if (!title.toLowerCase().includes(top)) {
      deduct(6, 'warning', 'Top keyword "' + top + '" not in title', 'Consider including your primary keyword in the title.');
    } else checks.push({ sev: 'ok', title: 'Top keyword appears in title', fix: '' });
  }

  if (topKeywords.length && description) {
    const top = topKeywords[0].word;
    if (!description.toLowerCase().includes(top)) {
      deduct(4, 'warning', 'Top keyword "' + top + '" not in meta description', 'Echoing it in the description can improve click-through.');
    } else checks.push({ sev: 'ok', title: 'Top keyword appears in description', fix: '' });
  }

  topKeywords.slice(0, 5).forEach(k => {
    if (k.density > 3) deduct(6, 'warning', 'Possible keyword stuffing: "' + k.word + '" at ' + k.density + '%',
      'Above ~3% density can read as spammy. Rewrite naturally instead of repeating the term.');
  });

  if (!ogTitle || !ogDesc || !ogImage) {
    deduct(4, 'warning', 'Incomplete Open Graph tags',
      'Missing: ' + ['og:title', 'og:description', 'og:image'].filter((_, i) => ![ogTitle, ogDesc, ogImage][i]).join(', ') + '. OG tags control how the page looks when shared.');
  } else checks.push({ sev: 'ok', title: 'Open Graph tags present', fix: '' });

  if (!canonical) deduct(3, 'warning', 'No canonical link', 'Add <link rel="canonical"> to signal the preferred URL for this page.');
  else checks.push({ sev: 'ok', title: 'Canonical link present', fix: '' });

  if (/noindex/i.test(robots)) deduct(10, 'warning', 'robots meta blocks indexing ("' + robots + '")',
    'Make sure this is intentional — noindex removes the page from search results.');
  else checks.push({ sev: 'ok', title: 'robots meta OK' + (robots ? ' ("' + robots + '")' : ''), fix: '' });

  function lenClass(n, lo, hi) {
    if (!n) return 'bad';
    if (n < lo || n > hi) return 'warn';
    return 'good';
  }

  return {
    score: score.value,
    tags: [
      { name: '<title>', value: title, len: title.length, range: [30, 60], lenCls: lenClass(title.length, 30, 60) },
      { name: 'meta description', value: description || '(missing)', len: description.length, range: [120, 158], lenCls: lenClass(description.length, 120, 158) },
      { name: 'meta keywords', value: keywordsTag || '(missing)', len: keywordsTag.length, range: [0, 0], lenCls: keywordsTag ? 'warn' : 'good' },
    ],
    keywords: topKeywords,
    checks,
    wordCount: words.length,
  };
})();
