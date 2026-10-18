// Screenshot Studio — editor: crop, blur, text, undo, sized export.
// base = full-resolution working canvas. view = scaled display canvas.

const view = document.getElementById("view");
const vctx = view.getContext("2d");
const base = document.createElement("canvas");
const bctx = base.getContext("2d");

let tool = null;
let scale = 1;
let drawing = false;
let cropStart = null;
let cropRect = null;
const history = [];

const $ = (id) => document.getElementById(id);
const hint = (t) => ($("hint").textContent = t);

init();

async function init() {
  document.querySelectorAll(".tool[data-tool]").forEach((b) =>
    b.addEventListener("click", () => selectTool(b.dataset.tool))
  );
  $("undo").addEventListener("click", undo);
  $("download").addEventListener("click", download);
  view.addEventListener("pointerdown", onDown);
  view.addEventListener("pointermove", onMove);
  view.addEventListener("pointerup", onUp);
  view.addEventListener("pointerleave", () => {
    drawing = false;
    cropStart = null;
  });

  const { pendingShot } = await chrome.storage.local.get("pendingShot");
  if (!pendingShot) {
    hint("No screenshot found — capture one from the extension popup first.");
    return;
  }
  const img = new Image();
  img.onload = () => {
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    bctx.drawImage(img, 0, 0);
    pushHistory();
    render();
    chrome.storage.local.remove("pendingShot");
  };
  img.src = pendingShot;
}

function selectTool(name) {
  tool = tool === name ? null : name;
  document
    .querySelectorAll(".tool[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  cropRect = null;
  render();
  hint(
    !tool
      ? "Pick a tool, then drag or click on the image."
      : tool === "crop"
      ? "Drag a rectangle, then click Apply crop."
      : tool === "blur"
      ? "Drag over areas to blur them."
      : "Type a caption above, then click where it should go."
  );
  if (tool === "crop") ensureCropButton();
}

function render() {
  if (!base.width) return;
  const maxW = Math.min(1100, window.innerWidth - 60);
  const maxH = window.innerHeight - 220;
  scale = Math.min(maxW / base.width, maxH / base.height, 1);
  view.width = Math.round(base.width * scale);
  view.height = Math.round(base.height * scale);
  vctx.imageSmoothingQuality = "high";
  vctx.drawImage(base, 0, 0, view.width, view.height);
  if (cropRect) {
    const [x, y, w, h] = cropRect.map((v) => v * scale);
    vctx.fillStyle = "rgba(0,0,0,0.55)";
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.clearRect(x, y, w, h);
    vctx.drawImage(base, x / scale, y / scale, w / scale, h / scale, x, y, w, h);
    vctx.strokeStyle = "#6fc3e8";
    vctx.lineWidth = 2;
    vctx.strokeRect(x, y, w, h);
  }
}

function viewPos(e) {
  const r = view.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (view.width / r.width),
    y: (e.clientY - r.top) * (view.height / r.height),
  };
}
const toBase = (p) => ({ x: p.x / scale, y: p.y / scale });

function onDown(e) {
  if (!tool || !base.width) return;
  const p = toBase(viewPos(e));
  drawing = true;
  if (tool === "crop") cropStart = p;
  if (tool === "blur") dabBlur(p);
  if (tool === "text") placeText(p);
}

function onMove(e) {
  if (!drawing || !tool) return;
  const p = toBase(viewPos(e));
  if (tool === "crop" && cropStart) {
    cropRect = [
      Math.min(cropStart.x, p.x),
      Math.min(cropStart.y, p.y),
      Math.abs(p.x - cropStart.x),
      Math.abs(p.y - cropStart.y),
    ];
    render();
  }
  if (tool === "blur") dabBlur(p);
}

function onUp() {
  if (!drawing) return;
  drawing = false;
  if (tool === "blur") pushHistory();
  if (tool === "crop") {
    if (cropRect && cropRect[2] > 10 && cropRect[3] > 10) {
      hint("Rectangle selected — click Apply crop.");
    } else {
      cropRect = null;
      render();
    }
  }
}

function dabBlur(p) {
  const rView = parseInt($("brush").value, 10);
  const r = rView / scale;
  const d = Math.ceil(r * 2);
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = d;
  const tctx = tmp.getContext("2d");
  tctx.filter = `blur(${Math.max(2, r / 3)}px)`;
  tctx.drawImage(base, p.x - r, p.y - r, d, d, 0, 0, d, d);
  bctx.drawImage(tmp, p.x - r, p.y - r);
  render();
}

function placeText(p) {
  const text = $("textInput").value.trim();
  if (!text) {
    hint("Type a caption in the box first, then click the image.");
    return;
  }
  const size = parseInt($("textSize").value, 10);
  bctx.font = `700 ${size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  bctx.fillStyle = $("textColor").value;
  bctx.shadowColor = "rgba(0,0,0,0.8)";
  bctx.shadowBlur = size / 6;
  bctx.textBaseline = "top";
  bctx.fillText(text, p.x, p.y);
  bctx.shadowBlur = 0;
  pushHistory();
  render();
}

function ensureCropButton() {
  if ($("applyCrop")) return;
  const b = document.createElement("button");
  b.id = "applyCrop";
  b.className = "tool active";
  b.textContent = "Apply crop";
  b.addEventListener("click", () => {
    if (!cropRect) return;
    const [x, y, w, h] = cropRect.map(Math.round);
    const cut = document.createElement("canvas");
    cut.width = w;
    cut.height = h;
    cut.getContext("2d").drawImage(base, x, y, w, h, 0, 0, w, h);
    base.width = w;
    base.height = h;
    bctx.drawImage(cut, 0, 0);
    cropRect = null;
    b.remove();
    selectTool(null);
    pushHistory();
    render();
  });
  document.querySelector("header").appendChild(b);
}

function pushHistory() {
  history.push(base.toDataURL("image/png"));
  if (history.length > 12) history.shift();
}

function undo() {
  if (history.length < 2) {
    hint("Nothing to undo.");
    return;
  }
  history.pop();
  const img = new Image();
  img.onload = () => {
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    bctx.drawImage(img, 0, 0);
    cropRect = null;
    render();
  };
  img.src = history[history.length - 1];
}

function download() {
  if (!base.width) return;
  const [tw, th] = $("preset").value.split("x").map(Number);
  const out = document.createElement("canvas");
  if (!tw) {
    out.width = base.width;
    out.height = base.height;
    out.getContext("2d").drawImage(base, 0, 0);
  } else {
    // cover-fit: scale to cover, center-crop
    out.width = tw;
    out.height = th;
    const s = Math.max(tw / base.width, th / base.height);
    const dw = base.width * s;
    const dh = base.height * s;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  }
  out.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screenshot-studio-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    hint("Downloaded.");
  }, "image/png");
}

window.addEventListener("resize", render);
