# SnippetVault — Local Snippet Library v1.0.0

Save named code/text snippets with language tags and search them locally.
One-click copy, JSON export/import, and a "Share prep" button that formats a
snippet so you can paste it **manually** into gist.github.com or pastebin.com.

## Honest scope

**This is a local-only vault. It does NOT sync to the cloud.**
There are no network calls, no API tokens, and nothing leaves your device.
"Share prep" only builds a formatted text block; posting to a gist or
Pastebin is a manual step for you, with in-app instructions.

## Features

- New / edit / delete snippets (name, language, comma-separated tags, body)
- Live search across name, language, tags and code
- One-click copy of any snippet
- "Share prep" modal: formatted Markdown block + manual paste instructions
- JSON export (download) and import (merge, collision-safe new ids)
- Snippet body truncated to 100k chars on import; 12 tags max per snippet

## Install (Chrome / Edge / Opera)

1. Unzip `cloud-gist-pastebin-sync.zip`
2. Open `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`.

## Permissions

- `storage` — persist your snippets locally with `chrome.storage.local`.

No host permissions, no network calls.

## Publishing notes

- MV3, no remote code, no external assets — store-safe.
- Listing should repeat the honest scope: local vault, manual share step.
