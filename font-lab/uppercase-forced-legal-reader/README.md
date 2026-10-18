# CapsRead — Uppercase Page Reader (v1.0.0)

Accessibility tool for reading dense legal documents: one click renders all page text in UPPERCASE via a display-only CSS layer. The page's actual content is never modified — reloading or clicking restore returns everything to normal.

## Features
- One-click **Make this page UPPERCASE** / **Restore normal text** toggle
- Live status indicator (works only on the current tab, on your click)
- **Skip form fields** option — keep inputs, textareas, selects and code readable as-is
- Fully reversible; nothing persists across page reloads

## Install
**Chrome / Edge / Opera:**
1. Download and unzip `uppercase-forced-legal-reader.zip`
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** load via `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → select `manifest.json`.

## Permissions (justified)
- `activeTab` + `scripting` — inject the uppercase CSS layer into the current tab, only when you click the button
- `storage` — remembers the "skip form fields" preference

## Privacy & limits
- Display-only: a single `<style>` element with `text-transform: uppercase`; DOM text is untouched
- No network requests, no analytics, no data collection
- Cannot run on restricted pages (`chrome://`, Chrome Web Store) — the popup says so instead of failing silently

## Publishing notes
- Manifest V3, minimal permissions, no remote code — store-friendly
