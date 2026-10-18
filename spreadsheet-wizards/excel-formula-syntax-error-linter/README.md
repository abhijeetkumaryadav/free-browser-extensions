# FormulaLint — Excel & Sheets Formula Linter

Paste an Excel or Google Sheets formula and get instant, on-device linting:
parenthesis balance, quote balance, function-name spelling with did-you-mean
suggestions, argument-count checks against a 238-function catalog, and
common-mistake detection (semicolon separators, doubled operators, empty
argument slots, missing `=`, trailing operators).

## Install (unpacked)

**Chrome / Edge**
1. Unzip the release archive.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.

## Permissions

- `storage` — persists your draft formula and lint options between popup opens. Nothing leaves your device.

## Privacy

All checks run 100% on-device. No network calls, no analytics, no remote code.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permission set (`storage` only) with in-README justification.
- All assets (icons) generated locally; no remote fonts or scripts.
