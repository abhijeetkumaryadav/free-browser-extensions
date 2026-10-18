'use strict';
/* ------------------------------------------------------------------
 * Local Tab Mesh — content script (mesh node)
 *
 * Injected ONLY when the user clicks "Join this tab" in the popup.
 * - Joins BroadcastChannel 'local-tab-mesh'
 * - Sends presence heartbeats so the popup can list mesh members
 * - Renders incoming snippet/file messages as dismissible in-page toasts
 * - Reassembles chunked file transfers and offers a download button
 * - Never stores anything; guard against double injection
 * ------------------------------------------------------------------ */

if (window.__tabMeshJoined) {
  // Already a mesh member in this page context; nothing more to do.
} else {
  window.__tabMeshJoined = true;

  const CHANNEL = 'local-tab-mesh';
  const CHUNK = 48 * 1024;            // base64 chars per file chunk
  const TOAST_MS = 20000;             // toast auto-dismiss

  const nodeId = 'tab-' + Math.random().toString(36).slice(2, 10);
  const bc = new BroadcastChannel(CHANNEL);
  const incoming = new Map();         // fileId -> {meta, chunks[]}

  /* ---------- presence ---------- */

  function announce() {
    bc.postMessage({
      type: 'presence',
      nodeId,
      title: document.title || '(untitled)',
      url: location.href,
      ts: Date.now()
    });
  }

  /* ---------- toasts (shadow DOM, isolated styles) ---------- */

  function toast(title, subtitle, actions) {
    if (!document.body) return;
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML =
      '<style>' +
      '.t{position:fixed;right:14px;bottom:14px;z-index:2147483647;max-width:320px;' +
      'background:rgba(16,18,26,.92);backdrop-filter:blur(12px);' +
      'border:1px solid rgba(56,189,248,.45);border-radius:12px;color:#f2f2f7;' +
      'font:13px system-ui,sans-serif;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
      '.t h4{margin:0 0 4px;font-size:12px;color:#38bdf8}' +
      '.t p{margin:0 0 8px;word-break:break-word;max-height:90px;overflow:hidden}' +
      '.t .row{display:flex;gap:8px}' +
      '.t button{font:12px system-ui,sans-serif;padding:6px 12px;border-radius:8px;cursor:pointer;' +
      'border:1px solid rgba(255,255,255,.2);background:transparent;color:#f2f2f7}' +
      '.t button.go{background:#0ea5e9;border:none;color:#06222e;font-weight:700}' +
      '</style>' +
      '<div class="t"><h4></h4><p></p><div class="row"></div></div>';
    root.querySelector('h4').textContent = title;
    root.querySelector('p').textContent = subtitle;
    const row = root.querySelector('.row');
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.primary) b.className = 'go';
      b.addEventListener('click', () => { a.onClick(); dismiss(); });
      row.appendChild(b);
    }
    const dis = document.createElement('button');
    dis.textContent = 'Dismiss';
    dis.addEventListener('click', dismiss);
    row.appendChild(dis);
    function dismiss() { host.remove(); }
    document.body.appendChild(host);
    setTimeout(dismiss, TOAST_MS);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* best effort */ }
    ta.remove();
  }

  function downloadFile(name, dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name || 'shared-file';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- message handling ---------- */

  bc.onmessage = (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.nodeId === nodeId) return;             // ignore own echoes
    if (m.target && m.target !== '*' && m.target !== nodeId) return; // not for us

    if (m.type === 'snippet') {
      const from = m.fromLabel || 'a mesh tab';
      toast('📩 Mesh snippet', from + ': ' + (m.text || '').slice(0, 160), [
        { label: 'Copy', primary: true, onClick: () => copyText(m.text || '') }
      ]);
    } else if (m.type === 'file-meta') {
      incoming.set(m.fileId, { meta: m, chunks: new Array(m.totalChunks) });
    } else if (m.type === 'file-chunk') {
      const rec = incoming.get(m.fileId);
      if (!rec) return;
      rec.chunks[m.index] = m.data;
      const got = rec.chunks.filter(Boolean).length;
      if (got === rec.meta.totalChunks) {
        incoming.delete(m.fileId);
        const dataUrl = 'data:' + rec.meta.mime + ';base64,' + rec.chunks.join('');
        const from = rec.meta.fromLabel || 'a mesh tab';
        toast('📦 Mesh file', from + ' shared "' + rec.meta.name + '" (' +
          (rec.meta.size / 1024).toFixed(1) + ' KB)', [
          { label: 'Download', primary: true, onClick: () => downloadFile(rec.meta.name, dataUrl) }
        ]);
      }
    }
  };

  // Heartbeats: announce presence every 5s; popup expires stale members.
  announce();
  setInterval(announce, 5000);
}
