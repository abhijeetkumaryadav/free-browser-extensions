# LineSorter — Sort & Dedupe Lines

Paste a list of lines, sort them, remove duplicates and blank lines, shuffle or reverse — then copy the result. Everything runs locally in your browser; your text never leaves the device.

## Features

- **Sort orders:** A→Z, Z→A, natural (`file-1, file-2, file-10` — not `file-1, file-10, file-2`), numeric (numbers first, sorted; text falls back to A→Z).
- **Dedupe modes:** exact matches, ignore-case, or trim-then-exact.
- **Cleanup:** remove blank lines, trim each line.
- **Shuffle** (Fisher–Yates) and **Reverse**.
- **Live stats:** input line count, output line count, lines removed.
- **Before/after:** input stays editable, result is read-only; copy with one click.
- **State persistence:** input, result and options are restored next time you open the popup.

## Install (Chrome / Edge / Opera)

1. Unzip the `.zip` into a folder.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.

## Install (Firefox)

1. Unzip the `.zip` into a folder.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` in the folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your input, result and option settings between popup sessions. Nothing else. |

No network access, no content scripts, no data collection.

## Publishing notes

- Manifest V3, works in Chrome/Edge/Opera/Firefox.
- Single permission (`storage`), trivially reviewable.
- No remote code, no tracking, no analytics.
