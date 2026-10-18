// game.js — bubble wrap grid, Web Audio pop synthesis, particles, stats.
//
// The "pop" is synthesized with the Web Audio API (no audio files bundled):
// a short pitch-dropping sine burst + filtered noise click. Pop pitch varies
// slightly per bubble so rapid pops sound organic, not mechanical.

(function () {
  "use strict";

  var board = document.getElementById("board");
  var popCountEl = document.getElementById("popCount");
  var streakEl = document.getElementById("streakCount");
  var progressBar = document.getElementById("progressBar");
  var progressLabel = document.getElementById("progressLabel");
  var resetBtn = document.getElementById("resetBtn");
  var soundBtn = document.getElementById("soundBtn");

  var COLS = 10;   // grid columns; rows adapt to the container
  var ROWS = 8;

  var state = {
    totalPops: 0,
    bestStreak: 0,
    sheetPops: 0,
    streak: 0,
    sound: true,
    audioCtx: null
  };

  /* ---------- persistence ---------- */

  chrome.storage.local.get({ totalPops: 0, bestStreak: 0, sound: true }, function (res) {
    state.totalPops = res.totalPops;
    state.bestStreak = res.bestStreak;
    state.sound = res.sound;
    soundBtn.setAttribute("aria-pressed", String(state.sound));
    renderStats();
  });

  function save() {
    chrome.storage.local.set({
      totalPops: state.totalPops,
      bestStreak: state.bestStreak,
      sound: state.sound
    });
  }

  /* ---------- Web Audio pop synthesis ---------- */

  // Lazily create the context on the first user gesture (autoplay policy).
  function ctx() {
    if (!state.audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) state.audioCtx = new AC();
    }
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  // A bubble pop: fast pitch-dropping sine "snap" + tiny noise click.
  function playPop() {
    if (!state.sound) return;
    var ac = ctx();
    if (!ac) return;
    var t = ac.currentTime;

    // Randomize pitch slightly per pop.
    var baseFreq = 480 + Math.random() * 320;

    // Snap body: sine sweeping down fast.
    var osc = ac.createOscillator();
    var oscGain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(oscGain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.12);

    // Click transient: short burst of filtered noise.
    var len = Math.floor(ac.sampleRate * 0.03);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var noise = ac.createBufferSource();
    noise.buffer = buf;
    var band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2200 + Math.random() * 1200;
    band.Q.value = 1.2;
    var noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    noise.connect(band).connect(noiseGain).connect(ac.destination);
    noise.start(t);
  }

  /* ---------- particle burst ---------- */

  function burst(x, y) {
    for (var i = 0; i < 8; i++) {
      var p = document.createElement("div");
      p.className = "particle";
      p.style.left = x + "px";
      p.style.top = y + "px";
      document.body.appendChild(p);
      var angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      var dist = 26 + Math.random() * 30;
      var dx = Math.cos(angle) * dist;
      var dy = Math.sin(angle) * dist;
      p.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + dx + "px," + dy + "px) scale(0.2)", opacity: 0 }
        ],
        { duration: 380 + Math.random() * 160, easing: "cubic-bezier(.2,.7,.3,1)" }
      ).onfinish = (function (el) {
        return function () { el.remove(); };
      })(p);
    }
  }

  /* ---------- board ---------- */

  function buildSheet() {
    board.innerHTML = "";
    board.style.gridTemplateColumns = "repeat(" + COLS + ", 64px)";
    state.sheetPops = 0;
    for (var i = 0; i < COLS * ROWS; i++) {
      var b = document.createElement("button");
      b.className = "bubble";
      b.type = "button";
      b.setAttribute("aria-label", "Bubble " + (i + 1));
      board.appendChild(b);
    }
    updateProgress();
  }

  function pop(bubble, evt) {
    if (bubble.classList.contains("popped")) return;
    bubble.classList.add("popped");
    if (evt && evt.clientX != null) {
      burst(evt.clientX, evt.clientY);
    } else {
      var r = bubble.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
    }
    playPop();
    state.sheetPops++;
    state.totalPops++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    renderStats();
    updateProgress();
    save();
    if (state.sheetPops === COLS * ROWS) {
      setTimeout(celebrate, 350);
    }
  }

  function renderStats() {
    popCountEl.textContent = state.sheetPops;
    streakEl.textContent = state.streak;
    document.title = "BubblePop — " + state.totalPops + " pops";
  }

  function updateProgress() {
    var total = COLS * ROWS;
    var pct = Math.round((state.sheetPops / total) * 100);
    progressBar.style.width = pct + "%";
    progressLabel.textContent = state.sheetPops === 0
      ? "Pop the whole sheet!"
      : state.sheetPops + " / " + total + " popped";
  }

  // Click a bubble. Also support press-and-drag: pointermove over bubbles
  // while the primary button is held pops them (rapid-fire popping).
  var dragging = false;

  board.addEventListener("pointerdown", function (e) {
    dragging = true;
    if (e.target.classList && e.target.classList.contains("bubble")) {
      pop(e.target, e);
    }
  });

  board.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    if (e.target.classList && e.target.classList.contains("bubble")) {
      pop(e.target, e);
    }
  });

  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("pointercancel", function () { dragging = false; });

  resetBtn.addEventListener("click", function () {
    state.streak = 0;
    buildSheet();
    renderStats();
  });

  soundBtn.addEventListener("click", function () {
    state.sound = !state.sound;
    soundBtn.setAttribute("aria-pressed", String(state.sound));
    save();
  });

  // Streak decays when the pointer leaves the window (keeps "best" honest).
  document.addEventListener("mouseleave", function () { state.streak = 0; renderStats(); });

  function celebrate() {
    var overlay = document.createElement("div");
    overlay.className = "celebrate";
    overlay.innerHTML =
      '<div class="celebrate-card">' +
      "<h2>Sheet cleared!</h2>" +
      "<p>You popped <strong>" + state.sheetPops + "</strong> bubbles.</p>" +
      "<p>Lifetime pops: <strong>" + state.totalPops + "</strong></p>" +
      '<button type="button">New sheet</button>' +
      "</div>";
    overlay.querySelector("button").addEventListener("click", function () {
      overlay.remove();
      state.streak = 0;
      buildSheet();
      renderStats();
    });
    document.body.appendChild(overlay);
  }

  buildSheet();
})();
