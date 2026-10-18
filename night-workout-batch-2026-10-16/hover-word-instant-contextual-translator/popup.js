/* My Word Hover — popup: manage the personal word->translation dictionary. */
const $ = id => document.getElementById(id);

async function getStore() {
  const res = await chrome.storage.local.get(['words', 'enabled']);
  return { words: res.words || {}, enabled: res.enabled !== false };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render() {
  const { words } = await getStore();
  const q = $('search').value.trim().toLowerCase();
  const keys = Object.keys(words).sort();
  const shown = q ? keys.filter(k =>
    k.includes(q) || (words[k].t || '').toLowerCase().includes(q)) : keys;
  $('count').textContent = keys.length;
  const list = $('wordList');
  if (!shown.length) {
    list.innerHTML = '<p class="empty">' +
      (keys.length ? 'No matches.' : 'No words yet. Add your first one above.') + '</p>';
    return;
  }
  list.innerHTML = shown.map(k => {
    const e = words[k];
    return '<div class="worditem"><div><span class="w">' + escapeHtml(k) +
      '</span> → <span class="t">' + escapeHtml(e.t || '') + '</span>' +
      (e.note ? '<span class="n">' + escapeHtml(e.note) + '</span>' : '') +
      '</div><button class="del" data-k="' + escapeHtml(k) + '" title="Delete">×</button></div>';
  }).join('');
  list.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const store = await getStore();
      delete store.words[btn.dataset.k];
      await chrome.storage.local.set({ words: store.words });
      render();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const store = await getStore();
  $('enabled').checked = store.enabled;
  render();

  $('enabled').addEventListener('change', e => {
    chrome.storage.local.set({ enabled: e.target.checked });
  });

  async function addWord() {
    const word = $('word').value.trim().toLowerCase();
    const translation = $('translation').value.trim();
    const note = $('note').value.trim();
    const msg = $('formMsg');
    if (!word || !translation) {
      msg.textContent = 'Enter both a word and its translation.';
      msg.classList.remove('ok');
      return;
    }
    if (/[^a-zà-öø-ÿ'’-]/u.test(word)) {
      msg.textContent = 'Word should be a single word (letters only).';
      msg.classList.remove('ok');
      return;
    }
    const s = await getStore();
    const existed = !!s.words[word];
    s.words[word] = { t: translation, note };
    await chrome.storage.local.set({ words: s.words });
    $('word').value = ''; $('translation').value = ''; $('note').value = '';
    msg.textContent = existed ? 'Updated "' + word + '".' : 'Added "' + word + '".';
    msg.classList.add('ok');
    render();
  }
  $('addBtn').addEventListener('click', addWord);
  [$('word'), $('translation'), $('note')].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); }));
  $('search').addEventListener('input', render);

  $('exportBtn').addEventListener('click', async () => {
    const { words } = await getStore();
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'word-hover-dictionary.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (typeof data !== 'object' || data === null) throw new Error('bad file');
      const s = await getStore();
      let added = 0;
      for (const [k, v] of Object.entries(data)) {
        const key = String(k).toLowerCase().trim();
        const t = v && typeof v === 'object' ? String(v.t || '') : String(v || '');
        if (key && t) { s.words[key] = { t, note: (v && v.note) || '' }; added++; }
      }
      await chrome.storage.local.set({ words: s.words });
      $('formMsg').textContent = 'Imported ' + added + ' words.';
      $('formMsg').classList.add('ok');
      render();
    } catch (err) {
      $('formMsg').textContent = 'Could not read that file.';
      $('formMsg').classList.remove('ok');
    }
    e.target.value = '';
  });
});
