# Cancel Helper — Find Cancel Links & Set Renewal Reminders

A manual cancel assistant for hard-to-cancel subscriptions. **Honest scope:** it
finds cancel/manage links on the current page, gives you a step checklist, and
sends renewal reminders. It **cannot cancel anything for you** — you do the
canceling on the merchant's own page.

## Features

- **Scan this page for cancel links** — on-demand scan (explicit click only) of
  the current page's visible links/buttons for cancel-related text
  (`cancel subscription`, `turn off auto-renew`, `manage billing`…), scored by
  confidence. Heuristic — can miss and misfire.
- **Cancel checklist** — generic walkthrough (find the billing page, watch for
  tiny grey links, confirm and save the receipt), persisted locally.
- **Renewal reminders** — set a service name + renewal date; get a browser
  notification 1/3/7/14 days before, via `chrome.alarms` + `chrome.notifications`.

## Permissions

- `storage` — checklist state and reminders.
- `activeTab` + `scripting` — inject the link scanner into the current page, only
  when you click Scan. Nothing runs in the background.
- `alarms` + `notifications` — renewal reminder alerts.

## Notes

- Scan runs only on your click; the extension never reads pages by itself.
- Scores are heuristic guesses. Always follow the real link on the page.
- 100% local. No network, no accounts, no telemetry.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`,
`background.js` (alarm listener), `README.md`, `icons/`.
