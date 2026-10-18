// Tab Session Saver — popup logic.

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("save").addEventListener("click", saveSession);
  document.getElementById("name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveSession();
  });
  document.getElementById("export").addEventListener("click", exportJson);
  document.getElementById("importBtn").addEventListener("click", () =>
    document.getElementById("importFile").click()
  );
  document.getElementById("importFile").addEventListener("change", importJson);
  await refreshCount();
  render();
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg || "";
}

async function currentTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((t) => t.url && /^https?:/.test(t.url));
}

async function refreshCount() {
  const tabs = await currentTabs();
  document.getElementById("save").textContent = `Save ${tabs.length} tab${
    tabs.length === 1 ? "" : "s"
  }`;
}

async function saveSession() {
  const tabs = await currentTabs();
  if (!tabs.length) {
    setStatus("No savable tabs in this window.");
    return;
  }
  const nameInput = document.getElementById("name");
  const name =
    nameInput.value.trim() ||
    "Session · " +
      new Date().toLocaleDateString() +
      " " +
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
  const { sessions = [] } = await chrome.storage.local.get("sessions");
  sessions.unshift({
    id: "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name,
    createdAt: Date.now(),
    tabs: tabs.map((t) => ({
      url: t.url,
      title: t.title || t.url,
      pinned: !!t.pinned,
    })),
  });
  await chrome.storage.local.set({ sessions: sessions.slice(0, 50) });
  nameInput.value = "";
  setStatus(`Saved “${name}” (${tabs.length} tabs).`);
  setTimeout(() => setStatus(""), 2000);
  render();
}

async function render() {
  const { sessions = [] } = await chrome.storage.local.get("sessions");
  const list = document.getElementById("list");
  list.innerHTML = "";
  if (!sessions.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent =
      "No saved sessions yet. Open some tabs, name the session, hit Save.";
    list.appendChild(d);
    return;
  }
  for (const s of sessions) {
    const card = document.createElement("div");
    card.className = "session";

    const top = document.createElement("div");
    top.className = "top";
    const b = document.createElement("b");
    b.textContent = s.name;
    b.title = s.name;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.style.cssText =
      "background:transparent;border:0;color:var(--muted);cursor:pointer;font-size:12px;";
    del.addEventListener("click", async () => {
      const { sessions: cur = [] } = await chrome.storage.local.get(
        "sessions"
      );
      await chrome.storage.local.set({
        sessions: cur.filter((x) => x.id !== s.id),
      });
      render();
    });
    top.append(b, del);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${s.tabs.length} tabs · ${new Date(
      s.createdAt
    ).toLocaleString()}`;

    const tabsEl = document.createElement("div");
    tabsEl.className = "tabs";
    tabsEl.textContent = s.tabs
      .slice(0, 6)
      .map((t) => t.title)
      .join("  •  ");

    const row = document.createElement("div");
    row.className = "row";
    const restore = document.createElement("button");
    restore.className = "restore";
    restore.textContent = "Restore in new window";
    restore.addEventListener("click", () => restoreSession(s));
    const openAll = document.createElement("button");
    openAll.textContent = "Open tabs here";
    openAll.addEventListener("click", () => openHere(s));
    row.append(restore, openAll);

    card.append(top, meta, tabsEl, row);
    list.appendChild(card);
  }
}

async function restoreSession(s) {
  const urls = s.tabs.map((t) => t.url);
  if (!urls.length) return;
  const win = await chrome.windows.create({ url: urls });
  // re-apply pinned state by position
  const tabs = await chrome.tabs.query({ windowId: win.id });
  for (let i = 0; i < tabs.length && i < s.tabs.length; i++) {
    if (s.tabs[i].pinned) {
      try {
        await chrome.tabs.update(tabs[i].id, { pinned: true });
      } catch (e) {
        /* ignore */
      }
    }
  }
  setStatus(`Restored “${s.name}”.`);
  setTimeout(() => setStatus(""), 2000);
}

async function openHere(s) {
  for (const t of s.tabs) {
    await chrome.tabs.create({ url: t.url, active: false });
  }
  setStatus(`Opened ${s.tabs.length} tabs in this window.`);
  setTimeout(() => setStatus(""), 2000);
  refreshCount();
}

function exportJson() {
  chrome.storage.local.get("sessions", ({ sessions = [] }) => {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tab-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("bad-format");
    const valid = data.filter(
      (s) =>
        s &&
        typeof s.name === "string" &&
        Array.isArray(s.tabs) &&
        s.tabs.every((t) => t && typeof t.url === "string")
    );
    if (!valid.length) throw new Error("no-valid");
    const { sessions = [] } = await chrome.storage.local.get("sessions");
    const withIds = valid.map((s) => ({
      ...s,
      id:
        "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      createdAt: s.createdAt || Date.now(),
    }));
    await chrome.storage.local.set({
      sessions: [...withIds.reverse(), ...sessions].slice(0, 50),
    });
    setStatus(`Imported ${withIds.length} session(s).`);
    render();
  } catch (err) {
    setStatus("That file doesn’t look like a sessions export.");
  } finally {
    e.target.value = "";
    setTimeout(() => setStatus(""), 2500);
  }
}
