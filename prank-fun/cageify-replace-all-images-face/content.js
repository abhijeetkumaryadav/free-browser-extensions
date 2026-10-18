// Cageify content script — runs in the page's isolated world.
// Holds its own state so repeated popup clicks reuse the same store.
(() => {
  'use strict';

  // Lazily resolved face URLs (chrome.runtime is available in isolated worlds).
  let faces = null;
  const getFaces = () => {
    if (!faces) {
      faces = [1, 2, 3, 4].map(n => chrome.runtime.getURL(`faces/face${n}.png`));
    }
    return faces;
  };

  let active = false;      // whether cageify mode is on for this page
  let observer = null;     // MutationObserver watching for late-loading images

  /** Swap a single <img> for a random silly face, remembering the original. */
  function cageifyImg(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.cageified === '1') return;
    img.dataset.cageified = '1';
    img.dataset.origSrc = img.currentSrc || img.src || '';
    img.dataset.origSrcset = img.getAttribute('srcset') || '';
    const list = getFaces();
    img.removeAttribute('srcset');
    img.src = list[Math.floor(Math.random() * list.length)];
  }

  /** Swap every image currently in the document. */
  function cageifyAll() {
    document.querySelectorAll('img').forEach(cageifyImg);
  }

  /** Restore every swapped image to its original source. */
  function restoreAll() {
    document.querySelectorAll('img[data-cageified="1"]').forEach(img => {
      if (img.dataset.origSrcset) {
        img.setAttribute('srcset', img.dataset.origSrcset);
      }
      img.src = img.dataset.origSrc || '';
      delete img.dataset.cageified;
      delete img.dataset.origSrc;
      delete img.dataset.origSrcset;
    });
  }

  /** Watch for images added after activation (lazy loaders, infinite scroll). */
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLImageElement) {
            cageifyImg(node);
          } else if (node instanceof Element) {
            node.querySelectorAll && node.querySelectorAll('img').forEach(cageifyImg);
          }
        }
        // Catch src changes on already-present images (e.g. carousels).
        if (m.type === 'attributes' && m.target instanceof HTMLImageElement
            && m.target.dataset.cageified !== '1') {
          cageifyImg(m.target);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function activate() {
    active = true;
    cageifyAll();
    startObserver();
  }

  function deactivate() {
    active = false;
    stopObserver();
    restoreAll();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'cageify-status') {
      sendResponse({ active });
    } else if (msg.action === 'cageify-on') {
      activate();
      sendResponse({ active: true });
    } else if (msg.action === 'cageify-off') {
      deactivate();
      sendResponse({ active: false });
    }
    return false; // synchronous responses only
  });
})();
