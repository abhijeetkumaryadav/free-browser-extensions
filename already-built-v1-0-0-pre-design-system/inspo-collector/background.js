// Inspo Collector — background service worker (Manifest V3)

const DEFAULT_BOARD = { id: "unsorted", name: "Unsorted", createdAt: Date.now() };

chrome.runtime.onInstalled.addListener(async () => {
  const { boards } = await chrome.storage.local.get("boards");
  if (!boards || boards.length === 0) {
    await chrome.storage.local.set({ boards: [DEFAULT_BOARD], items: [] });
  }
  await rebuildMenus();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.boards) rebuildMenus();
});

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  const { boards = [DEFAULT_BOARD] } = await chrome.storage.local.get("boards");

  chrome.contextMenus.create({
    id: "inspo-save",
    title: "Save image to Inspo Board",
    contexts: ["image"],
  });

  for (const board of boards) {
    chrome.contextMenus.create({
      id: `board:${board.id}`,
      parentId: "inspo-save",
      title: board.name,
      contexts: ["image"],
    });
  }

  chrome.contextMenus.create({
    id: "inspo-new-board",
    parentId: "inspo-save",
    title: "＋ New board…",
    contexts: ["image"],
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "inspo-new-board") {
    chrome.tabs.create({ url: chrome.runtime.getURL("new-board.html") });
    return;
  }
  if (!String(info.menuItemId).startsWith("board:")) return;

  const boardId = String(info.menuItemId).slice("board:".length);
  const srcUrl = info.srcUrl;
  if (!srcUrl) return;

  // Best-effort palette extraction in page context (fails silently on
  // chrome:// pages or CORS-tainted images).
  let palette = [];
  try {
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PALETTE",
      srcUrl,
    });
    if (res && Array.isArray(res.palette)) palette = res.palette;
  } catch (e) {
    palette = [];
  }

  const tags = buildTags(tab.title || "", info.pageUrl || "");
  const item = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    boardId,
    srcUrl,
    pageUrl: info.pageUrl || tab.url || "",
    pageTitle: tab.title || "",
    tags,
    palette,
    createdAt: Date.now(),
  };

  const { items = [] } = await chrome.storage.local.get("items");
  items.unshift(item);
  await chrome.storage.local.set({ items });

  // Quick confirmation on the toolbar icon.
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#b56576" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
});

const STOPWORDS = new Set(
  "the,a,an,and,or,of,to,in,on,for,with,by,at,from,is,are,was,were,it,its,this,that,these,those,you,your,we,our,they,their,he,she,his,her,as,be,has,have,had,will,would,can,not,no,do,does,did,but,if,then,than,so,into,over,after,before,new,best,top,how,what,when,where,who,why,image,photo,picture,png,jpg,jpeg,webp".split(
    ","
  )
);

function buildTags(title, pageUrl) {
  const tags = [];
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  for (const w of words) {
    if (!tags.includes(w)) tags.push(w);
    if (tags.length >= 6) break;
  }
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0];
    if (label && label.length > 2 && !tags.includes(label)) tags.push(label);
  } catch (e) {
    /* ignore */
  }
  return tags.slice(0, 7);
}
