# Form Saver — Auto-Save Input Crash Recovery

Never lose a long form to a crashed tab again.

## What it does

- **Per-site opt-in:** toggle Form Saver on for the sites where you type (never runs
  anywhere you haven't enabled it).
- **Automatic snapshots:** while you type, a debounced (1.5s) background capture
  saves the values of text inputs, textareas, and editable regions — locally, in
  `chrome.storage.session`. Nothing leaves your machine.
- **One-click restore:** if the tab crashes or reloads, open the popup and hit
  **Restore fields** to put everything back. **Discard** removes the snapshot.
- **Clear all:** wipes every stored snapshot at once.

## Honest scope

- Local snapshots only — clear anytime from the popup.
- **Password fields are never captured** (nor are file, checkbox, radio, hidden,
  date, and other non-text controls).
- Snapshots live in *session* storage: they survive tab crashes and reloads, but
  disappear when the browser fully quits. That's deliberate — no long-term
  hoarding of your keystrokes.

## Permissions

`storage`, `activeTab`, `scripting` — the content script is injected only when you
enable the site and only runs on regular `http(s)` pages.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `README.md`,
`icons/icon{16,48,128}.png`
