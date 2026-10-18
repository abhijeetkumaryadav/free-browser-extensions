# LocalStorage State Snapshotter v1.0.0

On any site, **capture** the current origin's `localStorage` +
`sessionStorage` into named snapshots. Later you can **restore** a
snapshot (with a confirmation prompt), **diff** any two snapshots
(added / removed / changed keys with values), and **export/import**
snapshots as JSON. Everything stays on-device.

Useful for debugging auth tokens, feature flags, cart state, A/B
test buckets — save a known-good state, experiment freely, restore
in one click.

## Try it
1. Unzip `localstorage-state-snapshotter.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any site → click the icon → **Capture** → change something
   on the site → capture again → tick two snapshots → **Compare**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read/write storage only
  on the page you explicitly capture or restore — never in the
  background), `storage` (snapshots, on-device). No host
  permissions, no network, nothing uploaded.
- Restore always asks for confirmation, and warns if the snapshot's
  origin differs from the current tab.
- Chrome Web Store: $5 one-time dev fee.
