/* EmojiPack — Slack & Discord custom emoji packer.
 * 100% local: files are read, resized and zipped on-device. No network,
 * no OAuth, no uploads. Upload instructions in the popup are manual steps. */
"use strict";

const TARGET = 128; // 128x128 output size

/* ---------- Platform rule sets ---------- */
const PLATFORMS = {
  slack: {
    label: "Slack",
    maxBytes: 128 * 1024,
    nameMax: 32,
    rules: [
      "Custom emoji are resized to 128×128 PNG.",
      "Max file size: 128 KB (we warn you before export).",
      "Names: lowercase letters, numbers, dashes, underscores. Max 32 chars.",
      "Upload: Workspace settings → Customize → Add Custom Emoji.",
    ],
    sanitize: (s) =>
      s.toLowerCase().replace(/[\s.]+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 32),
  },
  discord: {
    label: "Discord",
    maxBytes: 256 * 1024,
    nameMax: 32,
    rules: [
      "Custom emoji are resized to 128×128 PNG.",
      "Max file size: 256 KB (we warn you before export).",
      "Names: letters, numbers, underscores. Min 2 chars.",
      "Upload: Server Settings → Emoji → Upload Emoji (name without colons).",
    ],
    sanitize: (s) =>
      s.replace(/[\s.\-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32),
  },
};

let platform = "slack";
let items = []; // { id, blob, url, name, size, status, sizeNote }
let idCounter = 0;

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const fileInput = $("fileInput"), dropzone = $("dropzone"), emojiList = $("emojiList");

/* ---------- Platform switching ---------- */
function setPlatform(p) {
  platform = p;
  $("btnSlack").classList.toggle("active", p === "slack");
  $("btnDiscord").classList.toggle("active", p === "discord");
  $("rulesPlatform").textContent = PLATFORMS[p].label;
  $("rulesList").innerHTML = PLATFORMS[p].rules.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  chrome.storage.local.set({ emojipack_platform: p }).catch(() => {});
  refreshAll();
}
$("btnSlack").addEventListener("click", () => setPlatform("slack"));
$("btnDiscord").addEventListener("click", () => setPlatform("discord"));

/* ---------- File intake ---------- */
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("drag");
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
$("clearAll").addEventListener("click", () => {
  items.forEach((it) => URL.revokeObjectURL(it.url));
  items = []; render();
});

function addFiles(fileList) {
  const imgs = [...fileList].filter((f) => f.type.startsWith("image/"));
  if (!imgs.length) { toast("Please choose image files."); return; }
  imgs.slice(0, 50).forEach((f) => {
    const base = f.name.replace(/\.[^.]+$/, "") || "emoji";
    items.push({
      id: ++idCounter,
      file: f,
      url: URL.createObjectURL(f),
      name: PLATFORMS[platform].sanitize(base) || `emoji_${idCounter}`,
      size: 0, status: "processing", sizeNote: "resizing…",
      blob: null,
    });
  });
  render();
  items.filter((i) => i.status === "processing").forEach(processItem);
}

/* ---------- Resize to 128x128 PNG, check size ---------- */
function processItem(item) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = TARGET; canvas.height = TARGET;
    const ctx = canvas.getContext("2d");
    // cover-fit crop into square
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, TARGET, TARGET);
    canvas.toBlob((blob) => {
      item.blob = blob;
      item.size = blob.size;
      const kb = (blob.size / 1024).toFixed(1);
      const limit = PLATFORMS[platform].maxBytes / 1024;
      if (blob.size > PLATFORMS[platform].maxBytes) {
        item.status = "bad"; item.sizeNote = `${kb} KB — over ${limit} KB limit`;
      } else if (blob.size > PLATFORMS[platform].maxBytes * 0.8) {
        item.status = "warn"; item.sizeNote = `${kb} KB — close to ${limit} KB limit`;
      } else {
        item.status = "ok"; item.sizeNote = `${kb} KB · 128×128 PNG`;
      }
      URL.revokeObjectURL(item.url);
      item.url = URL.createObjectURL(blob);
      render();
    }, "image/png");
  };
  img.onerror = () => { item.status = "bad"; item.sizeNote = "could not read image"; render(); };
  img.src = item.url;
}

/* ---------- Rendering ---------- */
function render() {
  $("listPanel").classList.toggle("hidden", items.length === 0);
  $("exportPanel").classList.toggle("hidden", items.length === 0);
  $("rulesPanel").classList.toggle("hidden", false);
  $("emojiCount").textContent = items.length;
  emojiList.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "emoji-row";
    const badge = { processing: ["warn", "…"], ok: ["ok", "READY"], warn: ["warn", "LARGE"], bad: ["bad", "ISSUE"] }[item.status];
    row.innerHTML = `
      <img src="${item.url}" alt="emoji preview" />
      <div class="emoji-meta">
        <input class="name-input" data-id="${item.id}" value="${escapeHtml(item.name)}" maxlength="32" spellcheck="false" aria-label="Shortcode name" />
        <span class="size-note">${escapeHtml(item.sizeNote)}</span>
      </div>
      <span class="badge ${badge[0]}">${badge[1]}</span>
      <button class="remove-btn" data-id="${item.id}" type="button" aria-label="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>`;
    emojiList.appendChild(row);
  });
  emojiList.querySelectorAll(".name-input").forEach((inp) =>
    inp.addEventListener("input", () => {
      const it = items.find((x) => x.id === +inp.dataset.id);
      if (it) it.name = PLATFORMS[platform].sanitize(inp.value);
    })
  );
  emojiList.querySelectorAll(".remove-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const idx = items.findIndex((x) => x.id === +btn.dataset.id);
      if (idx > -1) { URL.revokeObjectURL(items[idx].url); items.splice(idx, 1); render(); }
    })
  );
  // dedupe / fix names then update hint
  refreshAll(false);
}

function refreshAll(rerender = true) {
  // resolve name collisions
  const seen = new Map();
  items.forEach((it) => {
    let n = it.name || `emoji_${it.id}`;
    if (seen.has(n)) { let k = 2; while (seen.has(`${n}_${k}`)) k++; n = `${n}_${k}`; }
    seen.set(n, true); it.name = n;
  });
  const ready = items.filter((i) => i.status === "ok").length;
  const bad = items.filter((i) => i.status === "bad").length;
  $("downloadZip").disabled = !(ready > 0);
  $("zipHint").textContent = bad
    ? `${bad} image${bad > 1 ? "s are" : " is"} over the ${PLATFORMS[platform].label} size limit and will be skipped.`
    : `${ready} emoji ready · exported as name.png + upload guide`;
  if (rerender) renderNamesOnly();
}

function renderNamesOnly() {
  emojiList.querySelectorAll(".name-input").forEach((inp) => {
    const it = items.find((x) => x.id === +inp.dataset.id);
    if (it && document.activeElement !== inp) inp.value = it.name;
  });
}

/* ---------- ZIP export (bundled JSZip, fully local) ---------- */
$("downloadZip").addEventListener("click", async () => {
  const ready = items.filter((i) => i.status === "ok");
  if (!ready.length) { toast("No ready emoji to export."); return; }
  try {
    const zip = new JSZip();
    ready.forEach((it) => zip.file(`${it.name}.png`, it.blob));
    zip.file("UPLOAD_GUIDE.txt", guideText());
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emoji-pack-${platform}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Packed ${ready.length} emoji — upload them manually.`);
  } catch (e) {
    console.error(e); toast("Packing failed — try fewer images.");
  }
});

function guideText() {
  const p = PLATFORMS[platform];
  return [
    `EMOJIPACK — ${p.label} custom emoji pack`,
    `Generated locally by EmojiPack. Nothing was uploaded anywhere.`,
    ``,
    `CONTENTS`,
    ...items.filter((i) => i.status === "ok").map((i) => `  ${i.name}.png  →  use as :${i.name}:`),
    ``,
    `HOW TO UPLOAD MANUALLY`,
    ...p.rules,
    ``,
    `Shortcode names use only: ${platform === "slack" ? "a-z 0-9 - _" : "a-z A-Z 0-9 _"}`,
  ].join("\n");
}

/* ---------- Helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ---------- Init ---------- */
chrome.storage.local.get({ emojipack_platform: "slack" }).then((r) => {
  setPlatform(r.emojipack_platform === "discord" ? "discord" : "slack");
});
