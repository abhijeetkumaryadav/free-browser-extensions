# Macro Recorder — Replay Your Browsing Steps

Records **your** clicks and typing on the active tab, saves them as named macros, and replays them on demand. 100% local, zero network.

## What it does

- **Start/stop recording** — explicit button; a live step counter shows progress
- Records **clicks** and **text input** (coalesced per field)
- **Save named macros** — stored locally, replay anytime
- **Replay** — re-finds elements by recorded selector and clicks/fills them with a small delay
- **Delete** macros you no longer need

## Safety rules

- Recording only works on regular web pages (`chrome://`, `edge://`, `about:` pages are refused)
- **Password, hidden, and file inputs are never recorded**
- Replays **your own** actions only — do not use on login pages or CAPTCHAs

## Permissions

- `storage` — saves your macros
- `activeTab`, `scripting`, `tabs` — inject the recorder into the active tab only when you press record/replay
