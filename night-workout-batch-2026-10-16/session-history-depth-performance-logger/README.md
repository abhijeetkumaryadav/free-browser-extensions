# History Depth Logger

On click, reads `history.length` for the current tab and logs it with a timestamp and URL, showing a depth-over-time bar chart.

## Honest scope

- **Logs history depth only** — the `history.length` counter (the number of entries in the tab's back/forward stack). It is **not** full performance data: no timings, no resource breakdowns, no heap info. For real performance work, use DevTools.
- `history.length` is capped by the browser (commonly 50) and counts forward entries too, so depth can stay flat even as you navigate.
- Scripting is injected only when you click **Log this tab's depth** (`activeTab` + `scripting`). Browser internal pages (`chrome://`) are off-limits and show a friendly note.
- Last 100 samples kept, newest chart shows the last 30.

## Permissions

- `activeTab` + `scripting` — to read `history.length` in the active tab on click only.
- `storage` — to keep your samples locally.

No network calls, no analytics, no remote code. 100% local.
