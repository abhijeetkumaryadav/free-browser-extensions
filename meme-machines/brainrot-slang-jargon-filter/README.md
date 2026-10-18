# Brainrot Slang Filter

A joke translator for your browser: on your click it rewrites the current page's text by swapping formal words for silly slang equivalents from a bundled dictionary (87 playful, inoffensive pairs — "good" → "bussin", "win" → "dub", "house" → "crib"...). Clearly just for laughs.

## Features
- **Brainrot intensity slider** (0–100%): the chance each matching word gets swapped
- **One-click restore**: returns the page to its original text — fully reversible, never compounds on repeated clicks
- Capitalization-aware ("Hello" → "Yo", "HELLO" → "YO")
- Form fields, scripts, and editable areas are never touched

## Install (Chrome / Edge / Opera)
1. Unzip `brainrot-slang-jargon-filter.zip`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)
Load via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. The `chrome.scripting` page injection requires the active tab; grant permission when prompted.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Remembers your intensity slider setting |
| `activeTab` + `scripting` | Used **only** when you click "Brainrot-ify this page" or "Restore original text", to rewrite text on the current tab. Never runs without your click. |

## Privacy
- No network calls, no analytics, no data collection
- The only stored value is the intensity slider position
- Page text is rewritten in-memory only; nothing is uploaded anywhere

## Publishing notes
- MV3, no remote code, no deprecated APIs — store-safe
- Category: Entertainment / Fun
- Screenshots: popup with intensity slider; a before/after page comparison
- The UI labels it a joke everywhere; no claims of real translation
