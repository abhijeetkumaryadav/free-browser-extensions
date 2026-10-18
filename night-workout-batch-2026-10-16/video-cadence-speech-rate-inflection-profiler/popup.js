/* Cadence Profiler — popup logic: local WPM computation + canvas graph. */

const FAST = 170, SLOW = 120; // conversational WPM reference bands

/** Count words in a text line. */
function words(text) {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

/**
 * Build per-window speech rates from caption segments.
 * Segments without timestamps are spread evenly across the total media length
 * if a <video> duration is known; otherwise ordered sequentially as fixed slices.
 * @returns {{wpm: number, label: string}[]} windows of ~15s each.
 */
function buildWindows(segments, durationSec) {
  const WINDOW = 15;
  const total = durationSec && durationSec > 0 ? durationSec : segments.length * 5;
  const wins = {};
  segments.forEach((seg, i) => {
    let t;
    if (seg.start != null) t = seg.start;
    else t = total * (i / Math.max(1, segments.length));
    const w = Math.floor(t / WINDOW) * WINDOW;
    wins[w] = (wins[w] || 0) + words(seg.text);
  });
  return Object.keys(wins).sort((a, b) => a - b).map((k) => ({
    label: fmtTime(+k),
    wpm: Math.round((wins[k] / WINDOW) * 60),
  }));
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function drawGraph(windows) {
  const cv = document.getElementById("graph");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!windows.length) return;

  const max = Math.max(200, ...windows.map((w) => w.wpm));
  const n = windows.length;
  const barW = Math.min(24, (W - 16) / n - 4);
  const step = (W - 16) / n;

  windows.forEach((w, i) => {
    const h = (w.wpm / max) * (H - 30);
    const x = 8 + i * step + (step - barW) / 2;
    const y = H - 22 - h;
    ctx.fillStyle = w.wpm > FAST ? "#f43f5e" : w.wpm < SLOW ? "#f59e0b" : "#34d399";
    ctx.beginPath();
    ctx.roundRect(x, y, barW, h, 4);
    ctx.fill();
    if (n <= 12) {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(w.label, x + barW / 2, H - 8);
    }
  });

  // Reference band lines (120 / 170 WPM).
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,255,255,.25)";
  for (const ref of [SLOW, FAST]) {
    const y = H - 22 - (ref / max) * (H - 30);
    ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(ref + " WPM", W - 58, y - 3);
  }
  ctx.setLineDash([]);
}

document.getElementById("scan").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { /* injected inline to also fetch duration */
        return (function () {
          const v = document.querySelector("video");
          return { duration: v && Number.isFinite(v.duration) ? v.duration : 0 };
        })();
      },
    });
    const duration = res?.[0]?.result?.duration || 0;

    const segRes = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    const segments = segRes?.[0]?.result || [];

    if (!segments.length) {
      document.getElementById("empty").textContent =
        "No captions found on this page — this profiler reads caption timing only, not audio.";
      document.getElementById("results").hidden = true;
      return;
    }

    const windows = buildWindows(segments, duration);
    const wpms = windows.map((w) => w.wpm);
    const avg = Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length);
    const fast = windows.reduce((a, b) => (b.wpm > a.wpm ? b : a), windows[0]);
    const slow = windows.reduce((a, b) => (b.wpm < a.wpm ? b : a), windows[0]);

    document.getElementById("stWpm").textContent = avg;
    document.getElementById("stSeg").textContent = segments.length;
    document.getElementById("stFast").textContent = `${fast.wpm} (${fast.label})`;
    document.getElementById("stSlow").textContent = `${slow.wpm} (${slow.label})`;

    drawGraph(windows);

    const list = document.getElementById("windows");
    list.innerHTML = "";
    const notable = windows.filter((w) => w.wpm > FAST || w.wpm < SLOW).slice(0, 8);
    if (!notable.length) {
      list.innerHTML = "<li>Steady pace — all windows within the normal 120–170 WPM band.</li>";
    } else {
      for (const w of notable) {
        const li = document.createElement("li");
        const zone = w.wpm > FAST ? "fast" : "slow";
        li.innerHTML = `<b>${w.label}</b> — <b>${w.wpm} WPM</b> (${zone}: ${zone === "fast" ? "rapid delivery" : "deliberate pause-heavy stretch"})`;
        list.appendChild(li);
      }
    }

    document.getElementById("empty").hidden = true;
    document.getElementById("results").hidden = false;
  } catch (e) {
    document.getElementById("empty").textContent =
      "Couldn't read this page — try a video page and scan again.";
  }
});
