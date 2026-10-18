// ============================================================================
// popup.js — Cookie Jar: per-domain cookie profiles (snapshot / clear / restore)
// with a viewer of current cookies for the active tab's domain.
//
// Honest model: jars are manual cookie snapshots. Restoring a jar REPLACES the
// domain's current cookies with the saved set. This is NOT container isolation,
// a VPN, or fingerprint protection. All data stays in chrome.storage.local.
// ============================================================================

'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  domainPill: $('domainPill'),
  domainLabel: $('domainLabel'),
  cookieCount: $('cookieCount'),
  cookieList: $('cookieList'),
  emptyCookies: $('emptyCookies'),
  jarName: $('jarName'),
  snapshotBtn: $('snapshotBtn'),
  clearBtn: $('clearBtn'),
  jarList: $('jarList'),
  emptyJars: $('emptyJars'),
  wipeJarsBtn: $('wipeJarsBtn'),
};

// ---- domain -----------------------------------------------------------------
function domainFromUrl(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

async function currentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return null;
  return domainFromUrl(tab.url);
}

// ---- storage ----------------------------------------------------------------
// Shape: { jars: { [domain]: [ { id, name, createdAt, cookies: [...] } ] } }
async function loadJars() {
  const { jars = {} } = await chrome.storage.local.get('jars');
  return jars;
}
async function saveJars(jars) {
  await chrome.storage.local.set({ jars });
}

// ---- cookies ----------------------------------------------------------------
// A cookie is stored as a plain, restorable object (not the live Cookie type).
function serializable(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: !!cookie.secure,
    httpOnly: !!cookie.httpOnly,
    sameSite: cookie.sameSite || 'unspecified',
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId,
  };
}

async function cookiesFor(domain) {
  // chrome.cookies.getAll with a domain match covers the domain + subdomains.
  return chrome.cookies.getAll({ domain });
}

async function removeCookie(c) {
  // Removal URL must be http(s) + domain without leading dot + path.
  const url = 'http' + (c.secure ? 's' : '') + '://' + c.domain.replace(/^\./, '') + c.path;
  try { await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId }); } catch { /* gone */ }
}

async function setCookie(c) {
  const url = 'http' + (c.secure ? 's' : '') + '://' + c.domain.replace(/^\./, '') + c.path;
  const details = {
    url,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    storeId: c.storeId,
    sameSite: c.sameSite === 'unspecified' ? undefined : c.sameSite,
  };
  if (c.expirationDate && c.expirationDate > Date.now() / 1000) {
    details.expirationDate = c.expirationDate;
  }
  Object.keys(details).forEach((k) => details[k] === undefined && delete details[k]);
  try { await chrome.cookies.set(details); } catch (e) {
    console.warn('Cookie Jar: could not restore cookie', c.name, e && e.message);
  }
}

// ---- render ------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function renderCookies(domain) {
  const cookies = await cookiesFor(domain);
  els.cookieCount.textContent = `(${cookies.length})`;
  els.cookieList.innerHTML = '';
  els.emptyCookies.style.display = cookies.length ? 'none' : '';
  for (const c of cookies.sort((a, b) => a.name.localeCompare(b.name))) {
    const li = document.createElement('li');
    li.className = 'cookie-item';
    const tags = [c.httpOnly ? 'httpOnly' : null, c.secure ? 'secure' : null, c.session ? 'session' : null]
      .filter(Boolean).join(' · ');
    li.innerHTML = `
      <div class="cookie-info">
        <div class="cookie-name">${escapeHtml(c.name)}</div>
        <div class="cookie-meta">${escapeHtml(tags || 'plain')} · ${escapeHtml(String(c.value).slice(0, 40))}${c.value.length > 40 ? '…' : ''}</div>
      </div>
      <button class="btn ghost small" data-name="${escapeHtml(c.name)}">Delete</button>`;
    els.cookieList.appendChild(li);
  }
  els.cookieList.onclick = async (e) => {
    const btn = e.target.closest('button[data-name]');
    if (!btn) return;
    const target = cookies.find((c) => c.name === btn.dataset.name);
    if (target) await removeCookie(target);
    renderCookies(domain);
  };
}

async function renderJars(domain) {
  const jars = await loadJars();
  const list = jars[domain] || [];
  els.jarList.innerHTML = '';
  els.emptyJars.style.display = list.length ? 'none' : '';
  for (const j of list) {
    const li = document.createElement('li');
    li.className = 'jar-item';
    const date = new Date(j.createdAt).toLocaleString();
    li.innerHTML = `
      <div class="jar-info">
        <div class="jar-name">${escapeHtml(j.name)}</div>
        <div class="jar-meta">${j.cookies.length} cookies · ${escapeHtml(date)}</div>
      </div>
      <div class="jar-actions">
        <button class="btn primary small" data-act="restore" data-id="${j.id}">Restore</button>
        <button class="btn ghost small" data-act="delete" data-id="${j.id}">Delete</button>
      </div>`;
    els.jarList.appendChild(li);
  }
  els.jarList.onclick = async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const all = await loadJars();
    const cur = all[domain] || [];
    const jar = cur.find((x) => x.id === btn.dataset.id);
    if (!jar) return;

    if (btn.dataset.act === 'delete') {
      all[domain] = cur.filter((x) => x.id !== jar.id);
      if (!all[domain].length) delete all[domain];
      await saveJars(all);
      renderJars(domain);
      return;
    }

    if (btn.dataset.act === 'restore') {
      // Replace current cookies for this domain with the jar's set.
      const existing = await cookiesFor(domain);
      for (const c of existing) await removeCookie(c);
      for (const c of jar.cookies) await setCookie(c);
      renderCookies(domain);
    }
  };
}

// ---- actions -----------------------------------------------------------------
async function init() {
  const domain = await currentDomain();
  if (!domain) {
    els.domainPill.textContent = 'no tab';
    els.domainLabel.textContent = 'this page';
    return;
  }
  els.domainPill.textContent = domain;
  els.domainPill.title = domain;
  els.domainLabel.textContent = domain;

  await renderCookies(domain);
  await renderJars(domain);

  els.snapshotBtn.addEventListener('click', async () => {
    const cookies = await cookiesFor(domain);
    const jars = await loadJars();
    const jar = {
      id: 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: els.jarName.value.trim() || `Snapshot ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      cookies: cookies.map(serializable),
    };
    jars[domain] = jars[domain] || [];
    jars[domain].push(jar);
    await saveJars(jars);
    els.jarName.value = '';
    renderJars(domain);
  });

  els.clearBtn.addEventListener('click', async () => {
    const cookies = await cookiesFor(domain);
    for (const c of cookies) await removeCookie(c);
    renderCookies(domain);
  });

  els.wipeJarsBtn.addEventListener('click', async () => {
    if (confirm('Delete ALL saved cookie jars?')) {
      await chrome.storage.local.remove('jars');
      renderJars(domain);
    }
  });
}

init();
