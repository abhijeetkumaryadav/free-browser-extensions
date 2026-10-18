# SlowSpeak — Clear Text-to-Speech Reader

Reads text aloud slowly and clearly using your device's built-in speech
synthesis — ideal for language learners, accessibility, and careful listening.

## Features
- Grab selected text from any page, or type/paste your own
- Adjustable speed (0.3×–1×), pitch, and pause between sentences
- Voice picker (prefers on-device voices)
- Sentence-by-sentence reading with clear pauses
- Settings persist locally

> **Honest scope:** 100% on-device speech synthesis. Nothing is uploaded or
> sent anywhere. Reading stops if the popup is closed (a platform limitation).

## Permissions
- `storage` — persist your settings locally
- `activeTab` + `scripting` — grab selected text only when you click the button

## Install (developer mode)
1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon to read text aloud

## Files
- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — reader UI + speech engine
- `content.js` — grabs the page selection on demand
- `icons/` — generated PNG icons
