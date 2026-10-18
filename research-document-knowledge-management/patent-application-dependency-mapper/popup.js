/* ClaimGraph — on-device patent claim dependency parser + canvas graph renderer.
   No network, no tracking. Only chrome.storage (persists the last input text). */
(function () {
  "use strict";

  /* ---------- DOM refs ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var input = $("claimsInput"), mapBtn = $("mapBtn"), sampleBtn = $("sampleBtn"),
      clearBtn = $("clearBtn"), inputPanel = $("inputPanel"), resultPanel = $("resultPanel"),
      canvas = $("graph"), backBtn = $("backBtn"), resetSelBtn = $("resetSelBtn"),
      detailCard = $("detailCard"), danglingBox = $("danglingBox"), footCount = $("footCount");

  /* ---------- state ---------- */
  var graph = null;      // { claims: Map<num, {num,text,deps:Set,dependents:Set}>, dangling: [...] }
  var selected = null;   // selected claim number
  var nodePos = [];      // [{num, x, y}] in CSS pixels

  var CSS_W = 348, NODE_W = 58, NODE_H = 34, LAYER_H = 68, PAD_TOP = 26;

  var SAMPLE = [
    "1. A fastening device comprising a base plate and a latch member pivotally attached to the base plate.",
    "2. The fastening device of claim 1, wherein the latch member further comprises a spring biasing element.",
    "3. The fastening device of claim 2, wherein the spring biasing element is a torsion spring.",
    "4. A system comprising a housing and at least two fastening devices according to any of claims 1-3 mounted on the housing.",
    "5. The system of claim 4, further comprising a sensor configured to detect a state of the latch member.",
    "6. The system according to claims 4 and 5, wherein the housing is hermetically sealed."
  ].join("\n");

  /* ================================================================
     1. PARSING — split numbered claims, then extract claim references
     ================================================================ */

  // Split text into claims. A claim starts a line with: [Claim] N. or N)
  function splitClaims(text) {
    var claims = [];
    var current = null;
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*(?:claim\s+)?(\d+)\s*[.)]\s*(.*)$/i);
      if (m) {
        current = { num: parseInt(m[1], 10), text: (m[2] || "").trim() };
        claims.push(current);
      } else if (current && line.trim()) {
        current.text += " " + line.trim(); // continuation line
      }
    });
    return claims;
  }

  // Expand a reference segment like "1-3", "2, 5", "4 and 5", "1 to 3" into numbers.
  function expandSegment(seg) {
    var nums = new Set();
    seg = seg.replace(/[–—]/g, "-").replace(/\s+to\s+/gi, "-");
    var re = /(\d+)\s*-\s*(\d+)|(\d+)/g, m;
    while ((m = re.exec(seg))) {
      if (m[3] !== undefined) {
        nums.add(parseInt(m[3], 10));
      } else {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        var lo = Math.min(a, b), hi = Math.max(a, b);
        for (var n = lo; n <= hi && n <= lo + 200; n++) nums.add(n); // sanity cap
      }
    }
    return Array.from(nums);
  }

  // Find all "claim N" / "claims 1-3, 5" references in a claim's text.
  function findRefs(text) {
    var refs = new Set();
    var re = /\bclaims?\s+(\d[\d\s,\-–—]*(?:\s*(?:and|or|to)\s*\d[\d\s,\-–—]*)*)/gi, m;
    while ((m = re.exec(text))) {
      expandSegment(m[1]).forEach(function (n) { refs.add(n); });
    }
    return refs;
  }

  function buildGraph(text) {
    var list = splitClaims(text);
    var map = new Map(); // num -> node
    list.forEach(function (c) {
      if (!map.has(c.num)) map.set(c.num, { num: c.num, text: c.text, deps: new Set(), dependents: new Set() });
      else map.get(c.num).text += " " + c.text; // merge duplicate numbers
    });
    var dangling = new Set();
    map.forEach(function (node) {
      findRefs(node.text).forEach(function (r) {
        if (r === node.num) return; // ignore self-reference
        if (map.has(r)) {
          node.deps.add(r);
          map.get(r).dependents.add(node.num);
        } else {
          dangling.add(r);
        }
      });
    });
    return { claims: map, dangling: Array.from(dangling).sort(function (a, b) { return a - b; }) };
  }

  /* ================================================================
     2. LAYOUT — depth layers (0 = independent, top), even spacing
     ================================================================ */

  function depthOf(node, g, memo) {
    if (memo.has(node.num)) return memo.get(node.num);
    memo.set(node.num, -1); // cycle guard
    var d = 0;
    node.deps.forEach(function (r) {
      var dep = g.claims.get(r);
      if (dep) d = Math.max(d, depthOf(dep, g, memo) + 1);
    });
    memo.set(node.num, d);
    return d;
  }

  function layout(g) {
    var memo = new Map(), layers = new Map(), maxDepth = 0;
    g.claims.forEach(function (node) {
      var d = depthOf(node, g, memo);
      maxDepth = Math.max(maxDepth, d);
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d).push(node.num);
    });
    nodePos = [];
    var h = PAD_TOP * 2 + (maxDepth + 1) * LAYER_H;
    canvas.height = Math.max(220, h);
    layers.forEach(function (nums, d) {
      nums.sort(function (a, b) { return a - b; });
      var y = PAD_TOP + d * LAYER_H;
      nums.forEach(function (num, i) {
        var x = CSS_W * (i + 1) / (nums.length + 1);
        nodePos.push({ num: num, x: x, y: y });
      });
    });
    return maxDepth;
  }

  function nodeByNum(num) {
    for (var i = 0; i < nodePos.length; i++) if (nodePos[i].num === num) return nodePos[i];
    return null;
  }

  /* ================================================================
     3. RENDERING
     ================================================================ */

  // Full transitive chain of a claim: itself + all ancestors + all descendants.
  function chainOf(g, num) {
    var seen = new Set([num]), stack = [num];
    var start = g.claims.get(num);
    if (!start) return seen;
    while (stack.length) {
      var n = g.claims.get(stack.pop());
      n.deps.forEach(function (r) { if (!seen.has(r)) { seen.add(r); stack.push(r); } });
      n.dependents.forEach(function (r) { if (!seen.has(r)) { seen.add(r); stack.push(r); } });
    }
    return seen;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    var cw = CSS_W, ch = canvas.height;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    canvas.style.height = ch + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    var chain = selected != null ? chainOf(graph, selected) : null;

    // edges (dependent -> its dependencies), drawn first
    graph.claims.forEach(function (node) {
      var from = nodeByNum(node.num);
      node.deps.forEach(function (r) {
        var to = nodeByNum(r);
        if (!from || !to) return;
        var inChain = !chain || (chain.has(node.num) && chain.has(r));
        ctx.strokeStyle = inChain ? "rgba(160,165,255,0.75)" : "rgba(255,255,255,0.10)";
        ctx.lineWidth = inChain ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y - NODE_H / 2);
        ctx.bezierCurveTo(from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2, to.x, to.y + NODE_H / 2);
        ctx.stroke();
        // arrowhead at the dependency end
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y + NODE_H / 2 + 5);
        ctx.lineTo(to.x - 4, to.y + NODE_H / 2 - 1);
        ctx.lineTo(to.x + 4, to.y + NODE_H / 2 - 1);
        ctx.closePath(); ctx.fill();
      });
    });

    // nodes
    nodePos.forEach(function (p) {
      var node = graph.claims.get(p.num);
      var isIndep = node.deps.size === 0;
      var isSel = selected === p.num;
      var dimmed = chain && !chain.has(p.num);
      var x = p.x - NODE_W / 2, y = p.y - NODE_H / 2;

      ctx.globalAlpha = dimmed ? 0.28 : 1;
      if (isSel) { ctx.shadowColor = "#6366f1"; ctx.shadowBlur = 14; }
      roundRect(ctx, x, y, NODE_W, NODE_H, 9);
      ctx.fillStyle = isIndep ? "rgba(52,211,153,0.18)" : "rgba(99,102,241,0.18)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = isSel ? 2.4 : 1.4;
      ctx.strokeStyle = isSel ? "#ffffff" : (isIndep ? "#34d399" : "#818cf8");
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#ececf1";
      ctx.font = "600 12px -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("C" + p.num, p.x, p.y + 0.5);
    });
  }

  /* ================================================================
     4. UI wiring
     ================================================================ */

  function renderStats(g) {
    var total = g.claims.size, indep = 0;
    g.claims.forEach(function (n) { if (n.deps.size === 0) indep++; });
    $("statTotal").textContent = total;
    $("statIndep").textContent = indep;
    $("statDep").textContent = total - indep;
    $("statDangling").textContent = g.dangling.length;
    if (g.dangling.length) {
      danglingBox.classList.remove("hidden");
      $("danglingText").textContent = "References to claims not present in the text: " +
        g.dangling.map(function (n) { return "claim " + n; }).join(", ") + ".";
    } else danglingBox.classList.add("hidden");
    footCount.textContent = total + " claim" + (total === 1 ? "" : "s") + " mapped";
  }

  function showDetail(num) {
    var node = graph.claims.get(num);
    if (!node) return;
    $("detailTitle").textContent = "Claim " + num + (node.deps.size === 0 ? " — independent" : " — dependent");
    $("detailText").textContent = node.text.length > 220 ? node.text.slice(0, 220) + "…" : node.text;
    $("detailDeps").textContent = node.deps.size ? Array.from(node.deps).sort(function (a, b) { return a - b; }).map(function (n) { return "C" + n; }).join(", ") : "—";
    $("detailDependents").textContent = node.dependents.size ? Array.from(node.dependents).sort(function (a, b) { return a - b; }).map(function (n) { return "C" + n; }).join(", ") : "—";
    detailCard.classList.remove("hidden");
    resetSelBtn.classList.remove("hidden");
  }

  function mapNow() {
    var text = input.value.trim();
    if (!text) { input.focus(); return; }
    graph = buildGraph(text);
    if (graph.claims.size === 0) {
      input.focus();
      input.setAttribute("placeholder", "No numbered claims found — start each claim on its own line, e.g. “1. A device…”");
      return;
    }
    selected = null;
    detailCard.classList.add("hidden");
    resetSelBtn.classList.add("hidden");
    layout(graph);
    renderStats(graph);
    draw();
    inputPanel.classList.add("hidden");
    resultPanel.classList.remove("hidden");
    chrome.storage.local.set({ claimGraphInput: input.value });
  }

  canvas.addEventListener("click", function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var hit = null;
    nodePos.forEach(function (p) {
      if (Math.abs(mx - p.x) <= NODE_W / 2 + 4 && Math.abs(my - p.y) <= NODE_H / 2 + 4) hit = p.num;
    });
    if (hit != null) {
      selected = (selected === hit) ? null : hit; // toggle
      if (selected != null) showDetail(selected);
      else { detailCard.classList.add("hidden"); resetSelBtn.classList.add("hidden"); }
      draw();
    }
  });

  mapBtn.addEventListener("click", mapNow);
  sampleBtn.addEventListener("click", function () { input.value = SAMPLE; });
  clearBtn.addEventListener("click", function () { input.value = ""; input.focus(); });
  backBtn.addEventListener("click", function () {
    resultPanel.classList.add("hidden");
    inputPanel.classList.remove("hidden");
  });
  resetSelBtn.addEventListener("click", function () {
    selected = null;
    detailCard.classList.add("hidden");
    resetSelBtn.classList.add("hidden");
    draw();
  });

  // restore last input
  chrome.storage.local.get("claimGraphInput", function (r) {
    if (r.claimGraphInput) input.value = r.claimGraphInput;
  });

  window.addEventListener("resize", function () { if (graph) draw(); });
})();
