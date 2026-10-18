# Font Fingerprint Scrambler v1.0.0

Websites can enumerate your installed fonts via canvas measurement — each unusual font is another bit of your fingerprint. This extension fights back two ways:

1. **Detection report** — probes a list of ~50 fonts with the same canvas-`measureText` technique trackers use, and shows which are detectable on your device. Fonts common enough not to add entropy are badged "common". The probe runs locally; the list never leaves your browser.
2. **Per-site standardization** — toggle it for the current site and the extension injects a tiny common font stack (`Segoe UI / Arial / Helvetica`) plus a monospace fallback, shrinking what font-probing can learn. Stored per-origin, re-applied on navigation, fully reversible by unchecking.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable **Developer mode** → **Load unpacked** → select the folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. (Temporary: reload after each browser restart.)

## Permissions

- `storage` — remembers which origins you enabled standardization for.
- `activeTab` + `scripting` — reads the current tab's origin and injects/removes the standardizing stylesheet only when you toggle it. Never reads page content, credentials, or keystrokes.

## Publishing notes

- MV3, no remote code, no network calls — straightforward for Chrome Web Store / Edge Add-ons review.
- Honest limitation: the stylesheet cannot apply to browser-internal pages (`chrome://`, web store) — the popup says so instead of failing silently.
