# Readability Font Scaler v1.0.0

Make any page comfortable to read: adjust base font size (12–28px slider),
line height (1.2–2.4), and font family (serif / sans / system) with live
preview. Settings are remembered per site, with a global fallback, a global
reset, and a one-click toggle that restores the page exactly. Fully
non-destructive and reversible — all on-device.

## Features

- **Font size slider** (12–28px) and **line height slider** (1.2–2.4)
- **Serif / Sans / System** font family switch
- **Per-site memory** — each hostname keeps its own settings
- **"Everywhere" scope** — set a global fallback for sites you haven't
  customized
- **One-click toggle** — disable instantly, original styling restored
- **Reset this site / Reset all** — clean slate whenever you want
- Live preview as you drag; persisted after a short settle debounce

## How it works

A content script injects a single `<style>` block scoped under an
`html.readability-scaled` class. Toggling off or resetting removes the
style block and class entirely — the page returns to its original state.

## Install (development)

**Chrome / Edge**
1. Unzip `readability-font-scaler.zip`
2. Go to `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select the folder's `manifest.json`
   (temporary installs unload on browser restart)

## Permissions (minimal, justified)

| Permission | Why |
|------------|-----|
| `storage` | Save per-site and global typography settings locally |
| `activeTab` | Read the current tab's hostname to load/save its settings |

The content script only ever injects the typography `<style>` override —
it never reads page content, credentials, or keystrokes.

## Publishing notes

- Chrome Web Store: $5 one-time developer registration, MV3 compliant
- Edge Add-ons: free account, same package
- Firefox Add-ons: free, requires Mozilla signing
- Opera: same Chromium package via Opera's developer portal
