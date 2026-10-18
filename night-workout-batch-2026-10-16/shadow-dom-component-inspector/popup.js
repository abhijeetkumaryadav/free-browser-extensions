// Shadow DOM Component Inspector — popup logic.
// Orchestrates scans of the active tab and renders the component tree.

const scanBtn = document.getElementById('scanBtn');
const clearBtn = document.getElementById('clearBtn');
const treeEl = document.getElementById('tree');
const statsEl = document.getElementById('stats');
const emptyEl = document.getElementById('empty');

let nodes = [];
let selectedId = null;

// Ask the page to collect its open shadow roots and return a flat tree.
function requestScan() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      const tab = tabs[0];
      if (!tab || !tab.id) return reject(new Error('No active tab.'));
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: collectShadowTree },
        (results) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(results && results[0] ? results[0].result : null);
        }
      );
    });
  });
}

// Ask the page to highlight one node (id => data-path) via overlay box.
function requestHighlight(path) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return resolve();
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: highlightNode, args: [path] },
        () => resolve()
      );
    });
  });
}

// Ask the page to remove the highlight overlay.
function requestClearHighlight() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return resolve();
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: clearHighlight },
        () => resolve()
      );
    });
  });
}

// Runs inside the page: walks the DOM, descending into open shadow roots only.
function collectShadowTree() {
  const out = [];
  let id = 0;
  const seen = new Set();

  // Walk a DOM subtree; record any element with an open shadowRoot.
  function walk(root, depth, path) {
    const els = root.querySelectorAll('*');
    for (const el of els) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (el.shadowRoot) {
        const slots = el.shadowRoot.querySelectorAll('slot').length;
        const rec = {
          id: id++,
          tag: el.tagName.toLowerCase(),
          depth: depth,
          slots: slots,
          path: path + '/' + (id - 1)
        };
        out.push(rec);
        // Recurse into this shadow root's own children (deeper nesting).
        walk(el.shadowRoot, depth + 1, path + '/' + (id - 1));
      }
    }
  }

  try {
    walk(document, 0, '');
  } catch (e) {
    return { error: String(e && e.message || e), nodes: [] };
  }
  return { error: null, nodes: out };
}

// Runs inside the page: draws a temporary highlight overlay on the node.
// (Self-contained: the clear logic is inline because only this function's
// own source is serialized into the page.)
function highlightNode(path) {
  try {
    var prev = document.getElementById('__shadow-inspector-highlight__');
    if (prev) prev.remove();
    // path is a slash-joined chain of node ids; the host element is the last recorded one.
    // Re-run a lightweight collection to map id -> element.
    var id = 0;
    var seen = new Set();
    var target = null;
    var targetId = Number(path.split('/').pop());
    function walk(root) {
      var els = root.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.shadowRoot) {
          if (id === targetId) { target = el; return; }
          id++;
          walk(el.shadowRoot);
          if (target) return;
        }
      }
    }
    walk(document);
    if (!target) return;
    var r = target.getBoundingClientRect();
    var box = document.createElement('div');
    box.id = '__shadow-inspector-highlight__';
    box.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483647;' +
      'left:' + (r.left + window.scrollX) + 'px;top:' + (r.top + window.scrollY) + 'px;' +
      'width:' + r.width + 'px;height:' + r.height + 'px;' +
      'outline:3px solid #22d3ee;outline-offset:2px;border-radius:4px;' +
      'background:rgba(34,211,238,0.12);';
    document.documentElement.appendChild(box);
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) { /* best effort only */ }
}

// Runs inside the page: removes the highlight overlay.
function clearHighlight() {
  try {
    const box = document.getElementById('__shadow-inspector-highlight__');
    if (box) box.remove();
  } catch (e) { /* noop */ }
}

// Render the flat tree (with depth indentation) into the popup.
function renderTree(list) {
  treeEl.innerHTML = '';
  selectedId = null;
  if (!list.length) {
    emptyEl.innerHTML = 'No open shadow roots found on this page.<br>Closed shadow roots cannot be inspected by design.';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  const maxDepth = Math.max.apply(null, list.map(n => n.depth));
  for (const n of list) {
    const div = document.createElement('div');
    div.className = 'node' + (n.depth > 0 ? ' shadow-host' : '');
    div.style.marginLeft = (n.depth * 14) + 'px';
    div.dataset.id = n.id;
    div.dataset.path = n.path;

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = '<' + n.tag + '>';

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = 'depth ' + n.depth + ' · ' + n.slots + ' slot' + (n.slots === 1 ? '' : 's');

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'HOST';

    div.appendChild(tag);
    div.appendChild(meta);
    div.appendChild(badge);

    div.addEventListener('click', () => {
      document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      selectedId = n.id;
      requestHighlight(n.path);
    });

    treeEl.appendChild(div);
  }

  statsEl.innerHTML = '<span><b>' + list.length + '</b> shadow host' + (list.length === 1 ? '' : 's') + '</span>' +
    '<span>max depth <b>' + maxDepth + '</b></span>' +
    '<span>open roots only</span>';
  statsEl.classList.remove('hidden');
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    const res = await requestScan();
    if (!res) {
      emptyEl.textContent = 'Scan failed — try a different page.';
      emptyEl.style.display = 'block';
    } else if (res.error) {
      emptyEl.textContent = 'Scan error: ' + res.error;
      emptyEl.style.display = 'block';
    } else {
      nodes = res.nodes || [];
      renderTree(nodes);
    }
  } catch (err) {
    emptyEl.textContent = 'Could not scan this page (' + (err && err.message || err) + '). Internal pages cannot be scanned.';
    emptyEl.style.display = 'block';
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Scan this page';
  }
});

clearBtn.addEventListener('click', () => {
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
  selectedId = null;
  requestClearHighlight();
});
