// Keyboard Shortcut Mapper — popup logic.
// Manages the 8 shortcut slots; keys themselves are assigned by the user
// at chrome://extensions/shortcuts (shown via chrome.commands.getAll()).

const SLOT_COUNT = 8;
const $ = (id) => document.getElementById(id);

function defaultSlots() {
  const presets = [
    { name: "GitHub", type: "url", value: "https://github.com" },
    { name: "Gmail", type: "url", value: "https://mail.google.com" },
    { name: "Email signature", type: "snippet", value: "Best regards,\nrdx" },
    { name: "", type: "url", value: "" },
    { name: "", type: "url", value: "" },
    { name: "", type: "snippet", value: "" },
    { name: "", type: "url", value: "" },
    { name: "", type: "snippet", value: "" },
  ];
  return presets.map((p, i) => ({
    command: "run-slot-" + (i + 1),
    name: p.name || ("Slot " + (i + 1)),
    type: p.type,
    value: p.value,
  }));
}

let slots = [];
let saveTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const data = await chrome.storage.local.get("slots");
  slots = Array.isArray(data.slots) && data.slots.length === SLOT_COUNT
    ? data.slots
    : defaultSlots();
  if (!data.slots) await chrome.storage.local.set({ slots });

  let keyMap = {};
  try {
    const commands = await chrome.commands.getAll();
    keyMap = Object.fromEntries(commands.map((c) => [c.name, c.shortcut || ""]));
  } catch (e) { /* commands unavailable — badges stay unset */ }

  renderSlots(keyMap);

  $("copyAddr").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("chrome://extensions/shortcuts");
      const b = $("copyAddr");
      b.textContent = "Copied!";
      setTimeout(() => { b.textContent = "Copy address"; }, 1500);
    } catch (e) { /* clipboard blocked */ }
  });

  $("resetBtn").addEventListener("click", async () => {
    slots = defaultSlots();
    await chrome.storage.local.set({ slots });
    renderSlots(keyMap);
  });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ slots });
    const el = document.querySelector(".saved");
    if (el) { el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1200); }
  }, 400);
}

function renderSlots(keyMap) {
  const box = $("slots");
  box.innerHTML = "";
  slots.forEach((slot, i) => {
    const card = document.createElement("div");
    card.className = "slot";

    const head = document.createElement("div");
    head.className = "slot-head";

    const badge = document.createElement("span");
    badge.className = "keybadge" + (keyMap[slot.command] ? "" : " unset");
    badge.textContent = keyMap[slot.command] || "no key set";
    badge.title = keyMap[slot.command]
      ? "Press this key anywhere in the browser"
      : "Assign a key at chrome://extensions/shortcuts";

    const name = document.createElement("input");
    name.className = "name";
    name.value = slot.name;
    name.placeholder = "Slot name";
    name.maxLength = 40;
    name.addEventListener("input", () => { slot.name = name.value; scheduleSave(); });

    const test = document.createElement("button");
    test.className = "test";
    test.textContent = "Test";
    test.title = "Run this action now";
    test.addEventListener("click", () => runAction(slot, test));

    head.append(badge, name, test);

    const body = document.createElement("div");
    body.className = "slot-body";

    const typeSel = document.createElement("select");
    for (const [v, label] of [["url", "Open URL"], ["snippet", "Copy snippet"]]) {
      const o = document.createElement("option");
      o.value = v; o.textContent = label;
      if (slot.type === v) o.selected = true;
      typeSel.appendChild(o);
    }

    const valueField = document.createElement(slot.type === "snippet" ? "textarea" : "input");
    valueField.value = slot.value;
    valueField.placeholder = slot.type === "url" ? "https://example.com" : "Text to copy…";
    valueField.spellcheck = false;
    valueField.addEventListener("input", () => { slot.value = valueField.value; scheduleSave(); });

    typeSel.addEventListener("change", () => {
      slot.type = typeSel.value;
      scheduleSave();
      renderSlots(keyMap); // swap input <-> textarea
    });

    body.append(typeSel, valueField);
    card.append(head, body);
    box.appendChild(card);
  });

  const saved = document.createElement("div");
  saved.className = "saved";
  saved.textContent = "✓ Saved";
  box.appendChild(saved);
}

async function runAction(slot, btn) {
  const val = (slot.value || "").trim();
  if (!val) return;
  const label = btn.textContent;
  try {
    if (slot.type === "url") {
      const url = /^https?:\/\//i.test(val) ? val : "https://" + val;
      await chrome.tabs.create({ url });
    } else {
      await navigator.clipboard.writeText(val);
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = label; }, 1200);
    }
  } catch (e) {
    btn.textContent = "Failed";
    setTimeout(() => { btn.textContent = label; }, 1200);
  }
}
