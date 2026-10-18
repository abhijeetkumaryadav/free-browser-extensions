# Goose Chaos — Desktop Prank Pal

A mischievous animated goose that wanders your web pages. It waddles along the
bottom of the screen, sits, pecks, honks (visual "HONK!" popups), gently nudges
nearby page elements, and — at maximum mischief — chases your cursor.

Harmless prank toy: 100% local, no tracking, no network. **Fully reversible** —
Dismiss removes the goose and restores every element it touched.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Click the toolbar icon → **Summon Goose**.

## Features

- SVG goose in an isolated Shadow DOM (page CSS can't break it)
- Behaviour state machine: wander / sit / honk / nudge / cursor-chase
- Mischief level 1–3 (wander+honk → +element nudges → +cursor chase)
- Honk popups toggle; **Honk now** button plays a synthesized honk —
  sound is produced **only** on explicit click, never autoplays
- Settings persist in `chrome.storage.local`; goose reacts live to changes
- Respects `prefers-reduced-motion`

## Honest scope

This is a prank toy, not a game engine. Element "nudges" are small temporary
CSS transforms on nearby elements that are always reverted. The goose never
modifies page content, never collects data, and never makes network requests.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save mischief level and preferences |
| `activeTab` + `scripting` | Inject the goose overlay only when you summon it |

## Publishing notes

- Manifest V3, zero remote code, zero network calls.
- No user data collected — safe for Chrome Web Store listing.
