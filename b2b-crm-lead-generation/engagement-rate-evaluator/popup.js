// Engagement Rate Evaluator — popup logic. All on-device.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("calc").addEventListener("click", () => { calculate(); });
  $("save").addEventListener("click", savePost);
  renderHistory();
}

function readInputs() {
  const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
  return {
    followers: num("followers"),
    likes: num("likes"),
    comments: num("comments"),
    shares: num("shares"),
  };
}

// Industry-context bands (typical cross-platform social benchmarks).
function verdictOf(er) {
  if (er >= 6) return { label: "Excellent", cls: "v-ex" };
  if (er >= 3.5) return { label: "Good", cls: "v-good" };
  if (er >= 1) return { label: "Average", cls: "v-avg" };
  return { label: "Low", cls: "v-low" };
}

const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

async function calculate() {
  const { followers, likes, comments, shares } = readInputs();
  const box = $("result");
  if (!followers || likes + comments + shares <= 0) { box.hidden = true; return null; }
  const er = ((likes + comments + shares) / followers) * 100;
  const v = verdictOf(er);
  $("erNum").textContent = er.toFixed(2) + "%";
  const pill = $("erVerdict");
  pill.textContent = v.label;
  pill.className = "pill " + v.cls;
  $("erBreak").textContent =
    `${fmt(likes)} likes · ${fmt(comments)} comments · ${fmt(shares)} shares / ${fmt(followers)} followers`;
  // compare against own average
  const { posts = [] } = await chrome.storage.local.get("posts");
  const delta = $("erDelta");
  if (posts.length) {
    const avg = posts.reduce((a, p) => a + p.er, 0) / posts.length;
    const diff = er - avg;
    delta.hidden = false;
    delta.textContent = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}pp vs your ${posts.length}-post average (${avg.toFixed(2)}%)`;
    delta.className = "delta " + (diff >= 0 ? "up" : "down");
  } else delta.hidden = true;
  box.hidden = false;
  return er;
}

async function savePost() {
  const er = await calculate();
  if (er == null) return;
  const { followers, likes, comments, shares } = readInputs();
  const { posts = [] } = await chrome.storage.local.get("posts");
  const label = $("label").value.trim() || `Post ${posts.length + 1}`;
  posts.unshift({
    id: "post-" + Date.now(),
    label, er, followers, likes, comments, shares, at: Date.now(),
  });
  await chrome.storage.local.set({ posts: posts.slice(0, 100) });
  $("label").value = "";
  renderHistory();
}

async function renderHistory() {
  const { posts = [] } = await chrome.storage.local.get("posts");
  const card = $("histCard");
  card.hidden = posts.length === 0;
  if (!posts.length) return;
  const ers = posts.map((p) => p.er);
  const avg = ers.reduce((a, b) => a + b, 0) / ers.length;
  $("stAvg").textContent = avg.toFixed(2) + "%";
  $("stBest").textContent = Math.max(...ers).toFixed(2) + "%";
  $("stN").textContent = posts.length;

  // sparkline (oldest → newest)
  const svg = $("spark");
  svg.innerHTML = "";
  const NS = "http://www.w3.org/2000/svg";
  const W = 340, H = 80, PAD = 8;
  const seq = [...ers].reverse();
  const min = Math.min(...seq), max = Math.max(...seq), span = max - min || 1;
  const pts = seq.map((v, i) => {
    const x = PAD + (i / Math.max(seq.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const poly = document.createElementNS(NS, "polyline");
  poly.setAttribute("points", pts.join(" "));
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "#ec4899");
  poly.setAttribute("stroke-width", "2.5");
  poly.setAttribute("stroke-linejoin", "round");
  svg.appendChild(poly);

  const box = $("history");
  box.innerHTML = "";
  for (const p of posts) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = p.label; b.title = p.label;
    const s = document.createElement("span");
    s.textContent = new Date(p.at).toLocaleDateString() + ` · ${fmt(p.followers)} followers`;
    t.append(b, s);
    const e = document.createElement("div"); e.className = "er";
    e.textContent = p.er.toFixed(2) + "%";
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.title = "Delete";
    x.addEventListener("click", async () => {
      const { posts: cur = [] } = await chrome.storage.local.get("posts");
      await chrome.storage.local.set({ posts: cur.filter((i) => i.id !== p.id) });
      renderHistory();
    });
    row.append(t, e, x);
    box.appendChild(row);
  }
}
