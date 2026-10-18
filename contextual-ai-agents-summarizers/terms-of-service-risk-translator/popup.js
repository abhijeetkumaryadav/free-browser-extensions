// Terms of Service Risk Translator — heuristic clause scanner.
// All scanning happens on-device; no network, no storage. Not legal advice.

const PATTERNS = [
  {
    id: "arbitration", severity: "high", title: "Binding arbitration clause",
    regexes: [/binding\s+arbitration/i, /arbitrat\w*\s+(?:any|all)\s+disput/i, /individual\s+arbitration/i],
    plain: "If you have a dispute, you can't take them to court — a private arbitrator decides instead. This usually limits your options and the public record of the case.",
  },
  {
    id: "class-waiver", severity: "high", title: "Class-action / jury waiver",
    regexes: [/class\s+action/i, /waiv\w*\s+(?:the\s+)?right\s+to\s+(?:a\s+)?jury/i, /no\s+class\s+(?:action|lawsuit)/i, /jury\s+trial\s+waiv/i],
    plain: "You give up the right to join others in a class-action lawsuit or have a jury decide your case. Large-scale wrongdoing becomes harder to challenge.",
  },
  {
    id: "data-sale", severity: "high", title: "Data sharing or sale",
    regexes: [/sell\w*\s+(?:your\s+|user\s+)?(?:personal\s+)?(?:data|information)/i, /share\w*\s+(?:your\s+)?personal\s+(?:data|information)/i, /third[\s-]?part\w*\s+(?:advertis|market|partner)/i, /monetiz\w*\s+(?:your\s+)?data/i],
    plain: "They may share or sell your personal data with third parties, including advertisers. Check what data is included and whether you can opt out.",
  },
  {
    id: "termination", severity: "med", title: "Unilateral termination",
    regexes: [/terminat\w*\s+(?:your\s+)?account\s+(?:at\s+)?(?:our\s+)?(?:sole\s+)?discretion/i, /suspend\w*\s+or\s+terminat/i, /terminat\w*\s+(?:at\s+any\s+time|without\s+(?:prior\s+)?notice)/i],
    plain: "They can suspend or delete your account at any time, possibly without warning — including any content, credits, or purchases tied to it.",
  },
  {
    id: "auto-renew", severity: "med", title: "Auto-renewal / recurring billing",
    regexes: [/auto[\s-]?renew/i, /recurring\s+(?:billing|charge|payment)/i, /automatically\s+charg/i, /subscription\s+will\s+renew/i],
    plain: "Paid plans renew automatically and you'll be charged again unless you cancel in time. Check how and when you can cancel.",
  },
  {
    id: "liability", severity: "med", title: "Liability limitation",
    regexes: [/limit\w*\s+(?:our|the\s+company'?s?)\s+liab/i, /(?:not|never)\s+liable/i, /"as\s+is"/i, /no\s+warrant/i, /consequential\s+(?:or\s+incidental\s+)?damages/i, /maximum\s+liability/i],
    plain: "Even if their service causes you harm or losses, what they owe you is capped — often at what you paid, or nothing. \"As is\" means no promises it works properly.",
  },
];

function excerpt(text, idx, matchLen, radius) {
  let start = Math.max(0, idx - radius);
  let end = Math.min(text.length, idx + matchLen + radius);
  // snap to sentence boundaries
  const before = text.lastIndexOf(".", idx);
  if (before > start - 60) start = before + 1;
  const after = text.indexOf(".", idx + matchLen);
  if (after !== -1 && after < end + 120) end = after + 1;
  let q = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (q.length > 420) q = q.slice(0, 417).trim() + "…";
  return (start > 0 ? "… " : "") + q + (end < text.length ? " …" : "");
}

function scan(text) {
  const flags = [];
  for (const p of PATTERNS) {
    const hits = [];
    for (const re of p.regexes) {
      const m = text.match(re);
      if (m && m.index !== undefined) hits.push({ idx: m.index, len: m[0].length });
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a.idx - b.idx);
    const first = hits[0];
    flags.push({
      id: p.id, severity: p.severity, title: p.title, plain: p.plain,
      quote: excerpt(text, first.idx, first.len, 140),
    });
  }
  return flags;
}

const $ = (id) => document.getElementById(id);
let lastFlags = [];

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", onScan);
  $("clear").addEventListener("click", () => {
    $("input").value = "";
    $("results").hidden = true;
  });
  $("copy").addEventListener("click", () => {
    const lines = ["Terms of Service risk report (heuristic scan — not legal advice)", ""];
    for (const f of lastFlags) {
      lines.push(`[${f.severity === "high" ? "HIGH" : "MEDIUM"}] ${f.title}`, f.plain, `"${f.quote}"`, "");
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  });
});

function onScan() {
  const text = $("input").value;
  const box = $("results"), rows = $("rows");
  rows.innerHTML = "";
  lastFlags = scan(text);
  box.hidden = false;
  const v = $("verdict");
  const high = lastFlags.filter((f) => f.severity === "high").length;
  if (!lastFlags.length) {
    v.className = "verdict ok";
    v.textContent = "✓ No common risk patterns detected — still read before agreeing.";
  } else if (high > 0) {
    v.className = "verdict bad";
    v.textContent = `⚠ ${lastFlags.length} risk flag${lastFlags.length === 1 ? "" : "s"} found (${high} high-severity)`;
  } else {
    v.className = "verdict warn";
    v.textContent = `⚠ ${lastFlags.length} medium-severity flag${lastFlags.length === 1 ? "" : "s"} found`;
  }
  for (const f of lastFlags) {
    const el = document.createElement("div");
    el.className = "flag";
    const fh = document.createElement("div");
    fh.className = "fh";
    const dot = document.createElement("div");
    dot.className = "dot " + (f.severity === "high" ? "high" : "med");
    const t = document.createElement("b");
    t.textContent = f.title;
    fh.append(dot, t);
    const plain = document.createElement("div");
    plain.className = "plain";
    plain.textContent = f.plain;
    const quote = document.createElement("div");
    quote.className = "quote";
    quote.textContent = "“" + f.quote + "”";
    el.append(fh, plain, quote);
    rows.appendChild(el);
  }
}
