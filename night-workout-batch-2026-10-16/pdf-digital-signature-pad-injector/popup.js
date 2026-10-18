/* Signature Stamp Pad — draw, save, and stamp signature images onto local photos.
 * Not a legal e-signature. Zero network; stamps in chrome.storage.local. */

// ============ ENGINE-START ============

// Validate a new stamp before saving.
function makeStamp(name, dataUrl) {
  const n = (name || "").trim().slice(0, 60);
  if (!n) return { ok: false, error: "Give the stamp a name." };
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/"))
    return { ok: false, error: "Stamp image is empty." };
  return { ok: true, stamp: { id: "s" + Date.now() + Math.floor(Math.random() * 1e4), name: n, dataUrl, createdAt: Date.now() } };
}

// Clamp stamp-size percent (5–40%).
function clampSize(pct) {
  const p = +pct;
  if (!isFinite(p)) return 18;
  return Math.max(5, Math.min(40, p));
}

// Compute stamp draw rect: stamp sized to pct% of image width, anchored
// bottom-right with a 4% margin, preserving stamp aspect ratio.
function stampRect(imgW, imgH, stampW, stampH, pct) {
  if (imgW <= 0 || imgH <= 0 || stampW <= 0 || stampH <= 0) return null;
  const p = clampSize(pct);
  const w = imgW * (p / 100);
  const h = (stampH / stampW) * w;
  const margin = imgW * 0.04;
  return { x: imgW - w - margin, y: imgH - h - margin, w, h };
}

// Fit an image into a display canvas without upscaling.
function fitScale(imgW, imgH, maxW) {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.min(1, maxW / imgW);
}

function downloadName(original) {
  const base = (original || "image").replace(/\.[^.]+$/, "").slice(0, 60) || "image";
  return base + "-signed.png";
}

function fmtWhen(ts) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
// ============ ENGINE-END ============

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
const store = {
  async get() { return (await chrome.storage.local.get({ stamps: [] })).stamps; },
  async set(s) { await chrome.storage.local.set({ stamps: s }); },
};

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("pane-" + btn.dataset.tab).classList.add("active");
  });
});

// --- Drawing pad ---
const pad = $("pad");
const pctx = pad.getContext("2d");
let drawing = false, hasInk = false;
function padPos(e) {
  const r = pad.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (pad.width / r.width), y: (e.clientY - r.top) * (pad.height / r.height) };
}
pad.addEventListener("pointerdown", (e) => { drawing = true; const p = padPos(e); pctx.beginPath(); pctx.moveTo(p.x, p.y); pad.setPointerCapture(e.pointerId); });
pad.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const p = padPos(e);
  pctx.strokeStyle = "#2dd4bf"; pctx.lineWidth = 2.5; pctx.lineCap = "round";
  pctx.lineTo(p.x, p.y); pctx.stroke();
  hasInk = true;
});
pad.addEventListener("pointerup", () => { drawing = false; });
$("clearPad").addEventListener("click", () => { pctx.clearRect(0, 0, pad.width, pad.height); hasInk = false; });

$("saveStamp").addEventListener("click", async () => {
  const url = hasInk ? pad.toDataURL("image/png") : "";
  const r = makeStamp($("stampName").value, url);
  if (!r.ok) { $("drawMsg").textContent = r.error; return; }
  const stamps = await store.get();
  stamps.unshift(r.stamp);
  await store.set(stamps);
  $("stampName").value = "";
  pctx.clearRect(0, 0, pad.width, pad.height); hasInk = false;
  $("drawMsg").textContent = "Stamp saved.";
  renderStamps(); refreshPicker();
});

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

async function renderStamps() {
  const stamps = await store.get();
  $("stampCount").textContent = stamps.length + " stamp" + (stamps.length === 1 ? "" : "s") + " saved";
  const list = $("stampList");
  list.innerHTML = "";
  if (!stamps.length) { list.innerHTML = '<div class="empty">Draw your first stamp in the Draw tab.</div>'; return; }
  for (const s of stamps) {
    const el = document.createElement("div");
    el.className = "stamp";
    el.innerHTML = '<img src="' + s.dataUrl + '" alt="stamp">' +
      '<div class="meta"><div><div class="nm">' + esc(s.name) + "</div><time>" + esc(fmtWhen(s.createdAt)) + "</time></div>" +
      '<button class="del" data-id="' + s.id + '">Delete</button></div>';
    list.appendChild(el);
  }
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async () => {
      await store.set((await store.get()).filter((s) => s.id !== b.dataset.id));
      renderStamps(); refreshPicker();
    })
  );
}

async function refreshPicker() {
  const stamps = await store.get();
  const sel = $("pickStamp");
  sel.innerHTML = "";
  stamps.forEach((s, i) => {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.name + (i === 0 ? " (newest)" : "");
    sel.appendChild(o);
  });
}

// --- Place on image ---
let loadedImg = null, loadedStamp = null, loadedFileName = "";

$("imgFile").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  loadedFileName = f.name;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => { loadedImg = img; URL.revokeObjectURL(url); redraw(); };
  img.src = url;
});

async function currentStamp() {
  const stamps = await store.get();
  return stamps.find((s) => s.id === $("pickStamp").value) || stamps[0] || null;
}

async function redraw() {
  const canvas = $("out");
  const ctx = canvas.getContext("2d");
  if (!loadedImg) { $("placeMsg").textContent = "Load an image first."; return; }
  const scale = fitScale(loadedImg.naturalWidth, loadedImg.naturalHeight, 336);
  canvas.width = Math.round(loadedImg.naturalWidth * scale);
  canvas.height = Math.round(loadedImg.naturalHeight * scale);
  ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);
  const stamp = await currentStamp();
  if (!stamp) { $("placeMsg").textContent = "No stamp saved yet — draw one first."; return; }
  const simg = new Image();
  simg.onload = () => {
    const rect = stampRect(loadedImg.naturalWidth, loadedImg.naturalHeight, simg.naturalWidth, simg.naturalHeight, $("stampSize").value);
    if (rect) {
      const dx = rect.x * scale, dy = rect.y * scale, dw = rect.w * scale, dh = rect.h * scale;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(simg, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#2dd4bf"; ctx.setLineDash([4, 3]); ctx.strokeRect(dx, dy, dw, dh); ctx.setLineDash([]);
    }
    $("placeMsg").textContent = "";
  };
  simg.src = stamp.dataUrl;
}

$("stampSize").addEventListener("input", redraw);
$("pickStamp").addEventListener("change", redraw);

$("download").addEventListener("click", async () => {
  if (!loadedImg) { $("placeMsg").textContent = "Load an image first."; return; }
  const stamp = await currentStamp();
  if (!stamp) { $("placeMsg").textContent = "No stamp saved yet."; return; }
  const simg = new Image();
  simg.onload = () => {
    const full = document.createElement("canvas");
    full.width = loadedImg.naturalWidth; full.height = loadedImg.naturalHeight;
    const fctx = full.getContext("2d");
    fctx.drawImage(loadedImg, 0, 0);
    const rect = stampRect(loadedImg.naturalWidth, loadedImg.naturalHeight, simg.naturalWidth, simg.naturalHeight, $("stampSize").value);
    if (rect) { fctx.globalAlpha = 0.85; fctx.drawImage(simg, rect.x, rect.y, rect.w, rect.h); fctx.globalAlpha = 1; }
    const a = document.createElement("a");
    a.href = full.toDataURL("image/png");
    a.download = downloadName(loadedFileName);
    a.click();
    $("placeMsg").textContent = "Downloaded.";
  };
  simg.src = stamp.dataUrl;
});

renderStamps(); refreshPicker();
