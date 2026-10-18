/* EXIF Scrubber — popup logic.
 * - Parses JPEG APP1/EXIF locally to show a metadata summary.
 * - Scrubbing = canvas re-encode, which drops every metadata chunk.
 * - Originals are never modified; only fresh clean copies download. */

const $ = (id) => document.getElementById(id);
const filesInput = $("files"), drop = $("drop"), list = $("list");
const formatSel = $("format"), qualityRange = $("quality");
const scrubAllBtn = $("scrubAll"), clearBtn = $("clear");

let queue = []; // {file, objectUrl, summary, blob?}

/* ---------- Minimal local EXIF parser (JPEG APP1) ---------- */

function readAscii(dv, offset, length) {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = dv.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Extract a small summary of EXIF tags from a JPEG ArrayBuffer. Pure local parsing. */
function parseExifSummary(buf) {
  const dv = new DataView(buf);
  const out = { exif: false, tags: [] };
  if (dv.byteLength < 4 || dv.getUint8(0) !== 0xFF || dv.getUint8(1) !== 0xD8) return out; // not JPEG

  let pos = 2;
  while (pos + 4 <= dv.byteLength) {
    if (dv.getUint8(pos) !== 0xFF) break;
    const marker = dv.getUint8(pos + 1);
    const len = dv.getUint16(pos + 2);
    if (marker === 0xE1 && len > 8) { // APP1
      const head = readAscii(dv, pos + 4, 4);
      if (head === "Exif") {
        out.exif = true;
        try {
          // TIFF header: byte order (II/MM), magic 42, then IFD offset
          const tiffStart = pos + 4 + 6;
          const bo = readAscii(dv, tiffStart, 2);
          const little = bo === "II";
          const ifdRel = little ? dv.getUint32(tiffStart + 4, true) : dv.getUint32(tiffStart + 4, false);
          readIfd(dv, tiffStart + ifdRel, tiffStart, out, 0);
        } catch (e) { /* malformed: ignore */ }
        break;
      }
    }
    if (marker === 0xDA) break; // start of scan
    pos += 2 + len;
  }
  return out;
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
const WANTED = { 0x010F: "Camera make", 0x0110: "Camera model", 0x9003: "Taken on", 0x0132: "Modified on", 0x829A: "Exposure", 0x8827: "ISO", 0x0112: "Orientation", 0x9286: "Software" };

function readIfd(dv, ifdOffset, tiffStart, out, depth) {
  if (depth > 3) return;
  const little = dv.getUint16(tiffStart) === 0x4949;
  const get16 = (o) => little ? dv.getUint16(o, true) : dv.getUint16(o, false);
  const get32 = (o) => little ? dv.getUint32(o, true) : dv.getUint32(o, false);
  if (ifdOffset + 2 > dv.byteLength) return;
  const count = get16(ifdOffset);
  for (let i = 0; i < count; i++) {
    const e = ifdOffset + 2 + i * 12;
    if (e + 12 > dv.byteLength) break;
    const tag = get16(e), type = get16(e + 2), n = get32(e + 4);
    const size = (TYPE_SIZE[type] || 1) * n;
    let valOffset = e + 8;
    if (size > 4) valOffset = tiffStart + get32(e + 8);
    if (tag === 0x8825) { // GPS IFD pointer
      out.tags.push(["GPS location", "present"]);
      continue;
    }
    if (tag === 0x8769) { // EXIF sub-IFD pointer
      readIfd(dv, tiffStart + get32(e + 8), tiffStart, out, (depth || 0) + 1);
      continue;
    }
    if (WANTED[tag] && valOffset + Math.min(size, 64) <= dv.byteLength) {
      let val;
      if (type === 2) val = readAscii(dv, valOffset, Math.min(n, 64));
      else if (type === 3 && n === 1) val = String(get16(valOffset));
      else if (type === 4 && n === 1) val = String(get32(valOffset));
      else val = `(${n} values)`;
      out.tags.push([WANTED[tag], val]);
    }
  }
}

/* ---------- Queue handling ---------- */

async function addFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith("image/")) continue;
    const buf = await file.arrayBuffer();
    let summary = { exif: false, tags: [], note: "No EXIF block (PNG/other)" };
    if (file.type === "image/jpeg") {
      const s = parseExifSummary(buf);
      summary = { ...s, note: s.exif ? `${s.tags.length} tag(s) found` : "No EXIF block" };
    }
    queue.push({ file, objectUrl: URL.createObjectURL(file), summary, clean: null });
  }
  render();
}

function render() {
  list.innerHTML = "";
  queue.forEach((q, i) => {
    const li = document.createElement("li");
    li.className = "item";
    const tagText = q.summary.tags.length
      ? q.summary.tags.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")
      : q.summary.note;
    li.innerHTML = `
      <img alt="">
      <div class="meta">
        <div class="name"></div>
        <div class="tags">${q.summary.exif ? "<b>EXIF found:</b> " : ""}</div>
      </div>
      <span class="ok">${q.clean ? "✓ clean" : ""}</span>`;
    li.querySelector("img").src = q.objectUrl;
    li.querySelector(".name").textContent = q.file.name;
    li.querySelector(".tags").append(document.createTextNode(tagText));
    list.appendChild(li);
  });
  const has = queue.length > 0;
  scrubAllBtn.disabled = !has;
  clearBtn.disabled = !has;
}

/* ---------- Scrubbing: canvas re-encode strips every metadata chunk ---------- */

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function scrubOne(q) {
  const img = await loadImage(q.objectUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const fmt = formatSel.value;
  const mime = fmt === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((res) => canvas.toBlob(res, mime, parseFloat(qualityRange.value)));
  q.clean = blob;
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function cleanName(name, fmt) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}_clean.${fmt === "png" ? "png" : "jpg"}`;
}

scrubAllBtn.addEventListener("click", async () => {
  scrubAllBtn.disabled = true;
  for (const q of queue) {
    if (!q.clean) await scrubOne(q);
    download(q.clean, cleanName(q.file.name, formatSel.value));
  }
  render();
  scrubAllBtn.disabled = false;
});

clearBtn.addEventListener("click", () => {
  queue.forEach((q) => URL.revokeObjectURL(q.objectUrl));
  queue = [];
  render();
});

// Drag & drop
drop.addEventListener("click", () => filesInput.click());
filesInput.addEventListener("change", () => addFiles(filesInput.files));
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
