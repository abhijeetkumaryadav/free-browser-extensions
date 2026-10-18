# ContextVault — Local RAG-Style Snippet Library

A browser extension for saving reusable context blocks (brand voice,
project background, coding standards, email templates…) and inserting them
into any text field with one click — a "RAG-style" workflow for your own
notes.

**Honest scope: this is a snippet manager, NOT real RAG.** There are no
embeddings, no vector database, no semantic search — just your named
snippets, tags, keyword search, and one-click insertion. Everything runs
on-device.

## Install

**Chrome / Edge**
1. Download and unzip `localized-rag-context-injector.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder. (Temporary until signed
   via AMO for permanent install.)

## Usage

1. Click the ContextVault toolbar icon, then **+** to save a snippet:
   name it, add comma-separated tags, paste the content.
2. **Search** filters by name, tags, and content; click a tag chip to filter
   by tag.
3. **Insert**: focus a text field on the current tab (a chat box, editor…),
   open ContextVault, and press **Insert** on a snippet. It types the text at
   the cursor. If no editable field is focused (or the page is restricted,
   e.g. `chrome://`), the snippet is copied to your clipboard instead and
   you'll be told to paste it manually.
4. **Edit** updates a snippet; **Delete** needs two clicks to confirm.
5. **Export / Import** moves your library as JSON (duplicates get new ids).

## Permissions

- `storage` — your snippet library, stored locally only.
- `activeTab` + `scripting` — used only when you press **Insert**, to type the
  snippet into the focused field of the tab you're viewing. Nothing is read
  from pages.

## Privacy

100% on-device. No network calls, no analytics, nothing leaves your browser.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- Single accent color (#6366f1); all other UI is neutral dark.
- Firefox: `activeTab`/`scripting`/`storage` are supported; submit to AMO
  for signing for permanent installs.
