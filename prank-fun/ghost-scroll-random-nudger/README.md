# GhostScroll — Random Page Nudger

A harmless prank extension: while active, the current tab gently scrolls by a few pixels at random intervals. Subtle, spooky, and fully reversible.

## What it does

- **Start haunting** injects a content script into the active tab; the page is nudged by a few pixels at random intervals (9–20s on Gentle, 5–12s on Mischievous, 2.5–7s on Haunted).
- A rare tiny horizontal shiver is added for extra spook.
- The nudger **never fights the user**: real scrolls within the last 1.5s suppress the next nudge.
- Nudges stop instantly via the popup, the "Stop all tabs" button, or closing the tab.

## Install

1. Unzip the package.
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder.
4. Pin the ghost icon and click it on any page.

## Permissions

- `storage` — remembers the last-used spookiness level. Nothing leaves the device.
- `activeTab` — lets the popup act on the current tab when you click.
- `scripting` — injects the nudger content script on demand, only into the tab you're haunting.

No network calls, no data collection, no background workers.

## Publishing notes

- Clearly labeled as a joke in the popup ("joke" tag, "harmless prank" copy).
- Single-purpose, minimal permissions — suitable for the Chrome Web Store with a "prank/joke" disclosure in the store description.
