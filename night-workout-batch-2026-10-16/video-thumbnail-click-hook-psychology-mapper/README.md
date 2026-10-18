# ThumbnailLab — Thumbnail Self-Audit

Score **your own** thumbnails against a click-psychology checklist
(face present, emotion clarity, text word count, contrast, curiosity gap)
and compare trait averages against **your own logged CTR notes**.

## Honest scope

- **Self-audit only.** Trends come from *your* entries and *your* CTR numbers —
  this is not a predictor of virality and cannot tell you what will perform.
- Gaps shown in the Trends view describe differences inside your logged data.
- 100% local (`chrome.storage.local`). Zero network calls. Nothing leaves the browser.

## Features

- **Score tab** — checklist form: label, optional thumbnail ref, face toggle,
  emotion/contrast/curiosity sliders (1–5), text-word count, your CTR % from
  your own analytics. Checklist total is /21 (face + ≤4-word bonus + 3× 5-point traits).
- **Trends tab** — per-trait averages across all entries, plus a high/low CTR
  split at the median once ≥2 entries carry CTR data.
- **Thumbs tab** — sorted list (CTR desc, then newest) with score rings,
  delete, JSON export, clear-all.
- Deep-dark glassmorphism UI (380px popup), single sky accent.

## Permissions

- `storage` — persists your scored thumbnails locally.

## Install (development)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension and open the popup.

## Validation

- `node --check` on all JS files
- `manifest.json` parses (Manifest V3)
- Icons generated (16/48/128 PNG)
