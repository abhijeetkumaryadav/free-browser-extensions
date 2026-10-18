/* EMOM Interval Beeper — popup: renders state, plays Web Audio beeps.
 * Timing runs in the background on 1s alarms; this popup is only a view + sounder.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const idleView = $('idleView'), runView = $('runView');
  const phase = $('phase'), clock = $('clock'), roundLabel = $('roundLabel'), barFill = $('barFill');
  const workSec = $('workSec'), restSec = $('restSec'), rounds = $('rounds');
  let muted = false, audioCtx = null, lastSeen = '';

  // --- Web Audio beeps (generated tones, no files) ---------------------------
  const beep = (freq, dur, when = 0, vol = 0.25) => {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime + when;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (_) { /* audio unavailable */ }
  };
  const soundFor = (events) => {
    for (const e of events) {
      if (e === 'countdown3' || e === 'countdown2' || e === 'countdown1') beep(660, 0.12);
      else if (e === 'work') { beep(880, 0.35); beep(880, 0.35, 0.4); }
      else if (e === 'rest') beep(440, 0.3);
      else if (e === 'done') { beep(880, 0.2); beep(1100, 0.2, 0.25); beep(1320, 0.4, 0.5); }
    }
  };

  // --- State ------------------------------------------------------------------
  const msg = (type, config) => new Promise((res) => chrome.runtime.sendMessage({ type, config }, res));

  const render = async () => {
    const r = await msg('EMOM_GET');
    const s = r && r.state;
    if (!s || !s.running || s.phase === 'idle' || s.phase === 'done') {
      idleView.hidden = false; runView.hidden = true;
      if (s && s.phase === 'done') clock.textContent = '✓';
      return;
    }
    idleView.hidden = true; runView.hidden = false;
    const label = s.phase.toUpperCase();
    phase.textContent = label;
    phase.className = 'phase ' + s.phase;
    clock.textContent = Math.max(0, s.remaining);
    roundLabel.textContent = s.phase === 'prep'
      ? `Get ready — ${s.totalRounds} rounds`
      : `Round ${s.round} / ${s.totalRounds}`;
    const phaseLen = s.phase === 'prep' ? s.prepSec : s.phase === 'work' ? s.workSec : s.restSec;
    barFill.style.width = phaseLen ? `${(1 - s.remaining / phaseLen) * 100}%` : '0%';
  };

  // Poll storage changes; derive which events fired to play beeps
  let prevSig = '';
  const sig = (s) => s ? `${s.phase}:${s.round}:${s.remaining}` : 'idle';
  const deriveEvents = (prev, cur) => {
    // Best-effort: detect phase transitions + countdown ticks between renders
    const ev = [];
    if (!cur || !cur.running) return ev;
    if (!prev || !prev.running) return ev;
    if (cur.phase !== prev.phase || cur.round !== prev.round) {
      if (cur.phase === 'work') ev.push('work');
      else if (cur.phase === 'rest') ev.push('rest');
      else if (cur.phase === 'done') ev.push('done');
    } else if (cur.remaining !== prev.remaining && cur.remaining <= 3 && cur.remaining >= 1) {
      ev.push('countdown' + cur.remaining);
    }
    return ev;
  };
  let prevState = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.emom) return;
    const cur = changes.emom.newValue;
    soundFor(deriveEvents(prevState, cur));
    prevState = cur;
    render();
  });

  // --- Controls ----------------------------------------------------------------
  $('start').addEventListener('click', async () => {
    await msg('EMOM_START', {
      workSec: parseInt(workSec.value, 10),
      restSec: parseInt(restSec.value, 10),
      totalRounds: parseInt(rounds.value, 10),
    });
    try { // unlock audio on the user gesture
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    } catch (_) {}
  });
  $('stop').addEventListener('click', () => msg('EMOM_STOP'));
  $('mute').addEventListener('click', () => {
    muted = !muted;
    $('mute').textContent = muted ? '🔇' : '🔊';
    chrome.storage.local.set({ emomMuted: muted });
  });

  chrome.storage.local.get(['emom', 'emomMuted'], (r) => {
    prevState = r.emom || null;
    muted = !!r.emomMuted;
    $('mute').textContent = muted ? '🔇' : '🔊';
    if (r.emom && (r.emom.workSec)) {
      workSec.value = r.emom.workSec; restSec.value = r.emom.restSec; rounds.value = r.emom.totalRounds;
    }
    render();
  });
  void lastSeen; void prevSig;
})();
