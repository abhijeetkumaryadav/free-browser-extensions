// Inspo Collector — popup UI

let state = { boards: [], items: [], activeBoard: null, query: "" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const data = await chrome.storage.local.get(["boards", "items"]);
  state.boards = data.boards || [];
  state.items = data.items || [];
  state.activeBoard = state.boards[0]?.id || null;

  document.getElementById("search").addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    renderGrid();
  });
  document.getElementById("newBoard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("new-board.html") });
  });
  document.getElementById("export").addEventListener("click", exportBoard);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.boards) state.boards = changes.boards.newValue || [];
    if (changes.items) state.items = changes.items.newValue || [];
    if (!state.boards.find((b) => b.id === state.activeBoard)) {
      state.activeBoard = state.boards[0]?.id || null;
    }
    render();
  });

  render();
}

function render() {
  renderBoards();
  renderGrid();
}

function renderBoards() {
  const nav = document.getElementById("boards");
  nav.innerHTML = "";
  for (const board of state.boards) {
    const btn = document.createElement("button");
    btn.className = board.id === state.activeBoard ? "active" : "";
    const count = state.items.filter((i) => i.boardId === board.id).length;

    const label = document.createElement("span");
    label.textContent = `${board.name} (${count})`;
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      state.activeBoard = board.id;
      render();
    });

    if (board.id !== "unsorted") {
      const del = document.createElement("span");
      del.className = "del";
      del.textContent = "×";
      del.title = "Delete board (keeps its images in Unsorted)";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteBoard(board.id);
      });
      btn.appendChild(del);
    }
    nav.appendChild(btn);
  }
}

function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const q = state.query;

  let items = state.items.filter((i) => i.boardId === state.activeBoard);
  if (q) {
    items = items.filter(
      (i) =>
        (i.pageTitle || "").toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.includes(q))
    );
  }

  document.getElementById("count").textContent =
    `${items.length} saved`;

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = q
      ? "No matches. Try a different search."
      : "Nothing here yet. Right-click any image on the web → “Save image to Inspo Board”.";
    grid.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = item.srcUrl;
    img.loading = "lazy";
    img.alt = item.pageTitle || "saved inspiration";
    card.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "meta";

    if (item.tags && item.tags.length) {
      const tags = document.createElement("div");
      tags.className = "tags";
      for (const t of item.tags.slice(0, 5)) {
        const s = document.createElement("span");
        s.textContent = t;
        tags.appendChild(s);
      }
      meta.appendChild(tags);
    }

    if (item.palette && item.palette.length) {
      const sw = document.createElement("div");
      sw.className = "swatches";
      for (const hex of item.palette) {
        const dot = document.createElement("i");
        dot.style.background = hex;
        dot.title = hex;
        sw.appendChild(dot);
      }
      meta.appendChild(sw);
    }

    const row = document.createElement("div");
    row.className = "row";
    const open = document.createElement("button");
    open.textContent = "Source ↗";
    open.addEventListener("click", () => {
      if (item.pageUrl) chrome.tabs.create({ url: item.pageUrl });
    });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteItem(item.id));
    row.append(open, del);
    meta.appendChild(row);

    card.appendChild(meta);
    grid.appendChild(card);
  }
}

async function deleteItem(id) {
  const items = state.items.filter((i) => i.id !== id);
  await chrome.storage.local.set({ items });
}

async function deleteBoard(id) {
  const boards = state.boards.filter((b) => b.id !== id);
  const items = state.items.map((i) =>
    i.boardId === id ? { ...i, boardId: "unsorted" } : i
  );
  await chrome.storage.local.set({ boards, items });
}

function exportBoard() {
  const board = state.boards.find((b) => b.id === state.activeBoard);
  const items = state.items.filter((i) => i.boardId === state.activeBoard);
  const blob = new Blob(
    [JSON.stringify({ board: board?.name || "board", exportedAt: new Date().toISOString(), items }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inspo-${(board?.name || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
