// Niche Influencer Vetting Tool — popup logic.
// All stats are entered manually; everything runs on-device.
// Flags are heuristics benchmarked against public creator averages.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("vetBtn").addEventListener("click", runVetting);
  renderHistory();
}

const num = (id) => Math.max(0, parseFloat($(id).value) || 0);

function flag(sev, title, detail) {
  return { sev, title, detail }; // sev: low | med | high
}

function vet({ followers, likes, comments, rate }) {
  const flags = [];
  const engRate = followers > 0 ? ((likes + comments) / followers) * 100 : 0;
  const engPerPost = likes + comments;
  const cpe = engPerPost > 0 && rate > 0 ? rate / engPerPost : null;

  // 1. Engagement vs follower mismatch (classic bought-follower signal)
  if (followers >= 10000 && engRate < 0.5) {
    flags.push(flag("high", "Engagement far below audience size",
      `${engRate.toFixed(2)}% engagement on ${fmtK(followers)} followers is well under the ~1–3% healthy range — a classic bought-follower pattern.`));
  } else if (followers >= 10000 && engRate < 1) {
    flags.push(flag("med", "Engagement slightly soft for audience",
      `${engRate.toFixed(2)}% engagement is under the ~1–3% healthy range for ${fmtK(followers)} followers.`));
  } else if (engRate >= 1) {
    flags.push(flag("low", "Engagement matches audience size",
      `${engRate.toFixed(2)}% engagement is within a healthy range.`));
  }

  // 2. Like-to-comment ratio (bot likes produce very few comments)
  const ratio = comments > 0 ? likes / comments : Infinity;
  if (comments === 0 && likes > 0) {
    flags.push(flag("high", "No comments on liked posts",
      "Posts get likes but zero comments — a strong bot-engagement signal."));
  } else if (ratio > 200) {
    flags.push(flag("high", "Extreme like-to-comment ratio",
      `${Math.round(ratio)} likes per comment. Organic posts usually sit near 10–100:1.`));
  } else if (ratio > 100) {
    flags.push(flag("med", "High like-to-comment ratio",
      `${Math.round(ratio)} likes per comment — worth a scroll through their comments for authenticity.`));
  } else if (ratio < 2 && likes > 0) {
    flags.push(flag("med", "Unusually comment-heavy",
      `${ratio.toFixed(1)} likes per comment may indicate comment pods or giveaways inflating numbers.`));
  } else {
    flags.push(flag("low", "Natural like-to-comment balance",
      `${Math.round(ratio)} likes per comment looks organic.`));
  }

  // 3. Cost efficiency (rough benchmark: healthy CPE usually under ~2 units of currency)
  if (cpe != null) {
    if (cpe > 5) {
      flags.push(flag("high", "Expensive per engagement",
        `~${cpe.toFixed(2)} per like/comment is steep — compare against 2–3 similar creators before booking.`));
    } else if (cpe > 2) {
      flags.push(flag("med", "Above-average cost per engagement",
        `~${cpe.toFixed(2)} per like/comment. Negotiable if the audience is a perfect niche fit.`));
    } else {
      flags.push(flag("low", "Fair cost per engagement",
        `~${cpe.toFixed(2)} per like/comment is competitive.`));
    }
  } else {
    flags.push(flag("med", "No rate given",
      "Add their sponsored-post rate to check cost efficiency."));
  }

  // 4. Rate vs audience sanity (wildly cheap big accounts are often fake)
  if (rate > 0 && followers >= 50000 && rate < followers * 0.01) {
    flags.push(flag("med", "Suspiciously cheap for the reach",
      `A ${fmtK(followers)}-follower account charging under 1% of their follower count per post is unusual — verify audience quality.`));
  }

  const risk = flags.reduce((a, f) => a + (f.sev === "high" ? 3 : f.sev === "med" ? 1.5 : 0), 0);
  let verdict, cls;
  if (risk >= 6 || (followers >= 10000 && engRate < 0.5)) { verdict = "PASS"; cls = "pass"; }
  else if (risk >= 2.5) { verdict = "CAUTION"; cls = "caution"; }
  else { verdict = "PARTNER"; cls = "partner"; }

  return { engRate, cpe, risk, flags, verdict, cls };
}

function fmtK(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

async function runVetting() {
  const handle = $("fHandle").value.trim() || "Untitled creator";
  const data = {
    handle, platform: $("fPlatform").value,
    followers: num("fFollowers"), likes: num("fLikes"),
    comments: num("fComments"), rate: num("fRate"),
  };
  const r = vet(data);

  $("resultCard").hidden = false;
  const v = $("verdict");
  v.className = "verdict " + r.cls;
  v.textContent = r.verdict === "PARTNER" ? "✓ PARTNER" : r.verdict === "CAUTION" ? "! CAUTION" : "✕ PASS";
  $("mEng").textContent = r.engRate.toFixed(2) + "%";
  $("mCpe").textContent = r.cpe != null ? r.cpe.toFixed(2) : "—";
  $("mRisk").textContent = r.risk.toFixed(1) + " / 9";

  const box = $("flags"); box.innerHTML = "";
  for (const f of r.flags) {
    const row = document.createElement("div"); row.className = "flag";
    const sev = document.createElement("span"); sev.className = "sev " + f.sev;
    sev.textContent = f.sev === "low" ? "OK" : f.sev === "med" ? "WATCH" : "RISK";
    const p = document.createElement("p");
    const b = document.createElement("b"); b.textContent = f.title + " — ";
    p.append(b, document.createTextNode(f.detail));
    row.append(sev, p);
    box.appendChild(row);
  }

  // persist to history
  const { vetted = [] } = await chrome.storage.local.get("vetted");
  vetted.unshift({ ...data, verdict: r.verdict, cls: r.cls, engRate: r.engRate, at: Date.now() });
  await chrome.storage.local.set({ vetted: vetted.slice(0, 30) });
  renderHistory();
}

async function renderHistory() {
  const { vetted = [] } = await chrome.storage.local.get("vetted");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = !vetted.length;
  for (const v of vetted) {
    const row = document.createElement("div"); row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = v.handle; b.title = v.handle;
    const s = document.createElement("span");
    s.textContent = `${v.platform} · ${fmtK(v.followers)} followers · ${v.engRate.toFixed(2)}% eng.`;
    t.append(b, s);
    const pill = document.createElement("span"); pill.className = "pill " + v.cls;
    pill.textContent = v.verdict;
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { vetted: cur = [] } = await chrome.storage.local.get("vetted");
      await chrome.storage.local.set({ vetted: cur.filter((i) => i.at !== v.at) });
      renderHistory();
    });
    row.append(t, pill, x);
    box.appendChild(row);
  }
}
