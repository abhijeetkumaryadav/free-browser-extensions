# Macro Recorder — Client-Side Browser Macros

Record clicks, typing and scrolls on the current page, save them as named macros, and replay them on demand. Everything runs locally in your browser; there is no network activity at all.

## What it does

- **Record** — click ● Record, interact with the page normally (click links/buttons, type in fields, scroll), then ■ Stop. Events are saved as a named macro.
- **Replay** — click ▶ Replay on any macro. It replays the recorded clicks, typing and scrolls **once** in the current visible tab.
- **Manage** — rename-free simple list: macros show step count and save date; delete any time.

## Safety limits (honest scope)

- Runs **only** in the visible tab, and **only** when you explicitly click Record, Stop or Replay. Nothing happens unprompted.
- **Never records password fields** — `<input type="password">`, hidden fields, and fields named password/pin/otp/secret/cvv are skipped during both recording and replay.
- Replay performs plain synthetic clicks. It does not silently submit forms — it only does what a real mouse would do at each recorded step.
- Intended for your own repetitive tasks (filling routine forms, repeated navigation flows). Not a scraping or automation-as-a-service tool.
- Pause lengths between your actions are preserved but clamped to a maximum of ~1.5 s so replays stay snappy.

## Files

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`
- `popup.html` / `popup.css` / `popup.js` — 380 px deep-dark glassmorphism UI, amber accent
- `content.js` — records events and replays them in-page (guarded, no secret fields)
- `background.js` — relays live progress to the popup and persists saved macros

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder (or drag in the `.zip`'s extracted contents).
3. Pin the extension and click it to open the recorder.
