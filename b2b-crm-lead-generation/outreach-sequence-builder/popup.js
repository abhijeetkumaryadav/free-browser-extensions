// Outreach Sequence Builder — popup logic. All on-device via chrome.storage.local.
// Variables supported in templates: {firstName} {company} {title}

const $ = (id) => document.getElementById(id);
const VARS = ["firstName", "company", "title"];

let state = { sequences: [], activeId: null, editingStepId: null };
let sample = { firstName: "Ava", company: "Northwind", title: "Head of Sales" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const stored = await chrome.storage.local.get(["ob_state", "ob_sample"]);
  if (stored.ob_state && stored.ob_state.sequences) {
    state = stored.ob_state;
  } else {
    seed(); // first run: ship one example sequence so the UI isn't empty
  }
  if (stored.ob_sample) sample = { ...sample, ...stored.ob_sample };
  wire();
  renderAll();
}

function uid(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
}

function seed() {
  const seq = {
    id: uid("seq"),
    name: "SaaS Intro",
    steps: [
      { id: uid("st"), day: 1, channel: "email",
        template: "Hi {firstName},\n\nNoticed {company} is scaling fast. We help {title}s cut manual outreach time in half.\n\nWorth a 15-min chat this week?" },
      { id: uid("st"), day: 4, channel: "linkedin",
        template: "Hi {firstName} — sent a note about helping {company}'s sales team. Happy to share a 2-min overview if useful." },
      { id: uid("st"), day: 7, channel: "call",
        template: "Call {firstName}: ask about {company}'s current outreach process. Reference wins with other {title}s. Book a next step." },
    ],
  };
  state = { sequences: [seq], activeId: seq.id, editingStepId: null };
}

function save() {
  return chrome.storage.local.set({ ob_state: state });
}

function activeSeq() {
  return state.sequences.find((s) => s.id === state.activeId) || null;
}

function wire() {
  $("seqSelect").addEventListener("change", async (e) => {
    state.activeId = e.target.value;
    state.editingStepId = null;
    await save(); renderAll();
  });
  $("newSeq").addEventListener("click", async () => {
    const name = prompt("Name for the new sequence:", "New Sequence");
    if (!name) return;
    const seq = { id: uid("seq"), name: name.trim().slice(0, 60), steps: [] };
    state.sequences.unshift(seq);
    state.activeId = seq.id; state.editingStepId = null;
    await save(); renderAll();
  });
  $("delSeq").addEventListener("click", async () => {
    const seq = activeSeq();
    if (!seq) return;
    if (!confirm(`Delete sequence "${seq.name}"?`)) return;
    state.sequences = state.sequences.filter((s) => s.id !== seq.id);
    state.activeId = state.sequences[0] ? state.sequences[0].id : null;
    state.editingStepId = null;
    await save(); renderAll();
  });
  $("saveStep").addEventListener("click", saveStep);
  $("copyAll").addEventListener("click", copyAll);
  for (const v of VARS) {
    const el = $({ firstName: "sFirst", company: "sCompany", title: "sTitle" }[v]);
    el.value = sample[v];
    el.addEventListener("input", () => {
      sample[v] = el.value;
      chrome.storage.local.set({ ob_sample: sample });
      renderPreview();
    });
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function substitute(tpl) {
  return tpl.replace(/\{(firstName|company|title)\}/g, (m, k) => sample[k] || m);
}

function renderAll() {
  renderSeqBar(); renderSteps(); renderPreview();
}

function renderSeqBar() {
  const sel = $("seqSelect");
  sel.innerHTML = "";
  for (const s of state.sequences) {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  }
  if (state.activeId) sel.value = state.activeId;
}

function sortedSteps(seq) {
  return [...seq.steps].sort((a, b) => a.day - b.day);
}

function renderSteps() {
  const seq = activeSeq();
  const box = $("steps");
  box.innerHTML = "";
  if (!seq) { box.innerHTML = '<div class="empty-steps">Create a sequence to add steps.</div>'; $("stepCount").textContent = ""; return; }
  const steps = sortedSteps(seq);
  $("stepCount").textContent = steps.length ? `(${steps.length})` : "";
  if (!steps.length) box.innerHTML = '<div class="empty-steps">No steps yet — add the first one below.</div>';
  for (const st of steps) {
    const el = document.createElement("div");
    el.className = "step";
    const meta = document.createElement("div");
    meta.className = "meta";
    const day = document.createElement("span"); day.className = "day"; day.textContent = "Day " + st.day;
    const chan = document.createElement("span"); chan.className = "chan"; chan.textContent = st.channel;
    const sp = document.createElement("span"); sp.className = "sp";
    const edit = document.createElement("button"); edit.className = "iconbtn"; edit.textContent = "✎"; edit.title = "Edit step";
    edit.addEventListener("click", () => loadStepIntoForm(st));
    const copy = document.createElement("button"); copy.className = "iconbtn"; copy.textContent = "⧉"; copy.title = "Copy step (filled in)";
    copy.addEventListener("click", () => copyText(formatStep(seq, st, true), copy));
    const del = document.createElement("button"); del.className = "iconbtn"; del.textContent = "×"; del.title = "Delete step";
    del.addEventListener("click", async () => {
      seq.steps = seq.steps.filter((x) => x.id !== st.id);
      await save(); renderSteps(); renderPreview();
    });
    meta.append(day, chan, sp, edit, copy, del);
    const tpl = document.createElement("div");
    tpl.className = "tpl"; tpl.textContent = st.template;
    el.append(meta, tpl);
    box.appendChild(el);
  }
}

function loadStepIntoForm(st) {
  $("fDay").value = st.day;
  $("fChannel").value = st.channel;
  $("fTemplate").value = st.template;
  state.editingStepId = st.id;
  $("saveStep").textContent = "Save step";
  $("fTemplate").focus();
}

async function saveStep() {
  const seq = activeSeq();
  if (!seq) return;
  const tpl = $("fTemplate").value.trim();
  if (!tpl) { $("fTemplate").focus(); return; }
  const day = Math.max(0, Math.min(365, parseInt($("fDay").value, 10) || 0));
  const channel = $("fChannel").value;
  if (state.editingStepId) {
    const st = seq.steps.find((x) => x.id === state.editingStepId);
    if (st) { st.day = day; st.channel = channel; st.template = tpl; }
    state.editingStepId = null;
    $("saveStep").textContent = "Add step";
  } else {
    seq.steps.push({ id: uid("st"), day, channel, template: tpl });
  }
  $("fTemplate").value = "";
  await save(); renderSteps(); renderPreview();
}

function formatStep(seq, st, filled) {
  const body = filled ? substitute(st.template) : st.template;
  return `Day ${st.day} · ${st.channel[0].toUpperCase() + st.channel.slice(1)}\n${body}`;
}

function formatSequence(seq, filled) {
  return `# ${seq.name}\n\n` + sortedSteps(seq).map((st) => formatStep(seq, st, filled)).join("\n\n---\n\n");
}

async function copyText(text, btn) {
  const done = () => {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = "✓"; btn.style.color = "#f97350";
    setTimeout(() => { btn.textContent = orig; btn.style.color = ""; }, 1200);
  };
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (err) {}
    ta.remove();
  }
  done();
}

async function copyAll() {
  const seq = activeSeq();
  if (!seq || !seq.steps.length) return;
  await copyText(formatSequence(seq, true), $("copyAll"));
}

function renderPreview() {
  const seq = activeSeq();
  const box = $("preview");
  box.innerHTML = "";
  if (!seq || !seq.steps.length) {
    box.innerHTML = '<div class="empty-steps">Add steps to see the filled-in preview.</div>';
    return;
  }
  for (const st of sortedSteps(seq)) {
    const el = document.createElement("div");
    el.className = "pv";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Day ${st.day} · ${st.channel}`;
    const body = document.createElement("div");
    body.className = "body"; body.textContent = substitute(st.template);
    el.append(meta, body);
    box.appendChild(el);
  }
}
