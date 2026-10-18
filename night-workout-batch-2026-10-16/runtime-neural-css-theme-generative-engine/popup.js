/* Theme Forge — generative CSS theme engine (pure color math, no models, no AI).
 * Engine lives between ENGINE-START / ENGINE-END markers so it can be
 * unit-tested headlessly in Node. Everything else is popup UI glue. */
'use strict';

/* ============ ENGINE-START ============ */

// Scheme hue offsets (degrees) applied to the primary hue.
const SCHEME_OFFSETS = {
  analogous:     [0, -30, 30, -60, 60],
  complementary: [0, 180, 30, 210, 150],
  triadic:       [0, 120, 240, 60, 180],
  tetradic:      [0, 90, 180, 270, 45],
  monochrome:    [0, 0, 0, 0, 0]
};

// Deterministic PRNG (mulberry32) so a seed reproduces a theme.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalize hue into [0, 360).
function wrapHue(h) { return ((h % 360) + 360) % 360; }

// Convert HSL (h:0-360, s,l:0-100) to #rrggbb.
function hslToHex(h, s, l) {
  h = wrapHue(h); s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}

// Generate a 5-role theme from parameters.
// Returns { bg, surface, primary, secondary, accent } as hex strings.
function generateTheme({ hue = 210, sat = 70, light = 55, scheme = 'analogous', seed = null } = {}) {
  const offsets = SCHEME_OFFSETS[scheme] || SCHEME_OFFSETS.analogous;
  let baseHue = hue, baseSat = sat, baseLight = light;
  if (seed !== null && seed !== '' && !Number.isNaN(Number(seed))) {
    // Seeded mode: deterministic base values, sliders ignored.
    const rand = mulberry32(Number(seed));
    baseHue = Math.floor(rand() * 360);
    baseSat = 55 + Math.floor(rand() * 40);   // 55-94
    baseLight = 40 + Math.floor(rand() * 30); // 40-69
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    bg:        hslToHex(baseHue, baseSat * 0.45, 10),
    surface:   hslToHex(baseHue, baseSat * 0.55, 19),
    primary:   hslToHex(wrapHue(baseHue + offsets[0]), baseSat, baseLight),
    secondary: hslToHex(wrapHue(baseHue + offsets[1]), clamp(baseSat * 0.9, 0, 100), baseLight),
    accent:    hslToHex(wrapHue(baseHue + offsets[2]), clamp(baseSat + 10, 0, 100), clamp(baseLight + 12, 0, 92))
  };
}

// Render theme roles as a CSS variables block.
function themeToCss(name, theme) {
  const lines = Object.entries(theme).map(([role, hex]) => `  --${name}-${role}: ${hex};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

/* ============ ENGINE-END ============ */

/* ---------------- Popup UI ---------------- */
const $ = id => document.getElementById(id);
const els = {
  scheme: $('scheme'), hue: $('hue'), sat: $('sat'), light: $('light'),
  hueVal: $('hueVal'), satVal: $('satVal'), lightVal: $('lightVal'),
  seed: $('seed'), generate: $('generate'), palette: $('palette'),
  preview: $('preview'), themeName: $('themeName'), save: $('save'),
  themeList: $('themeList'), export: $('export')
};

let current = null; // { theme, scheme, seedLabel }

// Tiny toast feedback.
let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

// Render the palette swatches; click copies the hex.
function renderPalette(theme) {
  els.palette.innerHTML = '';
  const roles = ['bg', 'surface', 'primary', 'secondary', 'accent'];
  for (const role of roles) {
    const hex = theme[role];
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.title = `${role}: ${hex} — click to copy`;
    sw.innerHTML = `<div class="chip" style="background:${hex}"></div><div class="hex">${hex}</div>`;
    sw.addEventListener('click', () => {
      navigator.clipboard.writeText(hex).then(() => toast(`${hex} copied`)).catch(() => toast('Copy failed'));
    });
    els.palette.appendChild(sw);
  }
}

// Apply theme as CSS variables scoped to the preview panel.
function renderPreview(theme) {
  const p = els.preview;
  p.style.setProperty('--tf-bg', theme.bg);
  p.style.setProperty('--tf-surface', theme.surface);
  p.style.setProperty('--tf-primary', theme.primary);
  p.style.setProperty('--tf-secondary', theme.secondary);
  p.style.setProperty('--tf-accent', theme.accent);
  p.querySelector('.pv-card').style.background = 'var(--tf-bg)';
  p.querySelector('.pv-h').style.color = 'var(--tf-primary)';
  p.querySelector('.pv-p').style.color = 'var(--tf-secondary)';
  p.querySelector('.pv-primary').style.background = 'var(--tf-primary)';
  p.querySelector('.pv-primary').style.color = '#111';
  p.querySelector('.pv-secondary').style.background = 'transparent';
  p.querySelector('.pv-secondary').style.color = 'var(--tf-accent)';
  p.querySelector('.pv-secondary').style.border = '1px solid var(--tf-accent)';
  p.querySelector('.pv-badge').style.background = 'var(--tf-accent)';
  p.querySelector('.pv-badge').style.color = '#111';
}

// Rebuild from current control values.
function rebuild(seedOverride) {
  const seed = seedOverride !== undefined ? seedOverride : (els.seed.value.trim() === '' ? null : els.seed.value.trim());
  const params = {
    hue: Number(els.hue.value),
    sat: Number(els.sat.value),
    light: Number(els.light.value),
    scheme: els.scheme.value,
    seed
  };
  els.hueVal.textContent = els.hue.value;
  els.satVal.textContent = els.sat.value;
  els.lightVal.textContent = els.light.value;
  current = { theme: generateTheme(params), params };
  renderPalette(current.theme);
  renderPreview(current.theme);
}

// Saved themes in chrome.storage.local: { themes: [{ name, theme, scheme }] }
async function getThemes() {
  const data = await chrome.storage.local.get('themes');
  return Array.isArray(data.themes) ? data.themes : [];
}
async function setThemes(list) {
  await chrome.storage.local.set({ themes: list });
}

function renderSavedThemes(list) {
  els.themeList.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No saved themes yet.';
    els.themeList.appendChild(li);
    return;
  }
  list.forEach((entry, idx) => {
    const li = document.createElement('li');
    const dots = ['bg', 'surface', 'primary', 'secondary', 'accent']
      .map(r => `<span style="background:${entry.theme[r]}"></span>`).join('');
    li.innerHTML = `<div class="themeDots">${dots}</div><span class="themeName"></span>`;
    li.querySelector('.themeName').textContent = entry.name;
    const load = document.createElement('button');
    load.className = 'btn ghost small';
    load.textContent = 'Load';
    load.addEventListener('click', () => {
      current = { theme: entry.theme, params: { scheme: entry.scheme } };
      renderPalette(entry.theme);
      renderPreview(entry.theme);
      toast('Theme loaded');
    });
    const del = document.createElement('button');
    del.className = 'btn ghost small';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      const fresh = await getThemes();
      fresh.splice(idx, 1);
      await setThemes(fresh);
      renderSavedThemes(fresh);
    });
    li.appendChild(load);
    li.appendChild(del);
    els.themeList.appendChild(li);
  });
}

// Export current theme as a .css variables file.
function exportCss() {
  if (!current) return;
  const safeName = (els.themeName.value.trim() || 'theme-forge').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const css = `/* Theme Forge — generated theme (color math, not neural) */\n${themeToCss(safeName, current.theme)}\n`;
  const blob = new Blob([css], { type: 'text/css' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}-theme.css`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('CSS exported');
}

// Events.
els.hue.addEventListener('input', () => rebuild());
els.sat.addEventListener('input', () => rebuild());
els.light.addEventListener('input', () => rebuild());
els.scheme.addEventListener('change', () => rebuild());
els.generate.addEventListener('click', () => {
  // Empty seed => random seed so every click differs; store it back for reproducibility.
  if (els.seed.value.trim() === '') els.seed.value = Math.floor(Math.random() * 999999);
  rebuild(els.seed.value.trim());
  toast('Theme generated');
});
els.save.addEventListener('click', async () => {
  const name = els.themeName.value.trim();
  if (!name) { toast('Name the theme first'); return; }
  const list = await getThemes();
  list.unshift({ name, theme: current.theme, scheme: current.params.scheme });
  await setThemes(list.slice(0, 50));
  els.themeName.value = '';
  renderSavedThemes(await getThemes());
  toast('Theme saved');
});
els.export.addEventListener('click', exportCss);

// Init.
(async function init() {
  rebuild();
  renderSavedThemes(await getThemes());
})();
