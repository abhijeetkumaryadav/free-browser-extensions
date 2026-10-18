/* RegexLab — bulk find → replace.
   Rules apply sequentially to the source text. Plain-text mode escapes
   the pattern; regex mode compiles with the 'g' flag (+ 'i' when the
   case-insensitive toggle is on). Live preview shows per-rule match
   counts against the original source and the fully transformed result. */

'use strict';

const $ = (id) => document.getElementById(id);
const els = { source: $('source'), rules: $('rules'), result: $('result'),
              status: $('status'), addRule: $('addRule'), apply: $('apply'),
              clear: $('clear'), copy: $('copy'), setName: $('setName'),
              saveSet: $('saveSet'), setList: $('setList') };

let rules = [];   // {find, replace, regex, ci, enabled}

/* ---------- core engine (pure, testable) ---------- */
function escapePlain(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRule(rule) {
  // Returns {re} or {error}. Always global so counts/preview replace all.
  if (!rule.find) return { error: 'empty' };
  try {
    const pattern = rule.regex ? rule.find : escapePlain(rule.find);
    return { re: new RegExp(pattern, 'g' + (rule.ci ? 'i' : '')) };
  } catch (err) {
    return { error: err.message };
  }
}

function countMatches(src, rule) {
  const { re, error } = compileRule(rule);
  if (error) return { count: 0, error };
  const m = src.match(re);
  return { count: m ? m.length : 0 };
}

function applyRules(src, ruleList) {
  // Sequential application. Regex mode uses string replacement so $1-style
  // group references work; plain mode escapes the pattern first.
  let out = src;
  let total = 0;
  for (const rule of ruleList) {
    if (!rule.enabled) continue;
    const { re, error } = compileRule(rule);
    if (error) continue;
    const { count } = countMatches(out, rule);
    out = rule.regex ? out.replace(re, rule.replace) : out.replace(re, () => rule.replace);
    total += count;
  }
  return { out, total };
}

/* ---------- UI: rule rows ---------- */
function ruleRow(rule, idx) {
  const div = document.createElement('div');
  div.className = 'rule';

  const top = document.createElement('div');
  top.className = 'rule-top';
  const find = document.createElement('input');
  find.type = 'text'; find.placeholder = 'Find…'; find.value = rule.find;
  find.setAttribute('aria-label', 'Find pattern');
  const arrow = document.createElement('span');
  arrow.className = 'arrow'; arrow.textContent = '→';
  const replace = document.createElement('input');
  replace.type = 'text'; replace.placeholder = 'Replace with…'; replace.value = rule.replace;
  replace.setAttribute('aria-label', 'Replacement');
  top.append(find, arrow, replace);

  const meta = document.createElement('div');
  meta.className = 'rule-meta';

  const mkCheck = (label, checked, title) => {
    const lab = document.createElement('label');
    lab.title = title;
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = checked;
    lab.append(box, document.createTextNode(label));
    return { lab, box };
  };
  const rx = mkCheck('.*', rule.regex, 'Treat pattern as a regular expression');
  const ci = mkCheck('Aa', rule.ci, 'Case-insensitive');
  const on = mkCheck('On', rule.enabled, 'Include this rule when applying');

  const count = document.createElement('span');
  count.className = 'count'; count.textContent = '—';

  const del = document.createElement('button');
  del.className = 'rule-del'; del.type = 'button'; del.title = 'Delete rule';
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

  meta.append(rx.lab, ci.lab, on.lab, count, del);
  div.append(top, meta);

  const sync = () => {
    rule.find = find.value; rule.replace = replace.value;
    rule.regex = rx.box.checked; rule.ci = ci.box.checked; rule.enabled = on.box.checked;
    refresh();
  };
  find.addEventListener('input', sync);
  replace.addEventListener('input', sync);
  rx.box.addEventListener('change', sync);
  ci.box.addEventListener('change', sync);
  on.box.addEventListener('change', sync);
  del.addEventListener('click', () => { rules.splice(idx, 1); renderRules(); refresh(); });

  div._countEl = count;
  return div;
}

function renderRules() {
  els.rules.innerHTML = '';
  if (rules.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--muted);font-size:12px;text-align:center;padding:8px';
    p.textContent = 'No rules yet — add one to begin.';
    els.rules.append(p);
    return;
  }
  rules.forEach((r, i) => els.rules.append(ruleRow(r, i)));
}

/* ---------- live preview ---------- */
function refresh() {
  const src = els.source.value;
  const rows = [...els.rules.querySelectorAll('.rule')];
  rows.forEach((row, i) => {
    const rule = rules[i];
    if (!rule || !rule.enabled || !rule.find) {
      row._countEl.textContent = '—';
      row._countEl.classList.remove('bad');
      return;
    }
    const { count, error } = countMatches(src, rule);
    row._countEl.textContent = error && error !== 'empty' ? 'bad regex' : `${count} hit${count === 1 ? '' : 's'}`;
    row._countEl.classList.toggle('bad', !!(error && error !== 'empty'));
    if (error && error !== 'empty') row._countEl.title = error;
  });

  const { out, total } = applyRules(src, rules);
  els.result.textContent = src ? out : 'Result appears here.';
  els.result.dataset.total = total;
  scheduleSave();
}

/* ---------- actions ---------- */
function showStatus(msg, ok) {
  els.status.hidden = false;
  els.status.textContent = msg;
  els.status.classList.toggle('ok', !!ok);
}

els.addRule.addEventListener('click', () => {
  rules.push({ find: '', replace: '', regex: false, ci: false, enabled: true });
  renderRules(); refresh();
  const last = els.rules.querySelector('.rule:last-child input');
  if (last) last.focus();
});

els.apply.addEventListener('click', () => {
  const total = Number(els.result.dataset.total || 0);
  const active = rules.filter(r => r.enabled && r.find).length;
  showStatus(`Applied ${active} rule${active === 1 ? '' : 's'} — ${total} replacement${total === 1 ? '' : 's'} total.`, true);
});

els.clear.addEventListener('click', () => {
  els.source.value = '';
  rules = [];
  renderRules(); refresh();
  els.status.hidden = true;
  chrome.storage.local.remove('regexlabDraft');
});

els.copy.addEventListener('click', async () => {
  const text = els.result.textContent;
  if (!text || text === 'Result appears here.') return;
  await navigator.clipboard.writeText(text);
  $('copyLabel').textContent = 'Copied ✓';
  setTimeout(() => { $('copyLabel').textContent = 'Copy'; }, 1200);
});

els.source.addEventListener('input', refresh);

/* ---------- draft autosave (debounced) ---------- */
let saveT;
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => chrome.storage.local.set({
    regexlabDraft: { source: els.source.value, rules }
  }), 400);
}

/* ---------- saved rule sets ---------- */
function renderSets(sets) {
  els.setList.innerHTML = '';
  const names = Object.keys(sets || {});
  if (names.length === 0) {
    els.setList.innerHTML = '<p style="color:var(--muted);font-size:11px">No saved sets yet.</p>';
    return;
  }
  names.sort().forEach((name) => {
    const div = document.createElement('div');
    div.className = 'set';
    const nm = document.createElement('span');
    nm.className = 'name'; nm.textContent = `${name} (${sets[name].length})`;
    const load = document.createElement('button');
    load.type = 'button'; load.textContent = 'Load';
    load.addEventListener('click', () => {
      rules = sets[name].map(r => ({ ...r }));
      renderRules(); refresh();
      showStatus(`Loaded set “${name}”.`, true);
    });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.textContent = 'Delete';
    del.addEventListener('click', () => {
      delete sets[name];
      chrome.storage.local.set({ regexlabSets: sets }, () => renderSets(sets));
    });
    div.append(nm, load, del);
    els.setList.append(div);
  });
}

els.saveSet.addEventListener('click', () => {
  const name = els.setName.value.trim();
  if (!name) { showStatus('Give the set a name first.', false); return; }
  if (rules.length === 0) { showStatus('Add at least one rule before saving.', false); return; }
  chrome.storage.local.get('regexlabSets', ({ regexlabSets = {} }) => {
    regexlabSets[name] = rules.map(r => ({ ...r }));
    chrome.storage.local.set({ regexlabSets }, () => {
      els.setName.value = '';
      renderSets(regexlabSets);
      showStatus(`Saved set “${name}”.`, true);
    });
  });
});

/* ---------- init ---------- */
chrome.storage.local.get(['regexlabDraft', 'regexlabSets'], (data) => {
  if (data.regexlabDraft) {
    els.source.value = data.regexlabDraft.source || '';
    rules = (data.regexlabDraft.rules || []).map(r => ({ enabled: true, ...r }));
  } else {
    rules = [{ find: '', replace: '', regex: false, ci: false, enabled: true }];
  }
  renderRules();
  refresh();
  renderSets(data.regexlabSets);
});
