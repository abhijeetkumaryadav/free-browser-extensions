/* Form Frame Scrubber — frame stepping, slow-mo, A/B loop. All local. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const video = $('video'), empty = $('empty');
  const file = $('file'), seek = $('seek');
  const tcur = $('tcur'), tdur = $('tdur');
  const fpsIn = $('fps'), speedSel = $('speed');
  const aVal = $('aVal'), bVal = $('bVal');
  const loopT = $('loopT'), clearAB = $('clearAB');

  let A = null, B = null, looping = false, objUrl = null;

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00.00';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
  };

  // --- Load video ---------------------------------------------------------
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    if (objUrl) URL.revokeObjectURL(objUrl);
    objUrl = URL.createObjectURL(f);
    video.src = objUrl;
    video.playbackRate = parseFloat(speedSel.value);
    empty.classList.add('gone');
    A = B = null; looping = false; refreshAB();
  });

  // --- Frame stepping -----------------------------------------------------
  const frameDur = () => 1 / Math.max(1, Math.min(240, parseFloat(fpsIn.value) || 30));
  const stepFrame = (dir) => {
    if (!video.duration) return;
    video.pause();
    video.currentTime = Math.min(Math.max(0, video.currentTime + dir * frameDur()), video.duration || 0);
    updateUI();
  };
  $('prevF').addEventListener('click', () => stepFrame(-1));
  $('nextF').addEventListener('click', () => stepFrame(1));

  // --- Play / pause --------------------------------------------------------
  const setPlayIcon = () => {
    $('playIcon').innerHTML = video.paused
      ? '<polygon points="6 3 20 12 6 21 6 3"/>'
      : '<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>';
  };
  $('play').addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
  video.addEventListener('play', setPlayIcon);
  video.addEventListener('pause', setPlayIcon);
  speedSel.addEventListener('change', () => { video.playbackRate = parseFloat(speedSel.value); });

  // --- Seek bar ------------------------------------------------------------
  seek.addEventListener('input', () => {
    if (!video.duration) return;
    video.currentTime = (seek.value / 1000) * video.duration;
  });

  // --- A/B loop ------------------------------------------------------------
  const refreshAB = () => {
    aVal.textContent = A === null ? '—' : fmt(A);
    bVal.textContent = B === null ? '—' : fmt(B);
    const ready = A !== null && B !== null && B > A;
    loopT.disabled = clearAB.disabled = !ready && (A === null && B === null);
    loopT.disabled = A === null && B === null;
    loopT.classList.toggle('on', looping && ready);
    loopT.textContent = looping && ready ? 'Loop A–B: on' : 'Loop A–B: off';
    chrome.storage.local.set({ ffs: { fps: fpsIn.value, speed: speedSel.value, a: A, b: B } });
  };
  const markPoint = () => {
    const t = video.currentTime;
    if (A === null || (B !== null && A !== null)) { A = t; B = null; looping = false; }
    else if (t > A) { B = t; }
    else { A = t; B = null; looping = false; }
    refreshAB();
  };
  $('setA').addEventListener('click', () => { A = video.currentTime; if (B !== null && B <= A) B = null; looping = false; refreshAB(); });
  $('setB').addEventListener('click', () => {
    if (A !== null && video.currentTime > A) { B = video.currentTime; refreshAB(); }
  });
  loopT.addEventListener('click', () => { looping = !looping; refreshAB(); });
  clearAB.addEventListener('click', () => { A = B = null; looping = false; refreshAB(); });
  video.addEventListener('timeupdate', () => {
    if (looping && A !== null && B !== null && B > A) {
      if (video.currentTime >= B || video.currentTime < A - 0.05) video.currentTime = A;
    }
    updateUI();
  });

  // --- UI sync --------------------------------------------------------------
  const updateUI = () => {
    tcur.textContent = fmt(video.currentTime);
    tdur.textContent = fmt(video.duration);
    if (video.duration) seek.value = Math.round((video.currentTime / video.duration) * 1000);
  };
  video.addEventListener('loadedmetadata', updateUI);
  video.addEventListener('seeked', updateUI);

  // --- Keyboard --------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'ArrowLeft') { e.preventDefault(); stepFrame(e.shiftKey ? -10 : -1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepFrame(e.shiftKey ? 10 : 1); }
    else if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
    else if (e.key === 'm' || e.key === 'M') markPoint();
  });

  // --- Restore prefs ----------------------------------------------------------
  chrome.storage.local.get('ffs', (r) => {
    const p = r.ffs || {};
    if (p.fps) fpsIn.value = p.fps;
    if (p.speed) { speedSel.value = p.speed; }
  });
  fpsIn.addEventListener('change', refreshAB);
  setPlayIcon();
})();
