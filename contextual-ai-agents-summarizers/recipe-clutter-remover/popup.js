// Recipe Clutter Remover — popup logic.
// extractRecipe() is injected into the page; it must stay self-contained.

function extractRecipe() {
  var S = function (v) { return v == null ? "" : String(v).trim(); };

  var isoDur = function (iso) {
    if (!iso || typeof iso !== "string") return "";
    var m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return "";
    var p = [];
    if (m[1]) p.push(m[1] + "d");
    if (m[2]) p.push(m[2] + "h");
    if (m[3]) p.push(m[3] + "m");
    if (m[4]) p.push(m[4] + "s");
    return p.join(" ");
  };

  var normSteps = function (inst) {
    var steps = [];
    var walk = function (x) {
      if (x == null) return;
      if (typeof x === "string") { var t = S(x); if (t) steps.push(t); return; }
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (typeof x === "object") {
        var t2 = S(x.text) || S(x.name);
        if (t2 && !/HowTo(Step|Section)/i.test(S(x["@type"]))) steps.push(t2);
        if (Array.isArray(x.itemListElement)) x.itemListElement.forEach(walk);
      }
    };
    (Array.isArray(inst) ? inst : [inst]).forEach(walk);
    return steps;
  };

  var out = { title: "", description: "", image: "", prepTime: "", cookTime: "",
    totalTime: "", servings: "", ingredients: [], steps: [], nutrition: {}, source: "none" };

  var pickNode = function (nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || typeof n !== "object") continue;
      var types = [].concat(n["@type"] || []);
      for (var j = 0; j < types.length; j++) {
        if (/recipe/i.test(String(types[j]))) return n;
      }
    }
    return null;
  };

  var recipe = null;
  try {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var s = 0; s < scripts.length && !recipe; s++) {
      var data;
      try { data = JSON.parse(scripts[s].textContent); } catch (e) { continue; }
      var nodes = [];
      (Array.isArray(data) ? data : [data]).forEach(function (d) {
        if (d && Array.isArray(d["@graph"])) nodes.push.apply(nodes, d["@graph"]);
        else nodes.push(d);
      });
      recipe = pickNode(nodes);
    }
  } catch (e) { /* ignore */ }

  if (recipe) {
    out.source = "json-ld";
    out.title = S(recipe.name);
    out.description = S(recipe.description);
    out.prepTime = isoDur(recipe.prepTime);
    out.cookTime = isoDur(recipe.cookTime);
    out.totalTime = isoDur(recipe.totalTime);
    var y = recipe.recipeYield;
    if (Array.isArray(y)) y = y[0];
    out.servings = S(y);
    out.ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map(S).filter(Boolean);
    out.steps = normSteps(recipe.recipeInstructions);
    var n = recipe.nutrition || {};
    ["calories", "proteinContent", "carbohydrateContent", "fatContent",
     "sugarContent", "sodiumContent", "fiberContent"].forEach(function (k) {
      var v = S(n[k]);
      if (v) out.nutrition[k] = v;
    });
    var img = recipe.image;
    if (Array.isArray(img)) img = img[0];
    out.image = typeof img === "string" ? img : S(img && img.url);
  } else {
    // Microdata fallback (schema.org/Recipe itemprops)
    var scope = document.querySelector('[itemtype*="Recipe" i]');
    if (scope) {
      out.source = "microdata";
      var q = function (sel) { return scope.querySelector(sel); };
      var t = function (el) { return el ? S(el.getAttribute("content") || el.textContent) : ""; };
      out.title = t(q('[itemprop="name"]'));
      out.description = t(q('[itemprop="description"]'));
      out.prepTime = isoDur(t(q('[itemprop="prepTime"]'))) || t(q('[itemprop="prepTime"]'));
      out.cookTime = isoDur(t(q('[itemprop="cookTime"]'))) || t(q('[itemprop="cookTime"]'));
      out.totalTime = isoDur(t(q('[itemprop="totalTime"]'))) || t(q('[itemprop="totalTime"]'));
      out.servings = t(q('[itemprop="recipeYield"]'));
      out.ingredients = Array.prototype.map.call(
        scope.querySelectorAll('[itemprop="recipeIngredient"]'), t).filter(Boolean);
      out.steps = Array.prototype.map.call(
        scope.querySelectorAll('[itemprop="recipeInstructions"]'), t).filter(Boolean);
    }
  }
  return out;
}

var $ = function (id) { return document.getElementById(id); };
var current = null;

var NUT_LABELS = {
  calories: "Calories", proteinContent: "Protein", carbohydrateContent: "Carbs",
  fatContent: "Fat", sugarContent: "Sugar", sodiumContent: "Sodium", fiberContent: "Fiber"
};

document.addEventListener("DOMContentLoaded", function () {
  chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    if (tabs[0] && tabs[0].url) {
      try { $("pageHost").textContent = new URL(tabs[0].url).hostname.replace(/^www\./, ""); }
      catch (e) { /* ignore */ }
    }
  });
  $("extract").addEventListener("click", doExtract);
  $("copyBtn").addEventListener("click", copyIngredients);
  $("printBtn").addEventListener("click", openPrintView);
});

async function doExtract() {
  var btn = $("extract");
  btn.disabled = true; btn.textContent = "Extracting…";
  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].id) throw new Error("no-tab");
    var res = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id }, func: extractRecipe
    });
    var r = res && res[0] && res[0].result;
    if (!r || (!r.title && !r.ingredients.length && !r.steps.length)) throw new Error("no-recipe");
    current = r;
    // remember the last extraction locally
    await chrome.storage.local.set({ lastRecipe: r });
    render(r);
  } catch (e) {
    $("empty").style.display = "";
    $("card").hidden = true;
    $("empty").innerHTML = "No recipe found on this page — best-effort extraction needs recipe markup (JSON-LD or microdata).";
  } finally {
    btn.disabled = false; btn.textContent = "Extract recipe";
  }
}

function meta(label, value) {
  if (!value) return "";
  return '<span>' + esc(label) + ": " + esc(value) + "</span>";
}

function render(r) {
  $("empty").style.display = "none";
  $("card").hidden = false;
  if (r.image) { var im = $("rImg"); im.src = r.image; im.hidden = false; }
  else $("rImg").hidden = true;
  $("rTitle").textContent = r.title || "Untitled recipe";
  if (r.description) { $("rDesc").textContent = r.description; $("rDesc").hidden = false; }
  else $("rDesc").hidden = true;

  $("rMeta").innerHTML =
    meta("Prep", r.prepTime) + meta("Cook", r.cookTime) +
    meta("Total", r.totalTime) + meta("Serves", r.servings);

  var ing = $("rIng"); ing.innerHTML = "";
  r.ingredients.forEach(function (i) {
    var li = document.createElement("li");
    li.textContent = i;
    ing.appendChild(li);
  });

  var st = $("rSteps"); st.innerHTML = "";
  r.steps.forEach(function (s) {
    var li = document.createElement("li");
    li.textContent = s;
    st.appendChild(li);
  });

  var nutKeys = Object.keys(NUT_LABELS).filter(function (k) { return r.nutrition[k]; });
  $("nutWrap").hidden = !nutKeys.length;
  var nut = $("rNut"); nut.innerHTML = "";
  nutKeys.forEach(function (k) {
    var d = document.createElement("div");
    d.innerHTML = "<span>" + NUT_LABELS[k] + "</span><b>" + esc(r.nutrition[k]) + "</b>";
    nut.appendChild(d);
  });

  $("srcNote").textContent = "Best-effort extraction via " +
    (r.source === "json-ld" ? "page recipe data (JSON-LD)" : "page recipe markup (microdata)") +
    " — always sanity-check against the original page.";
}

async function copyIngredients() {
  if (!current) return;
  var text = (current.title ? current.title + "\n\n" : "") +
    "INGREDIENTS\n" + current.ingredients.map(function (i) { return "• " + i; }).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    var b = $("copyBtn"); b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy"; }, 1500);
  } catch (e) { /* clipboard unavailable */ }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function openPrintView() {
  if (!current) return;
  var r = current;
  var rows = Object.keys(NUT_LABELS).filter(function (k) { return r.nutrition[k]; })
    .map(function (k) { return "<div><span>" + NUT_LABELS[k] + "</span><b>" + esc(r.nutrition[k]) + "</b></div>"; }).join("");
  var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + esc(r.title || "Recipe") + "</title>" +
    "<style>body{font-family:Georgia,serif;max-width:640px;margin:32px auto;padding:0 20px;color:#222}" +
    "h1{font-size:26px}h2{font-size:15px;text-transform:uppercase;letter-spacing:1px;color:#666;border-bottom:2px solid #f97316;padding-bottom:6px}" +
    "li{margin:6px 0}.meta{color:#666;margin-bottom:16px}" +
    "@media print{body{margin:0}}</style></head><body>" +
    "<h1>" + esc(r.title || "Recipe") + "</h1>" +
    (r.description ? "<p>" + esc(r.description) + "</p>" : "") +
    "<p class='meta'>" + [r.prepTime && "Prep " + esc(r.prepTime), r.cookTime && "Cook " + esc(r.cookTime),
      r.totalTime && "Total " + esc(r.totalTime), r.servings && "Serves " + esc(r.servings)].filter(Boolean).join(" · ") + "</p>" +
    "<h2>Ingredients</h2><ul>" + r.ingredients.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" +
    "<h2>Method</h2><ol>" + r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
    (rows ? "<h2>Nutrition</h2><p>" + rows.replace(/<\/?div>/g, " ").replace(/<\/?span>/g, "").replace(/<\/?b>/g, " ") + "</p>" : "") +
    "<script>window.onload=function(){window.print()}<\/script></body></html>";
  var blob = new Blob([html], { type: "text/html" });
  chrome.tabs.create({ url: URL.createObjectURL(blob) });
}
