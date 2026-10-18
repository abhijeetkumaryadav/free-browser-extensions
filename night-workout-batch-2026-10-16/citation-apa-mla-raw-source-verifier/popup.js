// Citation Builder — builds APA/MLA/Chicago from user metadata + format checker
const $ = id => document.getElementById(id);

// ---- parsing helpers -------------------------------------------------------
function parseAuthors(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(',').map(s => s.trim());
    return { last: parts[0] || '', first: parts.slice(1).join(', ') || '' };
  });
}
function initials(first) {
  return first.split(/[\s.\-]+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ');
}
function sentenceCase(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- citation formatters ---------------------------------------------------
function fmtAPA(a, d) {
  const authors = a.map(x => `${x.last}, ${initials(x.first)}`.trim()).join(', & ')
    .replace(/, & ([^,]+)$/, ', & $1');
  const auth = a.length ? authors + ' ' : '';
  const yr = d.year ? `(${d.year}). ` : '(n.d.). ';
  let s = `${auth}${yr}${sentenceCase(d.title)}. `;
  if (d.type === 'article') {
    s += d.container ? `*${d.container}*` : '';
    if (d.vol) s += `, *${d.vol}*`;
    if (d.issue) s += `(${d.issue})`;
    if (d.pages) s += `, ${d.pages}`;
    s += '. ';
  } else {
    s += d.container ? `${d.container}. ` : '';
  }
  if (d.url) s += d.url;
  return s.trim();
}

function fmtMLA(a, d) {
  let s = '';
  if (a.length === 1) s = `${a[0].last}, ${a[0].first}. `;
  else if (a.length === 2) s = `${a[0].last}, ${a[0].first}, and ${a[1].first} ${a[1].last}. `;
  else if (a.length > 2) s = `${a[0].last}, ${a[0].first}, et al. `;
  s += `"${d.title}." `;
  if (d.type === 'article') {
    if (d.container) s += `*${d.container}*, `;
    if (d.vol) s += `vol. ${d.vol}, `;
    if (d.issue) s += `no. ${d.issue}, `;
  } else if (d.container) {
    s += `*${d.container}*, `;
  }
  if (d.year) s += `${d.year}, `;
  if (d.pages && d.type === 'article') s += `pp. ${d.pages}. `;
  else s = s.trim().replace(/,$/, '.') + ' ';
  if (d.url) s += d.url + '.';
  return s.replace(/\s+/g, ' ').trim();
}

function fmtChicago(a, d) {
  let auth = '';
  if (a.length === 1) auth = `${a[0].last}, ${a[0].first}. `;
  else if (a.length === 2) auth = `${a[0].last}, ${a[0].first}, and ${a[1].first} ${a[1].last}. `;
  else if (a.length > 2) auth = `${a[0].last}, ${a[0].first}, et al. `;
  let s = auth + (d.year ? `${d.year}. ` : 'n.d. ') + `"${d.title}." `;
  if (d.type === 'article') {
    if (d.container) s += `*${d.container}* `;
    if (d.vol) s += `${d.vol} `;
    if (d.issue) s += `(${d.issue}) `;
    if (d.pages) s += `(${d.year || 'n.d.'}): ${d.pages}. `;
  } else if (d.container) {
    s += `${d.container}. `;
  }
  if (d.url) s += d.url + '.';
  return s.replace(/\s+/g, ' ').trim();
}

// ---- format checker --------------------------------------------------------
function checkFormat(a, d) {
  const w = [];
  if (!a.length) w.push('Missing author — most styles require at least one author (or mark as organization).');
  a.forEach(x => {
    if (!x.last || !x.first) w.push(`Author "${x.last || x.first}" looks incomplete — use "Last, First".`);
  });
  if (!d.title) w.push('Missing title.');
  if (d.title && d.title === d.title.toUpperCase() && d.title.length > 4)
    w.push('Title is ALL CAPS — APA uses sentence case.');
  if (!d.year) w.push('Missing year — use "n.d." only if truly undated.');
  else if (!/^\d{4}$/.test(d.year)) w.push(`Year "${d.year}" is not a 4-digit year.`);
  if (!d.container) w.push(d.type === 'book' ? 'Missing publisher.' : d.type === 'article' ? 'Missing journal name.' : 'Missing site name.');
  if (d.type === 'web' && d.url && !/^https?:\/\//i.test(d.url))
    w.push('URL is missing http(s):// — many checkers flag this.');
  if (d.type === 'web' && !d.url) w.push('Web source without URL — add the page address.');
  return w;
}

// ---- wire-up ----------------------------------------------------------------
$('buildBtn').addEventListener('click', () => {
  const d = {
    type: $('stype').value,
    year: $('year').value.trim(),
    title: $('title').value.trim(),
    container: $('container').value.trim(),
    vol: $('vol').value.trim(),
    issue: $('issue').value.trim(),
    pages: $('pages').value.trim(),
    url: $('url').value.trim()
  };
  const authors = parseAuthors($('authors').value);

  $('apa').textContent = fmtAPA(authors, d);
  $('mla').textContent = fmtMLA(authors, d);
  $('chicago').textContent = fmtChicago(authors, d);
  $('out').classList.remove('hidden');

  const warns = checkFormat(authors, d);
  const warn = $('warn');
  warn.classList.remove('hidden');
  if (!warns.length) {
    warn.classList.add('ok');
    warn.innerHTML = '✓ Format check passed — no common mistakes found.';
  } else {
    warn.classList.remove('ok');
    warn.innerHTML = '<b>Format check:</b><ul>' + warns.map(x => `<li>${x}</li>`).join('') + '</ul>';
  }
  // persist form so entries survive popup close
  chrome.storage.local.set({ citeForm: { ...d, authors: $('authors').value } });
});

document.querySelectorAll('button.mini').forEach(b => {
  b.addEventListener('click', async () => {
    const txt = $(b.dataset.k).textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied!'; }
    catch { b.textContent = 'Failed'; }
    setTimeout(() => b.textContent = 'Copy', 1200);
  });
});

// restore last form
chrome.storage.local.get('citeForm', r => {
  const f = r.citeForm; if (!f) return;
  $('stype').value = f.type || 'book';
  $('authors').value = f.authors || '';
  ['year','title','container','vol','issue','pages','url'].forEach(k => { $(k).value = f[k] || ''; });
});
