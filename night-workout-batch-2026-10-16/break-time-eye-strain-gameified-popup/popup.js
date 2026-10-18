/* Eye Break — popup logic: stats, follow-the-dot game, blink counter, reminder prefs. */
const $ = (id) => document.getElementById(id);
const GAME_SECS = 20, BLINK_GOAL = 20;

/* ---- persistent state ---- */
async function getState() {
  const d = await chrome.storage.local.get({
    points: 0, streak: 0, best: 0, today: 0, todayDate: "",
    blinks: 0, remindersOn: false, interval: 20,
  });
  return d;
}
async function setState(patch) {
  const cur = await getState();
  await chrome.storage.local.set({ ...cur, ...patch });
}

/* ---- today rollover for streaks ---- */
function todayKey() { return new Date().toISOString().slice(0, 10); }

async function rollover() {
  const s = await getState();
  if (s.todayDate !== todayKey()) {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    await setState({
      todayDate: todayKey(),
      today: 0,
      streak: s.todayDate === yesterday ? s.streak : (s.today > 0 ? s.streak : 0),
    });
  }
}

/* ---- render ---- */
async function render() {
  const s = await getState();
  $("points").textContent = s.points + " pts";
  $("streak").textContent = s.streak;
  $("todayCount").textContent = s.today;
  $("best").textContent = s.best;
  $("blinks").textContent = s.blinks;
  $("interval").value = String(s.interval);
  $("toggleReminders").textContent = s.remindersOn ? "Disable" : "Enable";
}

/* ---- scoring ---- */
async function award(points) {
  const s = await getState();
  const newToday = s.today + 1;
  const newStreak = newToday === 1 ? s.streak + 1 : s.streak;
  await setState({
    points: s.points + points,
    today: newToday,
    streak: newStreak,
    best: Math.max(s.best, newStreak),
  });
  await render();
}

/* ---- follow-the-dot game ---- */
let gameTimer = null, dotTimer = null, secsLeft = 0;

function moveDot() {
  const arena = $("arena"), dot = $("dot");
  const maxX = arena.clientWidth - 22, maxY = arena.clientHeight - 22;
  dot.style.left = Math.floor(Math.random() * Math.max(maxX, 1)) + "px";
  dot.style.top = Math.floor(Math.random() * Math.max(maxY, 1)) + "px";
}

function endGame() {
  clearInterval(gameTimer); clearInterval(dotTimer);
  gameTimer = dotTimer = null;
  $("dot").classList.add("hidden");
  $("gameTimer").textContent = "";
  const btn = $("startGame");
  btn.disabled = false; btn.textContent = "Start 20s game";
  award(10); // completing the full game earns points
}

$("startGame").addEventListener("click", () => {
  if (gameTimer) return;
  const dot = $("dot");
  dot.classList.remove("hidden");
  moveDot();
  secsLeft = GAME_SECS;
  $("gameTimer").textContent = secsLeft + "s — track the dot with your eyes";
  const btn = $("startGame");
  btn.disabled = true; btn.textContent = "Playing…";
  dotTimer = setInterval(moveDot, 900);
  gameTimer = setInterval(() => {
    secsLeft -= 1;
    if (secsLeft <= 0) { endGame(); return; }
    $("gameTimer").textContent = secsLeft + "s — track the dot with your eyes";
  }, 1000);
});

/* ---- blink counter ---- */
$("blinkTap").addEventListener("click", async () => {
  const s = await getState();
  const n = s.blinks + 1;
  if (n >= BLINK_GOAL) {
    await setState({ blinks: 0 });
    await award(5);
  } else {
    await setState({ blinks: n });
    await render();
  }
});
$("resetBlink").addEventListener("click", async () => {
  await setState({ blinks: 0 });
  await render();
});

/* ---- reminders (owned by background.js) ---- */
$("interval").addEventListener("change", async (e) => {
  await setState({ interval: Number(e.target.value) });
  chrome.runtime.sendMessage({ type: "refresh-schedule" });
});
$("toggleReminders").addEventListener("click", async () => {
  const s = await getState();
  await setState({ remindersOn: !s.remindersOn });
  chrome.runtime.sendMessage({ type: "refresh-schedule" });
  await render();
});

rollover().then(render);
