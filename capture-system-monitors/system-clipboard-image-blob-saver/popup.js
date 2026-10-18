/* ClipSave — Clipboard Image Saver popup logic.
 *
 * SAFETY / HONEST SCOPE:
 * - The clipboard is read ONLY on the explicit "Read image" button click
 *   (a user gesture). Nothing is ever read automatically or in the background.
 * - The image never leaves the device: preview is a local object URL, saving
 *   uses a local blob URL through the browser's normal download flow —
 *   nothing is downloaded silently (no `downloads` permission is used).
 * - All processing (canvas re-encode to PNG) happens on-device, zero network.
 */

(function () {
  'use strict';

  const readBtn     = document.getElementById('readBtn');
  const previewPanel= document.getElementById('previewPanel');
  const previewImg  = document.getElementById('previewImg');
  const metaSize    = document.getElementById('metaSize');
  const metaFormat  = document.getElementById('metaFormat');
  const metaBytes   = document.getElementById('metaBytes');
  const fileNameInp = document.getElementById('fileName');
  const saveBtn     = document.getElementById('saveBtn');
  const copyBackBtn = document.getElementById('copyBackBtn');
  const errorPanel  = document.getElementById('errorPanel');
  const errorText   = document.getElementById('errorText');

  let currentBlob = null;   // the clipboard image blob
  let objectUrl = null;     // its object URL (revoked on replace/close)
  const saveBtnHTML = saveBtn.innerHTML; // restore after the "Saved ✓" flash

  function showError(msg) {
    errorText.textContent = msg;
    errorPanel.classList.remove('hidden');
  }

  function hideError() {
    errorPanel.classList.add('hidden');
  }

  /** Human-readable byte size. Pure function — easy to unit-test. */
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /** Sanitize a user-supplied filename: strip path separators and weird chars. */
  function sanitizeName(name) {
    const clean = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
    return clean || 'clipboard-image';
  }

  function revoke() {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }
  window.addEventListener('unload', revoke);

  /** Explicit user-gesture clipboard read: image items only. */
  async function readClipboardImage() {
    hideError();
    if (!navigator.clipboard || !navigator.clipboard.read) {
      showError('Image clipboard reading is not supported in this browser.');
      return;
    }
    readBtn.disabled = true;
    try {
      const items = await navigator.clipboard.read(); // user gesture only
      let blob = null, mime = '';
      for (const item of items) {
        const imgType = item.types.find(function (t) { return t.startsWith('image/'); });
        if (imgType) { blob = await item.getType(imgType); mime = imgType; break; }
      }
      if (!blob) {
        showError('No image on the clipboard. Copy an image first, then press this button again.');
        return;
      }
      // Re-encode to PNG locally via canvas so "Save as PNG" is truthful.
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      const pngBlob = await new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
      bmp.close();
      if (!pngBlob) { showError('Could not convert the image.'); return; }

      revoke();
      currentBlob = pngBlob;
      objectUrl = URL.createObjectURL(pngBlob);
      previewImg.src = objectUrl;
      metaSize.textContent = canvas.width + ' × ' + canvas.height + ' px';
      metaFormat.textContent = 'PNG (from ' + mime + ')';
      metaBytes.textContent = formatBytes(pngBlob.size);
      previewPanel.classList.remove('hidden');
    } catch (e) {
      showError('Clipboard read was denied or failed (' + (e && e.name ? e.name : 'error') + '). Grant permission and try again.');
    } finally {
      readBtn.disabled = false;
    }
  }

  /** Save the current image via a one-time blob download (browser download flow). */
  function savePng() {
    if (!currentBlob) return;
    const name = sanitizeName(fileNameInp.value) + '.png';
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    saveBtn.textContent = 'Saved ✓';
    setTimeout(function () { saveBtn.innerHTML = saveBtnHTML; }, 1500);
  }

  /** Copy the image back to the clipboard (another explicit gesture). */
  async function copyBack() {
    if (!currentBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentBlob })]);
      copyBackBtn.textContent = 'Copied ✓';
    } catch (e) {
      copyBackBtn.textContent = 'Failed';
    }
    setTimeout(function () { copyBackBtn.textContent = 'Copy'; }, 1500);
  }

  readBtn.addEventListener('click', readClipboardImage);
  saveBtn.addEventListener('click', savePng);
  copyBackBtn.addEventListener('click', copyBack);
})();
