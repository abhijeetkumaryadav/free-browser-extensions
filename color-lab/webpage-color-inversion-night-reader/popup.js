// NightFlip popup — applies a reversible CSS inversion filter to the active tab.
const $ = (id) => document.getElementById(id);
const STYLE_NOTE = "nightflip-invert-style";

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function restricted(tab) {
  return !tab || !tab.url || !/^https?:|^file:|^ftp:/.test(tab.url);
}
async function run(fn, args) {
  const tab = await activeTab();
  if (restricted(tab)) throw new Error("restricted");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fn,
    args: [args || {}],
  });
  return result;
}

function render(on) {
  $("toggle").setAttribute("aria-checked", String(on));
  const pill = $("statusPill");
  pill.textContent = on ? "active" : "idle";
  pill.classList.toggle("on", on);
}

async function probe() {
  try {
    // Re-declare self-contained so func has no popup-scope dependency.
    const r = await run(function () {
      return !!document.getElementById("nightflip-invert-style");
    });
    render(!!r);
  } catch { render(false); }
}

function settings() {
  return {
    intensity: parseInt($("intensity").value, 10),
    protectMedia: $("protectMedia").checked,
  };
}

async function apply() {
  const s = settings();
  await chrome.storage.local.set({ nightflip: s });
  try {
    await run(function (opts) {
      const STYLE_ID = "nightflip-invert-style";
      const old = document.getElementById(STYLE_ID);
      if (old) old.remove();
      const style = document.createElement("style");
      style.id = STYLE_ID;
      const n = (opts && typeof opts.intensity === "number") ? opts.intensity / 100 : 1;
      let css = "html { filter: invert(" + n + ") hue-rotate(180deg) !important; background:#000 !important; }";
      if (!(opts && opts.protectMedia === false)) {
        css += "img, video, picture, canvas, [style*=\"background-image\"] { filter: invert(" + n + ") hue-rotate(180deg) !important; }";
      }
      style.textContent = css;
      document.documentElement.appendChild(style);
      return true;
    }, s);
    render(true);
  } catch (e) {
    render(false);
  }
}

async function restore() {
  try {
    await run(function () {
      const el = document.getElementById("nightflip-invert-style");
      if (el) el.remove();
      return true;
    });
  } catch { /* restricted tab */ }
  render(false);
}

$("toggle").addEventListener("click", async () => {
  const on = $("toggle").getAttribute("aria-checked") === "true";
  if (on) await restore(); else await apply();
});
$("intensity").addEventListener("input", () => {
  $("intensityVal").textContent = $("intensity").value + "%";
});
$("intensity").addEventListener("change", async () => {
  if ($("toggle").getAttribute("aria-checked") === "true") await apply();
});
$("protectMedia").addEventListener("change", async () => {
  if ($("toggle").getAttribute("aria-checked") === "true") await apply();
});
$("restore").addEventListener("click", restore);

(async function init() {
  const saved = (await chrome.storage.local.get("nightflip")).nightflip;
  if (saved) {
    $("intensity").value = saved.intensity;
    $("intensityVal").textContent = saved.intensity + "%";
    $("protectMedia").checked = saved.protectMedia !== false;
  }
  await probe();
})();
