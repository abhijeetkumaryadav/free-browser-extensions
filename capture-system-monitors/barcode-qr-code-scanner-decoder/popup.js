/* QRScan — QR code decoder popup logic.
 * All decoding runs locally via the vendored jsQR (lib/jsQR.js, Apache-2.0).
 * Honest scope: QR codes only. No network, no uploads. Clipboard is read
 * only on the explicit "Paste" button click (user gesture). */

(function () {
  'use strict';

  // --- DOM refs ---
  const dropzone    = document.getElementById('dropzone');
  const fileInput   = document.getElementById('fileInput');
  const browseBtn   = document.getElementById('browseBtn');
  const pasteBtn    = document.getElementById('pasteBtn');
  const previewPanel= document.getElementById('previewPanel');
  const previewCanvas = document.getElementById('previewCanvas');
  const imgMeta     = document.getElementById('imgMeta');
  const rescanBtn   = document.getElementById('rescanBtn');
  const resultPanel = document.getElementById('resultPanel');
  const resultText  = document.getElementById('resultText');
  const copyBtn     = document.getElementById('copyBtn');
  const openLink    = document.getElementById('openLink');
  const errorPanel  = document.getElementById('errorPanel');
  const errorText   = document.getElementById('errorText');

  let lastDecoded = '';   // decoded payload, used by the copy button
  let currentFileName = '';

  /** Show an error state in the UI. */
  function showError(msg) {
    errorText.textContent = msg;
    errorPanel.classList.remove('hidden');
    resultPanel.classList.add('hidden');
  }

  /** Hide result and error panels before a new scan. */
  function resetPanels() {
    resultPanel.classList.add('hidden');
    errorPanel.classList.add('hidden');
  }

  /**
   * Decode a QR code from an ImageBitmap/HTMLImageElement.
   * Downscales very large images for speed, then feeds raw pixels to jsQR.
   * @param {CanvasImageSource} source
   * @param {string} label human label for the source (file name or "clipboard")
   */
  function decodeSource(source, label) {
    resetPanels();
    const w = source.width, h = source.height;

    // Downscale to a max of 1200px on the long edge to keep jsQR fast.
    const MAX_EDGE = 1200;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const work = document.createElement('canvas');
    work.width = cw; work.height = ch;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(source, 0, 0, cw, ch);

    // Render a small preview for the user.
    previewCanvas.width = 192; previewCanvas.height = 192;
    const pctx = previewCanvas.getContext('2d');
    pctx.fillStyle = '#000'; pctx.fillRect(0, 0, 192, 192);
    const fit = Math.min(192 / cw, 192 / ch);
    const dw = cw * fit, dh = ch * fit;
    pctx.drawImage(work, (192 - dw) / 2, (192 - dh) / 2, dw, dh);
    previewPanel.classList.remove('hidden');
    imgMeta.textContent = label + ' · ' + w + '×' + h + ' px';

    let code = null;
    try {
      const imageData = wctx.getImageData(0, 0, cw, ch);
      // jsQR is exposed as a global by the vendored UMD bundle.
      code = window.jsQR(imageData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
    } catch (e) {
      showError('Decode failed: ' + e.message);
      return;
    }

    if (code && code.data) {
      showResult(code.data);
    } else {
      showError('The image was scanned but no QR code was detected. Try a clearer or larger image.');
    }
  }

  /** Render the decoded payload, wiring copy + optional open-link. */
  function showResult(data) {
    lastDecoded = data;
    resultText.textContent = data;
    resultPanel.classList.remove('hidden');

    if (/^https?:\/\//i.test(data.trim())) {
      openLink.href = data.trim();
      openLink.classList.remove('hidden');
    } else {
      openLink.classList.add('hidden');
    }
    // Persist last successful decode (nice touch, fully local).
    chrome.storage.local.set({ qrscan_last: data }).catch(() => {});
  }

  /** Load an image File and decode it. */
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showError('That file is not an image. Please choose a PNG, JPG, WebP or GIF image.');
      return;
    }
    currentFileName = file.name || 'image';
    createImageBitmap(file)
      .then(function (bmp) { decodeSource(bmp, currentFileName); })
      .catch(function () {
        // Fallback for formats createImageBitmap can't handle.
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          decodeSource(img, currentFileName);
          URL.revokeObjectURL(url);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          showError('Could not read that image file.');
        };
        img.src = url;
      });
  }

  /** Explicit user-gesture clipboard read: image only, never silent. */
  async function pasteFromClipboard() {
    resetPanels();
    if (!navigator.clipboard || !navigator.clipboard.read) {
      showError('Clipboard image reading is not supported in this browser.');
      return;
    }
    pasteBtn.disabled = true;
    try {
      const items = await navigator.clipboard.read(); // user gesture only
      for (const item of items) {
        const imgType = item.types.find(function (t) { return t.startsWith('image/'); });
        if (imgType) {
          const blob = await item.getType(imgType);
          handleFile(new File([blob], 'clipboard-image', { type: imgType }));
          return;
        }
      }
      showError('No image found on the clipboard. Copy an image first, then press this button again.');
    } catch (e) {
      showError('Clipboard read was denied or failed. Grant permission and try again.');
    } finally {
      pasteBtn.disabled = false;
    }
  }

  // --- Events: dropzone / drag & drop / browse / paste / rescan / copy ---
  browseBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
  dropzone.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault(); dropzone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault(); dropzone.classList.remove('dragging');
    });
  });
  dropzone.addEventListener('drop', function (e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  pasteBtn.addEventListener('click', pasteFromClipboard);
  rescanBtn.addEventListener('click', function () {
    fileInput.click(); // simplest rescan path: pick the image again
  });

  copyBtn.addEventListener('click', async function () {
    if (!lastDecoded) return;
    const originalHTML = copyBtn.innerHTML;
    let ok = false;
    try {
      await navigator.clipboard.writeText(lastDecoded);
      ok = true;
    } catch (e) {
      // Fallback for older browsers.
      const ta = document.createElement('textarea');
      ta.value = lastDecoded;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ok = true; }
      catch (err) { ok = false; }
      ta.remove();
    }
    copyBtn.innerHTML = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(function () { copyBtn.innerHTML = originalHTML; }, 1500);
  });
})();
