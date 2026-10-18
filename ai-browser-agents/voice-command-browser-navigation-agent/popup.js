/* VoiceNav — press-and-hold voice control for browser navigation.
   Mic activates ONLY while the button is held. Chrome-only (Web Speech API). */
'use strict';

const $ = id => document.getElementById(id);
const talkBtn = $('talk'), talkLabel = $('talkLabel');
const heard = $('heard'), status = $('status'), cmdsBox = $('cmds');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supported = !!SpeechRecognition;

/* phrase alternatives → action name */
const COMMANDS = [
  { phrases: ['new tab', 'open new tab'], name: 'New tab', run: () => chrome.tabs.create({}) },
  { phrases: ['close tab', 'close this tab'], name: 'Close tab', run: async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (t) chrome.tabs.remove(t.id); } },
  { phrases: ['go back', 'back'], name: 'Go back', run: async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (t) chrome.tabs.goBack(t.id); } },
  { phrases: ['go forward', 'forward'], name: 'Go forward', run: async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (t) chrome.tabs.goForward(t.id); } },
  { phrases: ['reload', 'refresh'], name: 'Reload', run: async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (t) chrome.tabs.reload(t.id); } },
  { phrases: ['scroll down'], name: 'Scroll down', run: () => injectScroll(400) },
  { phrases: ['scroll up'], name: 'Scroll up', run: () => injectScroll(-400) },
  { phrases: ['zoom in'], name: 'Zoom in', run: () => zoom(0.1) },
  { phrases: ['zoom out'], name: 'Zoom out', run: () => zoom(-0.1) },
  { phrases: ['open history', 'show history'], name: 'Open history', run: () => chrome.tabs.create({ url: 'chrome://history' }) },
  { phrases: ['open bookmarks', 'show bookmarks'], name: 'Open bookmarks', run: () => chrome.tabs.create({ url: 'chrome://bookmarks' }) },
  { phrases: ['open downloads', 'show downloads'], name: 'Open downloads', run: () => chrome.tabs.create({ url: 'chrome://downloads' }) },
];

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function injectScroll(dy) {
  activeTab().then(t => {
    if (!t) return;
    chrome.scripting.executeScript({
      target: { tabId: t.id },
      func: dy => window.scrollBy({ top: dy, behavior: 'smooth' }),
      args: [dy]
    }).catch(() => say('Cannot scroll this page (restricted page).'));
  });
}

function zoom(delta) {
  activeTab().then(async t => {
    if (!t) return;
    try {
      const z = await chrome.tabs.getZoom(t.id);
      await chrome.tabs.setZoom(t.id, Math.min(5, Math.max(0.25, +(z + delta).toFixed(2))));
    } catch { say('Cannot zoom this page.'); }
  });
}

function say(msg, ok) {
  status.textContent = msg;
  status.className = 'status' + (ok ? ' ok' : '');
}

function matchCommand(text) {
  const norm = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return COMMANDS.find(c => c.phrases.some(p => norm.includes(p)));
}

/* Render command reference list */
for (const c of COMMANDS) {
  const div = document.createElement('div');
  div.className = 'cmd';
  const b = document.createElement('b');
  b.textContent = '"' + c.phrases[0] + '"';
  div.append(b, document.createTextNode(' → ' + c.name));
  cmdsBox.appendChild(div);
}

let rec = null;
let holding = false;

function startListening() {
  if (!supported) { say('Speech recognition is not supported in this browser (Chrome only).'); return; }
  holding = true;
  talkBtn.classList.add('listening');
  talkLabel.textContent = 'Listening… release to run';
  heard.hidden = true;
  say('');
  rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = e => {
    const text = Array.from(e.results[0]).map(a => a.transcript).join(' ');
    heard.textContent = '"' + text + '"';
    heard.hidden = false;
    const cmd = matchCommand(text);
    if (cmd) {
      say('Running: ' + cmd.name, true);
      try { cmd.run(); } catch { say('Command failed.'); }
    } else {
      say('No matching command heard.');
    }
  };
  rec.onerror = e => { say('Speech error: ' + e.error); };
  rec.onend = () => { if (holding) { try { rec.start(); } catch {} } }; // keep listening while held
  try { rec.start(); } catch {}
}

function stopListening() {
  holding = false;
  talkBtn.classList.remove('listening');
  talkLabel.textContent = 'Press & hold to talk';
  if (rec) { try { rec.onend = null; rec.stop(); } catch {} rec = null; }
}

talkBtn.addEventListener('pointerdown', e => { e.preventDefault(); startListening(); });
window.addEventListener('pointerup', stopListening);
window.addEventListener('blur', stopListening); // popup closing stops the mic

if (!supported) {
  talkBtn.style.opacity = '.5';
  say('Speech recognition unavailable — requires Chrome/Edge.');
}
