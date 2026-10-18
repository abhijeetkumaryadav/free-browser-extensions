# PrivWatch — Camera & Mic Permission Monitor

A privacy dashboard that shows your browser's **camera and microphone permission states** at a glance, plus guidance for revoking per-site access.

## What it does

- Shows live permission state (**Granted / Denied / Ask**) for camera and microphone via the Permissions API, with plain-language explanations.
- States update live while the popup is open if you change a permission.
- Reads the browser's default content-setting for camera/mic (Chromium) where exposed.
- One-click buttons open the browser's site-permission settings pages so you can revoke access per site.

## Honest scope

- PrivWatch shows **permission states only**. It cannot see live usage, cannot tell which tab is recording, and cannot access your camera or microphone itself.
- All checks run locally in the popup. **Nothing leaves your device. No network calls.**

## Permissions

| Permission | Why |
|---|---|
| `contentSettings` | Read the default camera/mic content-setting (Chromium). No settings are ever changed by the extension. |

No host permissions. No remote code.

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `camera-microphone-active-permission-monitor.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** `contentSettings` is Chromium-only; the permission states panel works, the default-setting panel shows `n/a`. Load via `about:debugging`.

## Publishing notes

- MV3, no deprecated APIs.
- The extension never requests camera/microphone access itself — store reviewers can verify no `getUserMedia` usage exists in the code.
