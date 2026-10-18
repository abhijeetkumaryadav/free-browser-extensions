/* MemeForge popup logic.
 * Renders the selected bundled template onto a canvas, overlays top/bottom
 * captions in classic meme style, and downloads the result as a PNG via a
 * blob anchor (no `downloads` permission needed). All assets are bundled.
 */
(function () {
  'use strict';

  // Bundled templates (original blank designs generated at build time).
  var TEMPLATES = [
    { id: 'classic',  label: 'Classic' },
    { id: 'twopanel', label: 'Two Panel' },
    { id: 'fourgrid', label: 'Four Grid' },
    { id: 'brainrows', label: 'Brain Rows' },
    { id: 'versus',   label: 'Versus' },
    { id: 'blank',    label: 'Blank' }
  ];

  var SIZE = 600; // template/canvas resolution

  var tplGrid = document.getElementById('tplGrid');
  var topInput = document.getElementById('topText');
  var bottomInput = document.getElementById('bottomText');
  var sizeInput = document.getElementById('fontSize');
  var sizeVal = document.getElementById('sizeVal');
  var outlineBox = document.getElementById('outline');
  var shuffleBtn = document.getElementById('shuffleBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var canvas = document.getElementById('meme');
  var ctx = canvas.getContext('2d');

  var state = { template: 'classic', top: '', bottom: '', size: 64, outline: true };
  var images = {}; // id -> HTMLImageElement (cached)

  // --- Template picker -------------------------------------------------------
  TEMPLATES.forEach(function (t) {
    var btn = document.createElement('button');
    btn.className = 'tpl';
    btn.title = t.label;
    btn.dataset.id = t.id;
    var img = document.createElement('img');
    img.src = 'thumbs/' + t.id + '.png';
    img.alt = t.label;
    btn.appendChild(img);
    btn.addEventListener('click', function () { selectTemplate(t.id); });
    tplGrid.appendChild(btn);
  });

  function selectTemplate(id) {
    state.template = id;
    Array.prototype.forEach.call(tplGrid.children, function (el) {
      el.classList.toggle('on', el.dataset.id === id);
    });
    draw();
    chrome.storage.local.set({ mfTemplate: id });
  }

  // --- Caption drawing -------------------------------------------------------
  // Classic meme caption: uppercase, centered, white with black outline.
  function drawCaption(text, yCenter, maxWidth, fontSize, outline) {
    if (!text) return;
    var upper = text.toUpperCase();
    ctx.font = '900 ' + fontSize + 'px Impact, "Arial Black", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word-wrap to fit maxWidth.
    var words = upper.split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var trial = line ? line + ' ' + w : w;
      if (ctx.measureText(trial).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    });
    if (line) lines.push(line);

    var lineH = fontSize * 1.12;
    var startY = yCenter - ((lines.length - 1) * lineH) / 2;
    lines.forEach(function (ln, i) {
      var y = startY + i * lineH;
      if (outline) {
        ctx.lineWidth = Math.max(2, fontSize / 9);
        ctx.strokeStyle = 'rgba(0,0,0,.92)';
        ctx.lineJoin = 'round';
        ctx.strokeText(ln, SIZE / 2, y);
      }
      ctx.fillStyle = '#fff';
      ctx.fillText(ln, SIZE / 2, y);
    });
  }

  function loadImage(id) {
    return new Promise(function (resolve, reject) {
      if (images[id]) return resolve(images[id]);
      var img = new Image();
      img.onload = function () { images[id] = img; resolve(img); };
      img.onerror = reject;
      img.src = 'templates/' + id + '.png';
    });
  }

  function draw() {
    loadImage(state.template).then(function (img) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      var pad = state.size * 0.75 + 12;
      drawCaption(state.top, pad, SIZE - 36, state.size, state.outline);
      drawCaption(state.bottom, SIZE - pad, SIZE - 36, state.size, state.outline);
    }).catch(function () {
      // Fallback: dark backdrop so captions still render.
      ctx.fillStyle = '#14141a';
      ctx.fillRect(0, 0, SIZE, SIZE);
      drawCaption(state.top, 80, SIZE - 36, state.size, state.outline);
      drawCaption(state.bottom, SIZE - 80, SIZE - 36, state.size, state.outline);
    });
  }

  // --- Controls --------------------------------------------------------------
  var drawT;
  function scheduleDraw() {
    clearTimeout(drawT);
    drawT = setTimeout(draw, 60);
  }

  topInput.addEventListener('input', function () { state.top = topInput.value; scheduleDraw(); });
  bottomInput.addEventListener('input', function () { state.bottom = bottomInput.value; scheduleDraw(); });
  sizeInput.addEventListener('input', function () {
    state.size = parseInt(sizeInput.value, 10) || 64;
    sizeVal.textContent = state.size;
    scheduleDraw();
  });
  outlineBox.addEventListener('change', function () {
    state.outline = outlineBox.checked;
    draw();
  });
  shuffleBtn.addEventListener('click', function () {
    var pick = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)].id;
    selectTemplate(pick);
  });

  // --- Download (blob anchor; no `downloads` permission needed) ---------------
  downloadBtn.addEventListener('click', function () {
    draw(); // ensure latest state is painted
    setTimeout(function () {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'memeforge-' + state.template + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, 'image/png');
    }, 80);
  });

  // --- Restore last session --------------------------------------------------
  chrome.storage.local.get(
    { mfTemplate: 'classic', mfSize: 64, mfOutline: true },
    function (res) {
      state.size = res.mfSize;
      state.outline = res.mfOutline !== false;
      sizeInput.value = state.size;
      sizeVal.textContent = state.size;
      outlineBox.checked = state.outline;
      selectTemplate(TEMPLATES.some(function (t) { return t.id === res.mfTemplate; }) ? res.mfTemplate : 'classic');
    }
  );

  // Persist caption prefs (not the captions themselves).
  sizeInput.addEventListener('change', function () { chrome.storage.local.set({ mfSize: state.size }); });
  outlineBox.addEventListener('change', function () { chrome.storage.local.set({ mfOutline: state.outline }); });
})();
