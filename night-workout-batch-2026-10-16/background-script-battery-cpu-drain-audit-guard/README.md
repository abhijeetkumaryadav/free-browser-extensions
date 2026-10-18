# Page Activity Audit — Battery & CPU Guard

Audits the **current visible page's** background activity and flags energy-hungry pages: long main-thread tasks, frame rate, event-loop lag (runaway-timer heuristic), and network resource churn. Also lists open tabs so you can close the heavy ones.

## Honest scope

- Measures **this visible tab only**, as **estimates** from a 5-second sample.
- It **cannot** measure per-extension CPU or battery use — Manifest V3 does not expose that to extensions. Any tool claiming to do so is guessing.
- Background tabs are throttled by the browser, so low FPS on an unfocused tab is normal.
- Source attribution for long tasks is best-effort (browsers limit third-party detail).
- Firefox does not support `longtask` entries — the score falls back to frame rate and loop lag there.

## Use

1. Open the page you want to check (keep the tab visible).
2. Click the extension icon → **Run 5-second audit**.
3. Review the score, findings, and the tab list.

## Permissions

- `activeTab` + `scripting` — inject the measurement script on your click only.
- `tabs` — list open tabs and close ones you choose (close buttons are manual).
- `storage` — cache the last audit result locally.

100% local. Zero network. No data leaves your device.
