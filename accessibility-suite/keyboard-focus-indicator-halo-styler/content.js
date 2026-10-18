/* Focus Halo — content script.
 * Draws a customizable halo around the keyboard-focused element.
 * Pure CSS overlay: no tracking, no DOM mutation beyond one class + style tag.
 * Settings live in chrome.storage.local and update live via onChanged. */
'use strict';

const DEFAULTS = {
  enabled: true,
  color: '#a3e635',
  thickness: 3,        // px
  style: 'ring',       // ring | glow | underline | dashed
  pulse: true,
  keyboardOnly: true   // only show halo when focus came from keyboard
};

const CLASS = '__kfh-halo';
const STYLE_ID = '__kfh-style';
let settings = { ...DEFAULTS };
let keyboardModality = false; // true when last interaction was keyboard

/* ---------- injected stylesheet (once per page) ---------- */
const CSS = `
.${CLASS}{ outline:none !important; }
html.__kfh-ring .${CLASS}{
  outline: var(--kfh-t,3px) solid var(--kfh-c,#a3e635) !important;
  outline-offset: 3px !important;
}
html.__kfh-dashed .${CLASS}{
  outline: var(--kfh-t,3px) dashed var(--kfh-c,#a3e635) !important;
  outline-offset: 3px !important;
}
html.__kfh-glow .${CLASS}{
  box-shadow: 0 0 0 var(--kfh-t,3px) var(--kfh-c,#a3e635),
              0 0 18px var(--kfh-c,#a3e635) !important;
  border-radius: 6px;
}
html.__kfh-underline .${CLASS}{
  box-shadow: inset 0 calc(var(--kfh-t,3px) * -1.6) 0 var(--kfh-c,#a3e635) !important;
}
html.__kfh-pulse .${CLASS}{ animation: __kfh-pulse 1.4s ease-in-out infinite; }
@keyframes __kfh-pulse{
  0%,100%{ filter:brightness(1); }
  50%{ filter:brightness(1.45); }
}`;

function ensureStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  (document.head || document.documentElement).appendChild(el);
}

/* ---------- apply settings to <html> ---------- */
function applySettings(){
  const root = document.documentElement;
  if(!root) return;
  root.classList.remove('__kfh-ring','__kfh-dashed','__kfh-glow','__kfh-underline','__kfh-pulse');
  if(!settings.enabled){ clearHalo(); return; }
  root.style.setProperty('--kfh-c', settings.color);
  root.style.setProperty('--kfh-t', settings.thickness + 'px');
  root.classList.add('__kfh-' + settings.style);
  if(settings.pulse) root.classList.add('__kfh-pulse');
  refreshHalo(); // re-evaluate current focus against new settings
}

function clearHalo(){
  document.querySelectorAll('.' + CLASS).forEach(el => el.classList.remove(CLASS));
}

function refreshHalo(){
  clearHalo();
  if(!settings.enabled) return;
  if(settings.keyboardOnly && !keyboardModality) return;
  const el = document.activeElement;
  // Never halo the page body itself — only real focusable elements.
  if(el && el !== document.body && el !== document.documentElement && el instanceof HTMLElement){
    el.classList.add(CLASS);
  }
}

/* ---------- events ---------- */
window.addEventListener('keydown', ev => {
  // Tab / arrows / Enter / Space / Escape suggest keyboard navigation
  if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' ','Escape'].includes(ev.key)){
    keyboardModality = true;
  }
}, true);

window.addEventListener('mousedown', () => { keyboardModality = false; }, true);
window.addEventListener('touchstart', () => { keyboardModality = false; }, true);

document.addEventListener('focusin', () => {
  // focus lands after keydown, so modality is already correct
  refreshHalo();
});
document.addEventListener('focusout', () => {
  // remove immediately; focusin on the next element re-adds if appropriate
  clearHalo();
});

/* ---------- storage ---------- */
async function load(){
  try{
    const s = await chrome.storage.local.get(Object.keys(DEFAULTS));
    settings = { ...DEFAULTS, ...s };
  }catch(e){ settings = { ...DEFAULTS }; }
  ensureStyle();
  applySettings();
}
chrome.storage.onChanged.addListener((changes, area) => {
  if(area !== 'local') return;
  let touched = false;
  for(const k of Object.keys(DEFAULTS)){
    if(changes[k]){ settings[k] = changes[k].newValue; touched = true; }
  }
  if(touched) applySettings();
});

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', load);
}else{
  load();
}
