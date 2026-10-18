# Cookie Session Isolator v1.0.0

Privacy session reset for the site you're on. Lists all cookies for
the current site (name, masked value preview, domain, expiry), then
lets you wipe cookies, localStorage, sessionStorage, indexedDB,
service workers and cache for that origin with a two-step
confirmation. **Fresh session** clears everything and reloads the
page for a clean slate.

This is a privacy tool for resetting your own session state — not a
way to bypass paywalls or access controls.

## Try it
1. Unzip `cookie-session-isolator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon on any site to inspect and reset its session data.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions (all justified)
- `cookies` + host access: list and remove this site's cookies only.
- `browsingData`: clear the current origin's cookies, localStorage,
  indexedDB, service workers and cache.
- `scripting` + `activeTab`: clear sessionStorage in the current tab
  (not covered by browsingData) and reload on "Fresh session".
- `storage`: nothing stored yet; reserved for future preferences.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee; declare the data
  deletion purpose in the privacy tab.
- No data ever leaves the device.
