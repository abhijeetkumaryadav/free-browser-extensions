# Cookie Jar — Sandbox Cookie Profiles

Per-domain cookie profiles: snapshot, clear and restore cookie sets in named, isolated "jars". Everything runs locally; there is no network activity.

## What it does

- **Cookie viewer** — lists every cookie on the current tab's domain with flags (httpOnly / secure / session) and a per-cookie delete button.
- **Save snapshot** — stores the domain's current cookies as a named jar (e.g. "Logged-in", "Fresh").
- **Restore** — replaces the domain's current cookies with a saved jar's set.
- **Clear cookies** — removes all cookies for the current domain.
- **Delete all jars** — wipes every saved jar (current browser cookies untouched).

## Honest scope (read this)

- Jars are **manual cookie profiles**, not true browser container isolation. They do not provide VPN-like separation or fingerprint protection.
- Restoring a jar replaces cookies — the site will see you as logged in or logged out depending on what the jar held. Some cookies are server-side signed and restoring old ones may simply log you out.
- Cookies marked `httpOnly`/secure are handled through the standard `chrome.cookies` API; a few exotic cookies may refuse to restore — failures are logged, not retried aggressively.

## Files

- `manifest.json` — MV3; permissions: `cookies`, `storage`, `tabs`, `activeTab`; host `<all_urls>` (needed to read/clear cookies across domains, declared in the store listing)
- `popup.html` / `popup.css` / `popup.js` — 380 px deep-dark glassmorphism UI, teal accent

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
