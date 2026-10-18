/* Untrusted SSL Blocker — popup logic. */
'use strict';

const $ = id => document.getElementById(id);

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

async function getDomains() {
  const { httpsOnly = [] } = await chrome.storage.local.get('httpsOnly');
  return httpsOnly;
}
async function setDomains(d) { await chrome.storage.local.set({ httpsOnly: d }); }

function renderDomains(domains, currentHost) {
  const box = $('domainList');
  box.innerHTML = '';
  if (!domains.length) {
    box.innerHTML = '<p class="muted">No domains yet. Add sites you always want over HTTPS.</p>';
    return;
  }
  domains.forEach(d => {
    const row = document.createElement('div');
    row.className = 'domitem';
    const label = document.createElement('span');
    label.textContent = d + (d === currentHost ? '  •  this site' : '');
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.title = 'Remove';
    rm.addEventListener('click', async () => {
      await setDomains((await getDomains()).filter(x => x !== d));
      renderDomains(await getDomains(), currentHost);
    });
    row.append(label, rm);
    box.appendChild(row);
  });
}

function renderForms(forms, isHttp) {
  const box = $('formsList');
  box.innerHTML = '';
  if (!forms.length) {
    box.innerHTML = '<p class="muted">No password or payment forms detected on this page.</p>';
    return;
  }
  forms.forEach(f => {
    const div = document.createElement('div');
    // High risk only when the page itself is not secure; otherwise informational.
    div.className = 'formitem' + (isHttp ? '' : ' ok');
    const dot = document.createElement('span'); dot.className = 'dot';
    const txt = document.createElement('span');
    const kinds = [f.hasPassword && 'password', f.hasPayment && 'payment'].filter(Boolean).join(' + ');
    txt.textContent = `Form #${f.index} collects ${kinds}` + (isHttp ? ' — HIGH RISK over HTTP' : ' — page is HTTPS');
    div.append(dot, txt);
    box.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  let tab = null;
  try { tab = await activeTab(); } catch (e) {}

  const url = (tab && tab.url) || '';
  const isHttp = url.startsWith('http://');
  const isHttps = url.startsWith('https://');
  const host = hostOf(url);
  const badge = $('protoBadge');

  if (isHttps) {
    badge.textContent = 'HTTPS'; badge.classList.add('secure');
    $('verdict').textContent = 'Encrypted connection. Good.';
  } else if (isHttp) {
    badge.textContent = 'HTTP'; badge.classList.add('insecure');
    $('verdict').textContent = 'Plain HTTP — traffic is not encrypted.';
    $('warnBox').classList.remove('hidden');
  } else {
    badge.textContent = 'N/A'; badge.classList.add('na');
    $('verdict').textContent = 'Not a web page (or a browser-internal page).';
  }
  $('host').textContent = host || '—';

  // Warn if this host is on the user's HTTPS-only list but loaded over HTTP.
  const domains = await getDomains();
  if (isHttp && domains.includes(host)) {
    $('verdict').textContent = 'On your HTTPS-only list, but loaded over HTTP!';
  }

  // Scan for sensitive forms (web pages only).
  if (/^https?:/.test(url)) {
    try {
      let res;
      try { res = await chrome.tabs.sendMessage(tab.id, { action: 'usb-scan-forms' }); }
      catch (e) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        res = await chrome.tabs.sendMessage(tab.id, { action: 'usb-scan-forms' });
      }
      renderForms(res.forms || [], isHttp);
    } catch (e) {
      $('formsList').innerHTML = '<p class="muted">Could not scan this page.</p>';
    }
  } else {
    $('formsList').innerHTML = '<p class="muted">Form scan needs a regular web page.</p>';
  }

  $('tryHttps').addEventListener('click', async () => {
    if (tab && isHttp) {
      const httpsUrl = 'https://' + url.slice('http://'.length);
      await chrome.tabs.update(tab.id, { url: httpsUrl });
      window.close();
    }
  });

  renderDomains(domains, host);

  const addDomain = async raw => {
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!d || !d.includes('.')) return;
    const list = await getDomains();
    if (!list.includes(d)) { list.push(d); await setDomains(list); }
    $('domainInput').value = '';
    renderDomains(await getDomains(), host);
  };
  $('addDomain').addEventListener('click', () => addDomain($('domainInput').value));
  $('domainInput').addEventListener('keydown', e => { if (e.key === 'Enter') addDomain(e.target.value); });
  $('addCurrent').addEventListener('click', () => { if (host) addDomain(host); });
});
