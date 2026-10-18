# FillerSkip — Anime Filler Episode Guide

Pick a series, enter an episode number, get a **CANON / MIXED / FILLER** verdict with color coding — plus per-series canon/mixed/filler counts. You can also add your own series with custom episode ranges. All on-device; nothing leaves your browser.

## Install

1. Download and unzip `anime-filler-episode-skipper.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin the extension, then click its toolbar icon.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`. (Temporary installs are removed on browser restart.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persists your custom series, last-selected series, and preferences on-device. |

No host permissions, no network calls, no content scripts, no analytics.

## Use

1. Select a series (Naruto, Naruto Shippuden, One Piece, Bleach, Dragon Ball Z, or a custom one).
2. Enter an episode number and press **Check**.
3. The verdict card shows CANON (green), MIXED (amber), FILLER (red), or UNKNOWN (gray, outside the dataset).
4. **Add your own series**: expand the section, enter a name, total episodes, and one `from-to type` range per line (`canon`, `mixed`, or `filler`), then Save. Select it later to edit or delete it.

## Built-in dataset

Compiled **October 2026** from commonly cited community filler lists. Ranges are **approximate** — episode classifications can shift as lists are corrected, and One Piece is covered to episode 1100. Always verify a verdict against an up-to-date source (e.g. animefillerlist.com) before trusting it.

## Publishing notes

- Manifest V3 only; no deprecated APIs.
- Minimal, justified permissions (`storage` only).
- No remote code, no external requests, no data collection — store-review friendly.
- Icons: generated PNGs (16/48/128) in `icons/`.
