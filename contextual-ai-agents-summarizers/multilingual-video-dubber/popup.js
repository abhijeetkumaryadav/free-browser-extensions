// Multilingual Video Dubber — popup logic.
// Honest scope: reads EXISTING caption tracks on the page you're viewing.
// It does not translate, synthesize, or generate dubbing audio.

// ---- Page-side functions (injected; must stay self-contained) ----
function scanVideos() {
  return Array.from(document.querySelectorAll("video")).map((v, i) => ({
    index: i,
    src: (v.currentSrc || v.src || "").slice(0, 120),
    tracks: Array.from(v.textTracks || []).map((t, j) => ({
      index: j,
      label: t.label || ("Track " + (j + 1)),
      language: t.language || "und",
      kind: t.kind || "subtitles",
    })),
  }));
}

function extractCues(videoIndex, trackIndex) {
  const vids = Array.from(document.querySelectorAll("video"));
  const v = vids[videoIndex];
  if (!v) return [];
  const ts = Array.from(v.textTracks || []);
  // Cues are only readable when the track is active; "hidden" exposes them silently.
  ts.forEach((t) => { if (t.mode === "disabled") { try { t.mode = "hidden"; } catch (e) {} } });
  const t = ts[trackIndex];
  if (!t || !t.cues) return [];
  const out = [];
  for (const c of Array.from(t.cues)) {
    const text = String(c.text || "").replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ start: c.startTime, end: c.endTime, text });
  }
  return out;
}
// ---- End of injected functions ----

const $ = (id) => document.getElementById(id);
let cues = [];
let trackLabel = "";

const STOPWORDS = new Set(
  ("the,be,to,of,and,a,in,that,have,i,it,for,not,on,with,he,as,you,do,at,this,but,his,by," +
   "from,they,we,say,her,she,or,an,will,my,one,all,would,there,their,what,so,up,out,if,about," +
   "who,get,which,go,me,when,make,can,like,time,just,him,know,take,people,into,year,your,good," +
   "some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use," +
   "two,how,our,work,first,well,way,even,new,want,because,any,these,give,day,most,us,is,are,was," +
   "were,has,had,been,does,did,shall,should,may,might,must,very,more,much,such,no,yes,too,also," +
   "el,la,los,las,de,del,que,en,una,un,con,por,para,como,le,les,der,die,das,und,den,dem,einer," +
   "le,la,les,de,des,une,est,et,pour,dans,du,au,aux,ce,cette,il,ils,elle").split(",")
);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("host").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  $("scan").addEventListener("click", scan);
  $("srt").addEventListener("click", exportSrt);
  $("copyTxt").addEventListener("click", copyPlain);
  $("copyVocab").addEventListener("click", copyVocab);
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanVideos });
    renderTracks(res && res.result ? res.result : []);
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — try a regular video page (some sites block scripts).";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function renderTracks(videos) {
  const card = $("tracksCard"), box = $("tracks");
  box.innerHTML = "";
  const total = videos.reduce((a, v) => a + v.tracks.length, 0);
  card.hidden = total === 0;
  if (!total) {
    $("empty").style.display = "";
    $("empty").innerHTML = "No <b>video</b> or caption tracks found on this page.<br>Some sites render captions with custom players — those can’t be read.";
    return;
  }
  $("empty").style.display = "none";
  for (const v of videos) {
    for (const t of v.tracks) {
      const row = document.createElement("div");
      row.className = "track";
      const ti = document.createElement("div"); ti.className = "ti";
      const b = document.createElement("b"); b.textContent = t.label; b.title = t.label;
      const chips = document.createElement("div"); chips.className = "chips";
      const lang = document.createElement("span"); lang.className = "chip"; lang.textContent = t.language;
      const kind = document.createElement("span"); kind.className = "chip gray"; kind.textContent = t.kind;
      chips.append(lang, kind);
      ti.append(b, chips);
      const btn = document.createElement("button");
      btn.textContent = "Extract";
      btn.addEventListener("click", () => extract(v.index, t.index, t.label));
      row.append(ti, btn);
      box.appendChild(row);
    }
  }
}

async function extract(videoIndex, trackIndex, label) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: extractCues, args: [videoIndex, trackIndex],
    });
    cues = (res && res.result ? res.result : []).filter((c, i, a) =>
      i === 0 || c.text !== a[i - 1].text // drop repeated captions
    );
    trackLabel = label;
    if (!cues.length) {
      $("empty").style.display = "";
      $("empty").innerHTML = "This track has no readable cues right now — captions may not be loaded yet. Try playing the video briefly, then Extract again.";
      return;
    }
    renderCaptions();
    renderVocab();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").textContent = "Extraction failed on this page.";
  }
}

function srtTime(s) {
  const p = (n, l) => String(n).padStart(l === undefined ? 2 : l, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(Math.floor(s % 60))},${p(Math.round((s % 1) * 1000), 3)}`;
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderCaptions() {
  $("empty").style.display = "none";
  $("capsCard").hidden = false;
  $("capsTitle").textContent = "Captions — " + trackLabel;
  const dur = cues.length ? cues[cues.length - 1].end - cues[0].start : 0;
  $("capsMeta").textContent = `${cues.length} cues · ~${Math.round(dur / 60)} min of dialogue`;
  const box = $("capsList");
  box.innerHTML = "";
  for (const c of cues.slice(0, 200)) {
    const div = document.createElement("div");
    div.className = "cue";
    const time = document.createElement("time");
    time.textContent = srtTime(c.start).slice(3, 8);
    const span = document.createElement("span");
    span.textContent = c.text;
    div.append(time, span);
    box.appendChild(div);
  }
  if (cues.length > 200) {
    const more = document.createElement("div");
    more.className = "meta";
    more.textContent = `…and ${cues.length - 200} more (included in export)`;
    box.appendChild(more);
  }
}

function download(name, text, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function exportSrt() {
  if (!cues.length) return;
  const srt = cues.map((c, i) =>
    `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`
  ).join("\n");
  download("captions.srt", "﻿" + srt, "text/plain;charset=utf-8");
}

function copyPlain() {
  if (!cues.length) return;
  navigator.clipboard.writeText(cues.map((c) => c.text).join("\n"));
  $("copyTxt").textContent = "Copied!";
  setTimeout(() => { $("copyTxt").textContent = "Copy text"; }, 1500);
}

function wordFreq() {
  const counts = new Map();
  const text = cues.map((c) => c.text).join(" ").toLowerCase();
  const words = text.match(/[a-zà-ÿā-ž\u0400-\u04ff]+/gi) || [];
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 40);
}

function renderVocab() {
  const list = wordFreq();
  const card = $("vocabCard"), box = $("vocab");
  box.innerHTML = "";
  card.hidden = list.length === 0;
  if (!list.length) return;
  const max = list[0][1];
  for (const [w, n] of list) {
    const row = document.createElement("div");
    row.className = "vrow";
    const word = document.createElement("div"); word.className = "w"; word.textContent = w; word.title = w;
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("i"); fill.style.width = Math.max(6, (n / max) * 100) + "%";
    bar.appendChild(fill);
    const cnt = document.createElement("div"); cnt.className = "c"; cnt.textContent = n;
    row.append(word, bar, cnt);
    box.appendChild(row);
  }
}

function copyVocab() {
  const list = wordFreq();
  if (!list.length) return;
  navigator.clipboard.writeText(list.map(([w, n]) => `${w} — ${n}×`).join("\n"));
  $("copyVocab").textContent = "Copied!";
  setTimeout(() => { $("copyVocab").textContent = "Copy list"; }, 1500);
}
