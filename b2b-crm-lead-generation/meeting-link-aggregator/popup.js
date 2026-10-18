// Meeting Link Aggregator — popup logic.
// Meetings stored locally as [{id, title, link, at}]. Reminders fire
// through chrome.alarms scheduled by background.js on every save.

const $ = (id) => document.getElementById(id);
const REMIND_MIN = 10;   // notify this many minutes before a meeting
const SOON_MIN = 30;     // "starting soon" highlight window

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("toggleForm").addEventListener("click", () => { $("formCard").hidden = false; $("toggleForm").disabled = true; $("fTitle").focus(); });
  $("cancelBtn").addEventListener("click", hideForm);
  $("saveBtn").addEventListener("click", saveMeeting);
  // default the datetime field to the next hour
  const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  $("fWhen").value = toLocalInput(d);
  render();
  setInterval(render, 30000); // keep "starting soon" live
}

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hideForm() {
  $("formCard").hidden = true;
  $("toggleForm").disabled = false;
}

function normaliseLink(raw) {
  let l = raw.trim();
  if (!/^https?:\/\//i.test(l)) l = "https://" + l;
  try { new URL(l); return l; } catch (e) { return null; }
}

async function getMeetings() {
  const { meetings = [] } = await chrome.storage.local.get("meetings");
  return meetings;
}

async function saveMeeting() {
  const title = $("fTitle").value.trim();
  const link = normaliseLink($("fLink").value);
  const at = new Date($("fWhen").value).getTime();
  if (!title || !link || isNaN(at)) {
    [$("fTitle"), $("fLink"), $("fWhen")].forEach((el) => {
      el.style.borderColor = el.value.trim() ? "" : "#f06666";
    });
    return;
  }
  const meetings = await getMeetings();
  const meeting = { id: "m-" + Date.now(), title, link, at };
  meetings.push(meeting);
  await chrome.storage.local.set({ meetings: meetings.slice(0, 200) });
  // schedule a reminder alarm (past meetings get no alarm)
  const when = at - REMIND_MIN * 60000;
  if (when > Date.now()) {
    chrome.alarms.create(meeting.id, { when });
  }
  $("fTitle").value = ""; $("fLink").value = "";
  hideForm();
  render();
}

function fmtWhen(at) {
  const d = new Date(at), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tmr = new Date(now); tmr.setDate(tmr.getDate() + 1);
  const opts = { hour: "numeric", minute: "2-digit" };
  let day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (sameDay) day = "Today";
  else if (d.toDateString() === tmr.toDateString()) day = "Tomorrow";
  return `${day}, ${d.toLocaleTimeString(undefined, opts)}`;
}

function countdown(at) {
  const mins = Math.round((at - Date.now()) / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `in ${h}h${m ? " " + m + "m" : ""}`;
}

async function render() {
  const meetings = await getMeetings();
  const now = Date.now();
  const up = meetings.filter((m) => m.at >= now - 5 * 60000).sort((a, b) => a.at - b.at);
  const past = meetings.filter((m) => m.at < now - 5 * 60000).sort((a, b) => b.at - a.at);

  $("empty").style.display = meetings.length ? "none" : "";
  $("upCard").hidden = !up.length;
  $("pastCard").hidden = !past.length;

  const mk = (m, isPast) => {
    const row = document.createElement("div");
    const soon = !isPast && m.at - now < SOON_MIN * 60000 && m.at - now > -5 * 60000;
    row.className = "meet" + (soon ? " soon" : "") + (isPast ? " pastm" : "");
    const info = document.createElement("div"); info.className = "info";
    const b = document.createElement("b"); b.textContent = m.title; b.title = m.title;
    const s = document.createElement("span");
    s.textContent = isPast ? fmtWhen(m.at) : `${fmtWhen(m.at)} · ${soon ? "Starting soon" : countdown(m.at)}`;
    info.append(b, s);
    const join = document.createElement("button"); join.className = "join"; join.textContent = "Join";
    join.addEventListener("click", () => chrome.tabs.create({ url: m.link }));
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.title = "Delete";
    x.addEventListener("click", async () => {
      const cur = await getMeetings();
      await chrome.storage.local.set({ meetings: cur.filter((i) => i.id !== m.id) });
      render();
    });
    row.append(info, join, x);
    return row;
  };

  const ub = $("upcoming"); ub.innerHTML = "";
  up.forEach((m) => ub.appendChild(mk(m, false)));
  const pb = $("past"); pb.innerHTML = "";
  past.slice(0, 20).forEach((m) => pb.appendChild(mk(m, true)));
}
