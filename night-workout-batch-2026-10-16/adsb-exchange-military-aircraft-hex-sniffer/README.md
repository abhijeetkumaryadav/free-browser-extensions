# Mode-S Hex Explainer — Aircraft Code Guide

An **educational** guide to ICAO 24-bit Mode-S transponder hex codes, with a
personal log for codes you look up.

## What it is / is not

- ✅ Explains how 6-hex-digit Mode-S codes work and which country blocks they belong to.
- ✅ Lets you type a code and instantly see its registry block.
- ✅ Manual log with notes, persisted locally.
- ❌ **No live tracking, no receiver, no positions.** Nothing leaves the browser.

## How to use

1. Read the "How Mode-S hex codes work" guide in the popup.
2. Type a 6-digit hex code (e.g. `A4B5C6`) — the country block is detected live.
3. Add a note and press **Log** to keep it in your list.

## Privacy

Fully local. `storage` permission only, used for your log. No network calls.

## Tech

Manifest V3, no dependencies. Engine functions (`normalizeHex`, `isValidHex`,
`countryFor`, `makeEntry`, `COUNTRY_BLOCKS`) live between
`// ENGINE-START` / `// ENGINE-END` and are headless-testable.
