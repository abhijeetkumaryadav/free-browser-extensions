// Local Tab Mesh — content script. Receives mesh messages and shows a toast.
// Guards against double-injection.
if (!window.__localTabMeshInstalled) {
  window.__localTabMeshInstalled = true;

  const CHANNEL = 'local-tab-mesh';

  // Show an in-page toast for an incoming mesh message.
  function showToast(payload) {
    // Remove any existing toast
    const old = document.getElementById('ltm-toast');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'ltm-toast';
    wrap.attachShadow({ mode: 'open' });
    const accent = '#38bdf8';
    wrap.shadowRoot.innerHTML = `
      <style>
        .toast {
          position: fixed; bottom: 18px; right: 18px; z-index: 2147483647;
          width: 300px; padding: 14px; border-radius: 12px;
          background: rgba(20,20,26,0.92); backdrop-filter: blur(12px);
          border: 1px solid rgba(56,189,248,0.5); color: #eef2f7;
          font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        }
        .head { display:flex; align-items:center; gap:8px; margin-bottom:8px;
                font-weight:700; font-size:12px; color:${accent}; }
        .body { white-space: pre-wrap; word-break: break-word; max-height:160px; overflow:auto; }
        .actions { display:flex; gap:8px; margin-top:10px; }
        button { border:none; border-radius:8px; padding:6px 10px; cursor:pointer;
                 font-size:12px; font-weight:600; }
        .copy { background:${accent}; color:#06222f; }
        .dismiss { background:rgba(255,255,255,0.12); color:#eef2f7; }
      </style>
      <div class="toast">
        <div class="head">⬡ Mesh message · ${escapeHtml(payload.type)}</div>
        <div class="body" id="tb"></div>
        <div class="actions">
          <button class="copy" id="tc">Copy</button>
          <button class="dismiss" id="td">Dismiss</button>
        </div>
      </div>`;
    wrap.shadowRoot.getElementById('tb').textContent = payload.body;
    wrap.shadowRoot.getElementById('tc').addEventListener('click', () => {
      navigator.clipboard.writeText(payload.body).catch(() => {});
      wrap.shadowRoot.getElementById('tc').textContent = 'Copied ✓';
    });
    wrap.shadowRoot.getElementById('td').addEventListener('click', () => wrap.remove());
    document.documentElement.appendChild(wrap);
    setTimeout(() => { const t = document.getElementById('ltm-toast'); if (t) t.remove(); }, 20000);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Receive via extension messaging (from background relay)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.__ltm === true) showToast(msg);
  });

  // Also receive via BroadcastChannel — same-browser profile, no background hop needed.
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev) => {
      if (ev.data && ev.data.__ltm === true) showToast(ev.data);
    };
  } catch (e) { /* BroadcastChannel unsupported — extension messaging still works */ }

  // Announce membership to the mesh (background keeps the roster)
  chrome.runtime.sendMessage({ __ltmJoin: true, url: location.href, title: document.title }).catch(() => {});
}
