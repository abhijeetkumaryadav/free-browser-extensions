// SlowSpeak popup — slow, clear on-device text-to-speech.
'use strict';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const synth = window.speechSynthesis;

let speaking = false;
let stopRequested = false;
let voices = [];

const DEFAULTS = { rate: 0.7, pitch: 1.0, pause: 0.8, voiceURI: '' };

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('ok', !!ok);
}

// Split text into sentences so we can pause between them for clarity.
function splitSentences(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?…]+[.!?…]+[""')\]]?|\S[^.!?…]*$/g);
  return (parts || [cleaned]).map((s) => s.trim()).filter(Boolean);
}

function loadVoices() {
  voices = synth.getVoices();
  const sel = $('voice');
  sel.innerHTML = '';
  if (!voices.length) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = 'Default system voice';
    sel.appendChild(o);
    return;
  }
  // Prefer local voices, then English.
  const sorted = [...voices].sort((a, b) => {
    const score = (v) => (v.localService ? 2 : 0) + (v.lang && v.lang.toLowerCase().startsWith('en') ? 1 : 0);
    return score(b) - score(a);
  });
  for (const v of sorted) {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = `${v.name} (${v.lang})${v.localService ? ' — on-device' : ''}`;
    sel.appendChild(o);
  }
  chrome.storage.local.get('slowspeak', ({ slowspeak }) => {
    const s = { ...DEFAULTS, ...(slowspeak || {}) };
    if (s.voiceURI && sorted.some((v) => v.voiceURI === s.voiceURI)) sel.value = s.voiceURI;
  });
}

function speakUtterance(text, settings) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    const v = voices.find((x) => x.voiceURI === settings.voiceURI);
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function play() {
  const text = $('text').value.trim();
  if (!text) { setStatus('Enter or grab some text first.', false); return; }
  stop();
  stopRequested = false;
  speaking = true;
  const settings = {
    rate: Number($('rate').value),
    pitch: Number($('pitch').value),
    pause: Number($('pause').value),
    voiceURI: $('voice').value,
  };
  await chrome.storage.local.set({ slowspeak: settings });

  const sentences = splitSentences(text);
  setStatus(`Reading ${sentences.length} sentence${sentences.length === 1 ? '' : 's'}…`, true);
  for (let i = 0; i < sentences.length; i++) {
    if (stopRequested) break;
    setStatus(`Sentence ${i + 1} of ${sentences.length}…`, true);
    await speakUtterance(sentences[i], settings);
    if (stopRequested || i === sentences.length - 1) break;
    if (settings.pause > 0) await wait(settings.pause * 1000);
  }
  speaking = false;
  if (!stopRequested) setStatus('Finished.', true);
}

function stop() {
  stopRequested = true;
  if (synth.speaking || synth.pending) synth.cancel();
  speaking = false;
  setStatus('Stopped.');
}

// Pull the current page selection into the text area (on-demand injection).
async function grabSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) throw new Error('No active tab.');
    try {
      await chrome.tabs.sendMessage(tab.id, { kind: 'slowspeak-ping' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await wait(150);
    }
    const res = await chrome.tabs.sendMessage(tab.id, { kind: 'slowspeak-selection' });
    if (res && res.text) {
      $('text').value = res.text.trim();
      setStatus('Selection loaded.', true);
    } else {
      setStatus('No text selected on the page.', false);
    }
  } catch (e) {
    setStatus('Cannot read this page (protected tab?).', false);
  }
}

async function init() {
  const { slowspeak } = await chrome.storage.local.get('slowspeak');
  const s = { ...DEFAULTS, ...(slowspeak || {}) };
  $('rate').value = s.rate; $('rateVal').textContent = Number(s.rate).toFixed(2).replace(/0$/, '') + '×';
  $('pitch').value = s.pitch; $('pitchVal').textContent = Number(s.pitch).toFixed(1);
  $('pause').value = s.pause; $('pauseVal').textContent = Number(s.pause).toFixed(1) + 's';

  loadVoices();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

  $('rate').addEventListener('input', (e) => { $('rateVal').textContent = Number(e.target.value).toFixed(2).replace(/0$/, '') + '×'; });
  $('pitch').addEventListener('input', (e) => { $('pitchVal').textContent = Number(e.target.value).toFixed(1); });
  $('pause').addEventListener('input', (e) => { $('pauseVal').textContent = Number(e.target.value).toFixed(1) + 's'; });

  $('play').addEventListener('click', () => { if (!speaking) play(); });
  $('stop').addEventListener('click', stop);
  $('grab').addEventListener('click', grabSelection);
  setStatus('Ready');
}

init().catch((e) => setStatus('Error: ' + e.message, false));
