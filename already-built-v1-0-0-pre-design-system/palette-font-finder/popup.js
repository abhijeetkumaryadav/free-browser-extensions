// Palette + Font Finder — popup logic.
// analyzePage() is injected into the target page via chrome.scripting,
// so it must stay fully self-contained (no outer references).

function analyzePage() {
  function toHex(color) {
    const m = color.match(
      /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/
    );
    if (!m) return null;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < 0.9) return null; // skip translucent
    const hx = (v) =>
      Math.max(0, Math.min(255, parseInt(v, 10)))
        .toString(16)
        .padStart(2, "0");
    return "#" + hx(m[1]) + hx(m[2]) + hx(m[3]);
  }

  const colorCounts = new Map();
  const fontCounts = new Map();
  const els = document.getElementsByTagName("*");
  const limit = Math.min(els.length, 4000);

  for (let i = 0; i < limit; i++) {
    let cs;
    try {
      cs = getComputedStyle(els[i]);
    } catch (e) {
      continue;
    }
    for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
      const hex = toHex(cs[prop]);
      if (hex && hex !== "#ffffff" && hex !== "#000000") {
        colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
      }
    }
    let fam = (cs.fontFamily || "").split(",")[0].trim().replace(/['"]/g, "");
    if (fam && fam.toLowerCase() !== "inherit") {
      const key = fam;
      const rec = fontCounts.get(key) || { family: fam, count: 0 };
      rec.count++;
      fontCounts.set(key, rec);
    }
  }

  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([hex]) => hex);
  const fonts = [...fontCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return { colors, fonts, url: location.href, title: document.title };
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("analyze").addEventListener("click", analyze);
  document.getElementById("copyCss").addEventListener("click", copyCss);
  renderSaved();
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

async function analyze() {
  const btn = document.getElementById("analyze");
  btn.disabled = true;
  setStatus("Reading page styles…");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzePage,
    });
    if (!res || !res.result) throw new Error("no-result");
    renderResults(res.result);
    setStatus("");
  } catch (e) {
    setStatus("Can’t analyze this page — try a regular website instead.");
  } finally {
    btn.disabled = false;
  }
}

let lastColors = [];

function renderResults({ colors, fonts }) {
  document.getElementById("empty").style.display = "none";
  lastColors = colors;

  const cs = document.getElementById("colorsSection");
  cs.hidden = false;
  const sw = document.getElementById("swatches");
  sw.innerHTML = "";
  if (colors.length === 0) {
    sw.innerHTML = "<div class='empty'>No standout colors found.</div>";
  }
  for (const hex of colors) {
    const el = document.createElement("div");
    el.className = "swatch";
    el.style.background = hex;
    el.dataset.hex = hex;
    el.title = "Click to copy " + hex;
    el.addEventListener("click", () => copyText(hex, hex + " copied"));
    sw.appendChild(el);
  }

  // save-this-palette bar
  let bar = document.getElementById("saveBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "saveBar";
    const save = document.createElement("button");
    save.textContent = "Save this palette";
    save.addEventListener("click", savePalette);
    bar.appendChild(save);
    cs.appendChild(bar);
  }

  const fs = document.getElementById("fontsSection");
  fs.hidden = false;
  const fl = document.getElementById("fonts");
  fl.innerHTML = "";
  if (fonts.length === 0) {
    fl.innerHTML = "<div class='empty'>No fonts detected.</div>";
  }
  for (const f of fonts) {
    const row = document.createElement("div");
    row.className = "font-row";
    row.title = "Click to copy";
    const aa = document.createElement("div");
    aa.className = "aa";
    aa.textContent = "Aa";
    aa.style.fontFamily = `'${f.family}', sans-serif`;
    const nm = document.createElement("div");
    nm.className = "name";
    const b = document.createElement("b");
    b.textContent = f.family;
    const s = document.createElement("span");
    s.textContent = `used by ${f.count} elements — click to copy`;
    nm.append(b, s);
    row.append(aa, nm);
    row.addEventListener("click", () =>
      copyText(f.family, f.family + " copied")
    );
    fl.appendChild(row);
  }
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  setStatus(msg);
  setTimeout(() => setStatus(""), 1500);
}

function copyCss() {
  if (!lastColors.length) return;
  const css =
    ":root {\n" +
    lastColors.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n") +
    "\n}";
  copyText(css, "CSS variables copied");
}

async function savePalette() {
  if (!lastColors.length) return;
  const { savedPalettes = [] } = await chrome.storage.local.get(
    "savedPalettes"
  );
  savedPalettes.unshift({
    id: "pal-" + Date.now(),
    name: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
    colors: lastColors,
  });
  await chrome.storage.local.set({
    savedPalettes: savedPalettes.slice(0, 20),
  });
  renderSaved();
  setStatus("Palette saved");
  setTimeout(() => setStatus(""), 1500);
}

async function renderSaved() {
  const { savedPalettes = [] } = await chrome.storage.local.get(
    "savedPalettes"
  );
  const sec = document.getElementById("savedSection");
  const box = document.getElementById("saved");
  box.innerHTML = "";
  sec.hidden = savedPalettes.length === 0;
  for (const p of savedPalettes) {
    const row = document.createElement("div");
    row.className = "saved-row";
    const top = document.createElement("div");
    top.className = "top";
    const b = document.createElement("b");
    b.textContent = p.name;
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Delete";
    del.addEventListener("click", async () => {
      const { savedPalettes: cur = [] } = await chrome.storage.local.get(
        "savedPalettes"
      );
      await chrome.storage.local.set({
        savedPalettes: cur.filter((x) => x.id !== p.id),
      });
      renderSaved();
    });
    top.append(b, del);
    const dots = document.createElement("div");
    dots.className = "dots";
    for (const c of p.colors.slice(0, 14)) {
      const i = document.createElement("i");
      i.style.background = c;
      i.title = c;
      dots.appendChild(i);
    }
    row.append(top, dots);
    box.appendChild(row);
  }
}
