# Local Tab Mesh

Send **notes, snippets, and URLs between open tabs of the same browser** — a local tab mesh for juggling research, code, and copy-paste across pages.

## How it works

1. Open the tabs you want in the mesh.
2. Click the extension icon and press **+ Join this tab** on each one (this injects a tiny receiver into the tab).
3. Type a note/snippet/URL and press **Send to all members** — every joined tab gets an in-page toast with the message and a one-click **Copy** button.

The popup also keeps a local **Inbox** of messages broadcast while it was open, and a **mesh member list** with per-tab send buttons.

## Honest scope (read this first)

- **Same browser profile only.** This is NOT real peer-to-peer networking across devices — there is no WebRTC, no servers, and no sync beyond this browser.
- **No encryption.** Messages travel via `BroadcastChannel` and extension messaging in plain text, in memory only. Do not send passwords or secrets.
- **Joined tabs only.** A tab receives messages only after you explicitly joined it. Messages are never persisted — toasts vanish when dismissed or after 20 seconds.
- Fully local: zero network requests, zero analytics.

## Permissions (justified)

- `storage` — popup UI state (nothing sensitive).
- `tabs` — list open tabs so the member list shows titles/URLs.
- `activeTab` + `scripting` — inject the receiver into tabs **you** join; nothing is injected anywhere else.

## Development

Load unpacked, join two tabs, send a message, and watch both toasts arrive. Live-browser tested? Not yet — validate manually after install.

## Privacy

No data leaves your machine. No accounts. No telemetry.
