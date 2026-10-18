/* SafetyRadius popup — manual check-in buddy. All state in chrome.storage.local. */
const PLACES_KEY = 'safety_places';       // [{id, name, note}]
const CONTACTS_KEY = 'safety_contacts';  // [{id, name, phone}]
const TIMER_KEY = 'safety_checkin';       // {active, place, startedAt, dueAt, minutes, overdue}

const $ = (id) => document.getElementById(id);
let state = { places: [], contacts: [], timer: null, minutes: 30 };
let tickHandle = null;

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- persistence ---------- */
async function load() {
  const d = await chrome.storage.local.get([PLACES_KEY, CONTACTS_KEY, TIMER_KEY]);
  state.places = d[PLACES_KEY] || [];
  state.contacts = d[CONTACTS_KEY] || [];
  state.timer = d[TIMER_KEY] || null;
}
async function saveTimer() { await chrome.storage.local.set({ [TIMER_KEY]: state.timer }); }

/* ---------- rendering ---------- */
function renderPlaces() {
  const list = $('place-list');
  const sel = $('place-select');
  if (!state.places.length) {
    list.innerHTML = '<div class="empty">No places yet — add one below (e.g. "Evening dog walk").</div>';
    sel.innerHTML = '<option value="">Add a place first…</option>';
    return;
  }
  list.innerHTML = state.places.map(p => `
    <div class="list-item" data-id="${p.id}">
      <div class="meta">
        <div class="name">${esc(p.name)}</div>
        ${p.note ? `<div class="sub">${esc(p.note)}</div>` : ''}
      </div>
      <button class="del" data-del-place="${p.id}" title="Remove place">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`).join('');
  sel.innerHTML = state.places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  if (state.timer?.placeId) sel.value = state.timer.placeId;
}

function renderContacts() {
  const list = $('contact-list');
  if (!state.contacts.length) {
    list.innerHTML = '<div class="empty">No contacts yet. Add someone you trust below.</div>';
    return;
  }
  list.innerHTML = state.contacts.map(c => `
    <div class="list-item" data-id="${c.id}">
      <div class="meta">
        <div class="name">${esc(c.name)}</div>
        ${c.phone ? `<div class="sub">${esc(c.phone)}</div>` : ''}
      </div>
      <button class="del" data-del-contact="${c.id}" title="Remove contact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`).join('');
}

function renderTimer() {
  const card = $('timer-card');
  const pill = $('status-pill');
  if (!state.timer || !state.timer.active) {
    card.hidden = true;
    pill.textContent = 'Idle';
    pill.className = 'status-pill';
    stopTicking();
    return;
  }
  card.hidden = false;
  $('timer-place').textContent = state.timer.place;
  pill.textContent = state.timer.overdue ? 'Overdue' : 'Armed';
  pill.className = 'status-pill ' + (state.timer.overdue ? 'overdue' : 'armed');
  startTicking();
  paintCountdown();
}

function paintCountdown() {
  const t = state.timer;
  if (!t || !t.active) return;
  const total = t.dueAt - t.startedAt;
  const remain = t.dueAt - Date.now();
  if (remain <= 0) {
    $('countdown').textContent = '00:00';
    $('progress-bar').style.width = '100%';
    return;
  }
  const m = Math.floor(remain / 60000);
  const s = Math.floor((remain % 60000) / 1000);
  $('countdown').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  $('progress-bar').style.width = `${Math.min(100, ((total - remain) / total) * 100)}%`;
}

function startTicking() {
  if (tickHandle) return;
  tickHandle = setInterval(paintCountdown, 1000);
}
function stopTicking() {
  clearInterval(tickHandle);
  tickHandle = null;
}

function renderAll() { renderPlaces(); renderContacts(); renderTimer(); }

/* ---------- timer actions ---------- */
async function startCheckin() {
  const placeId = $('place-select').value;
  const place = state.places.find(p => p.id === placeId);
  if (!place) return;
  const now = Date.now();
  state.timer = {
    active: true, overdue: false, overdueSince: null,
    placeId: place.id, place: place.name,
    startedAt: now, dueAt: now + state.minutes * 60000, minutes: state.minutes
  };
  await saveTimer();
  // Chrome alarms need ≥ 30s period; we fire one-shot at due time instead.
  const delayMin = Math.max(state.minutes, 0.5);
  await chrome.alarms.clear('safety_checkin');
  await chrome.alarms.create('safety_checkin', { when: now + delayMin * 60000 });
  renderTimer();
}

async function checkInSafe() {
  if (!state.timer) return;
  // Checking in re-arms for another interval (recurring check-ins), resets overdue.
  const now = Date.now();
  state.timer = {
    active: true, overdue: false, overdueSince: null,
    placeId: state.timer.placeId, place: state.timer.place,
    startedAt: now, dueAt: now + state.timer.minutes * 60000, minutes: state.timer.minutes
  };
  await saveTimer();
  await chrome.alarms.clear('safety_checkin');
  await chrome.alarms.clear('safety_overdue_nudge');
  const delayMin = Math.max(state.timer.minutes, 0.5);
  await chrome.alarms.create('safety_checkin', { when: now + delayMin * 60000 });
  renderTimer();
}

async function cancelCheckin() {
  state.timer = null;
  await saveTimer();
  await chrome.alarms.clear('safety_checkin');
  await chrome.alarms.clear('safety_overdue_nudge');
  renderTimer();
}

/* ---------- CRUD ---------- */
async function addPlace() {
  const name = $('new-place-name').value.trim();
  const note = $('new-place-note').value.trim();
  if (!name) return;
  state.places.push({ id: uid(), name, note });
  await chrome.storage.local.set({ [PLACES_KEY]: state.places });
  $('new-place-name').value = '';
  $('new-place-note').value = '';
  renderPlaces();
}

async function addContact() {
  const name = $('new-contact-name').value.trim();
  const phone = $('new-contact-phone').value.trim();
  if (!name) return;
  state.contacts.push({ id: uid(), name, phone });
  await chrome.storage.local.set({ [CONTACTS_KEY]: state.contacts });
  $('new-contact-name').value = '';
  $('new-contact-phone').value = '';
  renderContacts();
}

async function deleteItem(key, list, id) {
  const next = list.filter(x => x.id !== id);
  if (key === PLACES_KEY) state.places = next; else state.contacts = next;
  await chrome.storage.local.set({ [key]: next });
  renderPlaces(); renderContacts();
}

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  renderAll();

  // Interval segment
  $('interval-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-min]');
    if (!btn) return;
    document.querySelectorAll('#interval-seg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.minutes = parseInt(btn.dataset.min, 10);
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('pane-' + tab.dataset.tab).classList.add('active');
    });
  });

  $('start-btn').addEventListener('click', startCheckin);
  $('checkin-btn').addEventListener('click', checkInSafe);
  $('cancel-btn').addEventListener('click', cancelCheckin);
  $('add-place-btn').addEventListener('click', addPlace);
  $('add-contact-btn').addEventListener('click', addContact);
  $('new-place-name').addEventListener('keydown', e => { if (e.key === 'Enter') addPlace(); });
  $('new-contact-name').addEventListener('keydown', e => { if (e.key === 'Enter') addContact(); });

  // Delegated deletes
  document.addEventListener('click', (e) => {
    const dp = e.target.closest('[data-del-place]');
    if (dp) { deleteItem(PLACES_KEY, state.places, dp.dataset.delPlace); return; }
    const dc = e.target.closest('[data-del-contact]');
    if (dc) { deleteItem(CONTACTS_KEY, state.contacts, dc.dataset.delContact); }
  });
});

// Refresh timer state when popup reopens while armed.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[TIMER_KEY]) {
    state.timer = changes[TIMER_KEY].newValue;
    renderTimer();
  }
});
