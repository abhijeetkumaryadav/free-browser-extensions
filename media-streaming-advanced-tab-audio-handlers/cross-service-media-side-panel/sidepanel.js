/* Stagehand side panel logic — renders audible tabs with user-initiated controls. */
"use strict";

const ICONS = {
  play: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 13 8-13 8V4z"/></svg>`,
  pause: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  mute: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>`,
  unmute: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  back: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><text x="8.5" y="16" font-size="7" fill="currentColor" stroke="none" font-weight="700">10</text></svg>`,
  fwd: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="8.5" y="16" font-size="7" fill="currentColor" stroke="none" font-weight="700">10</text></svg>`,
  jump: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>`,
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let refreshing = false;

async function render() {
  if (refreshing) return;
  refreshing = true;
  try {
    const tabs = await getMediaTabs();
    const list = document.getElementById("mediaList");
    if (!tabs.length) {
      list.innerHTML = `<div class="empty">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5c5c6e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 4 13 8-13 8V4z"/></svg>
        <p>No tabs are playing audio right now.<br>Start a video or song and it will appear here.</p>
      </div>`;
      return;
    }
    const states = await Promise.all(tabs.map((t) => probeTab(t.id)));
    list.innerHTML = tabs.map((tab, i) => {
      const st = states[i];
      const fav = tab.favIconUrl ? `<img class="fav" src="${esc(tab.favIconUrl)}" alt="">` : `<span class="fav fallback">♪</span>`;
      const time = st ? `${fmtTime(st.currentTime)} / ${fmtTime(st.duration)}` : "";
      const playing = st ? !st.paused : tab.audible;
      return `
      <div class="card" data-id="${tab.id}">
        <div class="row-top">
          ${fav}
          <div class="title-wrap">
            <div class="title" title="${esc(tab.title)}">${esc(tab.title || "Untitled")}</div>
            <div class="host">${esc(hostOf(tab.url))} ${time ? `· <span class="time">${time}</span>` : ""}</div>
          </div>
          <button class="ctrl primary" data-action="toggle" title="${playing ? "Pause" : "Play"}">${playing ? ICONS.pause : ICONS.play}</button>
        </div>
        <div class="controls">
          <button class="ctrl" data-action="back" title="Back 10s">${ICONS.back}</button>
          <button class="ctrl" data-action="forward" title="Forward 10s">${ICONS.fwd}</button>
          <button class="ctrl ${tab.mutedInfo && tab.mutedInfo.muted ? "active" : ""}" data-action="${tab.mutedInfo && tab.mutedInfo.muted ? "unmute" : "mute"}" title="${tab.mutedInfo && tab.mutedInfo.muted ? "Unmute tab" : "Mute tab"}">${tab.mutedInfo && tab.mutedInfo.muted ? ICONS.mute : ICONS.unmute}</button>
          <button class="ctrl" data-action="gototab" title="Jump to tab">${ICONS.jump}</button>
        </div>
      </div>`;
    }).join("");
  } finally {
    refreshing = false;
  }
}

document.getElementById("mediaList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const card = e.target.closest(".card");
  const tabId = +card.dataset.id;
  btn.disabled = true;
  try {
    await commandTab(tabId, btn.dataset.action);
  } catch (err) {
    console.warn("Stagehand command failed:", err);
  }
  btn.disabled = false;
  setTimeout(render, 350); // let the page catch up, then refresh state
});

document.getElementById("refreshBtn").addEventListener("click", render);

render();
setInterval(render, 4000); // gentle auto-refresh
