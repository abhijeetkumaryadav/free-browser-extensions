# Thread Formatter — Tweet Previewer

Paste long-form text and turn it into a numbered **X/Twitter thread**:
smart 280-character splitting, a live thread preview styled like X,
drag-to-reorder, per-tweet character counts, click-to-edit, and one-click
copy of the whole numbered thread. Everything runs locally — no network,
no accounts, no tracking.

## Features

- **Smart splitting** — breaks at sentence boundaries first, then word
  boundaries, reserving room for the `n/m` numbering so tweets never overflow.
- **Live thread preview** — cards styled like X with per-tweet char counts
  and usage bars that turn red past 280.
- **Drag to reorder** — grab the ⋮⋮ handle and rearrange tweets.
- **Click to edit** — any tweet is editable inline; counts update live.
- **Numbering options** — suffix (`text 1/5`) or prefix (`1/5 text`), or off.
- **Copy thread** — copies all tweets separated by blank lines, numbered.
- **Remembers your work** — restores your last thread on this device.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the folder. (Temporary until restart, per Firefox policy.)

## Permissions

- `storage` — saves your draft thread and preferences on this device only.
  Nothing is synced or transmitted.

## Publishing notes

- Manifest V3, no remote code, no network requests, no analytics.
- Single `storage` permission, all data stays local.
- Store-safe: standard popup utility, no policy-sensitive behavior.
