/* Note Overlay Canvas — content script.
 * Renders draggable, resizable sticky notes in an isolated overlay layer.
 * All rendering happens inside a Shadow DOM so page styles can never
 * affect the notes, and the notes can never alter the page itself.
 * Notes are stored per-origin in chrome.storage.local; only the data
 * for location.origin is ever read or written.
 */
(() => {
  if (window.__nucInstalled) return;
  window.__nucInstalled = true;

  const STORE_KEY = "nuc-notes";
  const SAVE_DEBOUNCE_MS = 400;
  const COLORS = ["#fef3c7", "#ffe4e6", "#dcfce7", "#e0f2fe", "#f3e8ff"];
  const NOTE_W = 220;
  const MIN_W = 160;
  const MIN_H = 90;
  const origin = location.origin;

  let notes = [];
  let saveTimer = null;

  /* ---------- isolated UI ---------- */
  const host = document.createElement("div");
  host.id = "nuc-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .nuc-layer {
        position: fixed; inset: 0; z-index: 2147483647;
        pointer-events: none;
        font-family: -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
      }
      .nuc-note {
        position: absolute; pointer-events: auto;
        background: var(--nuc-bg, #fef3c7);
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.10);
        box-shadow: 0 12px 32px rgba(0,0,0,.35);
        display: flex; flex-direction: column; overflow: hidden;
        transition: outline-color .2s;
        outline: 3px solid transparent;
      }
      .nuc-note.nuc-flash { outline-color: #f43f5e; }
      .nuc-head {
        display: flex; align-items: center; gap: 6px;
        padding: 7px 8px; cursor: grab;
        background: rgba(0,0,0,.06);
        user-select: none; -webkit-user-select: none;
      }
      .nuc-head:active { cursor: grabbing; }
      .nuc-swatch {
        width: 14px; height: 14px; border-radius: 50%;
        border: 1px solid rgba(0,0,0,.25);
        background: var(--nuc-bg, #fef3c7);
        cursor: pointer; padding: 0; flex: 0 0 auto;
      }
      .nuc-title {
        flex: 1; min-width: 0; font-size: 11px; font-weight: 700;
        color: #3f3f46; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
      .nuc-btn {
        border: 0; background: transparent; cursor: pointer;
        font-size: 14px; line-height: 1; color: #52525b;
        width: 24px; height: 24px; border-radius: 6px; padding: 0;
      }
      .nuc-btn:hover { background: rgba(0,0,0,.10); }
      .nuc-body { display: flex; }
      .nuc-note textarea {
        width: 100%; min-height: 110px; border: 0; background: transparent;
        resize: none; padding: 10px 12px; outline: none;
        font: 13px/1.55 -apple-system, "Segoe UI", Roboto, Inter, sans-serif;
        color: #27272a;
      }
      .nuc-note.nuc-min .nuc-body,
      .nuc-note.nuc-min .nuc-resize { display: none; }
      .nuc-resize {
        position: absolute; right: 3px; bottom: 3px;
        width: 16px; height: 16px; cursor: nwse-resize;
        opacity: .55;
      }
      .nuc-resize:hover { opacity: 1; }
    </style>
    <div class="nuc-layer"></div>`;
  const layer = shadow.querySelector(".nuc-layer");
  if (document.documentElement) {
    document.documentElement.appendChild(host);
  } else {
    document.addEventListener("DOMContentLoaded", () =>
      document.documentElement.appendChild(host)
    );
  }

  /* ---------- storage ---------- */
  async function load() {
    try {
      const all = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
      notes = Array.isArray(all[origin]) ? all[origin] : [];
    } catch (e) {
      notes = [];
    }
    render();
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const all = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
        all[origin] = notes;
        await chrome.storage.local.set({ [STORE_KEY]: all });
      } catch (e) {
        /* storage full/blocked — keep in-memory copy */
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function persistNow() {
    clearTimeout(saveTimer);
    persist();
  }

  // Re-render when another tab changes this origin's notes,
  // unless the user is actively typing in a note here.
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes[STORE_KEY]) return;
    const active = shadow.activeElement;
    if (active && active.tagName === "TEXTAREA") return;
    const all = changes[STORE_KEY].newValue || {};
    notes = Array.isArray(all[origin]) ? all[origin] : [];
    render();
  });

  /* ---------- note model ---------- */
  function makeNote(x, y) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      id: "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
      x: Math.max(8, Math.min(x, vw - NOTE_W - 8)),
      y: Math.max(8, Math.min(y, vh - 120)),
      w: NOTE_W,
      text: "",
      color: COLORS[0],
      min: false,
      ts: Date.now(),
    };
  }

  function addNote() {
    const n = makeNote(window.innerWidth / 2 - NOTE_W / 2, window.innerHeight * 0.25);
    notes.push(n);
    persistNow();
    render();
    const el = layer.querySelector(`[data-id="${n.id}"] textarea`);
    if (el) el.focus();
  }

  function removeNote(id) {
    notes = notes.filter((n) => n.id !== id);
    persistNow();
    render();
  }

  function flash(id) {
    const el = layer.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("nuc-flash");
    setTimeout(() => el.classList.remove("nuc-flash"), 1200);
  }

  /* ---------- rendering ---------- */
  function render() {
    layer.innerHTML = "";
    for (const n of notes) layer.appendChild(buildNoteEl(n));
  }

  function buildNoteEl(n) {
    const el = document.createElement("div");
    el.className = "nuc-note" + (n.min ? " nuc-min" : "");
    el.dataset.id = n.id;
    el.style.left = n.x + "px";
    el.style.top = n.y + "px";
    el.style.width = n.w + "px";
    el.style.setProperty("--nuc-bg", n.color);

    // Header: drag handle + color cycler + title + minimize + delete.
    const head = document.createElement("div");
    head.className = "nuc-head";

    const swatch = document.createElement("button");
    swatch.className = "nuc-swatch";
    swatch.title = "Change color";
    swatch.addEventListener("click", (e) => {
      e.stopPropagation();
      n.color = COLORS[(COLORS.indexOf(n.color) + 1) % COLORS.length];
      el.style.setProperty("--nuc-bg", n.color);
      persistNow();
    });

    const title = document.createElement("div");
    title.className = "nuc-title";
    title.textContent = noteTitle(n);

    const minBtn = document.createElement("button");
    minBtn.className = "nuc-btn";
    minBtn.textContent = n.min ? "▢" : "–";
    minBtn.title = n.min ? "Expand" : "Minimize";
    minBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      n.min = !n.min;
      persistNow();
      render();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "nuc-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete note";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeNote(n.id);
    });

    head.append(swatch, title, minBtn, delBtn);
    el.appendChild(head);
    enableDrag(el, n, head);

    // Body: textarea editor.
    const body = document.createElement("div");
    body.className = "nuc-body";
    const ta = document.createElement("textarea");
    ta.value = n.text;
    ta.placeholder = "Type your note…";
    ta.setAttribute("aria-label", "Sticky note text");
    ta.addEventListener("input", () => {
      n.text = ta.value;
      title.textContent = noteTitle(n);
      persist();
    });
    body.appendChild(ta);
    el.appendChild(body);

    // Resize handle.
    const rz = document.createElement("div");
    rz.className = "nuc-resize";
    rz.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#52525b" stroke-width="2" stroke-linecap="round"><path d="M14 10v4h-4"/><path d="M14 14 8 8"/></svg>';
    el.appendChild(rz);
    enableResize(el, n, rz);

    return el;
  }

  function noteTitle(n) {
    const first = (n.text || "").split("\n").map((l) => l.trim()).find(Boolean);
    return first ? first.slice(0, 32) : "Note";
  }

  /* ---------- drag & resize ---------- */
  function enableDrag(el, n, handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".nuc-btn, .nuc-swatch")) return;
      e.preventDefault();
      const sx = e.clientX - n.x;
      const sy = e.clientY - n.y;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        n.x = Math.max(0, Math.min(ev.clientX - sx, window.innerWidth - 60));
        n.y = Math.max(0, Math.min(ev.clientY - sy, window.innerHeight - 40));
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        persistNow();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  function enableResize(el, n, handle) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = n.w;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        n.w = Math.max(MIN_W, startW + (ev.clientX - startX));
        el.style.width = n.w + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        persistNow();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  /* ---------- popup messages ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "nuc-ping") sendResponse({ ok: true });
    else if (msg && msg.type === "nuc-add") { addNote(); sendResponse({ ok: true }); }
    else if (msg && msg.type === "nuc-flash") { flash(msg.id); sendResponse({ ok: true }); }
    return true;
  });

  load();
})();
