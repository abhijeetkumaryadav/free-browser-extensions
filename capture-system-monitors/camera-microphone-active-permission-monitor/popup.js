/* PrivWatch — popup logic.
 * Reads permission states via the Permissions API (popup context) and, where
 * available, the default content-setting via chrome.contentSettings.
 * Everything runs locally. Nothing is transmitted anywhere. */

'use strict';

const $ = (id) => document.getElementById(id);

/* Friendly explanation per permission state. */
const STATE_NOTES = {
  camera: {
    granted: 'Sites you previously allowed can access your camera without asking again.',
    denied: 'Camera access is blocked. No site can use your camera.',
    prompt: 'Sites must ask each time before using your camera.',
    unknown: 'Permission state could not be determined in this browser.',
  },
  microphone: {
    granted: 'Sites you previously allowed can access your microphone without asking again.',
    denied: 'Microphone access is blocked. No site can use your microphone.',
    prompt: 'Sites must ask each time before using your microphone.',
    unknown: 'Permission state could not be determined in this browser.',
  },
};

/**
 * Set the visual state pill for a device card.
 * @param {'camera'|'microphone'} device
 * @param {PermissionState|string} state
 */
function setDeviceState(device, state) {
  const pill = $(device === 'camera' ? 'cameraState' : 'micState');
  const note = $(device === 'camera' ? 'cameraNote' : 'micNote');
  const known = ['granted', 'denied', 'prompt'].includes(state) ? state : 'unknown';
  pill.dataset.state = known;
  pill.querySelector('.state-text').textContent =
    known === 'unknown' ? 'Unknown' : known.charAt(0).toUpperCase() + known.slice(1);
  note.textContent = STATE_NOTES[device][known];
}

/**
 * Query the Permissions API for camera + microphone.
 * Attaches live change listeners so the UI updates if the user
 * changes permissions while the popup is open.
 */
async function checkPermissions() {
  for (const device of ['camera', 'microphone']) {
    try {
      const status = await navigator.permissions.query({ name: device });
      setDeviceState(device, status.state);
      // Live-update if the state changes while the popup is open.
      status.onchange = () => setDeviceState(device, status.state);
    } catch (err) {
      // Permissions API may not support the descriptor in some browsers.
      setDeviceState(device, 'unknown');
    }
  }
}

/**
 * Read the browser's default content-setting for camera/mic.
 * chrome.contentSettings is Chromium-only; guard everything.
 */
function checkContentSettings() {
  const hasApi =
    typeof chrome !== 'undefined' &&
    chrome.contentSettings &&
    chrome.contentSettings.camera &&
    chrome.contentSettings.microphone;

  if (!hasApi) {
    $('cameraDefault').textContent = 'n/a';
    $('micDefault').textContent = 'n/a';
    return;
  }

  const pattern = 'https://*/*'; // primary pattern for the default rule
  chrome.contentSettings.camera.get({ primaryUrl: pattern }, (details) => {
    $('cameraDefault').textContent = chrome.runtime.lastError
      ? 'n/a'
      : String(details.setting || 'n/a');
  });
  chrome.contentSettings.microphone.get({ primaryUrl: pattern }, (details) => {
    $('micDefault').textContent = chrome.runtime.lastError
      ? 'n/a'
      : String(details.setting || 'n/a');
  });
}

/** Open the browser's site-permission settings page for a device. */
function openSettingsPage(kind) {
  // chrome://settings/content/{camera,microphone} — Chromium/Edge/Opera.
  // Firefox users get the generic site-permissions page instead.
  const isFirefox =
    typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
  const url = isFirefox
    ? 'about:preferences#privacy'
    : `chrome://settings/content/${kind}`;
  chrome.tabs.create({ url });
}

function stampCheckedTime() {
  $('checkedLine').textContent =
    'Last checked: ' + new Date().toLocaleTimeString();
}

/* Wire up. */
$('refreshBtn').addEventListener('click', async () => {
  await checkPermissions();
  checkContentSettings();
  stampCheckedTime();
});
$('openCameraSettings').addEventListener('click', () => openSettingsPage('camera'));
$('openMicSettings').addEventListener('click', () => openSettingsPage('microphone'));

(async function init() {
  await checkPermissions();
  checkContentSettings();
  stampCheckedTime();
})();
