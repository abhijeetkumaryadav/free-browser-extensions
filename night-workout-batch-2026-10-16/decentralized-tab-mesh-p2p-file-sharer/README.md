# Local Tab Mesh — Same-Browser Tab Sharer

Share text snippets and small files between tabs in the **same browser profile**.

## Honest scope (please read)

- **Same-browser only.** This is a `BroadcastChannel` mesh between contexts in one browser profile.
- It is **not** decentralized, **not** cross-device, and has no WebRTC, no servers, no encryption.
- Tabs receive messages **only after you explicitly click "Join this tab"** on them.
- Messages live in memory only — never stored, never transmitted anywhere.
- Files are capped at **5 MB** and sent as chunked base64 between your own tabs.

## How it works

1. On each tab you want to link, click the extension icon → **Join this tab to the mesh**.
   (The content script announces presence with a heartbeat every 5 seconds; members expire ~12s after the popup stops hearing them.)
2. **Mesh members** lists joined tabs. Send a snippet to *everyone* or target one tab.
3. **Send a file** (≤ 5 MB): receivers get an in-page toast (auto-dismisses in 20s) with a Download button.
4. **Inbox** collects snippets/files received while the popup is open.

Receiving tabs show a shadow-DOM toast with one-click **Copy** (snippets) or **Download** (files).

## Permissions

- `storage` — remember preferences
- `activeTab` + `scripting` — inject the mesh receiver into tabs you explicitly join

## Build

Manifest V3. Zip with `manifest.json` at the archive root.
