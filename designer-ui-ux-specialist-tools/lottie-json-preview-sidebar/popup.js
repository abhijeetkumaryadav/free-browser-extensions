/* Lottie Preview Studio — popup logic.
 * Loads user-supplied Lottie JSON into the locally-bundled lottie-web build.
 * Everything runs offline; the last animation is cached on-device. */
(function () {
  'use strict';

  // ---- DOM refs ----
  var $ = function (id) { return document.getElementById(id); };
  var inputSection = $('inputSection'), playerSection = $('playerSection');
  var jsonInput = $('jsonInput'), errorMsg = $('errorMsg');
  var loadBtn = $('loadBtn'), fileInput = $('fileInput');
  var playBtn = $('playBtn'), playIcon = $('playIcon');
  var scrubber = $('scrubber'), frameLabel = $('frameLabel');
  var loopBtn = $('loopBtn'), copyBtn = $('copyBtn'), newBtn = $('newBtn');
  var speedChips = document.querySelectorAll('.speed-group .chip');

  // ---- State ----
  var anim = null;          // lottie-web animation instance
  var animData = null;      // parsed JSON object
  var animJSON = '';        // raw text
  var totalFrames = 0;
  var isPlaying = false;
  var isScrubbing = false;
  var currentSpeed = 1;

  var ICON_PLAY = '<polygon points="6,4 20,12 6,20"/>';
  var ICON_PAUSE = '<line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/>';

  // ---- Helpers ----
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }
  function clearError() {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
  }

  // Validate that the object looks like a Lottie composition.
  function validateLottie(obj) {
    if (!obj || typeof obj !== 'object') return 'Not a JSON object.';
    if (!Array.isArray(obj.layers)) return 'Missing "layers" array — not a Lottie file.';
    if (typeof obj.fr !== 'number' || typeof obj.op !== 'number') {
      return 'Missing frame rate (fr) or out-point (op).';
    }
    return null;
  }

  // ---- Load an animation from raw JSON text ----
  function loadAnimation(text) {
    clearError();
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { showError('Invalid JSON: ' + e.message); return; }

    var problem = validateLottie(obj);
    if (problem) { showError(problem); return; }

    // Tear down any previous instance.
    if (anim) { anim.destroy(); anim = null; }
    $('stage').innerHTML = '';

    animData = obj;
    animJSON = text;

    try {
      anim = lottie.loadAnimation({
        container: $('stage'),
        renderer: 'svg',
        loop: loopBtn.classList.contains('active'),
        autoplay: true,
        animationData: obj
      });
    } catch (e) {
      showError('Renderer failed: ' + e.message);
      return;
    }

    // Wire events.
    anim.addEventListener('enterFrame', onEnterFrame);
    anim.addEventListener('complete', function () {
      if (!anim.loop) setPlaying(false);
    });

    totalFrames = Math.round(anim.getDuration(true));
    currentSpeed = 1;
    speedChips.forEach(function (c) { c.classList.toggle('active', c.dataset.speed === '1'); });
    scrubber.max = totalFrames;
    scrubber.value = 0;
    updateFrameLabel(0);
    fillMetadata(obj);
    setPlaying(true);

    inputSection.classList.add('hidden');
    playerSection.classList.remove('hidden');

    // Cache on-device so reopening the popup restores the last animation.
    chrome.storage.local.set({ lastLottie: text }, function () {});
  }

  // ---- Metadata ----
  function fillMetadata(obj) {
    var fr = obj.fr, ip = obj.ip || 0, op = obj.op;
    var frames = Math.round(op - ip);
    var dur = (frames / fr).toFixed(2) + 's';
    var w = obj.w || '?', h = obj.h || '?';
    $('metaFrames').textContent = String(frames);
    $('metaFps').textContent = String(fr);
    $('metaDur').textContent = dur;
    $('metaLayers').textContent = String(obj.layers.length);
    $('metaSize').textContent = w + '×' + h;
    $('metaVer').textContent = obj.v || '–';
  }

  // ---- Transport ----
  function setPlaying(playing) {
    isPlaying = playing;
    playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  }

  function onEnterFrame() {
    if (!anim || isScrubbing) return;
    var f = Math.round(anim.currentFrame);
    scrubber.value = f;
    updateFrameLabel(f);
  }

  function updateFrameLabel(f) {
    frameLabel.textContent = f + ' / ' + totalFrames;
  }

  playBtn.addEventListener('click', function () {
    if (!anim) return;
    if (isPlaying) { anim.pause(); setPlaying(false); }
    else { anim.play(); setPlaying(true); }
  });

  scrubber.addEventListener('input', function () {
    if (!anim) return;
    isScrubbing = true;
    var f = parseInt(scrubber.value, 10);
    anim.goToAndStop(f, true);
    updateFrameLabel(f);
  });
  scrubber.addEventListener('change', function () { isScrubbing = false; });

  speedChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      speedChips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      currentSpeed = parseFloat(chip.dataset.speed);
      if (anim) anim.setSpeed(currentSpeed);
    });
  });

  loopBtn.addEventListener('click', function () {
    var on = loopBtn.classList.toggle('active');
    if (anim) anim.loop = on;
  });

  // ---- Buttons ----
  loadBtn.addEventListener('click', function () {
    loadAnimation(jsonInput.value.trim());
  });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      jsonInput.value = String(reader.result);
      loadAnimation(jsonInput.value.trim());
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  copyBtn.addEventListener('click', function () {
    if (!animJSON) return;
    navigator.clipboard.writeText(animJSON).then(function () {
      copyBtn.classList.add('active');
      setTimeout(function () { copyBtn.classList.remove('active'); }, 900);
    }, function () {});
  });

  newBtn.addEventListener('click', function () {
    if (anim) { anim.destroy(); anim = null; }
    animData = null; animJSON = '';
    jsonInput.value = '';
    playerSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    chrome.storage.local.remove('lastLottie', function () {});
  });

  // ---- Restore last animation on open ----
  chrome.storage.local.get('lastLottie', function (res) {
    if (res && res.lastLottie) loadAnimation(res.lastLottie);
  });
})();
