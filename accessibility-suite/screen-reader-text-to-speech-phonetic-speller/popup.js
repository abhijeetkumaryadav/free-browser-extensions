/* Phonetic Speller — popup logic.
 * All speech is local via window.speechSynthesis (no network, no accounts).
 * Settings persist in chrome.storage.local. */

'use strict';

/* ---------- NATO phonetic alphabet + digits ---------- */
const NATO = {
  a:'Alfa', b:'Bravo', c:'Charlie', d:'Delta', e:'Echo', f:'Foxtrot',
  g:'Golf', h:'Hotel', i:'India', j:'Juliett', k:'Kilo', l:'Lima',
  m:'Mike', n:'November', o:'Oscar', p:'Papa', q:'Quebec', r:'Romeo',
  s:'Sierra', t:'Tango', u:'Uniform', v:'Victor', w:'Whiskey',
  x:'X-ray', y:'Yankee', z:'Zulu',
  '0':'zero','1':'one','2':'two','3':'three','4':'four',
  '5':'five','6':'six','7':'seven','8':'eight','9':'niner'
};
const LETTER_NAMES = { ...NATO };
'abcdefghijklmnopqrstuvwxyz'.split('').forEach(ch => { LETTER_NAMES[ch] = ch.toUpperCase(); });

/* ---------- element refs ---------- */
const $ = id => document.getElementById(id);
const textEl=$('text'), voiceEl=$('voice'), rateEl=$('rate'), pitchEl=$('pitch'),
      volEl=$('volume'), rateVal=$('rateVal'), pitchVal=$('pitchVal'), volVal=$('volVal');

/* ---------- settings ---------- */
const settings = { voiceURI:null, rate:1, pitch:1, volume:1 };

async function loadSettings(){
  try{
    const s = await chrome.storage.local.get(['voiceURI','rate','pitch','volume']);
    if(s.voiceURI) settings.voiceURI = s.voiceURI;
    if(typeof s.rate==='number')   { settings.rate=s.rate;   rateEl.value=s.rate; }
    if(typeof s.pitch==='number')  { settings.pitch=s.pitch; pitchEl.value=s.pitch; }
    if(typeof s.volume==='number') { settings.volume=s.volume; volEl.value=s.volume; }
    syncLabels();
  }catch(e){ /* storage unavailable: keep defaults */ }
}
function saveSettings(){
  try{ chrome.storage.local.set(settings); }catch(e){}
}
function syncLabels(){
  rateVal.textContent = Number(rateEl.value).toFixed(1);
  pitchVal.textContent = Number(pitchEl.value).toFixed(1);
  volVal.textContent = Number(volEl.value).toFixed(1);
}

/* ---------- voices ---------- */
function populateVoices(){
  const voices = speechSynthesis.getVoices().slice()
    .sort((a,b)=> a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  voiceEl.innerHTML = '';
  const auto = document.createElement('option');
  auto.value=''; auto.textContent='Auto (system default)';
  voiceEl.appendChild(auto);
  for(const v of voices){
    const o=document.createElement('option');
    o.value=v.voiceURI; o.textContent=`${v.name} · ${v.lang}${v.localService?' · local':''}`;
    if(v.voiceURI===settings.voiceURI) o.selected=true;
    voiceEl.appendChild(o);
  }
}
if('onvoiceschanged' in speechSynthesis){
  speechSynthesis.onvoiceschanged = populateVoices;
}

/* ---------- speech helpers ---------- */
function pickVoice(){
  if(!settings.voiceURI) return null;
  return speechSynthesis.getVoices().find(v=>v.voiceURI===settings.voiceURI) || null;
}
function utter(chunk, {rateMul=1}={}){
  const u = new SpeechSynthesisUtterance(chunk);
  const v = pickVoice();
  if(v) u.voice = v;
  u.rate = Math.min(2, Math.max(0.5, settings.rate * rateMul));
  u.pitch = settings.pitch;
  u.volume = settings.volume;
  return u;
}
/** Speak a queue of chunks sequentially. */
function speakQueue(chunks, rateMul=1){
  stop();
  chunks.forEach(c => speechSynthesis.speak(utter(c,{rateMul})));
}
function stop(){ speechSynthesis.cancel(); }

/* ---------- spelling ---------- */
/** "Hi!" -> ["H","I"] letters worth spelling; punctuation spoken as words. */
const PUNCT_WORDS = { '.':'period', ',':'comma', '!':'exclamation mark', '?':'question mark',
  ':':'colon', ';':'semicolon', '-':'dash', '_':'underscore', "'":'apostrophe',
  '"':'quote', '(':'open paren', ')':'close paren', '/':'slash', '@':'at', '#':'hash' };

function spellChunks(text, map){
  const chunks = [];
  for(const ch of text){
    const low = ch.toLowerCase();
    if(map[low]){ chunks.push(map[low]); }
    else if(ch===' '){ chunks.push(' '); /* brief pause via empty chunk */ }
    else if(PUNCT_WORDS[ch]){ chunks.push(PUNCT_WORDS[ch]); }
    else if(ch==='\n'){ chunks.push('new line'); }
    // other symbols skipped silently
  }
  // drop the pause placeholders; separate utterances already pace the speech
  return chunks.filter(c=>c!==' ');
}

/* ---------- UI wiring ---------- */
$('read').addEventListener('click', ()=>{
  const t = textEl.value.trim();
  if(!t) return;
  speakQueue([t]);
});
$('spellNato').addEventListener('click', ()=>{
  const t = textEl.value.trim();
  if(!t) return;
  speakQueue(spellChunks(t, NATO), 0.85);
});
$('spellLetters').addEventListener('click', ()=>{
  const t = textEl.value.trim();
  if(!t) return;
  speakQueue(spellChunks(t, LETTER_NAMES), 0.85);
});
$('stop').addEventListener('click', stop);

voiceEl.addEventListener('change', ()=>{ settings.voiceURI = voiceEl.value || null; saveSettings(); });
rateEl.addEventListener('input', ()=>{ settings.rate=Number(rateEl.value); syncLabels(); saveSettings(); });
pitchEl.addEventListener('input', ()=>{ settings.pitch=Number(pitchEl.value); syncLabels(); saveSettings(); });
volEl.addEventListener('input', ()=>{ settings.volume=Number(volEl.value); syncLabels(); saveSettings(); });

/* Grab the current selection from the active tab (needs activeTab + scripting). */
$('grab').addEventListener('click', async ()=>{
  try{
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    if(!tab || tab.id==null) return;
    const res = await chrome.scripting.executeScript({
      target:{tabId:tab.id},
      func: () => window.getSelection ? String(window.getSelection()) : ''
    });
    const sel = (res && res[0] && res[0].result || '').trim();
    if(sel) textEl.value = sel;
    else textEl.placeholder = 'No text selected on this page — select some text first.';
  }catch(e){
    textEl.placeholder = 'Could not read this page (e.g. chrome:// pages are protected).';
  }
});

/* ---------- init ---------- */
(async function init(){
  await loadSettings();
  populateVoices();
  // voices may arrive async; repopulate once more shortly after
  setTimeout(populateVoices, 500);
})();
