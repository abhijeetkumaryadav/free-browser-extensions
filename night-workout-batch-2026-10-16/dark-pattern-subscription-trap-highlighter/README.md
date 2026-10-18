# Dark Pattern Spotter — Subscription Trap Highlighter

Scans subscription, checkout, and signup pages for common dark patterns and highlights them with amber outlines, with plain-language explanations.

## What it detects (heuristics)

| Pattern | Severity | Signal |
|---|---|---|
| Pre-checked box | High | Consent/marketing/add-on checkbox already ticked (opt-out trap) |
| Hidden fee in fine print | High | Fee/charge language in ≤10px text |
| Urgency / scarcity pressure | Medium | Countdowns, "only X left", "offer ends" |
| Confirm-shaming | Medium | Guilt-laden decline options ("No, I hate saving money") |
| Free-trial → paid trap | Medium | "Free trial" near billing language |
| Cancel path obscured | Low | Tiny/low-visibility cancel or unsubscribe links |

Click any finding card to scroll to the element on the page. **Clear highlights** removes all outlines.

## Honest scope

- Pure heuristic pattern matching on visible page text and form state. It is **not proof of wrongdoing** and can miss or misfire.
- Read-only: the page DOM is never modified except for temporary highlight outlines and a small injected `<style>` for them, both removed by "Clear highlights".
- 100% local. Zero network requests. Nothing is read beyond the page you asked it to scan.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Scan only the tab you clicked on |
| `scripting` | Inject the scanner only when you click "Scan this page" |
| `storage` | Remember UI preferences (severity filter) |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Click the toolbar icon, then **Scan this page** on any subscription or checkout page.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI, results list, severity filters
- `content.js` — click-triggered heuristic scanner (never runs uninvited)
- `icons/` — generated 16/48/128 PNG icons
