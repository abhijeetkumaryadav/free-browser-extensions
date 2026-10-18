/* Thread Formatter — smart splitting, drag reorder, copy. All client-side. */

const LIMIT = 280;
const $ = (id) => document.getElementById(id);
let tweets = []; // array of strings, current thread order

/** Reserve chars for the " n/m" suffix/prefix so numbering never overflows. */
function reserveFor(total) {
  return String(total).length * 2 + 2; // " 12/12"
}

/**
 * Split text into chunks <= maxLen, preferring sentence boundaries,
 * then word boundaries. Falls back to hard cut for unbreakable runs.
 */
function splitSmart(text, maxLen) {
  const chunks = [];
  let rest = text.replace(/\s+/g, ' ').trim();
  while (rest.length > maxLen) {
    let cut = -1;
    // Prefer a sentence boundary within the limit
    const seg = rest.slice(0, maxLen + 1);
    const sent = [...seg.matchAll(/[.!?…]["'”)]?\s/g)];
    if (sent.length) cut = sent[sent.length - 1].index + sent[sent.length - 1][0].length;
    else {
      const sp = seg.lastIndexOf(' ');
      cut = sp > maxLen * 0.4 ? sp + 1 : maxLen;
    }
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Split with numbering reserve, iterating until numbering is stable. */
function buildThread(text) {
  const clean = text.trim();
  if (!clean) return [];
  let chunks = splitSmart(clean, LIMIT - 6);
  for (let i = 0; i < 4; i++) { // converge numbering reserve
    const reserve = reserveFor(chunks.length);
    const next = splitSmart(clean, LIMIT - reserve);
    if (next.length === chunks.length) break;
    chunks = next;
  }
  return chunks;
}

/* ---------- rendering ---------- */

function render() {
  const list = $('thread');
  list.innerHTML = '';
  $('tweetCount').textContent = tweets.length ? `· ${tweets.length} tweet${tweets.length > 1 ? 's' : ''}` : '';

  tweets.forEach((text, i) => {
    const li = document.createElement('li');
    li.className = 'tweet';
    li.draggable = true;
    li.dataset.index = i;

    const len = text.length;
    const over = len > LIMIT;

    li.innerHTML = `
      <span class="handle" title="Drag to reorder">⋮⋮</span>
      <button class="del" title="Delete tweet">×</button>
      <div class="ttext" contenteditable="true" spellcheck="false"></div>
      <div class="tmeta">
        <span class="num">${i + 1}/${tweets.length}</span>
        <span class="chars ${over ? 'over' : ''}">${len}/${LIMIT}</span>
      </div>
      <div class="bar"><i class="${over ? 'over' : ''}" style="width:${Math.min(100, (len / LIMIT) * 100)}%"></i></div>`;

    li.querySelector('.ttext').textContent = text;

    // Live edit: update model + counts
    li.querySelector('.ttext').addEventListener('input', (e) => {
      tweets[i] = e.target.textContent;
      const l = tweets[i].length;
      const chars = li.querySelector('.chars');
      chars.textContent = `${l}/${LIMIT}`;
      chars.classList.toggle('over', l > LIMIT);
      const bar = li.querySelector('.bar i');
      bar.style.width = Math.min(100, (l / LIMIT) * 100) + '%';
      bar.classList.toggle('over', l > LIMIT);
      persist();
    });

    li.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      tweets.splice(i, 1);
      render();
      persist();
      if (!tweets.length) $('threadPanel').classList.add('hidden');
    });

    // Drag & drop reorder
    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      // Read back new order from DOM
      tweets = [...list.children].map(el => el.querySelector('.ttext').textContent);
      render();
      persist();
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      if (!dragging || dragging === li) return;
      const rect = li.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      list.insertBefore(dragging, after ? li.nextSibling : li);
    });

    list.appendChild(li);
  });

  if (tweets.length) $('threadPanel').classList.remove('hidden');
}

/* ---------- copy ---------- */

function decorated(i, total) {
  const numbering = $('numbering').checked;
  const style = $('numStyle').value;
  const tag = `${i + 1}/${total}`;
  if (!numbering) return tweets[i];
  return style === 'prefix' ? `${tag} ${tweets[i]}` : `${tweets[i]} ${tag}`;
}

$('copyAll').addEventListener('click', async () => {
  const total = tweets.length;
  const out = tweets.map((_, i) => decorated(i, total)).join('\n\n');
  try {
    await navigator.clipboard.writeText(out);
  } catch {
    // Fallback for clipboard permission quirks
    const ta = document.createElement('textarea');
    ta.value = out;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const msg = $('copiedMsg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2200);
});

/* ---------- actions ---------- */

function persist() {
  chrome.storage.local.set({
    lastThread: tweets,
    numbering: $('numbering').checked,
    numStyle: $('numStyle').value,
    lastSource: $('source').value,
  });
}

$('split').addEventListener('click', () => {
  const text = $('source').value.trim();
  if (!text) { $('source').focus(); return; }
  tweets = buildThread(text);
  render();
  persist();
});

$('clear').addEventListener('click', () => {
  $('source').value = '';
  tweets = [];
  render();
  $('threadPanel').classList.add('hidden');
  chrome.storage.local.remove(['lastThread', 'lastSource']);
});

$('numbering').addEventListener('change', persist);
$('numStyle').addEventListener('change', persist);

/* Restore previous state (local only). */
chrome.storage.local.get(['lastThread', 'numbering', 'numStyle', 'lastSource'], (d) => {
  if (typeof d.numbering === 'boolean') $('numbering').checked = d.numbering;
  if (d.numStyle) $('numStyle').value = d.numStyle;
  if (d.lastSource) $('source').value = d.lastSource;
  if (Array.isArray(d.lastThread) && d.lastThread.length) {
    tweets = d.lastThread;
    render();
  }
});
