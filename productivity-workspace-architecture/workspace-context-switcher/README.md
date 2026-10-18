# Workspace Context Switcher

Save the current window's tabs as a named workspace ("Morning research", "Client A") and reopen any workspace in a fresh window with one click. Rename, delete, export/import JSON — everything stays on your device.

## Install

**Chrome / Edge**
1. Unzip `workspace-context-switcher.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json` inside the folder.
   (Note: `chrome.windows.create` with a URL array works in Firefox; temporary add-ons lose data on restart — use Export for a durable backup.)

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read the current window's tab URLs/titles to snapshot a workspace. |
| `storage` | Save workspaces locally. |

No host permissions, no network calls, no analytics.

## Notes

- Browser-internal pages (`chrome://`, `about:`, etc.) are skipped on save — they can't be reopened programmatically.
- Workspaces open in a **new window**, so your current context is never disturbed.
- Export regularly if you want a durable backup.

## Publishing

- Chrome Web Store: $5 one-time developer registration, MV3, minimal permissions — ready.
- Edge Add-ons: free account — ready.
- Firefox: requires Mozilla signing for distribution.
