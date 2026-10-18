# Jira Ticket Auto Epics Linker v1.0.0

Offline ticket-key organizer for people who live in Jira but don't want to hand the
extension their credentials.

## What it does

- **Paste ticket keys** (`PROJ-123`, comma/space/newline separated) — extracted with a
  strict `PROJECT-123` pattern matcher; duplicates are skipped automatically.
- **Auto-groups by project prefix** (PROJ, API, WEB…) with per-group counts.
- **Assign epic labels** per ticket (free text, stored on-device).
- **Quick links**: set your Jira base URL once (e.g. `https://your-team.atlassian.net`)
  and every key becomes a `…/browse/KEY` link. The extension never contacts Jira —
  the URL is just link-building.
- **Search/filter** across keys and epic labels.
- **Copy grouped list** — one click copies Markdown (`## PROJ` sections) to paste into
  docs, standup notes, or PRs.

Everything stays in `chrome.storage.local`. No network calls, ever.

## Install

1. Unzip `jira-ticket-auto-epics-linker.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:addons` →
   gear → "Install Add-on From File" won't work for unpacked; use
   `about:debugging` → "Load Temporary Add-on").
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Saves your tickets, epic labels, and base URL on-device. |
| `clipboardWrite` | "Copy grouped list" writes Markdown to the clipboard. |

No host permissions. No credentials requested. No data leaves the device.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy: no remote code, no analytics, no account linking — declare "does not collect data".
- Firefox: MV3 supported in Firefox 109+; `chrome.storage.local` works via the
  `browser` namespace shim automatically in modern builds (code uses `chrome.*`
  promise-style, which Firefox MV3 supports).
