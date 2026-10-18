// Narrative Flow Evaluator — popup logic.
// All analysis is heuristic and runs on-device. Scores describe surface
// rhythm (sentence/paragraph length patterns, quoted dialogue, tension-word
// density) — they are writing aids, not literary judgments.

// Curated tension-word list for the pacing curve (heuristic, English).
const TENSION = new Set(
  ("suddenly,frantic,frantically,panic,panicked,raced,slammed,gasped,gasp,screamed,shouted," +
   "trembled,trembling,rushed,explosion,chased,chase,danger,dangerous,terror,terrified,urgent," +
   "urgently,desperate,desperately,violent,violently,crashed,grabbed,fled,sprinted,breathless," +
   "chaos,thundered,whispered,crept,lurked,dread,menace,menacing,horror,horrified,snarled," +
   "lunged,stabbed,gunshot,siren,alarm,shattered,collapsed,trapped,cornered,hunted,stalked," +
   "ambush,attack,attacked,bleeding,wound,scream,cried,pleaded,begged,warning,warned,threat," +
   "threatened,killer,murder,death,died,dying,corpse,blood,fire,burning,smoke,storm,lightning," +
   "earthquake,flood,drowning,suffocating,choking,gripped,clutched,froze,frozen,shivered," +
   "sweat,sweating,heartbeat,pounding,racing,adrenaline,fight,fought,struggle,struggled," +
   "escape,escaped,run,ran,hide,hiding,searching,desperation,anguish,agony,savage,brutal," +
   "merciless,relentless,pursuit,pursued,caught,trapped,doom,doomed,ominous,sinister,eerie," +
   "haunting,spine,chilling,shiver,nightmare").split(",")
);

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", () => { $("text").value = ""; chrome.storage.local.remove("draft"); });
  const { draft = "" } = await chrome.storage.local.get("draft");
  if (draft) { $("text").value = draft; analyze(); }
}

function wordsOf(s) {
  return s.match(/[\p{L}']+/gu) || [];
}

function splitSentences(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  try {
    return flat.split(/(?<=[.!?…]["'”’)\]]?)\s+/).filter((s) => s.trim());
  } catch (e) {
    return flat.split(/(?:[.!?…]["'”’)\]]?\s+)/).filter((s) => s.trim());
  }
}

function stats(arr) {
  const n = arr.length;
  if (!n) return { mean: 0, sd: 0, cv: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
  return { mean, sd, cv: mean ? sd / mean : 0 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct = (v) => Math.round(v) + "";

function analyze() {
  const text = $("text").value.trim();
  if (wordsOf(text).length < 30) {
    $("results").hidden = true;
    return;
  }
  chrome.storage.local.set({ draft: text });

  const sentences = splitSentences(text);
  const sentLens = sentences.map((s) => Math.max(1, wordsOf(s).length));
  const sentStats = stats(sentLens);

  // Dialogue ratio: characters inside double-style quotes vs total.
  let quotedChars = 0;
  const qre = /[""«»]([^"""«»]+?)[""«»]/g;
  let m;
  while ((m = qre.exec(text))) quotedChars += m[1].length;
  const dialogueRatio = text.length ? quotedChars / text.length : 0;

  // Paragraph variety.
  const paras = text.split(/\n\s*\n/).map((p) => wordsOf(p).length).filter((n) => n > 0);
  const paraStats = stats(paras);

  // Pacing curve: tension density per eighth of the text.
  const allWords = wordsOf(text.toLowerCase());
  const SECTIONS = 8;
  const per = Math.max(1, Math.ceil(allWords.length / SECTIONS));
  const densities = [];
  for (let i = 0; i < SECTIONS; i++) {
    const slice = allWords.slice(i * per, (i + 1) * per);
    const hits = slice.filter((w) => TENSION.has(w)).length;
    densities.push(slice.length ? (hits / slice.length) * 1000 : 0);
  }

  // ---- Scores (0–100), all heuristics ----
  const varietyScore = clamp((sentStats.cv / 0.75) * 100, 0, 100);
  // Dialogue "sweet spot" for fiction ~15–55%; essays legitimately score low.
  const dialogueScore = clamp(100 - (Math.abs(dialogueRatio - 0.35) / 0.35) * 100, 0, 100);
  const paraScore = paras.length < 3 ? 50 : clamp((paraStats.cv / 0.8) * 100, 0, 100);
  const first = (densities[0] + densities[1]) / 2;
  const last = (densities[SECTIONS - 1] + densities[SECTIONS - 2]) / 2;
  const pacingScore = clamp(50 + 50 * ((last - first) / (last + first + 0.001)), 0, 100);

  const flow = Math.round(0.3 * varietyScore + 0.25 * dialogueScore + 0.2 * paraScore + 0.25 * pacingScore);

  renderScore(flow);
  renderRhythm(sentLens);
  renderPacing(densities);
  renderMetrics([
    { name: "Sentence variety", score: varietyScore, detail: `avg ${sentStats.mean.toFixed(1)} words/sentence` },
    { name: "Dialogue balance", score: dialogueScore, detail: `${(dialogueRatio * 100).toFixed(0)}% quoted` },
    { name: "Paragraph variety", score: paraScore, detail: `${paras.length} paragraphs` },
    { name: "Pacing shape", score: pacingScore, detail: last >= first ? "tension rises" : "tension falls" },
  ]);
  renderTips({ varietyScore, dialogueScore, paraScore, pacingScore, dialogueRatio, sentStats, paras });
  $("results").hidden = false;
}

function renderScore(flow) {
  $("score").textContent = flow;
  $("verdict").textContent =
    flow >= 80 ? "Propulsive — strong rhythmic control." :
    flow >= 60 ? "Solid flow with a few flat stretches." :
    flow >= 40 ? "Uneven — the rhythm needs work." :
                 "Flat — consider restructuring sentences and scenes.";
}

function barChart(svg, values, color) {
  svg.innerHTML = "";
  const W = 340, H = 84, PAD = 8;
  const max = Math.max(...values, 1);
  const n = values.length;
  const bw = Math.max(1.5, (W - PAD * 2) / Math.min(n, 120) - 1);
  const step = (W - PAD * 2) / n;
  values.slice(0, 240).forEach((v, i) => {
    const r = document.createElementNS(NS, "rect");
    const h = Math.max(2, (v / max) * (H - PAD * 2));
    r.setAttribute("x", (PAD + i * step).toFixed(1));
    r.setAttribute("y", (H - PAD - h).toFixed(1));
    r.setAttribute("width", Math.min(bw, step - 1).toFixed(1));
    r.setAttribute("height", h.toFixed(1));
    r.setAttribute("rx", "1.5");
    r.setAttribute("fill", color);
    r.setAttribute("opacity", "0.85");
    svg.appendChild(r);
  });
}

function renderRhythm(sentLens) {
  barChart($("rhythm"), sentLens, "#f59e0b");
}

function renderPacing(densities) {
  const svg = $("pacing");
  svg.innerHTML = "";
  const W = 340, H = 84, PAD = 10;
  const max = Math.max(...densities, 0.001);
  const pts = densities.map((d, i) => {
    const x = PAD + (i / (densities.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (d / max) * (H - PAD * 2 - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = document.createElementNS(NS, "polygon");
  area.setAttribute("points", `${PAD},${H - PAD} ${pts.join(" ")} ${W - PAD},${H - PAD}`);
  area.setAttribute("fill", "rgba(245,158,11,.18)");
  const line = document.createElementNS(NS, "polyline");
  line.setAttribute("points", pts.join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#f59e0b");
  line.setAttribute("stroke-width", "2.5");
  line.setAttribute("stroke-linejoin", "round");
  svg.append(area, line);
  densities.forEach((d, i) => {
    const [x, y] = pts[i].split(",");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y);
    c.setAttribute("r", "3.5"); c.setAttribute("fill", "#f59e0b");
    svg.appendChild(c);
  });
}

function renderMetrics(metrics) {
  const box = $("metrics");
  box.innerHTML = "";
  for (const mt of metrics) {
    const row = document.createElement("div");
    row.className = "metric";
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = mt.name;
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.width = pct(mt.score) + "%";
    bar.appendChild(fill);
    const vl = document.createElement("div"); vl.className = "vl"; vl.textContent = pct(mt.score);
    vl.title = mt.detail;
    row.append(nm, bar, vl);
    box.appendChild(row);
  }
}

function renderTips(s) {
  const tips = [];
  if (s.varietyScore < 45) tips.push("Sentences are very uniform in length — break up the rhythm with short punchy lines between longer ones.");
  else if (s.varietyScore > 85) tips.push("Sentence length varies nicely — that rhythmic contrast keeps readers moving.");
  if (s.dialogueRatio < 0.03) tips.push("Almost no quoted dialogue — fine for essays, but fiction usually breathes with scenes of spoken exchange.");
  else if (s.dialogueRatio > 0.65) tips.push("Very dialogue-heavy — anchor scenes with sensory narration so the setting doesn't vanish.");
  if (s.paraScore < 40 && s.paras.length >= 3) tips.push("Paragraphs are all similar in size — vary them: single-line paragraphs create emphasis and speed.");
  if (s.pacingScore < 40) tips.push("Tension words cluster early and fade — consider raising the stakes toward the ending.");
  else if (s.pacingScore > 65) tips.push("Tension builds toward the end — classic escalation shape.");
  if (!tips.length) tips.push("No major rhythm issues detected — trust your ear on the next pass.");
  const box = $("tips");
  box.innerHTML = "";
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  for (const t of tips.slice(0, 5)) {
    const div = document.createElement("div");
    div.className = "tip";
    div.innerHTML = ICON;
    const span = document.createElement("span");
    span.textContent = t;
    div.appendChild(span);
    box.appendChild(div);
  }
}
