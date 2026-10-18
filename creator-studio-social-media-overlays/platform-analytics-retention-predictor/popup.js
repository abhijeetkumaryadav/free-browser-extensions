/* Retention Curve Predictor — heuristic estimator. Parses pasted points, fits an
   exponential decay curve, detects steep drop-offs, and suggests hook/chapter
   placement. Clearly labeled as an estimate; reads no analytics account. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ACCENT = '#10b981', DATA_C = '#7dd3fc', DROP_C = '#f87171';

  // ---------- Parsing ----------
  // Accepts "mm:ss", "hh:mm:ss", or plain seconds for times, and lines like:
  //   0:30 82%   ·   30,82   ·   1:00 — 74%   ·   90 68
  function parseTime(s) {
    s = s.trim();
    let m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
    if (m) return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
    m = s.match(/^(\d+(?:\.\d+)?)$/);
    return m ? +m[1] : NaN;
  }
  function parseLines(text) {
    const pts = [], bad = [];
    text.split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const m = line.match(/^(.+?)\s*[,;|—–-]?\s*(\d+(?:\.\d+)?)\s*%?\s*$/);
      if (!m) { bad.push(i + 1); return; }
      const t = parseTime(m[1]), r = parseFloat(m[2]);
      if (isNaN(t) || t < 0 || isNaN(r)) { bad.push(i + 1); return; }
      pts.push({ t, r: Math.min(100, Math.max(0, r)) });
    });
    pts.sort((a, b) => a.t - b.t);
    // Dedupe identical timestamps (keep last).
    const out = [];
    pts.forEach(p => {
      const last = out[out.length - 1];
      if (last && Math.abs(last.t - p.t) < 1e-6) out[out.length - 1] = p; else out.push(p);
    });
    return { pts: out, bad };
  }
  function fmtT(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
  }

  // ---------- Curve fitting (exponential decay on log scale) ----------
  function fitDecay(pts) {
    const valid = pts.filter(p => p.r > 0.5);
    if (valid.length < 3) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    valid.forEach(p => { const y = Math.log(p.r); sx += p.t; sy += y; sxx += p.t * p.t; sxy += p.t * y; });
    const n = valid.length, den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return null;
    const b = -(n * sxy - sx * sy) / den;                 // decay rate (positive = decay)
    const a = Math.exp((sy + b * sx) / n);
    // R² on log scale
    const mean = sy / n;
    let ssTot = 0, ssRes = 0;
    valid.forEach(p => {
      const y = Math.log(p.r), f = Math.log(a) - b * p.t;
      ssTot += (y - mean) * (y - mean); ssRes += (y - f) * (y - f);
    });
    return { a, b, r2: ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0 };
  }

  // ---------- Drop-off detection ----------
  // Smooth with a moving average, then find the steepest local declines.
  function detectDrops(pts, duration) {
    if (pts.length < 4) return [];
    const sm = pts.map((p, i) => {
      const lo = Math.max(0, i - 1), hi = Math.min(pts.length - 1, i + 1);
      let s = 0; for (let j = lo; j <= hi; j++) s += pts[j].r;
      return { t: p.t, r: s / (hi - lo + 1) };
    });
    const cands = [];
    for (let i = 1; i < sm.length; i++) {
      const drop = sm[i - 1].r - sm[i].r;
      const dt = Math.max(1, sm[i].t - sm[i - 1].t);
      if (drop > 0.5) cands.push({ t: sm[i].t, drop, rate: drop / dt, before: sm[i - 1].r, after: sm[i].r });
    }
    cands.sort((x, y) => y.drop - x.drop);
    // Keep top drops, spaced apart so they are distinct moments.
    const minGap = Math.max(15, duration / 25), picked = [];
    for (const c of cands) {
      if (picked.length >= 3) break;
      if (picked.every(p => Math.abs(p.t - c.t) >= minGap)) picked.push(c);
    }
    return picked.sort((a, b) => a.t - b.t);
  }

  // ---------- Chart ----------
  function drawChart(pts, fit, drops, duration) {
    const cv = $('chart'), dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padL = 34, padR = 8, padT = 10, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    const xMax = Math.max(duration, ...pts.map(p => p.t)) * 1.02;
    const x = t => padL + (t / xMax) * iw;
    const y = r => padT + (1 - r / 100) * ih;

    c.strokeStyle = 'rgba(255,255,255,.08)'; c.fillStyle = '#9a9aa8';
    c.font = '10px system-ui'; c.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(v => {
      c.beginPath(); c.moveTo(padL, y(v)); c.lineTo(W - padR, y(v)); c.stroke();
      c.fillText(v + '%', 4, y(v) + 3);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(f => c.fillText(fmtT(xMax * f), x(xMax * f) - 12, H - 6));

    // Fitted decay curve
    if (fit) {
      c.strokeStyle = ACCENT; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * xMax, r = Math.min(100, fit.a * Math.exp(-fit.b * t));
        i ? c.lineTo(x(t), y(r)) : c.moveTo(x(t), y(r));
      }
      c.stroke(); c.lineWidth = 1;
    }
    // Data points + polyline
    c.strokeStyle = DATA_C; c.globalAlpha = 0.55; c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(x(p.t), y(p.r)) : c.moveTo(x(p.t), y(p.r)));
    c.stroke(); c.globalAlpha = 1;
    c.fillStyle = DATA_C;
    pts.forEach(p => { c.beginPath(); c.arc(x(p.t), y(p.r), 2.5, 0, 7); c.fill(); });
    // Drop-off markers
    drops.forEach(d => {
      const px = x(d.t), py = y(d.after);
      c.strokeStyle = DROP_C; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ih); c.stroke(); c.setLineDash([]);
      c.fillStyle = DROP_C;
      c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
      c.fillText(fmtT(d.t), Math.min(px + 5, W - 40), padT + 10);
    });
  }

  // ---------- Suggestions (heuristic, labeled as such) ----------
  function buildTips(drops, fit, duration, pts) {
    const tips = [];
    drops.forEach((d, i) => {
      const frac = d.t / duration, sev = d.drop >= 8 ? 'strong' : 'noticeable';
      let what;
      if (frac < 0.08) what = 'Viewers are leaving almost immediately — <b>front-load the payoff</b>: state the outcome in the first 10 seconds, then rewind to explain.';
      else if (frac < 0.35) what = 'Early-exit zone — insert a <b>pattern interrupt</b> (camera angle change, on-screen text, open loop) about 15–20s before ' + fmtT(d.t) + '.';
      else if (frac < 0.7) what = 'Mid-video dip — add a <b>chapter marker</b> at ' + fmtT(d.t) + ' and tease what comes next right before it ("in a minute I\'ll show…").';
      else what = 'Late dip — <b>tighten the outro</b>: move the CTA earlier and cut filler after ' + fmtT(d.t) + '.';
      tips.push('<b>Drop-off ' + (i + 1) + ' at ' + fmtT(d.t) + '</b> (−' + d.drop.toFixed(1) + ' pts, ' + sev + '): ' + what);
    });
    if (fit) {
      if (fit.b * duration > 1.2) tips.push('The fitted decay is <b>steep</b> (curve loses most viewers early) — re-hook every 60–90 seconds in the first third.');
      else if (fit.b * duration < 0.35) tips.push('The fitted decay is <b>shallow</b> — retention holds well; protect the intro, it is doing the heavy lifting.');
      tips.push('Predicted retention at the end of the video: <b>≈' + Math.max(1, Math.round(fit.a * Math.exp(-fit.b * duration))) + '%</b> (heuristic fit, R² = ' + fit.r2.toFixed(2) + ').');
    }
    if (!drops.length) tips.push('No sharp drop-offs detected in this data — the curve is smooth. Keep the current structure and test one variable at a time.');
    return tips;
  }

  // ---------- Sample data ----------
  $('sampleBtn').addEventListener('click', () => {
    $('duration').value = '8:00';
    $('data').value = [
      '0:00 100%', '0:15 88%', '0:30 81%', '0:45 79%', '1:00 74%', '1:30 71%',
      '2:00 66%', '2:30 64%', '3:00 58%', '3:20 49%', '3:40 47%', '4:00 45%',
      '4:30 44%', '5:00 40%', '5:30 39%', '6:00 35%', '6:30 34%', '7:00 30%', '7:30 28%', '8:00 25%'
    ].join('\n');
  });

  // ---------- Analyze ----------
  $('analyzeBtn').addEventListener('click', () => {
    const durRaw = $('duration').value.trim();
    const duration = parseTime(durRaw);
    const note = $('parseNote');
    if (isNaN(duration) || duration <= 0) {
      note.textContent = 'Could not read the duration — use mm:ss (e.g. 10:00).';
      note.className = 'note warn'; note.classList.remove('hidden'); return;
    }
    const { pts, bad } = parseLines($('data').value);
    if (pts.length < 4) {
      note.textContent = 'Need at least 4 valid points, one per line like "1:30 74%".';
      note.className = 'note warn'; note.classList.remove('hidden'); return;
    }
    note.classList.add('hidden');

    const fit = fitDecay(pts);
    const drops = detectDrops(pts, duration);

    // Fit note
    $('fitNote').innerHTML = fit
      ? 'Exponential fit: R(t) ≈ ' + fit.a.toFixed(1) + '·e<sup>−' + fit.b.toFixed(4) + 't</sup>, R² = ' + fit.r2.toFixed(2) +
        ' — a heuristic smoothing of <b>your</b> data, not platform analytics.'
      : 'Not enough positive points for a decay fit — showing your data only.';

    // Drop list
    const box = $('drops'); box.innerHTML = '';
    if (!drops.length) box.innerHTML = '<div class="note">No sharp drop-offs found.</div>';
    drops.forEach(d => {
      const el = document.createElement('div');
      el.className = 'drop';
      el.innerHTML = '<span class="t">' + fmtT(d.t) + '</span><span class="d">−' + d.drop.toFixed(1) +
        ' pts (' + d.before.toFixed(0) + '% → ' + d.after.toFixed(0) + '%)</span>' +
        '<span class="badge ' + (d.drop >= 8 ? 'high' : 'med') + '">' + (d.drop >= 8 ? 'STEEP' : 'NOTICEABLE') + '</span>';
      box.appendChild(el);
    });

    // Tips
    const ul = $('tips'); ul.innerHTML = '';
    buildTips(drops, fit, duration, pts).forEach(t => {
      const li = document.createElement('li'); li.innerHTML = t; ul.appendChild(li);
    });

    $('results').classList.remove('hidden');
    requestAnimationFrame(() => drawChart(pts, fit, drops, duration));
  });
})();
