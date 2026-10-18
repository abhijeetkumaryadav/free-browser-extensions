/* AsciiArt popup logic.
 * Reads the dropped image with FileReader, draws it small on a canvas,
 * maps each pixel's brightness to a character. Everything stays local —
 * no network, no uploads.
 */
(function () {
  'use strict';

  // Darkest → lightest character ramps.
  var CHARSETS = {
    detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    simple: '@%#*+=-:. ',
    blocks: '█▓▒░ '
  };

  var els = {
    dropzone: document.getElementById('dropzone'),
    file: document.getElementById('file'),
    workbench: document.getElementById('workbench'),
    output: document.getElementById('output'),
    copyTop: document.getElementById('copy'),
    download: document.getElementById('download'),
    copy2: document.getElementById('copy2'),
    newImg: document.getElementById('new'),
    width: document.getElementById('s-width'),
    contrast: document.getElementById('s-contrast'),
    brightness: document.getElementById('s-brightness'),
    charset: document.getElementById('charset'),
    invert: document.getElementById('invert')
  };

  var opts = { width: 100, contrast: 1.0, brightness: 0, charset: 'detailed', invert: false };
  var sourceImage = null;   // HTMLImageElement of the loaded file
  var lastAscii = '';       // latest generated text
  var fileNameBase = 'ascii-art';

  // ---- image loading ---------------------------------------------------------

  function loadFile(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      flashDrop('Please drop an image file.');
      return;
    }
    fileNameBase = (file.name || 'ascii-art').replace(/\.[^.]+$/, '') || 'ascii-art';
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        sourceImage = img;
        els.dropzone.classList.add('hidden');
        els.workbench.classList.remove('hidden');
        els.copyTop.classList.remove('hidden');
        els.download.classList.remove('hidden');
        render();
      };
      img.onerror = function () { flashDrop('Could not read that image.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function flashDrop(msg) {
    var t = els.dropzone.querySelector('.drop-text');
    var orig = t.innerHTML;
    t.innerHTML = '<strong>' + escapeHtml(msg) + '</strong>';
    setTimeout(function () { t.innerHTML = orig; }, 1600);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  els.dropzone.addEventListener('click', function () { els.file.click(); });
  els.dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.file.click(); }
  });
  els.file.addEventListener('change', function () {
    if (els.file.files[0]) loadFile(els.file.files[0]);
    els.file.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    els.dropzone.addEventListener(ev, function (e) { e.preventDefault(); els.dropzone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    els.dropzone.addEventListener(ev, function (e) { e.preventDefault(); els.dropzone.classList.remove('dragover'); });
  });
  els.dropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  els.newImg.addEventListener('click', function () {
    sourceImage = null;
    els.workbench.classList.add('hidden');
    els.copyTop.classList.add('hidden');
    els.download.classList.add('hidden');
    els.dropzone.classList.remove('hidden');
  });

  // ---- conversion ------------------------------------------------------------

  // Rec. 709 luma, adjusted by brightness offset + contrast around midpoint.
  function adjustLuma(luma) {
    var v = luma + Number(opts.brightness);
    v = (v - 128) * Number(opts.contrast) + 128;
    return Math.max(0, Math.min(255, v));
  }

  function convert() {
    if (!sourceImage) return '';
    var chars = CHARSETS[opts.charset] || CHARSETS.detailed;
    var maxIdx = chars.length - 1;

    // Fit width to the requested char count; height follows the aspect ratio.
    // Monospace glyphs are ~2x taller than wide, so halve the row count.
    var w = Math.max(20, Math.min(220, Math.round(opts.width)));
    var aspect = sourceImage.naturalHeight / sourceImage.naturalWidth;
    var h = Math.max(5, Math.round(w * aspect * 0.5));

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(sourceImage, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;

    var rows = [];
    for (var y = 0; y < h; y++) {
      var row = '';
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        var adj = adjustLuma(luma);
        var idx = Math.round((adj / 255) * maxIdx);
        if (opts.invert) idx = maxIdx - idx;
        row += chars.charAt(idx);
      }
      rows.push(row.replace(/\s+$/, '')); // trim trailing spaces per row
    }
    return rows.join('\n');
  }

  function render() {
    lastAscii = convert();
    els.output.textContent = lastAscii;
    // Scale the preview font a touch for very wide art.
    var w = Math.max(20, Math.min(220, Math.round(opts.width)));
    els.output.style.fontSize = (w > 140 ? 4.5 : 6) + 'px';
    document.getElementById('v-width').textContent = String(w);
    document.getElementById('v-contrast').textContent = Number(opts.contrast).toFixed(1);
    document.getElementById('v-brightness').textContent =
      (opts.brightness > 0 ? '+' : '') + String(opts.brightness);
  }

  function persist() {
    chrome.storage.local.set({ asciiOpts: opts });
  }

  // ---- controls ---------------------------------------------------------------

  var debounce = null;
  function onControlChange() {
    opts.width = Number(els.width.value);
    opts.contrast = Number(els.contrast.value);
    opts.brightness = Number(els.brightness.value);
    opts.charset = els.charset.value;
    opts.invert = els.invert.checked;
    persist();
    clearTimeout(debounce);
    debounce = setTimeout(render, 120); // live preview while dragging
  }
  [els.width, els.contrast, els.brightness].forEach(function (s) {
    s.addEventListener('input', onControlChange);
  });
  els.charset.addEventListener('change', onControlChange);
  els.invert.addEventListener('change', onControlChange);

  // ---- copy / download ----------------------------------------------------------

  function copyText() {
    if (!lastAscii) return;
    navigator.clipboard.writeText(lastAscii).then(function () {
      toast(els.copy2, 'Copied!');
    }).catch(function () {
      // Fallback: select the text so the user can copy manually.
      var range = document.createRange();
      range.selectNodeContents(els.output);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  function toast(btn, label) {
    var orig = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = orig; }, 1400);
  }

  els.copy2.addEventListener('click', copyText);
  els.copyTop.addEventListener('click', copyText);

  els.download.addEventListener('click', function () {
    if (!lastAscii) return;
    var blob = new Blob([lastAscii], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileNameBase + '-ascii.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });

  // ---- init ----------------------------------------------------------------------

  chrome.storage.local.get(['asciiOpts'], function (data) {
    if (data.asciiOpts) {
      var o = data.asciiOpts;
      if (o.width) { opts.width = o.width; els.width.value = o.width; }
      if (o.contrast) { opts.contrast = o.contrast; els.contrast.value = o.contrast; }
      if (o.brightness || o.brightness === 0) { opts.brightness = o.brightness; els.brightness.value = o.brightness; }
      if (o.charset && CHARSETS[o.charset]) { opts.charset = o.charset; els.charset.value = o.charset; }
      opts.invert = !!o.invert;
      els.invert.checked = opts.invert;
    }
    render();
  });
})();
