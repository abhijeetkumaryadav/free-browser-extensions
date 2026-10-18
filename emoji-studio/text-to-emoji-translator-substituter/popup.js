/* WordMoji — Text to Emoji Translator (popup logic)
 * Pure local dictionary lookup. Tokenizes on word boundaries so punctuation and
 * whitespace survive untouched. Density = % chance each eligible word is swapped
 * (seeded by hash so results are stable across re-renders of the same text).
 * Every swapped word is clickable to toggle word ⇄ emoji. Full undo stack.
 */
'use strict';

/* Local word → emoji dictionary. Keys are lowercase, singular-ish forms.
 * Plurals and common variants map to the same emoji. */
const DICT = {
  // Food & drink
  pizza: '🍕', burger: '🍔', fries: '🍟', sandwich: '🥪', taco: '🌮', hotdog: '🌭',
  popcorn: '🍿', cake: '🍰', donut: '🍩', doughnut: '🍩', chocolate: '🍫', candy: '🍬',
  icecream: '🍦', coffee: '☕', tea: '🍵', beer: '🍺', wine: '🍷', cocktail: '🍹',
  water: '💧', milk: '🥛', apple: '🍎', banana: '🍌', strawberry: '🍓', grapes: '🍇',
  orange: '🍊', lemon: '🍋', watermelon: '🍉', pineapple: '🍍', peach: '🍑',
  cherry: '🍒', avocado: '🥑', broccoli: '🥦', corn: '🌽', carrot: '🥕', bread: '🍞',
  cheese: '🧀', egg: '🥚', eggs: '🥚', bacon: '🥓', pasta: '🍝', rice: '🍚',
  sushi: '🍣', ramen: '🍜', soup: '🍲', salad: '🥗', cookie: '🍪', cookies: '🍪',
  honey: '🍯', peanut: '🥜', croissant: '🥐', pancake: '🥞', waffle: '🧇',
  breakfast: '🥞', lunch: '🥪', dinner: '🍽️', meal: '🍽️', snack: '🍿', food: '🍔',
  drink: '🥤', soda: '🥤', juice: '🧃', champagne: '🍾', whiskey: '🥃', whisky: '🥃',
  // Love & faces
  love: '❤️', heart: '❤️', hearts: '💕', kiss: '💋', hug: '🤗', hugs: '🤗',
  happy: '😊', happiness: '😊', sad: '😢', cry: '😭', laugh: '😂', smile: '😄',
  wink: '😉', cool: '😎', angry: '😠', rage: '🤬', shock: '😱', shocked: '😱',
  surprise: '😲', surprised: '😲', sleep: '😴', tired: '😩', sick: '🤒', nerd: '🤓',
  party: '🥳', clown: '🤡', ghost: '👻', alien: '👽', robot: '🤖', skull: '💀',
  // Animals
  dog: '🐶', puppy: '🐶', dogs: '🐶', cat: '🐱', kitten: '🐱', cats: '🐱',
  mouse: '🐭', mice: '🐭', hamster: '🐹', rabbit: '🐰', bunny: '🐰', fox: '🦊',
  bear: '🐻', panda: '🐼', koala: '🐨', tiger: '🐯', lion: '🦁', cow: '🐮',
  pig: '🐷', frog: '🐸', monkey: '🐵', chicken: '🐔', penguin: '🐧', bird: '🐦',
  birds: '🐦', duck: '🦆', eagle: '🦅', owl: '🦉', bat: '🦇', wolf: '🐺',
  horse: '🐴', unicorn: '🦄', bee: '🐝', butterfly: '🦋', snail: '🐌',
  turtle: '🐢', snake: '🐍', dragon: '🐉', whale: '🐳', dolphin: '🐬',
  fish: '🐟', shark: '🦈', octopus: '🐙', crab: '🦀', shrimp: '🍤', lobster: '🦞',
  spider: '🕷️', ant: '🐜', ladybug: '🐞', cricket: '🦗',
  // Nature & weather
  sun: '☀️', sunny: '☀️', moon: '🌙', star: '⭐', stars: '✨', cloud: '☁️',
  rain: '🌧️', storm: '⛈️', thunder: '⚡', lightning: '⚡', snow: '❄️',
  rainbow: '🌈', fire: '🔥', flame: '🔥', flames: '🔥', water: '💧',
  ocean: '🌊', sea: '🌊', wave: '🌊', waves: '🌊', beach: '🏖️',
  mountain: '⛰️', mountains: '🏔️', volcano: '🌋', desert: '🏜️', island: '🏝️',
  forest: '🌲', tree: '🌳', trees: '🌲', flower: '🌸', flowers: '💐',
  rose: '🌹', roses: '🌹', tulip: '🌷', sunflower: '🌻', leaf: '🍃', leaves: '🍂',
  cactus: '🌵', mushroom: '🍄', earth: '🌍', world: '🌍', globe: '🌐',
  // Objects & tech
  phone: '📱', mobile: '📱', iphone: '📱', laptop: '💻', computer: '💻',
  keyboard: '⌨️', mouse: '🖱️', monitor: '🖥️', printer: '🖨️', camera: '📷',
  photo: '📸', photos: '📸', picture: '🖼️', video: '🎥', movie: '🎬',
  music: '🎵', song: '🎵', songs: '🎶', guitar: '🎸', piano: '🎹',
  microphone: '🎤', mic: '🎤', headphones: '🎧', radio: '📻', tv: '📺',
  game: '🎮', gaming: '🎮', dice: '🎲', puzzle: '🧩', trophy: '🏆',
  medal: '🥇', gift: '🎁', balloon: '🎈', balloons: '🎈', confetti: '🎉',
  book: '📖', books: '📚', newspaper: '📰', pen: '🖊️', pencil: '✏️',
  scissors: '✂️', lock: '🔒', key: '🔑', keys: '🔑', hammer: '🔨',
  wrench: '🔧', gear: '⚙️', magnet: '🧲', battery: '🔋', bulb: '💡',
  idea: '💡', ideas: '💡', money: '💰', cash: '💵', dollar: '💵',
  coin: '🪙', coins: '🪙', bank: '🏦', credit: '💳', card: '💳',
  shopping: '🛍️', cart: '🛒', bag: '👜', box: '📦', package: '📦',
  mail: '📧', email: '📧', letter: '💌', calendar: '📅', clock: '🕐',
  time: '⏰', alarm: '⏰', watch: '⌚', hourglass: '⏳',
  // Travel & places
  car: '🚗', cars: '🚗', taxi: '🚕', bus: '🚌', train: '🚂', subway: '🚇',
  plane: '✈️', airplane: '✈️', flight: '✈️', flights: '✈️', rocket: '🚀',
  ship: '🚢', boat: '⛵', bike: '🚲', bicycle: '🚲', motorcycle: '🏍️',
  house: '🏠', home: '🏠', building: '🏢', office: '🏢', hospital: '🏥',
  school: '🏫', church: '⛪', hotel: '🏨', castle: '🏰', tent: '⛺',
  city: '🌆', town: '🏘️', village: '🏘️',
  // Body & people
  hand: '✋', hands: '🙌', clap: '👏', thumbsup: '👍', thumbsdown: '👎',
  fist: '✊', wave: '👋', pray: '🙏', muscle: '💪', strong: '💪',
  eye: '👀', eyes: '👀', ear: '👂', nose: '👃', mouth: '👄', tongue: '👅',
  brain: '🧠', heart: '❤️', baby: '👶', kid: '🧒', kids: '🧒', boy: '👦',
  girl: '👧', man: '👨', woman: '👩', family: '👨‍👩‍👧', friend: '🧑‍🤝‍🧑',
  friends: '👯', couple: '💑', wedding: '💒', bride: '👰', king: '🤴',
  queen: '👸', prince: '🤴', princess: '👸', santa: '🎅', angel: '👼',
  devil: '😈', zombie: '🧟', vampire: '🧛', wizard: '🧙', mage: '🧙',
  superhero: '🦸', ninja: '🥷', pirate: '🏴‍☠️', astronaut: '🧑‍🚀',
  // Sports & activities
  soccer: '⚽', football: '🏈', basketball: '🏀', baseball: '⚾',
  tennis: '🎾', volleyball: '🏐', golf: '⛳', rugby: '🏉', cricket: '🏏',
  hockey: '🏒', pingpong: '🏓', badminton: '🏸', boxing: '🥊',
  swimming: '🏊', surf: '🏄', ski: '🎿', snowboard: '🏂', skateboard: '🛹',
  running: '🏃', run: '🏃', walking: '🚶', walk: '🚶', dancing: '💃',
  dance: '🕺', yoga: '🧘', gym: '🏋️', workout: '🏋️', trophy: '🏆',
  medal: '🏅', target: '🎯', dart: '🎯',
  // Symbols & misc
  check: '✅', cross: '❌', x: '❌', warning: '⚠️', question: '❓',
  exclamation: '❗', plus: '➕', minus: '➖', star: '⭐', sparkle: '✨',
  sparkles: '✨', boom: '💥', poop: '💩', diamond: '💎', crown: '👑',
  ring: '💍', gem: '💎', flag: '🚩', pirate: '🏴‍☠️', anchor: '⚓',
  umbrella: '☂️', snowman: '☃️', dice: '🎲', slot: '🎰', joker: '🃏',
  crystal: '🔮', magic: '✨', wizard: '🧙',
  // Common words
  yes: '👍', no: '👎', ok: '👌', okay: '👌', thanks: '🙏', thank: '🙏',
  sorry: '😔', please: '🙏', hello: '👋', hi: '👋', bye: '👋', goodbye: '👋',
  congratulations: '🎉', congrats: '🎉', welcome: '🤗', birthday: '🎂',
  christmas: '🎄', halloween: '🎃', newyear: '🎆', easter: '🐣',
  weekend: '🎉', friday: '🍻', monday: '😩', work: '💼', job: '💼',
  office: '🏢', meeting: '🤝', call: '📞', message: '💬', chat: '💬',
  // Plurals & variants
  pizzas: '🍕', burgers: '🍔', apples: '🍎', bananas: '🍌', dogs: '🐶',
  cats: '🐱', birds: '🐦', flowers: '💐', books: '📚', movies: '🎬',
  songs: '🎶', games: '🎮', photos: '📸', cars: '🚗', houses: '🏠',
  trees: '🌲', stars: '✨', hearts: '💕', gifts: '🎁', parties: '🥳',
  babies: '👶', children: '🧒', men: '👨', women: '👩', friends: '👯',
  ideas: '💡', dreams: '💭', nights: '🌙', days: '☀️', mornings: '🌅',
  evenings: '🌇', weeks: '📅', months: '🗓️', years: '🎂',
};

/* Simple plural fallback: try the word as-is, then strip a trailing 's'/'es'. */
function lookupEmoji(word) {
  const w = word.toLowerCase();
  if (DICT[w]) return DICT[w];
  if (w.endsWith('es') && DICT[w.slice(0, -2)]) return DICT[w.slice(0, -2)];
  if (w.endsWith('s') && DICT[w.slice(0, -1)]) return DICT[w.slice(0, -1)];
  return null;
}

/* Deterministic hash → stable density results for the same input text. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* DOM refs */
const input = document.getElementById('input');
const density = document.getElementById('density');
const densityVal = document.getElementById('densityVal');
const translateBtn = document.getElementById('translateBtn');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const output = document.getElementById('output');
const copyBtn = document.getElementById('copyBtn');
const swapAllBtn = document.getElementById('swapAllBtn');
const stat = document.getElementById('stat');
const status = document.getElementById('status');

/* State: array of token objects. Undo stack stores serialized snapshots. */
let tokens = [];
let undoStack = [];

function setStatus(msg, isError) {
  status.textContent = msg;
  status.style.color = isError ? '#f87171' : '';
  if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 2600);
}

/* Tokenize preserving whitespace & punctuation: [word][non-word][word]… */
function tokenize(text) {
  const parts = text.match(/[A-Za-z0-9'’]+|[^A-Za-z0-9'’]+/g) || [];
  return parts.map((raw) => {
    const isWord = /^[A-Za-z0-9'’]+$/.test(raw);
    const emoji = isWord ? lookupEmoji(raw) : null;
    return { raw, isWord, emoji, swapped: false, eligible: !!emoji };
  });
}

function snapshot() {
  return tokens.map((t) => ({ ...t }));
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 30) undoStack.shift();
  undoBtn.disabled = false;
}

function applyDensity(densityPct) {
  pushUndo();
  tokens.forEach((t, i) => {
    if (!t.eligible) { t.swapped = false; return; }
    // Stable pseudo-random per token: hash of word + index vs density threshold.
    t.swapped = (hashStr(t.raw.toLowerCase() + '#' + i) % 100) < densityPct;
  });
  render();
}

function plainText() {
  return tokens.map((t) => (t.swapped && t.emoji ? t.emoji : t.raw)).join('');
}

function render() {
  output.innerHTML = '';
  if (!tokens.length) {
    output.innerHTML = '<span class="placeholder">Translate something to see it here. Click any highlighted word to toggle it back.</span>';
    copyBtn.disabled = true;
    swapAllBtn.disabled = true;
    stat.textContent = '';
    return;
  }
  const frag = document.createDocumentFragment();
  tokens.forEach((t, i) => {
    if (!t.eligible) {
      frag.appendChild(document.createTextNode(t.raw));
      return;
    }
    const s = document.createElement('span');
    s.className = 'token swapped' + (t.swapped ? '' : ' off');
    s.textContent = t.swapped && t.emoji ? t.emoji : t.raw;
    s.title = t.swapped ? `Click to show "${t.raw}"` : `Click to show ${t.emoji}`;
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    s.dataset.idx = i;
    frag.appendChild(s);
  });
  output.appendChild(frag);
  const swapped = tokens.filter((t) => t.swapped).length;
  const eligible = tokens.filter((t) => t.eligible).length;
  stat.textContent = swapped + ' / ' + eligible + ' swapped';
  copyBtn.disabled = false;
  swapAllBtn.disabled = false;
}

/* Toggle a single token word ⇄ emoji. */
output.addEventListener('click', (e) => {
  const el = e.target.closest('.token.swapped');
  if (!el) return;
  const i = Number(el.dataset.idx);
  pushUndo();
  tokens[i].swapped = !tokens[i].swapped;
  render();
});
output.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('token')) {
    e.preventDefault();
    e.target.click();
  }
});

translateBtn.addEventListener('click', () => {
  const text = input.value;
  if (!text.trim()) { setStatus('Type some text first.', true); return; }
  undoStack = [];
  undoBtn.disabled = true;
  tokens = tokenize(text);
  const d = Number(density.value);
  tokens.forEach((t, i) => {
    t.swapped = t.eligible && (hashStr(t.raw.toLowerCase() + '#' + i) % 100) < d;
  });
  render();
  setStatus('Translated — click any highlighted word to toggle it.');
  chrome.storage.local.set({ wordmojiDraft: text, wordmojiDensity: d }).catch(() => {});
});

density.addEventListener('input', () => {
  densityVal.textContent = density.value + '%';
});
density.addEventListener('change', () => {
  if (tokens.length) applyDensity(Number(density.value));
});

undoBtn.addEventListener('click', () => {
  const prev = undoStack.pop();
  if (!prev) return;
  tokens = prev;
  undoBtn.disabled = !undoStack.length;
  render();
  setStatus('Undone.');
});

swapAllBtn.addEventListener('click', () => {
  pushUndo();
  const anySwapped = tokens.some((t) => t.swapped);
  tokens.forEach((t) => { if (t.eligible) t.swapped = !anySwapped; });
  swapAllBtn.textContent = anySwapped ? 'Swap all to emoji' : 'Show all words';
  render();
});

clearBtn.addEventListener('click', () => {
  pushUndo();
  tokens = [];
  input.value = '';
  render();
  setStatus('Cleared.');
});

copyBtn.addEventListener('click', async () => {
  const text = plainText();
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard.');
  } catch (err) {
    // Fallback for denied clipboard permission.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); setStatus('Copied to clipboard.'); }
    catch (e2) { setStatus('Copy failed — select and copy manually.', true); }
    ta.remove();
  }
});

/* Restore draft. */
chrome.storage.local.get(['wordmojiDraft', 'wordmojiDensity']).then((r) => {
  if (r.wordmojiDraft) input.value = r.wordmojiDraft;
  if (typeof r.wordmojiDensity === 'number') {
    density.value = r.wordmojiDensity;
    densityVal.textContent = r.wordmojiDensity + '%';
  }
}).catch(() => {});

/* Enter (no shift) in textarea translates. */
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); translateBtn.click(); }
});
