# Floating Ping Pong Arcade

A harmless, **user-triggered** ping-pong game that floats over the current tab.

## How it works

1. Open the extension popup and click **Play on this tab**.
2. A draggable floating panel appears with a ping-pong game: your paddle (bottom, emerald) vs an AI paddle (top).
3. Move with your **mouse** or **← →** keys. **Space** pauses. Click the panel to restart after a match ends.
4. Click the **×** button (or the popup button again) to remove the panel.

## Features

- Adjustable difficulty (Easy / Medium / Hard) — AI speed and ball speed.
- Adjustable points-to-win (3 / 5 / 11).
- Best score and win count persist in `chrome.storage.local`.
- Rally ball speed ramps up slightly for excitement.

## Honest scope

- This is a **toy game only**. The floating panel is the **only** thing added to the page; closing it removes every trace.
- The page itself is **never modified** — no DOM changes, no tracking, no network calls.
- Nothing runs until you click the button.

## Permissions

- `storage` — saves your settings, best score, and wins.
- `activeTab` + `scripting` — shows the game panel on the tab you explicitly choose, nothing else.
