# CSS Animation Performance Profiler

Scan any web page for CSS animations, transitions, and `@keyframes` rules, and get a performance audit: each animation is classified as **Smooth** (compositor-only: transform/opacity), **Paint-heavy** (color, background, box-shadow…), or **Expensive** (layout-triggering: width, height, top, margin…), with a plain-English tip for fixing it.

## Install

**Chrome / Edge**
1. Unzip `css-animation-performance-profiler.zip`
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and pick `manifest.json`

## Usage
Click the toolbar icon → **Scan this page**. The extension reads the page's style sheets and computed styles (read-only) and renders a report sorted worst-first.

## Permissions
- `activeTab` — access the current tab only when you click the icon
- `scripting` — inject the read-only scanner on demand

No network requests, no data stored, no page modification. The scan cannot run on browser-internal pages (`chrome://`, `about:`, web stores) — a friendly notice is shown instead.

## Publishing notes
MV3, no deprecated APIs. Minimal justified permissions. Read-only analysis makes store review straightforward.
