// Video Stream Codec Reporter — popup logic.
// scanVideos() is injected into the page; keep it fully self-contained.

function scanVideos() {
  const READY = ["HAVE_NOTHING", "HAVE_METADATA", "HAVE_CURRENT_DATA", "HAVE_FUTURE_DATA", "HAVE_ENOUGH_DATA"];
  const EXT_MIME = {
    mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm",
    ogv: "video/ogg", ogg: "video/ogg", mov: "video/quicktime",
    m3u8: "application/x-mpegURL", mpd: "application/dash+xml",
  };
  function guessMime(url) {
    try {
      const path = new URL(url, location.href).pathname.toLowerCase();
      const ext = path.split(".").pop().split("?")[0];
      return EXT_MIME[ext] || null;
    } catch (e) { return null; }
  }
  return Array.from(document.querySelectorAll("video")).map((v, i) => {
    const sources = Array.from(v.querySelectorAll("source")).map((s) => ({
      src: s.src || s.getAttribute("src") || "",
      type: s.getAttribute("type") || null,
    }));
    const current = v.currentSrc || v.src || "";
    const buffered = [];
    try {
      for (let k = 0; k < v.buffered.length; k++) {
        buffered.push([+v.buffered.start(k).toFixed(2), +v.buffered.end(k).toFixed(2)]);
      }
    } catch (e) {}
    return {
      index: i,
      src: current,
      typeAttr: v.getAttribute("type") || null,
      mimeGuess: guessMime(current),
      sources,
      width: v.videoWidth || 0,
      height: v.videoHeight || 0,
      duration: isFinite(v.duration) ? v.duration : null,
      readyState: v.readyState,
      readyLabel: READY[v.readyState] || "UNKNOWN",
      buffered,
    };
  });
}

const $ = (id) => document.getElementById(id);
let lastReport = [];

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", scan);
  $("copy").addEventListener("click", copyReport);
});

function fmtDur(sec) {
  if (sec == null) return "live / unknown";
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
    }
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanVideos });
    lastReport = (res && res.result) || [];
    render();
  } catch (e) {
    lastReport = [];
    renderError();
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function render() {
  const box = $("results");
  box.innerHTML = "";
  $("empty").style.display = "none";
  $("copy").hidden = lastReport.length === 0;
  if (!lastReport.length) {
    const d = document.createElement("div");
    d.className = "novideo";
    d.textContent = "No <video> elements found on this page.";
    box.appendChild(d);
    return;
  }
  for (const v of lastReport) {
    const card = document.createElement("div");
    card.className = "glass vcard";
    const h = document.createElement("h2");
    h.textContent = `Video ${v.index + 1}`;
    card.appendChild(h);
    const src = document.createElement("div");
    src.className = "vsrc";
    src.textContent = v.src || "(no source set)";
    src.title = v.src || "";
    card.appendChild(src);
    const grid = document.createElement("div");
    grid.className = "vgrid";
    const cells = [
      ["Resolution", v.width && v.height ? `${v.width}×${v.height}` : "unknown"],
      ["Duration", fmtDur(v.duration)],
      ["Ready state", `${v.readyState} · ${v.readyLabel}`],
      ["Buffered ranges", String(v.buffered.length)],
    ];
    for (const [label, val] of cells) {
      const c = document.createElement("div");
      c.className = "cell";
      const sp = document.createElement("span"); sp.textContent = label;
      const b = document.createElement("b"); b.textContent = val;
      c.append(sp, b);
      grid.appendChild(c);
    }
    card.appendChild(grid);
    const types = [];
    if (v.typeAttr) types.push(`type attr: <code>${esc(v.typeAttr)}</code>`);
    if (v.mimeGuess) types.push(`guessed MIME: <code>${esc(v.mimeGuess)}</code>`);
    if (v.sources.length) {
      types.push(`<source> tags: ${v.sources.length} (${v.sources.map((s) => esc(s.type || "no type")).join(", ")})`);
    }
    if (types.length) {
      const t = document.createElement("div");
      t.className = "vtype";
      t.innerHTML = types.join("<br>");
      card.appendChild(t);
    }
    if (v.buffered.length) {
      const b = document.createElement("div");
      b.className = "buf";
      b.textContent = "buffered: " + v.buffered.map((r) => `[${r[0]}–${r[1]}s]`).join(" ");
      card.appendChild(b);
    }
    box.appendChild(card);
  }
}

function renderError() {
  const box = $("results");
  box.innerHTML = "";
  $("empty").style.display = "";
  $("empty").textContent = "Couldn't scan this page — try a regular web page (not a chrome:// page).";
  $("copy").hidden = true;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function copyReport() {
  const lines = lastReport.map((v) =>
    [
      `Video ${v.index + 1}`,
      `  src: ${v.src || "(none)"}`,
      `  type attr: ${v.typeAttr || "—"}`,
      `  MIME guess: ${v.mimeGuess || "—"}`,
      `  <source> tags: ${v.sources.length ? v.sources.map((s) => `${s.src || "(empty)"} [${s.type || "no type"}]`).join(" | ") : "—"}`,
      `  resolution: ${v.width && v.height ? v.width + "x" + v.height : "unknown"}`,
      `  duration: ${v.duration != null ? v.duration.toFixed(2) + "s" : "live / unknown"}`,
      `  readyState: ${v.readyState} (${v.readyLabel})`,
      `  buffered: ${v.buffered.length ? v.buffered.map((r) => `[${r[0]}-${r[1]}s]`).join(" ") : "none"}`,
    ].join("\n")
  );
  const text = lines.join("\n\n") || "No <video> elements found.";
  try {
    await navigator.clipboard.writeText(text);
    $("copy").textContent = "✓ Copied";
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); $("copy").textContent = "✓ Copied"; }
    catch (err) { $("copy").textContent = "Copy failed"; }
    ta.remove();
  }
  setTimeout(() => { $("copy").textContent = "⧉ Copy report"; }, 1600);
}
