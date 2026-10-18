# Font Enlarger + Auto Contrast

Accessibility reading aid: enlarge page fonts and automatically boost text contrast toward a WCAG-ish target ratio. A comfort aid — **not a medical device**.

## What it does

- **Text size slider (100–200%)** — per-element font scaling; originals are preserved and restored exactly on reset
- **Auto contrast boost** — for every text element, the effective background is computed (walking up through transparent ancestors) and the foreground colour's lightness is nudged toward black or white until the target contrast ratio is met. Hue is preserved
- **Contrast target slider (3.0–7.0 : 1)** — default 4.5 : 1
- **Presets** — Off / Comfortable / Large / Extra large
- **Remember for this site** — per-hostname memory; the content script auto-applies on page load when enabled
- **Reset** — removes every injected style and restores the page exactly

## Honest scope

This adjusts CSS rendering only. It cannot change the OS font rasterizer, fix broken web fonts, or guarantee any specific accessibility standard — it is a comfort aid. Contrast boosting is heuristic: on photographic or gradient backgrounds the "effective background" is an approximation.

## Permissions

- `storage` — settings + per-site memory
- `activeTab` + `scripting` — apply/reset messaging with the page
- Host `<all_urls>` — lets the content script auto-apply remembered settings on navigation

No network calls. Nothing leaves your device.

## Install

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder (or drag in the `.zip`)
3. Open any page, set your size/contrast, click **Apply to this page**

## Publishing notes

- Manifest V3, no remote code, no data collection — store-friendly
- Screenshots: popup + a before/after of an article page
