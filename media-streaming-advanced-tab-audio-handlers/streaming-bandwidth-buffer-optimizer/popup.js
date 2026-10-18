// Stream Health — popup logic.
// Read-only video health analysis via getVideoPlaybackQuality().
// Nothing is modified, throttled, or sent anywhere.

const $ = (id) => document.getElementById(id);

function toast(message, ms = 5000) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

/** Runs in the page (MAIN world). Returns per-video health stats. */
function analyzeVideosInPage() {
  return Array.from(document.querySelectorAll("video")).map((v, i) => {
    let q = null;
    try {
      q = typeof v.getVideoPlaybackQuality === "function"
        ? v.getVideoPlaybackQuality()
        : null;
    } catch (e) {
      q = null; // some players throw; treat as unknown
    }
    const rect = v.getBoundingClientRect();
    return {
      index: i,
      label:
        v.getAttribute("aria-label") ||
        v.title ||
        (v.currentSrc ? v.currentSrc.split("/").pop().split("?")[0] : null) ||
        `Video ${i + 1}`,
      videoWidth: v.videoWidth || 0,
      videoHeight: v.videoHeight || 0,
      playbackRate: v.playbackRate || 1,
      paused: v.paused,
      readyState: v.readyState, // 0..4
      networkState: v.networkState, // 0..3
      droppedFrames: q ? q.droppedVideoFrames : null,
      totalFrames: q ? q.totalVideoFrames : null,
      corruptedFrames: q ? q.corruptedVideoFrames : null,
      visible: rect.width > 40 && rect.height > 40,
    };
  });
}

/** Health grade from drop rate + stall signals. */
function gradeVideo(v) {
  if (v.droppedFrames === null || !v.totalFrames) {
    // Not enough data — fall back to ready-state heuristics.
    if (v.readyState <= 1) return { key: "fair", label: "Fair", reason: "not-loaded" };
    return { key: "good", label: "Good", reason: "no-data" };
  }
  const rate = v.droppedFrames / v.totalFrames;
  if (rate < 0.01) return { key: "good", label: "Good", rate };
  if (rate < 0.05) return { key: "fair", label: "Fair", rate };
  return { key: "poor", label: "Poor", rate };
}

/** Actionable tips tailored to what we measured. */
function buildTips(videos) {
  const tips = new Set();
  const anyPoor = videos.some((v) => gradeVideo(v).key === "poor");
  const anyFair = videos.some((v) => gradeVideo(v).key === "fair");
  const anyStalled = videos.some((v) => v.readyState <= 2 && !v.paused);
  const anyFast = videos.some((v) => v.playbackRate > 1.25);

  if (anyPoor) {
    tips.add("Lower the playback quality (e.g. 1080p → 720p) in the player's settings — dropped frames mean your device or connection can't keep up.");
    tips.add("Close heavy tabs and apps. Video decoding competes for CPU/GPU with everything else open.");
  }
  if (anyStalled) {
    tips.add("Frequent buffering points at the network: pause for 30 seconds to let it pre-buffer, or switch from Wi-Fi to a wired connection.");
  }
  if (anyFair && !anyPoor) {
    tips.add("A few dropped frames is normal at stream start. If it persists, try one quality step down.");
  }
  if (anyFast) {
    tips.add("High playback speed (>1.25×) increases decode load — dropping back to 1× can smooth things out.");
  }
  tips.add("Disable other extensions on this page temporarily — ad blockers and enhancers can fight the player.");
  tips.add("If nothing helps, restart the browser: long sessions leak memory in video pipelines.");
  return [...tips];
}

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function fmtPct(rate) {
  return rate === undefined || rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function renderResults(videos) {
  const box = $("results");
  const hint = $("hint");
  const tipsPanel = $("tips-panel");
  box.innerHTML = "";

  const usable = videos.filter((v) => v.visible);
  if (!usable.length) {
    box.classList.add("hidden");
    tipsPanel.classList.add("hidden");
    hint.textContent = videos.length
      ? "Found videos, but none are visibly large enough to analyze."
      : "No videos found on this tab.";
    hint.classList.remove("hidden");
    return;
  }

  hint.classList.add("hidden");
  box.classList.remove("hidden");

  for (const v of usable) {
    const g = gradeVideo(v);
    const card = document.createElement("div");
    card.className = "video-card";
    const res = v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : "—";
    const dropRate = v.droppedFrames !== null && v.totalFrames
      ? v.droppedFrames / v.totalFrames
      : null;
    const barWidth = dropRate === null ? 0 : Math.min(100, dropRate * 100 * 4); // 25%+ saturates

    card.innerHTML = `
      <div class="card-head">
        <div class="title"></div>
        <span class="grade ${g.key}">${g.label}</span>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Resolution</div><div class="v">${res}</div></div>
        <div class="stat"><div class="k">Playback rate</div><div class="v">${v.playbackRate}×</div></div>
        <div class="stat"><div class="k">Frames dropped</div>
          <div class="v ${dropRate !== null && dropRate >= 0.05 ? "warn" : ""}">
            ${v.droppedFrames === null ? "—" : v.droppedFrames.toLocaleString()}
          </div></div>
        <div class="stat"><div class="k">Total frames</div>
          <div class="v">${v.totalFrames === null ? "—" : v.totalFrames.toLocaleString()}</div></div>
      </div>
      <div class="bar"><div style="width:${barWidth}%"></div></div>
      <div class="bar-label"><span>Drop rate</span><span>${fmtPct(dropRate)}</span></div>`;
    card.querySelector(".title").textContent = v.label;
    card.querySelector(".title").title = v.label;
    box.appendChild(card);
  }

  // Tips
  const tips = buildTips(usable);
  const list = $("tips-list");
  list.innerHTML = "";
  for (const t of tips) {
    const li = document.createElement("li");
    li.innerHTML = `${CHECK_SVG}<span></span>`;
    li.querySelector("span").textContent = t;
    list.appendChild(li);
  }
  tipsPanel.classList.remove("hidden");
}

$("analyze-btn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("no-tab");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: analyzeVideosInPage,
    });
    renderResults(results?.[0]?.result || []);
  } catch (e) {
    $("results").classList.add("hidden");
    $("tips-panel").classList.add("hidden");
    const hint = $("hint");
    hint.textContent = "Can't analyze this page (browser pages and the web store are off-limits).";
    hint.classList.remove("hidden");
  }
});
