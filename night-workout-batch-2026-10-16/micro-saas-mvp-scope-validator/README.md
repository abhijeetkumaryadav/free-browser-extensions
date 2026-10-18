# MVP Scope Validator

A heuristic checklist that scores your micro-SaaS feature list for MVP scope risk and suggests cuts from bundled rules-of-thumb.

**Honest scope:** this is a heuristic checklist, NOT business advice. The risk score and suggested cuts come from bundled rules-of-thumb (e.g. must-have effort above ~60 days is rarely a real MVP; features over ~15 days usually hide a sub-project). Use your own judgment and talk to real users.

## Features

- Feature list with effort estimates (days) and must-have / nice-to-have flags
- 0–100 scope-risk score with a LOW / MEDIUM / HIGH band and a plain-language verdict
- Suggested cuts: split oversized features, defer nice-to-haves, reduce must-have count
- Copyable scope summary (plain text) for sharing with co-founders
- 100% local via `chrome.storage.local`

## Permissions

- `storage` — store your feature list locally. Nothing leaves the browser.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
