/* =========================================================================
 * TamaBloom — popup logic + procedural pet renderer
 *
 * The background worker owns state; the popup asks for it via messages and
 * renders the pet as a stage/mood-dependent SVG. All local.
 * ========================================================================= */

const $ = (id) => document.getElementById(id);

const STAGE_NAMES = ['Egg', 'Baby', 'Child', 'Teen', 'Adult'];
const STAGE_HUES = ['#fbbf24', '#f472b6', '#a78bfa', '#60a5fa', '#34d399'];
/* Minutes of age needed to REACH each stage (index = stage). */
const STAGE_AT = [0, 30, 120, 360, 720];

/* ------------------------------------------------------------------ */
/* Procedural pet SVG: shape grows with stage, face follows mood.       */
/* ------------------------------------------------------------------ */
function petSVG(stage, mood) {
  const c = STAGE_HUES[stage];
  const dark = 'rgba(0,0,0,0.18)';

  /* Body per stage */
  let body = '';
  if (stage === 0) {
    body = `
      <ellipse cx="60" cy="70" rx="36" ry="46" fill="${c}"/>
      <circle cx="46" cy="52" r="6" fill="#ffffff" opacity="0.35"/>
      <circle cx="74" cy="88" r="8" fill="#ffffff" opacity="0.25"/>
      <circle cx="70" cy="44" r="4" fill="#ffffff" opacity="0.3"/>`;
  } else {
    const w = [0, 30, 36, 40, 44][stage];
    const h = [0, 32, 38, 42, 46][stage];
    const cy = 128 - h - 8;
    body = `<ellipse cx="60" cy="${cy}" rx="${w}" ry="${h}" fill="${c}"/>`;
    if (stage >= 2) { /* ear nubs */
      body += `<circle cx="${60 - w + 6}" cy="${cy - h + 4}" r="9" fill="${c}"/>
               <circle cx="${60 + w - 6}" cy="${cy - h + 4}" r="9" fill="${c}"/>`;
    }
    if (stage >= 3) { /* tail */
      body += `<path d="M${60 + w - 4} ${cy + h - 14} q 26 6 20 -18" stroke="${c}" stroke-width="11" fill="none" stroke-linecap="round"/>`;
    }
    if (stage >= 4) { /* feet */
      body += `<ellipse cx="${60 - w / 2}" cy="${cy + h - 2}" rx="12" ry="7" fill="${dark}"/>
               <ellipse cx="${60 + w / 2}" cy="${cy + h - 2}" rx="12" ry="7" fill="${dark}"/>`;
    }
    /* belly */
    body += `<ellipse cx="60" cy="${cy + h * 0.28}" rx="${w * 0.55}" ry="${h * 0.5}" fill="#ffffff" opacity="0.28"/>`;
  }

  /* Face per mood (positioned for the body centre) */
  const fy = stage === 0 ? 66 : 128 - [0, 32, 38, 42, 46][stage] - 6;
  const ink = '#292524';
  let face = '';
  if (mood === 'happy') {
    face = `<g class="tama-eyes" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none">
              <path d="M46  ${fy} q 6 -7 12 0"/><path d="M62 ${fy} q 6 -7 12 0"/></g>
            <path d="M54 ${fy + 12} q 6 6 12 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (mood === 'sad') {
    face = `<g class="tama-eyes" fill="${ink}"><circle cx="52" cy="${fy}" r="4"/><circle cx="68" cy="${fy}" r="4"/></g>
            <path d="M54 ${fy + 16} q 6 -6 12 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M80 ${fy - 4} q 2 8 -2 12" stroke="#7dd3fc" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (mood === 'sleepy') {
    face = `<g stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none">
              <path d="M46 ${fy} q 6 5 12 0"/><path d="M62 ${fy} q 6 5 12 0"/></g>
            <text x="84" y="${fy - 14}" font-size="16" fill="#c4b5fd" font-weight="700">z</text>
            <text x="94" y="${fy - 26}" font-size="20" fill="#c4b5fd" font-weight="700">z</text>`;
  } else if (mood === 'grumpy') {
    face = `<g class="tama-eyes" stroke="${ink}" stroke-width="3" stroke-linecap="round">
              <path d="M46 ${fy - 4} l 12 8 M58 ${fy - 4} l -12 8"/>
              <path d="M62 ${fy - 4} l 12 8 M74 ${fy - 4} l -12 8"/></g>
            <path d="M52 ${fy + 14} l 16 0" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  } else { /* neutral */
    face = `<g class="tama-eyes" fill="${ink}"><circle cx="52" cy="${fy}" r="4.2"/><circle cx="68" cy="${fy}" r="4.2"/>
              <circle cx="53.4" cy="${fy - 1.4}" r="1.3" fill="#fff"/><circle cx="69.4" cy="${fy - 1.4}" r="1.3" fill="#fff"/></g>
            <path d="M55 ${fy + 12} q 5 3 10 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }

  return `<svg viewBox="0 0 120 132" role="img" aria-label="${STAGE_NAMES[stage]} pet, feeling ${mood}">
    <g class="tama-body">${body}<g>${face}</g></g></svg>`;
}

/* Expose for the on-page widget (injected separately). */
window.tamaPetSVG = petSVG;
window.tamaStageNames = STAGE_NAMES;

/* ------------------------------------------------------------------ */
/* State + rendering                                                   */
/* ------------------------------------------------------------------ */
let current = null;

function fmtAge(min) {
  if (min < 1) return 'newborn';
  if (min < 60) return `${Math.floor(min)}m old`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h old`;
  return `${Math.floor(h / 24)}d old`;
}

function nextStageIn(s) {
  if (s.stage >= 4) return 'Fully grown — maximum bloom!';
  const need = STAGE_AT[s.stage + 1] - s.ageMin;
  const h = Math.floor(need / 60), m = Math.ceil(need % 60);
  return `Evolves to ${STAGE_NAMES[s.stage + 1]} in ${h > 0 ? h + 'h ' : ''}${m}m`;
}

function render(s) {
  current = s;
  $('petName').textContent = s.name;
  $('stageBadge').textContent = STAGE_NAMES[s.stage];
  $('moodBadge').textContent = s.mood;
  $('ageLine').textContent = fmtAge(s.ageMin);
  $('stage').innerHTML = petSVG(s.stage, s.mood);
  $('mHunger').style.width = s.hunger + '%';
  $('mHappy').style.width = s.happiness + '%';
  $('mEnergy').style.width = s.energy + '%';
  $('sleepLabel').textContent = s.sleeping ? 'Wake' : 'Sleep';

  const pl = $('poopLine');
  if (s.poop > 0) {
    pl.hidden = false;
    pl.textContent = '💩'.repeat(s.poop) + ' — time to clean!';
  } else pl.hidden = true;

  $('evoLine').textContent = nextStageIn(s);
  $('bondPts').textContent = s.bond;

  const dead = s.hunger <= 0 && s.happiness <= 0 && s.energy <= 0;
  $('btnRevive').hidden = !dead;
  ['btnFeed', 'btnPlay', 'btnClean', 'btnSleep'].forEach((id) => { $(id).disabled = dead; });
}

function flash(msg) {
  const el = $('status');
  el.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { el.textContent = ''; }, 2600);
}

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: 'getState' });
  if (res && res.ok) render(res.state);
}

async function act(action, msg) {
  const res = await chrome.runtime.sendMessage({ type: 'action', action });
  if (res && res.ok) { render(res.state); if (msg) flash(msg); }
}

$('btnFeed').addEventListener('click', () => act('feed', current && current.hunger > 92 ? 'Too much! Tummy ache.' : 'Yum!'));
$('btnPlay').addEventListener('click', () => act('play', current && current.sleeping ? 'Shh… sleeping.' : 'Wheee!'));
$('btnClean').addEventListener('click', () => act('clean', current && current.poop > 0 ? 'All clean!' : 'Already spotless.'));
$('btnSleep').addEventListener('click', () => act('sleep'));
$('btnRevive').addEventListener('click', () => act('revive', 'Welcome back!'));

$('petName').addEventListener('click', async () => {
  const name = prompt('Name your pet:', current ? current.name : 'Pixel');
  if (name === null) return;
  const res = await chrome.runtime.sendMessage({ type: 'action', action: 'rename', name: name.trim() });
  if (res && res.ok) render(res.state);
});

$('btnWidget').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['widget.js'] });
    const res = await chrome.runtime.sendMessage({ type: 'getState' });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (st) => window.summonTamaWidget(st),
      args: [res && res.ok ? res.state : null],
    });
    flash('Mini-pet is on this page!');
  } catch (e) {
    flash('Cannot run here (e.g. chrome:// pages).');
  }
});

refresh();
