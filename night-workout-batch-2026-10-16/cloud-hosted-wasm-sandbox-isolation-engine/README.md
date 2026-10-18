# Local Code Sandbox

Run your own JavaScript snippets in a **local sandboxed frame** with captured console output, snippet history, and a result display.

## Honest scope (read this first)

- ✅ Runs **on this device only** — zero network, 100% local.
- ✅ Sandboxed `<iframe>` (`sandbox="allow-scripts"`): no page DOM access, no extension APIs, no network.
- ❌ **NOT cloud-hosted.** Nothing runs on a server.
- ❌ **NOT WebAssembly.** It runs plain JavaScript.
- ❌ **NOT a security isolation engine.** Do not run untrusted code expecting strong isolation guarantees.
- ⚠️ A synchronous **infinite loop will hang the runner frame** — close and reopen the popup to reset. Promises get a 5-second watchdog.

## Features

- Code editor with **Run**, **Clear output**, and snippet naming
- Console capture (`console.log/info/warn/error`), uncaught errors, unhandled rejections, and the snippet's return value
- Snippet history (up to 50) persisted in `chrome.storage.local` — load or delete anytime
- Async support: returned promises are awaited (5s watchdog)

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, `storage` permission, sandbox page registration |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, styles, logic |
| `sandbox.html` | Sandboxed runner (separate CSP, eval allowed) |
| `icons/` | Generated PNG icons |

## Permissions

- `storage` — snippet history only. Nothing else is requested.

## Build validation

- `manifest.json` parses, Manifest V3
- `node --check` passes on `popup.js`
- Icons generated at 16/48/128 px
- `<slug>.zip` contains `manifest.json` at the zip root
