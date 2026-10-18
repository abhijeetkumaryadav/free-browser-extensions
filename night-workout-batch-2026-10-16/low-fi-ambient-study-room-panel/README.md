# Lo-Fi Study Room

A cozy study companion in your toolbar: an animated lo-fi scene (rainy window, sleeping cat, warm lamp), a Pomodoro focus timer that keeps running when the panel closes, daily session stats, and ambient sound synthesized live in your browser — no audio files, no network, 100% offline.

## Features

- **Animated scene** — rain streaks on a night window, a breathing sleeping cat, warm lamp glow (canvas, respects nothing but vibes)
- **Pomodoro timer** — Focus 25 / Break 5 / Rest 15 presets; state owned by the background service worker so the timer survives the popup closing; desktop notification when a session completes
- **Session stats** — today's focus sessions, breaks, and focus minutes (resets daily)
- **Ambient sound** — rain (filtered noise) and brown noise synthesized with WebAudio; volume slider. Sound plays while the panel is open.

## Honest scope

- The cat does not judge your productivity. The rain is decorative, not meteorological.
- Timer notifications require the `notifications` permission; stats and timer state use `storage`; `alarms` keeps the session end accurate in the background.
- No remote requests, no analytics, no accounts.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin the extension and click the toolbar icon to open your study room.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Timer state, mode, daily stats |
| `alarms` | Accurate session-end timing in the background |
| `notifications` | "Session complete" desktop notification |

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` (scene + UI + WebAudio) · `background.js` (timer state, alarms, stats) · `icons/` · `README.md`

v1.0.0 — Manifest V3.
