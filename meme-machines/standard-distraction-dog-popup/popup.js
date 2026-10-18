/* Distraction Dog popup logic.
 * The dog pops up at random intervals while the popup is open, says something
 * funny, and responds to pets/treats/tricks. All state stays in chrome.storage.local.
 * No network, no content scripts, no background work — pure fun. */
'use strict';

const STORAGE_KEY = 'distraction-dog.v1';

/* Funny one-liners the dog "says". */
const MESSAGES = [
  'You look busy. Have you considered NOT being busy?',
  'I chased my tail for 20 minutes today. Productive? Debatable.',
  'Psst. Stretch. Your back will thank you.',
  'Is that a snack? Asking for a friend. The friend is me.',
  'Woof means "hello" in professional.',
  'I would die for you. Anyway, how\'s the spreadsheet?',
  'Remember: every email can wait. Belly rubs cannot.',
  'I saw a squirrel once. Never been the same since.',
  'Hydration check! I drink from a bowl. You have a cup. Same thing.',
  'The mailman came today. I handled it. You\'re welcome.',
  'Naps are just sleep with better PR.',
  'You\'ve been staring at that screen a while. Just saying. Woof.',
  'I don\'t know what "deadline" means but it sounds scary. Let\'s ignore it.',
  'Fun fact: I\'m 100% good boy. Peer reviewed.',
  'Plot twist: the real distraction was the dog we met along the way.'
];

/* Trick lines + matching dog moods. */
const TRICKS = [
  { line: 'Okay okay — watch this: SIT. …I sat. Treat now?', mood: 'happy' },
  { line: 'Paw! See? PAW. Where\'s my Oscar?', mood: 'love' },
  { line: 'I can spin! Wheee— okay I\'m dizzy.', mood: 'sleepy' },
  { line: 'Play dead! …Am I doing it right? Blink twice if yes.', mood: 'sleepy' },
  { line: 'High five! …That was your face. Sorry.', mood: 'happy' }
];

const PET_LINES = [
  'Mmm. Right there. Yes. Keep going.',
  'Okay, you may stop. …No wait, keep going.',
  '*happy wiggles intensify*',
  'Best. Human. Ever.'
];
const FEED_LINES = [
  'OM NOM NOM. 10/10. Would inhale again.',
  'A treat?! For ME? You shouldn\'t have. (Keep doing it.)',
  'Crunch crunch. Delicious. My compliments to the chef.',
  '*inhales treat* Thank you thank you thank you.'
];

const MOODS = {
  happy: 'assets/dog_happy.png',
  hungry: 'assets/dog_hungry.png',
  sleepy: 'assets/dog_sleepy.png',
  love: 'assets/dog_love.png'
};

/** Pure helper: pick a random element without repeating the last one. */
function pickRandom(arr, exclude) {
  const pool = arr.filter((x) => x !== exclude);
  const source = pool.length ? pool : arr;
  return source[Math.floor(Math.random() * source.length)];
}

let state;
let lastMessage = null;
let popupTimer = null;

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const s = stored[STORAGE_KEY] || {};
  return {
    pets: s.pets || 0,
    treats: s.treats || 0,
    visits: s.visits || 0,
    enabled: s.enabled !== false,
    frequency: s.frequency || '20'
  };
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function setDog(mood, message) {
  const img = document.getElementById('dogImg');
  img.src = MOODS[mood] || MOODS.happy;
  img.classList.remove('bounce');
  // Force reflow so the bounce animation restarts.
  void img.offsetWidth;
  img.classList.add('bounce');
  document.getElementById('dogMsg').textContent = message;
  lastMessage = message;
}

function updateStats() {
  document.getElementById('petsCount').textContent = state.pets;
  document.getElementById('treatsCount').textContent = state.treats;
  document.getElementById('visitsCount').textContent = state.visits;
}

/** The dog "pops up": appear with a bounce + a new funny line. */
function popUp() {
  const panel = document.getElementById('dogPanel');
  panel.classList.remove('hidden-dog');
  state.visits += 1;
  setDog(pickRandom(['happy', 'hungry', 'sleepy'], null), pickRandom(MESSAGES, lastMessage));
  updateStats();
  saveState();
}

/** Schedule the next random-interval appearance. */
function scheduleNext() {
  clearTimeout(popupTimer);
  if (!state.enabled) return;
  const base = parseInt(state.frequency, 10) * 1000;
  // Randomize ±40% around the chosen frequency so it feels spontaneous.
  const jitter = base * (0.6 + Math.random() * 0.8);
  popupTimer = setTimeout(() => {
    popUp();
    scheduleNext();
  }, jitter);
}

if (typeof document !== 'undefined') {
document.addEventListener('DOMContentLoaded', async () => {
  state = await loadState();

  document.getElementById('enablePopups').checked = state.enabled;
  document.getElementById('frequency').value = String(state.frequency);
  updateStats();
  setDog('happy', pickRandom(MESSAGES, null));
  scheduleNext();

  document.getElementById('petBtn').addEventListener('click', async () => {
    state.pets += 1;
    setDog('love', pickRandom(PET_LINES, lastMessage));
    updateStats();
    await saveState();
  });

  document.getElementById('feedBtn').addEventListener('click', async () => {
    state.treats += 1;
    setDog('hungry', pickRandom(FEED_LINES, lastMessage));
    updateStats();
    await saveState();
  });

  document.getElementById('trickBtn').addEventListener('click', () => {
    const trick = TRICKS[Math.floor(Math.random() * TRICKS.length)];
    setDog(trick.mood, trick.line);
  });

  document.getElementById('dismissBtn').addEventListener('click', () => {
    document.getElementById('dogPanel').classList.add('hidden-dog');
    // The dog always comes back on the next scheduled pop-up. It's a dog.
  });

  document.getElementById('summonBtn').addEventListener('click', () => {
    popUp();
    scheduleNext();
  });

  document.getElementById('enablePopups').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    await saveState();
    scheduleNext();
  });

  document.getElementById('frequency').addEventListener('change', async (e) => {
    state.frequency = e.target.value;
    await saveState();
    scheduleNext();
  });

  window.addEventListener('beforeunload', () => clearTimeout(popupTimer));
});
}

// Exported for Node smoke tests.
if (typeof module !== 'undefined') module.exports = { pickRandom, MESSAGES, TRICKS };
