# Squawk Code Reference — Emergency Signals Guide

Educational reference for aircraft transponder (squawk) codes, including the
emergency codes 7500 / 7600 / 7700, a common code table, and a personal notes
field saved locally.

**Reference only — educational.** This extension is not connected to any live
data source, sends no notifications, and cannot track aircraft. Always use
official procedures and charts in real flight operations.

## Features
- Emergency code cards: 7500 (unlawful interference), 7600 (radio failure),
  7700 (emergency)
- Common squawk code table with octal validation
- Personal notes saved to `chrome.storage.local` (this browser only)

## Files
- `manifest.json` — MV3 manifest (`storage` only)
- `popup.html` / `popup.css` / `popup.js` — UI and logic
- `icons/` — generated PNG icons

## Build
`node --check` on `popup.js`; manifest JSON validated; icons generated with PIL.
