/* VoiceNav popup — on-device speech recognition + command dispatch.
   No audio is recorded or transmitted; SpeechRecognition runs in the browser. */
'use strict';

const micBtn = document.getElementById('micBtn');
const micState = document.getElementById('micState');
const heard = document.getElementById('heard');
const statusDot = document.getElementById('statusDot');
const confirmNav = document.getElementById('confirmNav');
const langSel = document.getElementById('langSel');
const logList = document.getElementById('logList');

/* ---------- command catalogue (shown in UI) ---------- */
const COMMANDS = [
  ['"scroll down" / "scroll up"', 'scroll the page'],
  ['"scroll to top" / "scroll to bottom"', 'jump to page ends'],
  ['"go back" / "go forward"', 'browser history'],
  ['"reload"', 'refresh the page'],
  ['"new tab" / "close tab"', 'tab control'],
  ['"click …"', 'click element by its text, e.g. "click search"'],
  ['"open …"', 'open a site, e.g. "open wikipedia"'],
  ['"read page"', 'read visible text aloud'],
  ['"stop"', 'stop speaking'],
];

const cmdList = document.getElementById('cmdList');
for (const [cmd, desc] of COMMANDS) {
  const li = document.createElement('li');
  const code = document.createElement('code');
  code.textContent = cmd;
  const span = document.createElement('span');
  span.textContent = desc;
  li.append(code, span);
  cmdList.appendChild(li);
}

/* ---------- settings ---------- */
let settings = { confirmNav: true, lang: 'en-US' };
chrome.storage.local.get({ confirmNav: true, lang: 'en-US' }, (s) => {
  settings = s;
  confirmNav.checked = s.confirmNav;
  langSel.value = s.lang;
});
confirmNav.addEventListener('change', () => {
  settings.confirmNav = confirmNav.checked;
  chrome.storage.local.set({ confirmNav: confirmNav.checked });
});
langSel.addEventListener('change', () => {
  settings.lang = langSel.value;
  chrome.storage.local.set({ lang: langSel.value });
  if (recognition) recognition.lang = langSel.value;
});

/* ---------- log ---------- */
let log = [];
function addLog(text, kind = '') {
  log.unshift({ text, kind, at: new Date().toLocaleTimeString() });
  log = log.slice(0, 12);
  chrome.storage.local.set({ log });
  renderLog();
}
function renderLog() {
  logList.innerHTML = '';
  if (!log.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No commands yet';
    logList.appendChild(li);
    return;
  }
  for (const e of log) {
    const li = document.createElement('li');
    if (e.kind) li.className = e.kind;
    const t = document.createElement('span');
    t.textContent = e.at;
    const m = document.createElement('span');
    m.textContent = e.text;
    li.append(t, m);
    logList.appendChild(li);
  }
}
chrome.storage.local.get({ log: [] }, (s) => { log = s.log; renderLog(); });
document.getElementById('clearLog').addEventListener('click', () => {
  log = [];
  chrome.storage.local.set({ log });
  renderLog();
});

/* ---------- speech recognition ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (!SR) {
  micState.textContent = 'Speech recognition not supported in this browser';
  micBtn.disabled = true;
  micBtn.style.opacity = '.4';
}

function setListening(on) {
  listening = on;
  micBtn.classList.toggle('listening', on);
  statusDot.classList.toggle('live', on);
  micState.textContent = on ? 'Listening…' : 'Tap the mic to start';
  if (!on) heard.textContent = '';
}

function startRecognition() {
  recognition = new SR();
  recognition.lang = settings.lang;
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) handleCommand(t.trim().toLowerCase());
      else interim += t;
    }
    heard.textContent = interim ? '“' + interim + '”' : '';
  };
  recognition.onerror = (ev) => {
    addLog('Mic error: ' + ev.error, 'err');
    setListening(false);
  };
  recognition.onend = () => { if (listening) { try { recognition.start(); } catch { setListening(false); } } };
  recognition.start();
  setListening(true);
}

micBtn.addEventListener('click', () => {
  if (!SR) return;
  if (listening) {
    listening = false;
    try { recognition.stop(); } catch {}
    setListening(false);
  } else {
    speechSynthesis.cancel();
    startRecognition();
  }
});

/* ---------- command handling ---------- */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToPage(action, payload = {}) {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error('no active tab');
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {}
  return chrome.tabs.sendMessage(tab.id, { action, ...payload });
}

async function confirmIfNeeded(label, fn) {
  if (!settings.confirmNav) return fn();
  heard.textContent = 'Say "yes" to confirm: ' + label;
  const ok = await waitForYesNo(6000);
  if (ok) return fn();
  addLog('Cancelled: ' + label, 'err');
}

function waitForYesNo(ms) {
  return new Promise((resolve) => {
    const onR = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        const t = ev.results[i][0].transcript.trim().toLowerCase();
        if (/^(yes|yeah|yep|confirm|ok|okay|sure)$/.test(t)) { cleanup(); resolve(true); }
        else if (/^(no|nope|cancel|never)$/.test(t)) { cleanup(); resolve(false); }
      }
    };
    const cleanup = () => recognition && recognition.removeEventListener('result', onR);
    recognition.addEventListener('result', onR);
    setTimeout(() => { cleanup(); resolve(false); }, ms);
  });
}

async function handleCommand(text) {
  heard.textContent = '“' + text + '”';
  try {
    if (/^(stop|quiet|shut up)$/.test(text)) {
      speechSynthesis.cancel();
      addLog('Heard "' + text + '" → stopped speech', 'ok');
    } else if (/scroll down/.test(text)) {
      await sendToPage('scroll', { dy: 600 }); ok('scrolled down');
    } else if (/scroll up/.test(text)) {
      await sendToPage('scroll', { dy: -600 }); ok('scrolled up');
    } else if (/scroll to (top|beginning)/.test(text)) {
      await sendToPage('scrollTo', { where: 'top' }); ok('scrolled to top');
    } else if (/scroll to (bottom|end)/.test(text)) {
      await sendToPage('scrollTo', { where: 'bottom' }); ok('scrolled to bottom');
    } else if (/go back|previous page/.test(text)) {
      await confirmIfNeeded('go back', () => sendToPage('history', { dir: -1 })); ok('went back');
    } else if (/go forward|next page/.test(text)) {
      await confirmIfNeeded('go forward', () => sendToPage('history', { dir: 1 })); ok('went forward');
    } else if (/reload|refresh/.test(text)) {
      await sendToPage('reload'); ok('reloaded');
    } else if (/new tab/.test(text)) {
      await confirmIfNeeded('open a new tab', () => chrome.tabs.create({})); ok('opened new tab');
    } else if (/close tab/.test(text)) {
      await confirmIfNeeded('close this tab', async () => { const t = await activeTab(); chrome.tabs.remove(t.id); }); ok('closed tab');
    } else if (/^click (.+)/.test(text)) {
      const target = text.match(/^click (.+)/)[1];
      const res = await sendToPage('clickText', { text: target });
      addLog('Heard "' + text + '" → ' + (res && res.found ? 'clicked "' + res.label + '"' : 'no match for "' + target + '"'), res && res.found ? 'ok' : 'err');
    } else if (/^open (.+)/.test(text)) {
      const site = text.match(/^open (.+)/)[1].replace(/\s+/g, '');
      const url = /^https?:\/\//.test(site) ? site : 'https://' + site + (site.includes('.') ? '' : '.com');
      await confirmIfNeeded('open ' + url, () => chrome.tabs.create({ url }));
      ok('opened ' + url);
    } else if (/read page|read this/.test(text)) {
      const res = await sendToPage('readText');
      if (res && res.text) {
        const u = new SpeechSynthesisUtterance(res.text.slice(0, 2000));
        u.lang = settings.lang;
        speechSynthesis.speak(u);
        addLog('Heard "' + text + '" → reading page aloud', 'ok');
      } else addLog('Heard "' + text + '" → no readable text', 'err');
    } else {
      addLog('Heard "' + text + '" → not a known command', 'err');
    }
  } catch (e) {
    addLog('Failed "' + text + '": ' + e.message, 'err');
  }
  function ok(msg) { addLog('Heard "' + text + '" → ' + msg, 'ok'); }
}
