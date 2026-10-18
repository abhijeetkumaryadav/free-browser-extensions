# Idiom Vault — Personal Idiom Collection

A personal, browsable idiom library living in your browser toolbar. **Your browsable collection — not AI suggestions.**

## What it does

- **150 bundled idioms** with plain-language meanings and example sentences, organized into 6 categories: Emotions, Work & Money, Communication, Success & Failure, Time & Patience, General
- **Search** across idioms, meanings, and examples as you type
- **Category chips** to filter the list
- **Favorites** — star idioms to keep them in one tab
- **Add your own** — save personal idioms with meaning, example, and category; delete them anytime
- **Copy** — one click copies an idiom + meaning + example to your clipboard

## What it does NOT do

- No AI, no suggestions engine, no network calls — the bundled list is fixed local data and everything you add stays in `chrome.storage.local`
- It does not read your pages, emails, or documents

## Permissions

- `storage` — saves your favorites and custom idioms locally

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and logic
- `idioms.js` — the bundled 150-idiom collection (static data)
- `icons/icon{16,48,128}.png` — extension icons
- `smart-idiom-suggestions-panel.zip` — packaged build

## Load it

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (or drag in the `.zip`)
4. Click the toolbar icon to open Idiom Vault
