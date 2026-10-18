// TrackTag — popup.js
// Manual "what's this song" log. No audio analysis of any kind —
// the user hears a track and logs the current tab's title/URL with a note.
// Quick-search buttons open the query on Spotify / YouTube / Google.
(function () {
  "use strict";

  const STORE_KEY = "tracktag_tracks";

  // Search targets: user-typed queries only, opened in new tabs.
  const SEARCH_ENGINES = [
    { id: "spotify", label: "Spotify", icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', url: (q) => "https://open.spotify.com/search/" + encodeURIComponent(q) },
    { id: "youtube", label: "YouTube", icon: '<path d="M22.5 7s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.4-1C16 3.4 12 3.4 12 3.4s-4 0-7.2.3c-.5.1-1.5.1-2.4 1-.7.7-.9 2.3-.9 2.3S1.3 8.9 1.3 10.8v1.6c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.6 1 1.9.2 7 .3 7 .3s4 0 7.2-.4c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8v-1.6c0-1.9-.2-3.8-.2-3.8zM9.8 14.6V8.9l5.7 2.9z"/>', url: (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) },
    { id: "google", label: "Google", icon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', url: (q) => "https://www.google.com/search?q=" + encodeURIComponent(q) },
  ];

  const els = {
    nowPlaying: document.getElementById("nowPlaying"),
    note: document.getElementById("noteInput"),
    logBtn: document.getElementById("logBtn"),
    list: document.getElementById("trackList"),
    empty: document.getElementById("emptyMsg"),
    count: document.getElementById("countBadge"),
    clear: document.getElementById("clearBtn"),
  };

  let currentTab = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function getTracks() {
    return chrome.storage.local.get([STORE_KEY]).then((r) => r[STORE_KEY] || []);
  }
  function setTracks(tracks) {
    return chrome.storage.local.set({ [STORE_KEY]: tracks });
  }

  function render(tracks) {
    els.count.textContent = tracks.length;
    els.empty.style.display = tracks.length ? "none" : "block";
    els.list.innerHTML = "";
    tracks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "track";
      li.innerHTML =
        '<div class="title">' + esc(t.title) + "</div>" +
        '<div class="meta">' + esc(fmtTime(t.ts)) + " · " + esc(t.host) + "</div>" +
        (t.note ? '<div class="note">“' + esc(t.note) + "”</div>" : "") +
        '<div class="row"></div>';
      const row = li.querySelector(".row");
      SEARCH_ENGINES.forEach((eng) => {
        const btn = document.createElement("button");
        btn.className = "search-btn";
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + eng.icon + "</svg>" + eng.label;
        btn.addEventListener("click", () => {
          chrome.tabs.create({ url: eng.url(t.title) });
        });
        row.appendChild(btn);
      });
      const del = document.createElement("button");
      del.className = "delete-btn";
      del.title = "Delete this entry";
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      del.addEventListener("click", async () => {
        const all = await getTracks();
        await setTracks(all.filter((x) => x.id !== t.id));
        render(await getTracks());
      });
      row.appendChild(del);
      els.list.appendChild(li);
    });
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
    if (tab && tab.title) {
      let host = "";
      try { host = new URL(tab.url).hostname; } catch (e) { /* non-http tab */ }
      els.nowPlaying.innerHTML =
        esc(tab.title) + (host ? '<span class="from">' + esc(host) + "</span>" : "");
    } else {
      els.nowPlaying.textContent = "No readable tab.";
      els.logBtn.disabled = true;
    }

    render(await getTracks());

    els.logBtn.addEventListener("click", async () => {
      if (!currentTab) return;
      let host = "";
      try { host = new URL(currentTab.url).hostname; } catch (e) { /* ignore */ }
      const tracks = await getTracks();
      tracks.unshift({
        id: "t" + Date.now() + Math.floor(Math.random() * 1e6),
        title: currentTab.title || "(untitled)",
        url: currentTab.url || "",
        host,
        note: els.note.value.trim(),
        ts: Date.now(),
      });
      await setTracks(tracks);
      els.note.value = "";
      render(tracks);
    });

    els.clear.addEventListener("click", async () => {
      if (!confirm("Delete all logged tracks?")) return;
      await setTracks([]);
      render([]);
    });

    els.note.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") els.logBtn.click();
    });
  }

  init();
})();
