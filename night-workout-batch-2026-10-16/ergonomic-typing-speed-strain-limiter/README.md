# Pace Nudge — Typing-Pace Strain Helper

A gentle typing-pace monitor.

## What it does

- **Watch this tab** — starts a keystroke-rate monitor on the current tab (explicit click only)
- Measures your rolling 60-second WPM (5 keystrokes ≈ 1 word)
- If your pace **sustains above your threshold for 20 seconds**, a small dismissible banner nudges you to ease off (auto-dismisses after 12s, cooldown between nudges is configurable)
- **Nothing is ever blocked or throttled** — it's a nudge, not a limiter
- Session stats: status, current WPM, nudges shown, keystrokes counted

## Honest scope

- **Nudge only — not medical advice.** Typing fast doesn't cause injury, and this tool diagnoses nothing.
- Counts keystrokes locally on the tab you started it on. No keystroke content is ever stored or transmitted — only counts and timestamps.
- 100% local, zero network.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `icons/`, `README.md`

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Pin the extension, open any page, click **Start watching**
