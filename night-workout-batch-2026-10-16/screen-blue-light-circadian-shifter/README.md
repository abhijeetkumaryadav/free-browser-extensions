# Circadian Warm Tint

A user-triggered warm-tint screen overlay for the current tab. Click to enable — a warm amber layer softens the page; enable **Circadian mode** and the tint automatically strengthens after sunset and eases off by morning (computed from your local time).

## Honest scope

- **Cosmetic overlay only.** This is not a blue-light medical device and does not treat sleep or circadian-rhythm conditions.
- Nothing runs until you click. One click (or **Remove tint now**) clears the overlay completely.
- 100% local — zero network calls, works offline.

## Features

- Tint strength slider (0–100%)
- Circadian mode: ~30% strength by day, ramps up after 6 PM to full after 9 PM, eases back by 9 AM
- Re-evaluates automatically every 5 minutes while the page is open
- Settings persist across sessions

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your tint settings |
| `activeTab` | Apply the tint only to the tab you click on |
| `scripting` | Inject the overlay on explicit click only |

## Install

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
