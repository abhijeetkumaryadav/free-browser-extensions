/* LineForge — multi-line text appender.
 * Pure local text transformation. Draft + settings persist in
 * chrome.storage.local. Zero network calls. */

const $ = (id) => document.getElementById(id);
const input = $('input'), output = $('output'), lineCount = $('lineCount');
const prefix = $('prefix'), suffix = $('suffix'), wrap = $('wrap');
const customWrap = $('customWrap'), customWrapField = $('customWrapField');
const numbering = $('numbering'), skipEmpty = $('skipEmpty'), trimLines = $('trimLines');
const numberStyle = $('numberStyle'), joiner = $('joiner');
const customJoin = $('customJoin'), customJoinField = $('customJoinField');

const PREFS_KEY = 'lineforge.prefs.v1';

/* ---------- transform core (pure, unit-testable) ---------- */
function transform(text, opts) {
  let lines = text.split(/\r?\n/);
  if (opts.trim) lines = lines.map(l => l.trim());
  if (opts.skipEmpty) lines = lines.filter(l => l.length > 0);

  const pad = lines.length >= 100 ? 3 : lines.length >= 10 ? 2 : 1;
  const fmtNum = (i) => {
    switch (opts.numberStyle) {
      case '1)': return `${i}) `;
      case '01': return String(i).padStart(pad, '0') + ' ';
      case '#1': return `#${i} `;
      case '[1]': return `[${i}] `;
      default: return `${i}. `;
    }
  };

  const mapped = lines.map((line, idx) => {
    let s = line;
    if (opts.numbering) s = fmtNum(idx + 1) + s;
    // wrap pair: [open, close]
    let pair = null;
    switch (opts.wrap) {
      case "'": pair = ["'", "'"]; break;
      case '"': pair = ['"', '"']; break;
      case 'backtick': pair = ['`', '`']; break;
      case 'li': pair = ['<li>', '</li>']; break;
      case 'p': pair = ['<p>', '</p>']; break;
      case 'span': pair = ['<span>', '</span>']; break;
      case 'custom': {
        const parts = opts.customWrap.split('|');
        pair = [parts[0] ?? '', parts[1] ?? ''];
        break;
      }
    }
    if (pair) s = pair[0] + s + pair[1];
    return opts.prefix + s + opts.suffix;
  });

  let sep;
  switch (opts.joiner) {
    case ', ': sep = ', '; break;
    case 'comma': sep = ','; break;
    case 'space': sep = ' '; break;
    case ';': sep = ';'; break;
    case 'pipe': sep = ' | '; break;
    case 'custom': sep = opts.customJoin; break;
    default: sep = '\n';
  }
  return { text: mapped.join(sep), count: mapped.length };
}

function collectOpts() {
  return {
    prefix: prefix.value, suffix: suffix.value,
    wrap: wrap.value, customWrap: customWrap.value,
    numbering: numbering.checked, skipEmpty: skipEmpty.checked,
    trim: trimLines.checked, numberStyle: numberStyle.value,
    joiner: joiner.value, customJoin: customJoin.value,
  };
}

/* ---------- render ---------- */
function render() {
  const { text, count } = transform(input.value, collectOpts());
  output.textContent = text;
  lineCount.textContent = `${count} line${count === 1 ? '' : 's'}`;
  customWrapField.classList.toggle('hidden', wrap.value !== 'custom');
  customJoinField.classList.toggle('hidden', joiner.value !== 'custom');
  savePrefs();
}

[ input, prefix, suffix, wrap, customWrap, numbering, skipEmpty, trimLines,
  numberStyle, joiner, customJoin ].forEach(el =>
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', render));

/* ---------- prefs persistence ---------- */
async function savePrefs() {
  try {
    await chrome.storage.local.set({ [PREFS_KEY]: {
      draft: input.value.slice(0, 200000), ...collectOpts(),
    }});
  } catch { /* storage full / unavailable — draft just won't persist */ }
}
async function loadPrefs() {
  const { [PREFS_KEY]: p } = await chrome.storage.local.get(PREFS_KEY);
  if (!p) return;
  if (typeof p.draft === 'string') input.value = p.draft;
  if ('prefix' in p) prefix.value = p.prefix;
  if ('suffix' in p) suffix.value = p.suffix;
  if (p.wrap) wrap.value = p.wrap;
  if ('customWrap' in p) customWrap.value = p.customWrap;
  numbering.checked = !!p.numbering;
  skipEmpty.checked = p.skipEmpty !== false;
  trimLines.checked = !!p.trim;
  if (p.numberStyle) numberStyle.value = p.numberStyle;
  if (p.joiner) joiner.value = p.joiner;
  if ('customJoin' in p) customJoin.value = p.customJoin;
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}

/* ---------- actions ---------- */
$('btnCopy').addEventListener('click', async () => {
  const text = output.textContent;
  if (!text) { toast('Nothing to copy'); return; }
  await navigator.clipboard.writeText(text);
  toast('Copied to clipboard');
});

$('btnClear').addEventListener('click', () => {
  input.value = '';
  render();
  input.focus();
});

$('btnDownload').addEventListener('click', () => {
  const text = output.textContent;
  if (!text) { toast('Nothing to download'); return; }
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lineforge-output.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Downloaded as .txt');
});

/* ---------- init ---------- */
(async () => {
  await loadPrefs();
  render();
})();

// expose for Node smoke tests (harmless in browser)
if (typeof module !== 'undefined') module.exports = { transform };
