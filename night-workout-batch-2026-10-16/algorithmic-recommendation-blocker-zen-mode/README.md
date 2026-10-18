# Zen Mode — Distraction Dimmer

**Heuristic only — not an algorithm blocker.** This extension does not change
any site's algorithm, block content, or send data anywhere.

## What it does

- Click **Zen on** in the popup: likely recommendation panels, sidebars and
  "suggested" sections on the current tab are blurred and faded (pure CSS,
  heuristic selectors).
- Click **Zen off**: the injected style is removed and the page is left
  completely untouched.
- Your on/off state persists locally in `chrome.storage.local`.

## Permissions

- `activeTab` + `scripting`: inject a reversible `<style>` into the tab you
  click on.
- `storage`: remember Zen on/off state. Nothing else is stored.

## Privacy

Fully local. Zero network calls. No analytics, no telemetry.
