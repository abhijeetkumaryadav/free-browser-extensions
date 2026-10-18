/* StyleForge popup logic — CRUD for CSS rules, import/export, live apply. */
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

async function getRules() {
  const { rules = [] } = await chrome.storage.local.get('rules');
  return rules;
}
async function setRules(rules) {
  await chrome.storage.local.set({ rules });
}

/* Re-apply rules to the active tab so toggles take effect immediately. */
async function reapplyActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) return;
    const host = new URL(tab.url).hostname.toLowerCase();
    const rules = await getRules();
    const css = rules
      .filter((r) => r.enabled && (r.scope === 'global' || host === r.domain || host.endsWith('.' + r.domain)))
      .map((r) => r.css).join('\n');
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: css ? 'styleforge:apply' : 'styleforge:remove', css });
    } catch { /* not scriptable */ }
  } catch { /* no tab */ }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function render() {
  const rules = await getRules();
  const list = $('ruleList');
  if (!rules.length) {
    list.innerHTML = '<div class="empty">No rules yet — write your first stylesheet below.</div>';
    return;
  }
  list.innerHTML = '';
  for (const r of rules) {
    const div = document.createElement('div');
    div.className = 'rule' + (r.enabled ? '' : ' off');
    const scopeTxt = r.scope === 'global' ? 'Global' : '@ ' + r.domain;
    div.innerHTML = `
      <div class="info"><div class="name">${escapeHtml(r.name)}</div><div class="scope">${escapeHtml(scopeTxt)}</div></div>
      <button class="toggle" role="switch" aria-checked="${r.enabled}"><span class="knob"></span></button>
      <button class="del" title="Delete rule">✕</button>`;
    div.querySelector('.toggle').addEventListener('click', async () => {
      const all = await getRules();
      const t = all.find((x) => x.id === r.id);
      if (t) { t.enabled = !t.enabled; await setRules(all); await render(); await reapplyActiveTab(); }
    });
    div.querySelector('.del').addEventListener('click', async () => {
      await setRules((await getRules()).filter((x) => x.id !== r.id));
      await render(); await reapplyActiveTab();
    });
    list.appendChild(div);
  }
}

async function currentHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return new URL(tab.url).hostname;
  } catch { return ''; }
}

document.addEventListener('DOMContentLoaded', async () => {
  await render();

  $('ruleScope').addEventListener('change', async (e) => {
    const site = e.target.value === 'site';
    $('ruleDomain').disabled = !site;
    if (site && !$('ruleDomain').value) $('ruleDomain').value = await currentHost();
  });

  $('addRule').addEventListener('click', async () => {
    const name = $('ruleName').value.trim() || 'Untitled rule';
    const scope = $('ruleScope').value;
    const domain = $('ruleDomain').value.trim().toLowerCase();
    const css = $('ruleCss').value;
    if (!css.trim()) { $('ruleCss').focus(); return; }
    if (scope === 'site' && !domain) { $('ruleDomain').focus(); return; }
    const rules = await getRules();
    rules.push({ id: uid(), name, scope, domain, css, enabled: true, created: Date.now() });
    await setRules(rules);
    $('ruleName').value = ''; $('ruleCss').value = '';
    await render(); await reapplyActiveTab();
  });

  $('exportBtn').addEventListener('click', async () => {
    const rules = await getRules();
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'styleforge-rules.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data)) throw new Error('not an array');
      const rules = await getRules();
      for (const r of data) {
        if (typeof r.css !== 'string') continue;
        rules.push({
          id: uid(), name: String(r.name || 'Imported rule'),
          scope: r.scope === 'site' ? 'site' : 'global',
          domain: String(r.domain || '').toLowerCase(),
          css: r.css, enabled: r.enabled !== false, created: Date.now()
        });
      }
      await setRules(rules);
      await render(); await reapplyActiveTab();
    } catch { /* invalid file — ignore */ }
    e.target.value = '';
  });
});
