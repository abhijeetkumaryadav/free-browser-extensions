# CiteIt — APA & MLA Citation Generator

Build APA 7th and MLA 9th citations for web pages: auto-fill from the current tab's
metadata, edit fields, copy the result, and keep a saved citation library with
plain-text export.

## What it does

- **Auto-fill** from the active tab: title, author (`<meta name="author">`), site name
  (`og:site_name`), published date, and URL
- Editable fields: authors (`"Last, First; Last2, First2"`), page title, site name,
  published date, URL
- Live-generated **APA 7th** (`Author, A. A. (Year, Month Day). Title. Site. URL`)
  and **MLA 9th** (`Author. "Title." Site, Day Month Year, URL.`) citations
- One-click copy, saved citation library (persisted on-device), delete, `.txt` export

## Honest limits

- Auto-fill is best-effort: it reads standard meta tags, which many sites omit
- Date parsing accepts ISO (`2024-05-10`) and common formats; unparseable dates are
  treated as missing (`(n.d.)` in APA, omitted in MLA)
- Always verify against your institution's style guide before submitting

## Install (unpacked)

**Chrome / Edge:**
1. Unzip `citation-apa-mla-style-generator.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

**Opera:** same as Chrome via `opera://extensions`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Identify the current tab for auto-fill |
| `scripting` | Read the page's title/meta tags on user click only |
| `storage` | Persist the saved citation library on-device |

No network requests, no analytics, no data leaves your device.

## Publishing notes

- Manifest V3, no deprecated APIs
- Minimal, justified permissions; no remote code — all logic is bundled
