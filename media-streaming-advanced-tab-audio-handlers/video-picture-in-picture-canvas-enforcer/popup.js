// PiP Canvas — popup logic.
// Scans the active tab for <video> elements and requests PiP on demand.
// All page interaction happens through chrome.scripting, user-initiated.

const $ = (id) => document.getElementById(id);

/** Show a transient message at the bottom of the popup. */
function toast(message, ms = 5200) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

/** Run a function in the active tab's MAIN world and return its result. */
async function runInTab(fn, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: fn,
    args,
  });
  return results?.[0]?.result;
}

/** Collect visible video metadata from the page (runs in page context). */
function scanVideosInPage() {
  return Array.from(document.querySelectorAll("video")).map((v, i) => {
    const rect = v.getBoundingClientRect();
    return {
      index: i,
      // A human-friendly label: aria-label, page-title fallback, else size.
      label:
        v.getAttribute("aria-label") ||
        v.title ||
        v.currentSrc?.split("/").pop()?.split("?")[0] ||
        `Video ${i + 1}`,
      duration: Number.isFinite(v.duration) ? v.duration : 0,
      readyState: v.readyState,
      paused: v.paused,
      pipBlocked: v.hasAttribute("disablepictureinpicture"),
      visible: rect.width > 40 && rect.height > 40,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
}

/** Request PiP for the video at `index` (runs in page context). */
function requestPipInPage(index) {
  const videos = document.querySelectorAll("video");
  const v = videos[index];
  if (!v) return { ok: false, reason: "video-gone" };
  if (v.hasAttribute("disablepictureinpicture")) {
    return { ok: false, reason: "blocked" };
  }
  if (v.readyState < 2) {
    return { ok: false, reason: "not-ready" };
  }
  // Chrome throws if another element already has PiP; exit it first.
  const enter = () =>
    v
      .requestPictureInPicture()
      .then(() => ({ ok: true }))
      .catch((e) => ({ ok: false, reason: "error", message: String(e?.message || e) }));
  if (document.pictureInPictureElement) {
    return document
      .exitPictureInPicture()
      .then(() => new Promise((r) => setTimeout(r, 150)))
      .then(enter)
      .catch(() => enter());
  }
  return enter();
}

/** Human-friendly explanations when PiP cannot start. */
const REASONS = {
  "video-gone": "That video disappeared from the page. Scan again.",
  blocked:
    "This site disables picture-in-picture on its videos (disablepictureinpicture). Try the video on another page — nothing else we can do from here.",
  "not-ready": "The video hasn't loaded enough data yet. Press play, wait a moment, and try again.",
  error: "The browser refused the request.",
};

function fmtDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PLAY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;

/** Render the scanned videos as pop-out rows. */
function renderVideos(videos) {
  const list = $("video-list");
  const hint = $("scan-hint");
  list.innerHTML = "";
  if (!videos.length) {
    list.classList.add("hidden");
    hint.textContent = "No videos found on this tab.";
    hint.classList.remove("hidden");
    return;
  }
  const usable = videos.filter((v) => v.visible);
  if (!usable.length) {
    list.classList.add("hidden");
    hint.textContent = "Found videos, but none are visibly large enough to pop out.";
    hint.classList.remove("hidden");
    return;
  }
  hint.classList.add("hidden");
  list.classList.remove("hidden");
  for (const v of usable) {
    const row = document.createElement("div");
    row.className = "video-item";
    const sub = [
      fmtDuration(v.duration),
      `${v.width}×${v.height}`,
      v.pipBlocked ? "PiP blocked by site" : v.paused ? "Paused" : "Playing",
    ].join(" · ");
    row.innerHTML = `<div class="thumb">${PLAY_SVG}</div>
      <div class="meta"><div class="title"></div><div class="sub"></div></div>
      <button class="btn ghost">Pop out</button>`;
    row.querySelector(".title").textContent = v.label;
    row.querySelector(".sub").textContent = sub;
    const btn = row.querySelector("button");
    if (v.pipBlocked) {
      btn.textContent = "Blocked";
      btn.disabled = true;
      btn.style.opacity = "0.45";
      btn.title = "This site disables picture-in-picture";
    } else {
      btn.addEventListener("click", () => popOut(v.index, v.label));
    }
    list.appendChild(row);
  }
}

async function popOut(index, label) {
  try {
    const res = await runInTab(requestPipInPage, [index]);
    if (res?.ok) {
      toast(`"${label}" is now floating in picture-in-picture.`);
    } else {
      toast(REASONS[res?.reason] || REASONS.error);
    }
  } catch (e) {
    // Cannot inject on chrome://, web store, etc.
    toast("Can't reach this page (browser pages and the web store are off-limits).");
  }
}

async function scan() {
  try {
    const videos = await runInTab(scanVideosInPage);
    renderVideos(videos || []);
  } catch (e) {
    $("video-list").classList.add("hidden");
    $("scan-hint").textContent = "Can't scan this page (browser pages are off-limits).";
    $("scan-hint").classList.remove("hidden");
  }
}

/* ---------- Floating PiP button toggle ---------- */
async function loadToggle() {
  const { floatBtn = false } = await chrome.storage.local.get("floatBtn");
  $("float-toggle").setAttribute("aria-checked", String(floatBtn));
}

$("float-toggle").addEventListener("click", async () => {
  const el = $("float-toggle");
  const next = el.getAttribute("aria-checked") !== "true";
  el.setAttribute("aria-checked", String(next));
  await chrome.storage.local.set({ floatBtn: next });
  toast(next
    ? "Floating PiP buttons are on — hover any video on any page."
    : "Floating PiP buttons are off.");
});

$("scan-btn").addEventListener("click", scan);
loadToggle();
