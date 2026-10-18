/* Repurpose Planner — template-based outline generator. No AI. 100% local. */
'use strict';

/** Default templates. Placeholders: {{topic}}, {{pointN}}, {{allpoints}}. */
const DEFAULT_TPL = {
  short: `HOOK (0-3s): {{topic}} — but here's what nobody tells you…\nBEAT 1: {{point1}}\nBEAT 2: {{point2}}\nBEAT 3: {{point3}}\nCTA: Follow for more on {{topic}}. Save this for later.`,
  carousel: `Slide 1 (Cover): {{topic}}\nSlide 2: {{point1}}\nSlide 3: {{point2}}\nSlide 4: {{point3}}\nSlide 5 (CTA): Which one surprised you? Comment below.`,
  long: `INTRO: Why {{topic}} matters right now.\nCHAPTER 1: {{point1}}\nCHAPTER 2: {{point2}}\nCHAPTER 3: {{point3}}\nOUTRO: Quick recap — {{allpoints}}. Subscribe for the deep dive.`,
  news: `Subject line: The truth about {{topic}}\n—\nHey reader,\nToday: {{topic}}.\n1. {{point1}}\n2. {{point2}}\n3. {{point3}}\nYour take? Hit reply.`
};

const $ = (id) => document.getElementById(id);
const store = {
  async get(k, fb) { const r = await chrome.storage.local.get(k); return r[k] ?? fb; },
  async set(o) { await chrome.storage.local.set(o); }
};

/** Fill template placeholders from topic + points array. */
function fill(template, topic, points) {
  let out = template.replaceAll('{{topic}}', topic || '[topic]');
  out = out.replaceAll('{{allpoints}}', points.length ? points.join(' · ') : '[points]');
  for (let i = 0; i < points.length; i++) {
    out = out.replaceAll(`{{point${i + 1}}}`, points[i]);
  }
  // Any point placeholder left over → mark as missing so the user knows.
  out = out.replace(/\{\{point\d+\}\}/g, '[add point]');
  return out;
}

function renderPanel(elId, text) {
  const el = $(elId);
  el.innerHTML = '';
  if (!text) { el.innerHTML = '<div class="empty">Fill in your topic & points, then hit Generate.</div>'; return; }
  const pre = document.createElement('div');
  pre.className = 'outline';
  pre.textContent = text;
  const btn = document.createElement('button');
  btn.className = 'copy';
  btn.textContent = 'Copy outline';
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied ✓';
    setTimeout(() => (btn.textContent = 'Copy outline'), 1200);
  });
  el.append(pre, btn);
}

async function generate() {
  const topic = $('topic').value.trim();
  const points = $('points').value.split('\n').map((s) => s.trim()).filter(Boolean);
  const tpl = {
    short: $('tpl-short').value, carousel: $('tpl-carousel').value,
    long: $('tpl-long').value, news: $('tpl-news').value
  };
  await store.set({ topic, points, tpl });
  if (!topic && !points.length) {
    ['out-short', 'out-carousel', 'out-long', 'out-news'].forEach((id) => renderPanel(id, ''));
    return;
  }
  renderPanel('out-short', fill(tpl.short, topic, points));
  renderPanel('out-carousel', fill(tpl.carousel, topic, points));
  renderPanel('out-long', fill(tpl.long, topic, points));
  renderPanel('out-news', fill(tpl.news, topic, points));
}

async function init() {
  // Restore saved state.
  const topic = await store.get('topic', '');
  const points = await store.get('points', []);
  const tpl = await store.get('tpl', DEFAULT_TPL);
  $('topic').value = topic;
  $('points').value = points.join('\n');
  $('tpl-short').value = tpl.short ?? DEFAULT_TPL.short;
  $('tpl-carousel').value = tpl.carousel ?? DEFAULT_TPL.carousel;
  $('tpl-long').value = tpl.long ?? DEFAULT_TPL.long;
  $('tpl-news').value = tpl.news ?? DEFAULT_TPL.news;
  if (topic || points.length) generate();

  $('generate').addEventListener('click', generate);

  // Tabs.
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      $('out-' + b.dataset.tab).classList.add('active');
    });
  });

  // Template editing.
  $('saveTpl').addEventListener('click', async () => {
    await store.set({ tpl: {
      short: $('tpl-short').value, carousel: $('tpl-carousel').value,
      long: $('tpl-long').value, news: $('tpl-news').value
    } });
    $('saveTpl').textContent = 'Saved ✓';
    setTimeout(() => ($('saveTpl').textContent = 'Save templates'), 1200);
  });
  $('resetTpl').addEventListener('click', () => {
    $('tpl-short').value = DEFAULT_TPL.short;
    $('tpl-carousel').value = DEFAULT_TPL.carousel;
    $('tpl-long').value = DEFAULT_TPL.long;
    $('tpl-news').value = DEFAULT_TPL.news;
  });
}

document.addEventListener('DOMContentLoaded', init);
