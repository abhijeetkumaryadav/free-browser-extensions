/* Focus Halo — popup logic. Settings persist to chrome.storage.local;
 * content scripts on every page pick them up live via storage.onChanged. */
'use strict';

const DEFAULTS = {
  enabled: true,
  color: '#a3e635',
  thickness: 3,
  style: 'ring',
  pulse: true,
  keyboardOnly: true
};

const $ = id => document.getElementById(id);
const enabledEl=$('enabled'), thEl=$('thickness'), thVal=$('thVal'),
      pulseEl=$('pulse'), kbEl=$('keyboardOnly'), customEl=$('customColor');

async function load(){
  let s = {};
  try{ s = await chrome.storage.local.get(Object.keys(DEFAULTS)); }catch(e){}
  const cur = { ...DEFAULTS, ...s };
  enabledEl.checked = cur.enabled;
  thEl.value = cur.thickness;
  thVal.textContent = cur.thickness + 'px';
  pulseEl.checked = cur.pulse;
  kbEl.checked = cur.keyboardOnly;
  markPreset(cur.style);
  markSwatch(cur.color);
  if(!document.querySelector(`.sw[data-color="${cur.color}"]`)){
    customEl.value = cur.color; // custom color in use
  }
}
function save(patch){
  try{ chrome.storage.local.set(patch); }catch(e){}
}

function markPreset(style){
  document.querySelectorAll('.preset').forEach(b =>
    b.classList.toggle('active', b.dataset.style === style));
}
function markSwatch(color){
  let found = false;
  document.querySelectorAll('.sw[data-color]').forEach(b => {
    const on = b.dataset.color.toLowerCase() === String(color).toLowerCase();
    b.classList.toggle('active', on);
    if(on) found = true;
  });
  document.querySelector('.sw.custom').classList.toggle('active', !found);
}

/* style presets */
document.querySelectorAll('.preset').forEach(b =>
  b.addEventListener('click', () => {
    markPreset(b.dataset.style);
    save({ style: b.dataset.style });
  }));

/* swatches */
document.querySelectorAll('.sw[data-color]').forEach(b =>
  b.addEventListener('click', () => {
    markSwatch(b.dataset.color);
    save({ color: b.dataset.color });
  }));
customEl.addEventListener('input', () => {
  markSwatch(customEl.value);
  save({ color: customEl.value });
});

/* controls */
enabledEl.addEventListener('change', () => save({ enabled: enabledEl.checked }));
thEl.addEventListener('input', () => {
  thVal.textContent = thEl.value + 'px';
  save({ thickness: Number(thEl.value) });
});
pulseEl.addEventListener('change', () => save({ pulse: pulseEl.checked }));
kbEl.addEventListener('change', () => save({ keyboardOnly: kbEl.checked }));

load();
