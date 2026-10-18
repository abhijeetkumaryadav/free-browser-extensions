# StepLog — Browsing Step Recorder (v1.0.0)

Record browsing sessions as step-by-step logs (page visits, clicks, form fills) for agent workflows, QA repro steps, or documentation.

## Features
- **User-initiated recording only**: press Start → red `REC` badge appears on the toolbar; press Stop. Recording never resumes automatically after a browser restart.
- **Step types**: navigations (URL + title), clicks (labeled element + selector), form fills (field label + value, logged on commit — not per keystroke).
- **Privacy by design**: password / card-field values are never recorded (logged as "(password field — value not recorded)"). Everything stays in `chrome.storage.local` on-device.
- **Timeline view** per session with timestamps, per-step annotation notes (autosaved), delete sessions, clear-all with confirmation.
- **Exports**: one-click JSON and Markdown (for agent prompts / docs) via blob download — no `downloads` permission needed.
- Caps: 50 sessions, 500 steps per session (oldest trimmed).

## Install
1. Unzip `ai-agent-browsing-step-recorder.zip`.
2. Open `chrome://extensions` (or Edge `edge://extensions`).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder.

## Permissions
- `storage` — persist sessions locally.
- `tabs` — read tab URL/title for navigation steps.
- `host_permissions` (http/https) — content script must run on arbitrary pages to observe clicks/fills *while recording*. The script is inert unless the background confirms recording is active.

## Publishing notes
- Manifest V3, no remote code, no network calls.
- Host permissions will prompt a store-review justification — the README's privacy section covers it.
- Suggested store categories: Productivity / Developer Tools.
