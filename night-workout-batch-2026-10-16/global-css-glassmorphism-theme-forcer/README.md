# GlassForce — Glassmorphism Theme Forcer

Applies a frosted-glass glassmorphism theme to any web page: frosted panels on major
containers, backdrop blur, and a tinted background. User-triggered, pure CSS injection,
fully reversible.

## Features
- Power toggle applies/removes the theme on the active tab instantly
- 3 intensity presets: Soft, Frosted, Deep
- Blur strength (4–30px) and panel opacity sliders with live updates
- Optional per-site memory ("Remember for this site")

## Honest scope
- Pure CSS injection into the current tab — no page content is read, modified, or transmitted
- Turning the toggle off removes the injected `<style>` node and restores the page exactly
- All settings live in `chrome.storage.local`; nothing leaves your device

## Permissions
- `activeTab` + `scripting` — inject the theme CSS into the tab you click the toggle on
- `storage` — persist theme settings and per-site memory

## Install (developer mode)
1. Open `chrome://extensions`, enable Developer mode
2. "Load unpacked" → select this folder
3. Click the toolbar icon and flip the toggle
