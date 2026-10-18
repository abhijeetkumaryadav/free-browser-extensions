# Keyboard Shortcut Mapper v1.0.0

Map your own keyboard shortcuts to two kinds of actions: **open a
favorite URL** in a new tab, or **copy a saved snippet** to the
clipboard. Eight slots, each fully editable from the popup —
give it a name, pick the action type, and test it instantly.

**Assigning keys:** browsers don't let extensions open
`chrome://` pages, so press keys are assigned at
`chrome://extensions/shortcuts` (copy the address from the popup's
help card, paste it into the address bar, find this extension, and
set a key per slot). The popup shows each slot's currently assigned
key live.

## Try it
1. Unzip `keyboard-shortcut-mapper.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, fill in a slot, then assign a key at
   `chrome://extensions/shortcuts`.

## Publishing notes
- Permissions: `storage` (slot definitions, on-device), `offscreen`
  (clipboard helper document used when a snippet shortcut fires —
  required because service workers can't touch the clipboard
  directly). No host permissions, no network, nothing uploaded.
- Commands are user-triggered only.
- Chrome Web Store: $5 one-time dev fee.
