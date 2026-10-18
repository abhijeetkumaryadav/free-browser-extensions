'use strict';
/* Form Fill Helper — regex rules applied user-triggered to the current tab's HTML form fields.
   Honest scope: HTML forms only. No PDF parsing. Preview before fill. */

const $ = (id) => document.getElementById(id);
const RULES_KEY = 'formfill_rules';

// ===== ENGINE-START =====
/** Validate and normalize a rule. Returns {pattern, value, ci} or throws. */
function makeRule(pattern, value, ci) {
  const pat = String(pattern || '').trim();
  const val = String(value || '');
  if (!pat) throw new Error('Pattern is required.');
  if (pat.length > 300) throw new Error('Pattern too long (max 300 chars).');
  if (val.length > 5000) throw new Error('Value too long (max 5000 chars).');
  try { new RegExp(pat, ci ? 'i' : ''); }
  catch (e) { throw new Error('Invalid regex: ' + e.message); }
  return { pattern: pat, value: val, ci: !!ci, id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4) };
}

/** Build RegExp objects for rules, skipping invalid ones. Returns [{rule, re}]. */
function compileRules(rules) {
  const out = [];
  for (const r of rules || []) {
    try { out.push({ rule: r, re: new RegExp(r.pattern, r.ci === false ? '' : 'i') }); }
    catch { /* skip broken rules */ }
  }
  return out;
}

/** Field key used for matching: name, id, placeholder, aria-label, type. */
function fieldKey(field) {
  return [field.name, field.id, field.placeholder, field.label, field.type]
    .filter(Boolean).join(' ').toLowerCase();
}

/** Preview which fields match which rule. fields: [{name,id,placeholder,label,type}]. */
function previewMatches(compiledRules, fields) {
  const rows = [];
  for (const f of fields || []) {
    const key = fieldKey(f);
    for (const { rule, re } of compiledRules) {
      if (re.test(f.name || '') || re.test(f.id || '') || re.test(f.placeholder || '') ||
          re.test(f.label || '') || re.test(f.type || '') || re.test(key)) {
        rows.push({ field: f, ruleId: rule.id, pattern: rule.pattern });
        break; // first matching rule wins
      }
    }
  }
  return rows;
}
// ===== ENGINE-END =====

const state = { rules: [] };

async function load() {
  const data = await chrome.storage.local.get(RULES_KEY);
  state.rules = Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [];
  render();
}
async function save() { await chrome.storage.local.set({ [RULES_KEY]: state.rules }); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const box = $('rules');
  $('ruleCount').textContent = state.rules.length ? `(${state.rules.length})` : '';
  if (!state.rules.length) { box.innerHTML = '<p class="empty">No rules yet. Add one above.</p>'; return; }
  box.innerHTML = state.rules.map((r) => `
    <div class="rule" data-id="${esc(r.id)}">
      <div class="info"><code>/${esc(r.pattern)}/${r.ci === false ? '' : 'i'}</code><span class="v">${esc(r.value)}</span></div>
      <button data-del title="Delete rule" aria-label="Delete rule">✕</button>
    </div>`).join('');
  box.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.rule').dataset.id;
      state.rules = state.rules.filter((r) => r.id !== id);
      await save(); render();
    });
  });
}

$('addBtn').addEventListener('click', async () => {
  try {
    const rule = makeRule($('pat').value, $('val').value, $('case').checked);
    if (state.rules.length >= 200) throw new Error('Rule cap reached (200).');
    state.rules.push(rule);
    await save(); render();
    $('pat').value = ''; $('val').value = '';
  } catch (e) { alert('Could not add rule: ' + e.message); }
});

// Content-script snippets injected user-triggered into the active tab.
function scanPage() {
  return Array.from(document.querySelectorAll('input, textarea, select'))
    .filter((el) => !el.disabled && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button')
    .map((el) => ({
      name: el.name || '', id: el.id || '', placeholder: el.placeholder || '',
      label: (el.getAttribute('aria-label') || '').slice(0, 120),
      type: (el.type || el.tagName.toLowerCase()).slice(0, 40),
    }));
}
function fillPage(plans) {
  const els = Array.from(document.querySelectorAll('input, textarea, select'))
    .filter((el) => !el.disabled && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button');
  let n = 0;
  for (const p of plans) {
    const el = els[p.index];
    if (!el || el.readOnly) continue;
    el.focus();
    if (el.tagName === 'SELECT') {
      const opt = Array.from(el.options).find((o) => o.value === p.value || o.text === p.value);
      if (opt) { el.value = opt.value; n++; }
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      // only tick checkboxes/radios when value says yes/true/1/on
      if (/^(yes|true|1|on)$/i.test(p.value.trim())) { el.checked = true; n++; }
    } else {
      el.value = p.value; n++;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return n;
}
function clearPage() {
  const els = Array.from(document.querySelectorAll('input, textarea, select'))
    .filter((el) => !el.disabled && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button');
  for (const el of els) {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
    else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return els.length;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab.');
  if (!/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular web page first.');
  return tab;
}

async function withTab(fn, args) {
  const tab = await activeTab();
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args });
  return res && res.result;
}

let lastScan = null; // {fields, matches}

$('scanBtn').addEventListener('click', async () => {
  $('preview').textContent = 'Scanning…';
  try {
    const fields = await withTab(scanPage) || [];
    const compiled = compileRules(state.rules);
    const matches = previewMatches(compiled, fields);
    lastScan = { fields, matches };
    $('fillBtn').disabled = !matches.length;
    if (!fields.length) $('preview').textContent = 'No fillable fields found on this tab.';
    else if (!matches.length) $('preview').textContent = `${fields.length} field(s) found, none matched your rules.`;
    else {
      $('preview').textContent = matches.map((m, i) =>
        `#${i + 1} field "${m.field.name || m.field.id || m.field.type}"  ←  /${m.pattern}/`).join('\n') +
        `\n\n${matches.length} of ${fields.length} field(s) matched. Review, then “Fill matched”.`;
    }
  } catch (e) { $('preview').textContent = 'Scan failed: ' + e.message; }
});

$('fillBtn').addEventListener('click', async () => {
  if (!lastScan || !lastScan.matches.length) return;
  try {
    // rebuild field indexes for matched fields
    const fields = lastScan.fields;
    const compiled = compileRules(state.rules);
    const matches = previewMatches(compiled, fields);
    const plans = [];
    for (const m of matches) {
      const idx = fields.indexOf(m.field);
      const rule = state.rules.find((r) => r.id === m.ruleId);
      if (idx >= 0 && rule) plans.push({ index: idx, value: rule.value });
    }
    const n = await withTab(fillPage, [plans]) || 0;
    $('preview').textContent = `Filled ${n} field(s). Review the page before submitting anything.`;
  } catch (e) { $('preview').textContent = 'Fill failed: ' + e.message; }
});

$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Clear all inputs on this tab?')) return;
  try { const n = await withTab(clearPage) || 0; $('preview').textContent = `Cleared ${n} field(s).`; }
  catch (e) { $('preview').textContent = 'Clear failed: ' + e.message; }
});

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ rules: state.rules }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'form-fill-rules.json'; a.click();
  URL.revokeObjectURL(a.href);
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const raw = Array.isArray(data) ? data : data.rules;
    if (!Array.isArray(raw)) throw new Error('Not a rules file.');
    const out = [];
    for (const r of raw.slice(0, 200)) out.push(makeRule(r.pattern, r.value, r.ci !== false));
    state.rules = out; await save(); render();
  } catch (err) { alert('Import failed: ' + err.message); }
  e.target.value = '';
});

load();
