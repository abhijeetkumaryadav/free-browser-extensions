# PanelGlow — Manga Reading Display Tuner

Per-site brightness, contrast, grayscale and invert tuning for comfortable manga, comic and long-form reading — day or night.

## What it does

- Sliders for **brightness** (20–200%), **contrast** (20–200%), **grayscale** and **invert** (0–100%), applied as CSS filters to the page.
- One-click presets: **Day**, **Night**, **Paper**.
- Settings are **remembered per site** and re-applied automatically when you revisit.
- Master toggle per site; Reset restores the original page exactly. Fully reversible — nothing is permanent.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save per-site display settings on-device. |
| `activeTab` | Identify the current tab's site for per-site memory. |
| `scripting` | Inject the filter stylesheet on the current tab only when you adjust settings. |

No network access, no analytics, no data leaves your device.

## Notes

- Filters are CSS-only and removed when you toggle off or reset.
- Cannot run on `chrome://` or extension-store pages (browser restriction).
- Heavily filtered pages may slightly reduce rendering performance on very old hardware.
