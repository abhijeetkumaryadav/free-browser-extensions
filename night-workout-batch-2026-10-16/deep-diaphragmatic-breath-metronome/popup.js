/* Deep Diaphragmatic Breath Metronome — popup logic.
 *
 * Pacing aid only — not medical advice. All logic is local; settings persist
 * in chrome.storage.local. Ticks are generated with Web Audio (no audio files).
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // ENGINE-START — pure, headless-testable timing plan
  // ---------------------------------------------------------------------------
  // Returns a two-phase plan (inhale, exhale) in seconds for the given
  // breaths-per-minute and inhale-share percent. Phases are rounded to
  // 0.1s and guaranteed to sum to the cycle length.
  function planBreath(bpm, inhaleSharePct) {
    const bpmNum = Number(bpm);
    const share = Number(inhaleSharePct);
    if (!Number.isFinite(bpmNum) || bpmNum <= 0) return [];
    const cycle = 60 / bpmNum; // seconds per breath
    const clampedShare = Math.min(80, Math.max(20, Number.isFinite(share) ? share : 50));
    let inhale = Math.round((cycle * clampedShare) / 100 * 10) / 10;
    let exhale = Math.round((cycle - inhale) * 10) / 10;
    if (inhale <= 0) inhale = 0.1;
    if (exhale <= 0) exhale = 0.1;
    return [
      { phase: 'inhale', seconds: inhale },
      { phase: 'exhale', seconds: exhale },
    ];
  }

  // Formats seconds as m:ss.
  function fmtTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }
  // ENGINE-END
  // ---------------------------------------------------------------------------

  // ----------------------------- DOM wiring ----------------------------------
  const $ = (id) => document.getElementById(id);
  const phaseLabel = $('phaseLabel');
  const phaseCount = $('phaseCount');
  const ball = $('ball');
  const sessionTimeEl = $('sessionTime');
  const breathCountEl = $('breathCount');
  const bpmInput = $('bpm');
  const bpmVal = $('bpmVal');
  const durInput = $('duration');
  const durVal = $('durVal');
  const inhaleInput = $('inhaleShare');
  const inhaleVal = $('inhaleVal');
  const tickEnabled = $('tickEnabled');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');

  // Session state
  let running = false;
  let plan = [];
  let phaseIndex = 0;
  let phaseRemaining = 0; // seconds left in the current phase
  let phaseTick = null;   // 1s countdown interval
  let sessionLeft = 0;    // seconds left in the whole session
  let sessionTick = null; // 1s session interval
  let breathCount = 0;
  let audioCtx = null;    // lazily created on Start (user gesture)

  function persistSettings() {
    chrome.storage.local.set({
      bpm: Number(bpmInput.value),
      durationMin: Number(durInput.value),
      inhaleShare: Number(inhaleInput.value),
      tick: tickEnabled.checked,
    });
  }

  function refreshLabels() {
    bpmVal.textContent = bpmInput.value;
    durVal.textContent = durInput.value + ' min';
    inhaleVal.textContent = inhaleInput.value + '%';
  }

  // ----------------------------- Web Audio ticks ------------------------------
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Soft tick: inhale = higher tone, exhale = lower tone.
  function tick(isInhale) {
    if (!tickEnabled.checked) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isInhale ? 660 : 440;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // ----------------------------- session engine -------------------------------
  function renderIdle() {
    phaseLabel.textContent = 'Ready';
    phaseLabel.classList.add('idle');
    phaseCount.textContent = '–';
    ball.style.transform = 'scale(1)';
    ball.style.opacity = '0.55';
  }

  function startPhase(index) {
    phaseIndex = index;
    const p = plan[phaseIndex];
    phaseRemaining = Math.ceil(p.seconds);
    const isInhale = p.phase === 'inhale';
    phaseLabel.textContent = isInhale ? 'Inhale' : 'Exhale';
    phaseLabel.classList.remove('idle');
    // Animate the ball with a CSS transition matching the phase length.
    ball.style.transition = 'transform ' + p.seconds + 's ease-in-out, opacity ' + p.seconds + 's ease-in-out';
    ball.style.transform = isInhale ? 'scale(1.9)' : 'scale(1)';
    ball.style.opacity = isInhale ? '1' : '0.55';
    tick(isInhale);
    updatePhaseCount();

    clearInterval(phaseTick);
    phaseTick = setInterval(() => {
      phaseRemaining -= 1;
      if (phaseRemaining <= 0) {
        advancePhase();
      } else {
        updatePhaseCount();
      }
    }, 1000);
  }

  function updatePhaseCount() {
    phaseCount.textContent = String(Math.max(0, phaseRemaining));
  }

  function advancePhase() {
    const next = (phaseIndex + 1) % plan.length;
    if (next === 0) {
      breathCount += 1;
      breathCountEl.textContent = String(breathCount);
    }
    startPhase(next);
  }

  function startSession() {
    if (running) return;
    plan = planBreath(bpmInput.value, inhaleInput.value);
    if (plan.length === 0) return;
    ensureAudio(); // user gesture — permitted context
    running = true;
    breathCount = 0;
    breathCountEl.textContent = '0';
    sessionLeft = Number(durInput.value) * 60;
    sessionTimeEl.textContent = fmtTime(sessionLeft);
    persistSettings();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    bpmInput.disabled = true;
    durInput.disabled = true;
    inhaleInput.disabled = true;

    startPhase(0);
    sessionTick = setInterval(() => {
      sessionLeft -= 1;
      sessionTimeEl.textContent = fmtTime(sessionLeft);
      if (sessionLeft <= 0) stopSession(true);
    }, 1000);
  }

  function stopSession(finished) {
    if (!running) return;
    running = false;
    clearInterval(phaseTick);
    clearInterval(sessionTick);
    phaseTick = null;
    sessionTick = null;
    ball.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    if (finished) {
      phaseLabel.textContent = 'Complete';
      phaseLabel.classList.remove('idle');
      phaseCount.textContent = '✓';
      tick(true);
    } else {
      renderIdle();
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    bpmInput.disabled = false;
    durInput.disabled = false;
    inhaleInput.disabled = false;
  }

  // ----------------------------- init -----------------------------------------
  bpmInput.addEventListener('input', () => { refreshLabels(); persistSettings(); });
  durInput.addEventListener('input', () => { refreshLabels(); persistSettings(); });
  inhaleInput.addEventListener('input', () => { refreshLabels(); persistSettings(); });
  tickEnabled.addEventListener('change', persistSettings);
  startBtn.addEventListener('click', startSession);
  stopBtn.addEventListener('click', () => stopSession(false));

  // Restore persisted settings, then render idle state.
  chrome.storage.local.get({ bpm: 6, durationMin: 5, inhaleShare: 40, tick: true }, (s) => {
    bpmInput.value = s.bpm;
    durInput.value = s.durationMin;
    inhaleInput.value = s.inhaleShare;
    tickEnabled.checked = s.tick !== false;
    refreshLabels();
  });
  renderIdle();

  // Expose the pure engine for headless tests (no side effects).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { planBreath, fmtTime };
  }
})();
