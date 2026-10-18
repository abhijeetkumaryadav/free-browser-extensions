# DraftVault — Auto-Save & Local Recovery (v1.0.0)

Write drafts that autosave locally as you type. If the browser crashes, the
popup closes, or you simply come back later, your text is recovered exactly as
you left it. 100% local — nothing is uploaded anywhere.

## Install

**Chrome / Edge:**
1. Download and unzip `draft-auto-save-local-recovery.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** this package targets Chromium MV3. Firefox supports MV3 with only
minor manifest adjustments.

## Usage

- Type in the editor — drafts autosave ~1.2s after you stop typing
  (status pill shows `typing…` / `saved`).
- The most recent draft is **recovered automatically** when you reopen the popup.
- Manage multiple named drafts: click a draft to open it, delete individually,
  **Export .txt** to download the current draft, **New draft** to start fresh.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Saves all drafts on-device so they survive restarts and crashes |

No clipboard, no network, no background workers. The only data access is your
own typed text.

## Publishing notes

- MV3 only, no remote code, no deprecated APIs.
- Single `storage` permission — minimal review surface for the Chrome Web Store.
