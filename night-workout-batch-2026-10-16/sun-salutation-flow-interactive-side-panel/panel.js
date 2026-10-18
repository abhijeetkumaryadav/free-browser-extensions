/* Sun Salutation Flow — side-panel logic.
 *
 * Pose guide — not coaching advice. Uses the stable chrome.sidePanel API.
 * All state is local (chrome.storage.local); the chime is a generated
 * Web Audio tone (no audio files, no network).
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // ENGINE-START — pure, headless-testable sequence engine
  // ---------------------------------------------------------------------------
  // The 12-pose Surya Namaskar (A) sequence. Descriptions are plain-language
  // and deliberately non-prescriptive.
  const POSES = [
    { name: 'Pranamasana', en: 'Prayer Pose', desc: 'Stand tall with feet together, palms pressed at the chest. Breathe easy and settle in.' },
    { name: 'Hasta Uttanasana', en: 'Raised Arms', desc: 'Sweep the arms up and gently arch back, opening the chest toward the sky.' },
    { name: 'Uttanasana', en: 'Standing Forward Fold', desc: 'Hinge at the hips and fold forward, letting the head and arms hang heavy.' },
    { name: 'Ashwa Sanchalanasana', en: 'Low Lunge (right)', desc: 'Step the right foot back into a low lunge, fingertips framing the front foot.' },
    { name: 'Dandasana', en: 'Plank', desc: 'Step back to a straight-line plank, shoulders stacked over wrists.' },
    { name: 'Ashtanga Namaskara', en: 'Eight-Limbed Salute', desc: 'Lower knees, chest and chin to the floor, hips lifted.' },
    { name: 'Bhujangasana', en: 'Cobra', desc: 'Slide forward and lift the chest, shoulders rolling down and back.' },
    { name: 'Adho Mukha Svanasana', en: 'Downward Dog', desc: 'Press back and up into an inverted V, pedalling the feet.' },
    { name: 'Ashwa Sanchalanasana', en: 'Low Lunge (left)', desc: 'Step the left foot forward between the hands into a low lunge.' },
    { name: 'Uttanasana', en: 'Standing Forward Fold', desc: 'Step the back foot forward and fold over the legs again.' },
    { name: 'Hasta Uttanasana', en: 'Raised Arms', desc: 'Rise up, sweeping the arms overhead with a gentle backbend.' },
    { name: 'Tadasana', en: 'Mountain Pose', desc: 'Return to standing tall, arms resting at the sides. One round complete.' },
  ];

  // Index of the next pose after `i` (wraps; reports whether a round ended).
  function nextPoseIndex(i, count) {
    const n = ((i % count) + count) % count;
    const next = (n + 1) % count;
    return { next, roundComplete: next === 0 };
  }

  // Builds a timed round plan: array of {pose, seconds} for the given hold.
  function buildRoundPlan(holdSec) {
    const hold = Math.max(5, Math.min(180, Math.floor(Number(holdSec) || 30)));
    return POSES.map((pose) => ({ pose, seconds: hold }));
  }

  // Fraction of the pose elapsed (0..1), clamped.
  function ringFraction(elapsed, total) {
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, elapsed / total));
  }
  // ENGINE-END
  // ---------------------------------------------------------------------------

  // ----------------------------- DOM wiring ----------------------------------
  const $ = (id) => document.getElementById(id);
  const poseIndexEl = $('poseIndex');
  const poseCountEl = $('poseCount');
  const poseNameEl = $('poseName');
  const poseDescEl = $('poseDesc');
  const ringFg = $('ringFg');
  const ringLabel = $('ringLabel');
  const seqList = $('seqList');
  const roundCountEl = $('roundCount');
  const prevBtn = $('prevBtn');
  const playBtn = $('playBtn');
  const playLabel = $('playLabel');
  const nextBtn = $('nextBtn');
  const resetBtn = $('resetBtn');
  const holdInput = $('holdSec');
  const holdVal = $('holdVal');
  const autoAdvance = $('autoAdvance');

  const RING_C = 326.73; // 2 * PI * 52

  let index = 0;            // current pose index
  let running = false;      // flow playing?
  let elapsed = 0;          // seconds elapsed in current pose
  let holdSeconds = 30;
  let rounds = 0;
  let timer = null;
  let audioCtx = null;

  function persist() {
    chrome.storage.local.set({ holdSec: holdSeconds, autoAdv: autoAdvance.checked, rounds });
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Gentle two-tone chime on phase/round change.
  function chime(roundDone) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const notes = roundDone ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    notes.forEach((freq, k) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + k * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  function renderSeq() {
    seqList.innerHTML = '';
    POSES.forEach((p, i) => {
      const li = document.createElement('li');
      if (i === index) li.classList.add('active');
      if (i < index) li.classList.add('done');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1).padStart(2, '0');
      li.appendChild(num);
      li.appendChild(document.createTextNode(p.name + ' · ' + p.en));
      li.addEventListener('click', () => { goTo(i); });
      seqList.appendChild(li);
    });
  }

  function renderPose() {
    const p = POSES[index];
    poseIndexEl.textContent = 'Pose ' + (index + 1) + ' of ' + POSES.length;
    poseNameEl.textContent = p.name;
    poseDescEl.textContent = p.en + ' — ' + p.desc;
    poseCountEl.textContent = holdSeconds + 's';
    updateRing();
    renderSeq();
  }

  function updateRing() {
    const frac = ringFraction(elapsed, holdSeconds);
    ringFg.style.strokeDashoffset = String(RING_C * frac);
    ringLabel.textContent = String(Math.max(0, Math.ceil(holdSeconds - elapsed)));
  }

  function goTo(i) {
    index = ((i % POSES.length) + POSES.length) % POSES.length;
    elapsed = 0;
    renderPose();
  }

  function advance(manual) {
    const { next, roundComplete } = nextPoseIndex(index, POSES.length);
    if (roundComplete && !manual) {
      rounds += 1;
      roundCountEl.textContent = String(rounds);
      persist();
      chime(true);
    } else if (!manual) {
      chime(false);
    }
    goTo(next);
  }

  function startFlow() {
    if (running) return;
    ensureAudio(); // user gesture — permitted context
    running = true;
    playLabel.textContent = 'Pause';
    holdInput.disabled = true;
    clearInterval(timer);
    timer = setInterval(() => {
      elapsed += 1;
      if (elapsed >= holdSeconds) {
        if (autoAdvance.checked) {
          advance(false);
        } else {
          elapsed = holdSeconds;
          updateRing();
          pauseFlow();
          return;
        }
      }
      updateRing();
    }, 1000);
  }

  function pauseFlow() {
    running = false;
    clearInterval(timer);
    timer = null;
    playLabel.textContent = 'Resume';
    holdInput.disabled = false;
  }

  // ----------------------------- events --------------------------------------
  playBtn.addEventListener('click', () => (running ? pauseFlow() : startFlow()));
  prevBtn.addEventListener('click', () => goTo(index - 1));
  nextBtn.addEventListener('click', () => advance(true));
  resetBtn.addEventListener('click', () => {
    pauseFlow();
    rounds = 0;
    roundCountEl.textContent = '0';
    goTo(0);
    persist();
  });
  holdInput.addEventListener('input', () => {
    holdSeconds = Number(holdInput.value);
    holdVal.textContent = holdSeconds + 's';
    elapsed = 0;
    renderPose();
    persist();
  });
  autoAdvance.addEventListener('change', persist);

  // ----------------------------- init ----------------------------------------
  chrome.storage.local.get({ holdSec: 30, autoAdv: true, rounds: 0 }, (s) => {
    holdSeconds = Math.max(10, Math.min(90, Number(s.holdSec) || 30));
    holdInput.value = holdSeconds;
    holdVal.textContent = holdSeconds + 's';
    autoAdvance.checked = s.autoAdv !== false;
    rounds = Number(s.rounds) || 0;
    roundCountEl.textContent = String(rounds);
    renderPose();
  });
})();
