# Live HTML Editor

Edit any page's HTML live in your browser — then revert with a reload.

## What it does

1. **Grab tab HTML** — loads the current tab's full HTML source (including doctype) into the editor.
2. **Edit** — change anything: text, styles, structure.
3. **Apply** — replaces the live page copy instantly so you can preview your edits.
4. **Download** — saves the edited HTML as `edited-page.html`.

## Honest scope

- Edits the **live page copy in your tab only** — never the server, never other visitors.
- Changes are **lost on reload** (reload reverts everything).
- Some pages (chrome://, web store, pages with strict CSP) cannot be edited by extensions; the popup will tell you if the grab or apply fails.

## Permissions

- `activeTab` + `scripting` — read and replace the HTML of the tab you click on, only when you click.
- `storage` — reserved for future preferences; nothing is stored yet.

## Privacy

100% local. No network requests, no analytics, no data leaves your machine.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or drag the `.zip` contents).
3. Click the toolbar icon to open the editor.
