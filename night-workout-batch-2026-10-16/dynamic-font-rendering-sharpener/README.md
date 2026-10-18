# FontSharp — Font Rendering Sharpener

Fine-tune font rendering on any web page: smoothing hints, letter spacing, and a
contrast boost. Pure CSS injection through an on-demand content script — nothing
is read, stored, or transmitted.

## Features

- **Presets** — Crisp, Soft, Reader, Off, one click away.
- **Font smoothing** — None / Auto / Antialiased rendering hints.
- **Letter spacing** — 0 to 0.25em in fine steps.
- **Contrast boost** — 0–60% subtle CSS contrast lift.
- **Per-site memory** — toggle "remember this site" and settings re-apply on load.
- **Reset page** — removes the injected stylesheet instantly, restoring the page exactly.

## Honest scope

This extension adjusts **CSS rendering hints only**. It cannot change your
operating system's font rasterizer, repair broken web fonts, or alter a site's
actual typefaces. Results vary by browser, OS, and monitor.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Click the toolbar icon on any web page, tune the sliders, hit **Apply to this page**.

## Permissions

- `storage` — saves your slider settings and per-site list locally.
- `activeTab` + `scripting` — injects the tuning stylesheet only when you click Apply.

No network access. No analytics. Your settings never leave the device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Minimal permissions, all justified above.
- No remote code, no bundled libraries.
