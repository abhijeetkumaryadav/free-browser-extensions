# Move Ticker — Sedentary Break Prompts

A motivational timer that counts up the time since **your last logged movement break** — and nudges you to move at sensible thresholds.

## How it works

- Open the popup and the ticker counts up from your last logged break (stored locally; starts when you first open it).
- **I took a movement break** resets the clock and logs the break with a timestamp.
- The phase label and motivational prompt change at 30 / 60 / 120 minutes — purely motivational text, rotating deterministically.
- Stats: breaks today, longest sitting stretch today, average gap today — all computed from **your own logs**.
- Clear today's log anytime.

## Honest scope

- **Motivational tracker — not medical advice.** It does not measure your activity, posture, or health. It only counts time between breaks you log yourself.
- 100% local — `storage` permission only, no network, no analytics, no background tracking.

## Privacy

Nothing leaves your browser. No data is collected, transmitted, or shared.
