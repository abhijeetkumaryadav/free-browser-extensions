# Word Killer — DOM Element Shooter

A typing arcade game that runs on any tab: words fall styled as DOM
elements (`<div>`, `<span>`, `<button>`…), and you type each word exactly
to shoot it before it reaches the bottom.

> **Honest scope:** this is a **game on a canvas-style overlay**. The page
> itself is **never modified** — words are rendered in a single overlay
> layer, and Esc (or Close) removes every trace. User-triggered only.

## Gameplay

- **Start game on this tab** from the popup (choose Easy / Normal / Hard).
- Words spawn at the top and fall; each shows a DOM tag label.
- Type the full word to destroy it: `+10 × length` points, plus streak bonus.
- A wrong keystroke resets your buffer and breaks the streak.
- Words that reach the bottom cost a life. Lose all lives → game over.
- Live HUD: score, lives, streak, WPM, best score (persisted).
- Esc quits instantly and restores the page exactly.

## Permissions

- `activeTab` + `scripting` — inject the game overlay on the tab you click Start on. Nothing else.
- `storage` — persist difficulty and best score.

No network calls, no bundled word lists from the internet — everything is local.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
