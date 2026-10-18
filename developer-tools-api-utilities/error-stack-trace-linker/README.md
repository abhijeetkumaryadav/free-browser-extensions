# Error Stack Trace Linker v1.0.0

Paste any JavaScript stack trace and get clean, actionable frames:
each frame shows the function, file, and line/column in a tidy table
with **Copy frame**, a **VS Code** deep link (`vscode://file/…`) for
local paths, and a markdown **shareable version** for pasting into
issues or chat.

Best-effort parser covering Chrome/V8, Firefox (`fn@file:line:col`),
and Node frame formats. Your last pasted trace is remembered
on-device.

## Try it
1. Unzip `error-stack-trace-linker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, paste a stack trace, hit **Parse frames**.

## Permissions
- `storage` — remembers your last pasted trace on this device only.
  No network access, nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration fee.
- Minimal, justified permission set; no remote code, no page reading.
