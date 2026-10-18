// Keyword Volume Overlay — popup logic.
// extractKeywords() is injected into the page; keep it self-contained.

function extractKeywords() {
  const STOPWORDS = new Set(
    ("the,a,an,and,or,of,to,in,on,for,with,by,at,from,is,are,was,were,it,its," +
     "this,that,these,those,you,your,we,our,they,their,he,she,his,her,as,be,has," +
     "have,had,will,would,can,could,should,not,no,do,does,did,but,if,then,than," +
     "so,into,over,after,before,between,about,also,more,most,other,such,only," +
     "its,may,might,must,shall,been,being,there,here,when,where,which,while," +
     "who,whom,what,how,why,all,any,both,each,few,own,same,too,very,just,don," +
     "now,get,got,make,made,use,used,using,like,click,page,home,menu,search," +
     "login,sign,account,cart,free,new,best,top,shop,buy,price,sale,product," +
     "image,photo,video,read,learn,view,see,show,please,thank,hello,welcome").split(",")
  );
  // visible text only: skip script/style/nav boilerplate weight
  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|TEXTAREA|OPTION)$/.test(tag)) return NodeFilter.FILTER_REJECT;
        const t = node.nodeValue.trim();
        return t.length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    }
  );
  const counts = new Map();
  let totalWords = 0;
  let node;
  while ((node = walker.nextNode())) {
    const words = node.nodeValue.toLowerCase().match(/[a-z][a-z\-']{2,}/g) || [];
    for (const w of words) {
      const clean = w.replace(/^['\-]+|['\-]+$/g, "");
      if (clean.length < 3 || STOPWORDS.has(clean)) continue;
      counts.set(clean, (counts.get(clean) || 0) + 1);
      totalWords++;
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({ term, count }));
  return {
    title: (document.title || "").split("|")[0].trim() || null,
    host: location.hostname.replace(/^www\./, ""),
    url: location.href,
    totalWords,
    keywords: top,
  };
}

// Heuristic volume estimate: maps on-page frequency + term shape to a
// plausible monthly-search bucket. Clearly an estimate, never live data.
function estimateVolume(term, count, maxCount) {
  const freqScore = maxCount ? count / maxCount : 0;
  const words = term.split(/[\s\-]+/).length;
  const lenBonus = term.length >= 4 && term.length <= 14 ? 1.15 : 0.9;
  const multiBonus = words > 1 ? 0.7 : 1.0; // long-tail gets less
  const raw = Math.round(120 * freqScore * lenBonus * multiBonus * 100);
  // bucket to look like a real estimate, not false precision
  if (raw >= 50000) return "50K+";
  if (raw >= 10000) return (Math.round(raw / 5000) * 5) + "K";
  if (raw >= 1000) return (Math.round(raw / 500) / 2).toFixed(1).replace(/\.0$/, "") + "K";
  if (raw >= 100) return String(Math.round(raw / 50) * 50);
  return "<100";
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderHistory();
}

async function analyze() {
  const btn = $("analyze");
  btn.disabled = true;
  btn.textContent = "Analyzing…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractKeywords,
    });
    const data = res && res.result;
    if (!data || !data.keywords.length) throw new Error("no-keywords");
    renderResults(data);
    saveAnalysis(data);
    $("empty").style.display = "none";
    $("results").hidden = false;
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read this page — try a content-heavy page on a regular site.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Analyze";
  }
}

function renderResults(data) {
  $("wordCount").textContent = data.totalWords.toLocaleString() + " words scanned";
  const box = $("kwList");
  box.innerHTML = "";
  const maxCount = data.keywords[0] ? data.keywords[0].count : 1;
  for (let i = 0; i < data.keywords.length; i++) {
    const k = data.keywords[i];
    const vol = estimateVolume(k.term, k.count, maxCount);
    const row = document.createElement("div");
    row.className = "kw";
    row.title = "Click to copy";
    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = i + 1;
    const term = document.createElement("div");
    term.className = "term";
    const b = document.createElement("b");
    b.textContent = k.term;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    bar.appendChild(fill);
    const s = document.createElement("span");
    s.textContent = k.count + " mentions";
    term.append(b, bar, s);
    const vv = document.createElement("div");
    vv.className = "vol";
    const vb = document.createElement("b");
    vb.textContent = vol;
    const vs = document.createElement("span");
    vs.textContent = "est. vol/mo";
    vv.append(vb, vs);
    row.append(rank, term, vv);
    row.addEventListener("click", () => copyText(k.term));
    box.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.width = Math.max(4, (k.count / maxCount) * 100) + "%";
    }));
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

async function saveAnalysis(data) {
  const { analyses = [] } = await chrome.storage.local.get("analyses");
  analyses.unshift({
    id: "an-" + Date.now(),
    title: data.title || data.host,
    host: data.host,
    top: data.keywords.slice(0, 3).map((k) => k.term).join(", "),
    at: Date.now(),
  });
  await chrome.storage.local.set({ analyses: analyses.slice(0, 20) });
  renderHistory();
}

async function renderHistory() {
  const { analyses = [] } = await chrome.storage.local.get("analyses");
  const card = $("histCard");
  const box = $("history");
  box.innerHTML = "";
  card.hidden = analyses.length === 0;
  for (const a of analyses) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div");
    t.className = "t";
    const b = document.createElement("b");
    b.textContent = a.title;
    b.title = a.title;
    const s = document.createElement("span");
    s.textContent = new Date(a.at).toLocaleString() + " · " + a.top;
    t.append(b, s);
    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "×";
    x.addEventListener("click", async () => {
      const { analyses: cur = [] } = await chrome.storage.local.get("analyses");
      await chrome.storage.local.set({ analyses: cur.filter((i) => i.id !== a.id) });
      renderHistory();
    });
    row.append(t, x);
    box.appendChild(row);
  }
}
