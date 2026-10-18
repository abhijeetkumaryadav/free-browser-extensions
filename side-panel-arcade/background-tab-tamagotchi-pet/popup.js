// PixelPal — Virtual Pet. All state in chrome.storage.local.
// Stats decay computed on popup open from lastSeen timestamp (no background work, no alarms).
const DEFAULT_STATE = {
  name: "PixelPal",
  bornAt: Date.now(),
  lastSeen: Date.now(),
  hunger: 80,     // 0 = starving, 100 = full
  happiness: 80,  // 0 = sad, 100 = joyful
  health: 90,     // 0 = sick, 100 = healthy
  energy: 80,     // 0 = exhausted, 100 = rested
  sleeping: false,
  alive: true,
  gamesWon: 0
};

// Decay rates per hour while browser runs (applied on open).
const DECAY = { hunger: 6, happiness: 5, energy: 4 };

// Mood resolution order: sleeping > dead > hungry > sad > sleepy > happy
function resolveMood(s) {
  if (!s.alive) return "ghost";
  if (s.sleeping) return "sleeping";
  if (s.hunger < 25) return "hungry";
  if (s.health < 30) return "sick";
  if (s.energy < 25) return "sleepy";
  if (s.happiness < 30) return "sad";
  return "happy";
}

function applyDecay(s) {
  const hours = Math.min((Date.now() - s.lastSeen) / 3600000, 72);
  if (!s.alive) return s;
  s.hunger = clamp(s.hunger - DECAY.hunger * hours, 0, 100);
  s.happiness = clamp(s.happiness - DECAY.happiness * hours, 0, 100);
  if (!s.sleeping) s.energy = clamp(s.energy - DECAY.energy * hours, 0, 100);
  else s.energy = clamp(s.energy + hours * 12, 0, 100);
  // Health follows neglect: starving or sad too long hurts health.
  if (s.hunger <= 5 || s.happiness <= 5) s.health = clamp(s.health - hours * 8, 0, 100);
  else if (s.hunger > 60 && s.happiness > 60) s.health = clamp(s.health + hours * 3, 0, 100);
  if (s.health <= 0) { s.alive = false; s.sleeping = false; }
  s.lastSeen = Date.now();
  return s;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

let state = null;
let canvas, ctx, frame = 0, animId = null;

document.addEventListener("DOMContentLoaded", async () => {
  canvas = document.getElementById("pet-canvas");
  ctx = canvas.getContext("2d");
  state = await loadState();
  applyDecay(state);
  await saveState();
  bindButtons();
  render();
  animId = requestAnimationFrame(tick);
});

async function loadState() {
  const data = await chrome.storage.local.get("pet");
  if (data.pet && typeof data.pet === "object") return Object.assign({}, DEFAULT_STATE, data.pet);
  return Object.assign({}, DEFAULT_STATE);
}
function saveState() { return chrome.storage.local.set({ pet: state }); }

function bindButtons() {
  document.getElementById("btn-feed").addEventListener("click", () => act("feed"));
  document.getElementById("btn-play").addEventListener("click", () => act("play"));
  document.getElementById("btn-clean").addEventListener("click", () => act("clean"));
  document.getElementById("btn-sleep").addEventListener("click", () => act("sleep"));
  document.getElementById("rename-btn").addEventListener("click", renamePet);
}

async function act(kind) {
  if (!state.alive && kind !== "clean") { // clean becomes "restart" when dead
    if (kind === "clean") restartPet();
    return;
  }
  switch (kind) {
    case "feed":
      state.hunger = clamp(state.hunger + 25, 0, 100);
      state.happiness = clamp(state.happiness + 5, 0, 100);
      break;
    case "play":
      if (state.sleeping) break;
      state.happiness = clamp(state.happiness + 20, 0, 100);
      state.energy = clamp(state.energy - 10, 0, 100);
      state.hunger = clamp(state.hunger - 8, 0, 100);
      break;
    case "clean":
      state.health = clamp(state.health + 15, 0, 100);
      state.happiness = clamp(state.happiness + 8, 0, 100);
      break;
    case "sleep":
      state.sleeping = !state.sleeping;
      if (state.sleeping) state.energy = clamp(state.energy + 15, 0, 100);
      break;
  }
  state.lastSeen = Date.now();
  await saveState();
  render();
}

function restartPet() {
  const name = state.name;
  state = Object.assign({}, DEFAULT_STATE, { name, bornAt: Date.now(), lastSeen: Date.now() });
  saveState();
  render();
}

function renamePet() {
  const next = prompt("Name your pet:", state.name);
  if (next && next.trim()) {
    state.name = next.trim().slice(0, 20);
    state.lastSeen = Date.now();
    saveState();
    render();
  }
}

function render() {
  document.getElementById("pet-name").textContent = state.name;
  const days = Math.floor((Date.now() - state.bornAt) / 86400000);
  document.getElementById("pet-age").textContent = state.alive ? `Age ${days} day${days === 1 ? "" : "s"}` : "R.I.P. — press Clean to adopt a new pet";
  setBar("hunger", state.hunger);
  setBar("happiness", state.happiness);
  setBar("health", state.health);
  setBar("energy", state.energy);
  const mood = resolveMood(state);
  document.getElementById("mood-pill").textContent = mood.charAt(0).toUpperCase() + mood.slice(1);
  document.getElementById("btn-sleep").lastChild.textContent = state.sleeping ? " Wake" : " Rest";
}

function setBar(id, v) {
  const el = document.getElementById("bar-" + id);
  el.style.width = clamp(v, 0, 100) + "%";
  el.style.background = v < 25 ? "#ef4444" : "#ec4899";
}

// ---------- Pet sprite: chunky pixel blob drawn on canvas ----------
const ACCENT = "#ec4899";
const ACCENT_DARK = "#be185d";

function drawPet(mood, t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const bounce = mood === "happy" ? Math.abs(Math.sin(t / 280)) * 8 : Math.sin(t / 900) * 2;
  const cy = 105 - bounce;

  if (mood === "ghost") {
    // Spooky little ghost
    ctx.fillStyle = "rgba(200,200,215,0.85)";
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 34, Math.PI, 0);
    ctx.lineTo(cx + 34, cy + 22);
    for (let i = 0; i < 4; i++) {
      ctx.arc(cx + 34 - (i * 17) - 8.5, cy + 22, 8.5, 0, Math.PI);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(cx - 14, cy - 28, 9, 13);
    ctx.fillRect(cx + 5, cy - 28, 9, 13);
    return;
  }

  // Body: rounded blob
  ctx.fillStyle = mood === "sick" ? "#8a8a96" : ACCENT;
  roundRect(cx - 42, cy - 30, 84, 66, 26); ctx.fill();
  // Belly patch
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(cx - 26, cy - 8, 52, 38, 18); ctx.fill();
  // Ears
  ctx.fillStyle = mood === "sick" ? "#8a8a96" : ACCENT_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy - 22); ctx.lineTo(cx - 46, cy - 52); ctx.lineTo(cx - 16, cy - 34); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 36, cy - 22); ctx.lineTo(cx + 46, cy - 52); ctx.lineTo(cx + 16, cy - 34); ctx.closePath(); ctx.fill();
  // Feet
  ctx.fillStyle = mood === "sick" ? "#77777f" : ACCENT_DARK;
  roundRect(cx - 34, cy + 32, 24, 12, 6); ctx.fill();
  roundRect(cx + 10, cy + 32, 24, 12, 6); ctx.fill();

  // Face
  const eyeY = cy - 8;
  if (mood === "sleeping") {
    ctx.strokeStyle = "#1a1a22"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - 20, eyeY); ctx.lineTo(cx - 8, eyeY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8, eyeY); ctx.lineTo(cx + 20, eyeY); ctx.stroke();
    // Zzz
    ctx.fillStyle = "#9a9aa5";
    ctx.font = "bold 13px system-ui";
    const z = 1 + Math.floor((t / 600) % 3);
    ctx.fillText("z".repeat(z), cx + 44, cy - 44 + Math.sin(t / 500) * 3);
  } else {
    ctx.fillStyle = "#1a1a22";
    ctx.beginPath(); ctx.arc(cx - 15, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 15, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    // Sparkle
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(cx - 17, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 13, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
    // Mouth by mood
    ctx.strokeStyle = "#1a1a22"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath();
    if (mood === "happy") ctx.arc(cx, cy + 8, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === "hungry") { ctx.arc(cx, cy + 14, 7, 0, Math.PI * 2); }
    else if (mood === "sad" || mood === "sick") ctx.arc(cx, cy + 18, 10, 1.15 * Math.PI, 1.85 * Math.PI);
    else ctx.arc(cx, cy + 10, 9, 0.1 * Math.PI, 0.9 * Math.PI); // sleepy: small smile
    ctx.stroke();
  }
  // Blush
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.arc(cx - 27, cy + 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 27, cy + 6, 5, 0, Math.PI * 2); ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tick(t) {
  drawPet(resolveMood(state), t || 0);
  frame++;
  // Periodic auto-save keeps lastSeen honest while popup stays open.
  if (frame % 600 === 0) { state.lastSeen = Date.now(); saveState(); }
  animId = requestAnimationFrame(tick);
}

window.addEventListener("unload", () => {
  if (animId) cancelAnimationFrame(animId);
  state.lastSeen = Date.now();
  chrome.storage.local.set({ pet: state });
});
