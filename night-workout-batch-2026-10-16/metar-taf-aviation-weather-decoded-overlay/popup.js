/* METAR/TAF Decoder — popup logic. Pure decode engine between markers. */
"use strict";

// ENGINE-START
const CLOUD_COVER = { FEW: "Few clouds (1-2 oktas)", SCT: "Scattered (3-4 oktas)", BKN: "Broken (5-7 oktas)", OVC: "Overcast (8 oktas)" };
const CLOUD_TYPE = { CB: "cumulonimbus", TCU: "towering cumulus" };

function splitTokens(text) {
  return text.trim().toUpperCase().split(/\s+/).filter(Boolean);
}

function parseTemp(val) {
  // "18", "M02" -> 18, -2 ; null on garbage
  const m = /^M?(\d{1,2})$/.exec(val);
  if (!m) return null;
  return val[0] === "M" ? -parseInt(m[1], 10) : parseInt(m[1], 10);
}

function decodeWind(tok) {
  // "27012G22KT", "VRB03KT", "27012MPS", "00000KT"
  const m = /^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS|KMH)$/.exec(tok);
  if (!m) return null;
  const dir = m[1] === "VRB" ? "variable direction" : m[1] + "°";
  const spd = parseInt(m[2], 10);
  const gust = m[4] ? ", gusting " + parseInt(m[4], 10) : "";
  const unit = m[5] === "KT" ? "kt" : m[5] === "MPS" ? "m/s" : "km/h";
  return "Wind " + dir + " at " + spd + " " + unit + gust;
}

function decodeVis(tok) {
  // "9999", "5000", "1/2SM", "10SM", "CAVOK"
  if (tok === "CAVOK") return "Ceiling and visibility OK (10+ km, no cloud below 5000 ft)";
  if (tok === "P6SM") return "Visibility more than 6 statute miles";
  let m = /^(\d+)$/.exec(tok);
  if (m) {
    const n = parseInt(m[1], 10);
    return n >= 9999 ? "Visibility 10 km or more" : "Visibility " + n + " m";
  }
  m = /^(\d+\/\d+|\d+(?:\s?\d+\/\d+)?)SM$/.exec(tok);
  if (m) return "Visibility " + m[1] + " statute miles";
  return null;
}

function decodeCloud(tok) {
  // "FEW035", "BKN012CB", "VV008", "CLR", "SKC", "NSC"
  if (tok === "CLR" || tok === "SKC") return "Sky clear";
  if (tok === "NSC") return "No significant cloud";
  let m = /^(VV)(\d{3})$/.exec(tok);
  if (m) return "Vertical visibility " + parseInt(m[2], 10) * 100 + " ft (indefinite ceiling)";
  m = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/.exec(tok);
  if (!m) return null;
  let s = CLOUD_COVER[m[1]] + " at " + parseInt(m[2], 10) * 100 + " ft";
  if (m[3]) s += " — " + CLOUD_TYPE[m[3]];
  return s;
}

function decodeTempDew(tok) {
  const m = /^(M?\d{1,2})\/(M?\d{1,2})$/.exec(tok);
  if (!m) return null;
  const t = parseTemp(m[1]), d = parseTemp(m[2]);
  if (t === null || d === null) return null;
  return "Temperature " + t + "°C, dew point " + d + "°C";
}

function decodePressure(tok) {
  // "Q1013", "A2992"
  let m = /^Q(\d{3,4})$/.exec(tok);
  if (m) return "QNH " + parseInt(m[1], 10) + " hPa";
  m = /^A(\d{4})$/.exec(tok);
  if (m) return "Altimeter " + m[1].slice(0, 2) + "." + m[1].slice(2) + " inHg";
  return null;
}

function decodeTime(tok) {
  // "161450Z" -> day 16, 14:50 UTC
  const m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(tok);
  if (!m) return null;
  return "Day " + m[1] + " at " + m[2] + ":" + m[3] + " UTC";
}

// A small set of common weather phenomenon codes.
const WX_CODES = {
  "-DZ": "light drizzle", DZ: "drizzle", "+DZ": "heavy drizzle",
  "-RA": "light rain", RA: "rain", "+RA": "heavy rain",
  "-SHRA": "light rain showers", SHRA: "rain showers", "+SHRA": "heavy rain showers",
  "-TSRA": "light thunderstorm w/ rain", TSRA: "thunderstorm with rain", "+TSRA": "heavy thunderstorm with rain",
  TS: "thunderstorm", "-SN": "light snow", SN: "snow", "+SN": "heavy snow",
  BR: "mist", FG: "fog", HZ: "haze", FU: "smoke", DU: "dust",
  SQ: "squalls", FC: "funnel cloud", GR: "hail", GS: "small hail",
  VCTS: "thunderstorm in vicinity", VCSH: "showers in vicinity", VCBRA: "mist in vicinity"
};

function decodeWx(tok) {
  return WX_CODES[tok] || null;
}

// Detect METAR vs TAF and produce a list of decoded items.
function decodeReport(text) {
  const toks = splitTokens(text);
  if (toks.length === 0) return { kind: null, items: [], error: "Paste a METAR or TAF first." };
  let i = 0;
  let kind = "REPORT";
  if (toks[0] === "METAR") { kind = "METAR"; i = 1; }
  else if (toks[0] === "TAF" || toks[0] === "TAF AMD" || toks[0] === "TAFAMD") { kind = "TAF"; i = 1; }
  const items = [];
  let station = null;
  // Station: 4 letters (ICAO), right after kind or at start.
  if (i < toks.length && /^[A-Z]{4}$/.test(toks[i])) { station = toks[i]; i++; }
  const decoded = new Set();
  for (; i < toks.length; i++) {
    const t = toks[i];
    if (/^(TEMPO|BECMG|FM\d{6}|PROB\d{2}|INTER|NOSIG)$/.test(t)) {
      items.push({ k: "Trend", v: t.replace("NOSIG", "No significant change").replace("TEMPO", "Temporary").replace("BECMG", "Becoming") });
      decoded.add(i); continue;
    }
    if (/^\d{6}Z$/.test(t) && !decoded.has("time")) { items.push({ k: "Observed", v: decodeTime(t) }); decoded.add("time"); continue; }
    if (/^\d{4}\/\d{4}$/.test(t)) { items.push({ k: "Valid", v: "Day " + t.slice(0, 2) + " " + t.slice(2, 4) + "Z to day " + t.slice(5, 7) + " " + t.slice(7) + "Z" }); decoded.add(i); continue; }
    let v = decodeWind(t);
    if (v && !decoded.has("wind")) { items.push({ k: "Wind", v }); decoded.add("wind"); continue; }
    v = decodeVis(t);
    if (v && !decoded.has("vis")) { items.push({ k: "Visibility", v }); decoded.add("vis"); continue; }
    v = decodeCloud(t);
    if (v) { items.push({ k: "Cloud", v }); decoded.add(i); continue; }
    v = decodeTempDew(t);
    if (v && !decoded.has("temp")) { items.push({ k: "Temp / dew", v }); decoded.add("temp"); continue; }
    v = decodePressure(t);
    if (v && !decoded.has("pres")) { items.push({ k: "Pressure", v }); decoded.add("pres"); continue; }
    v = decodeWx(t);
    if (v) { items.push({ k: "Weather", v }); decoded.add(i); continue; }
  }
  if (items.length === 0) return { kind, station, items: [], error: "Nothing recognizable — check the pasted text is a METAR or TAF." };
  return { kind, station, items, error: null };
}
// ENGINE-END

/* ---------- UI wiring ---------- */
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(res) {
  const out = document.getElementById("out");
  out.classList.remove("hidden");
  if (res.error) { out.innerHTML = '<p class="err">' + esc(res.error) + "</p>"; return; }
  let h = '<div class="kind">' + esc(res.kind) + (res.station ? ' <span class="sta">' + esc(res.station) + "</span>" : "") + "</div>";
  for (const it of res.items) {
    h += '<div class="item">' + ICON + '<span class="k">' + esc(it.k) + '</span><span class="v">' + esc(it.v) + "</span></div>";
  }
  out.innerHTML = h;
}

document.getElementById("decode").addEventListener("click", () => {
  const raw = document.getElementById("raw").value;
  chrome.storage.local.set({ lastRaw: raw });
  render(decodeReport(raw));
});
document.getElementById("clear").addEventListener("click", () => {
  document.getElementById("raw").value = "";
  const out = document.getElementById("out");
  out.classList.add("hidden"); out.innerHTML = "";
  chrome.storage.local.remove("lastRaw");
});
document.getElementById("raw").addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) document.getElementById("decode").click();
});
chrome.storage.local.get("lastRaw", d => { if (d.lastRaw) document.getElementById("raw").value = d.lastRaw; });
