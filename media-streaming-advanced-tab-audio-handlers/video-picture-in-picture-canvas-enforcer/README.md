# PiP Canvas — Picture-in-Picture Enforcer

Pop any HTML5 video into a floating picture-in-picture window — even on sites
that don't offer a PiP button.

## Features

- **Scan this tab** — lists every `<video>` on the page with duration, size, and
  play state; one click pops any of them out.
- **Floating PiP button** — optional toggle injects a small "PiP" button on the
  corner of every video (hover to reveal). Enable it once in the popup.
- **Honest fallbacks** — if a site sets `disablepictureinpicture` on its video,
  the popup tells you exactly why instead of failing silently.

## Install

**Chrome / Edge**
1. Unzip `video-picture-in-picture-canvas-enforcer.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** — `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
pick `manifest.json`. (Note: `requestPictureInPicture` and content-script
behavior may differ slightly; PiP itself is supported.)

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Scan the videos on the tab you clicked the icon on. |
| `scripting` | Run the one-shot scan / pop-out in the page when you ask. |
| `storage` | Remember the floating-button toggle only. |

No host permissions beyond the content-script matches for the optional floating
button. Nothing is read, stored, or sent anywhere — videos are never recorded.

## Limitations (honest)

- Pages like `chrome://`, `edge://`, and the web stores cannot be scripted —
  the popup says so when you try.
- Sites can opt out of PiP via the `disablepictureinpicture` attribute; those
  videos are labeled "Blocked" and can't be forced.
- Some DRM-protected players (e.g. certain streaming apps) refuse PiP at the
  browser level.

## Publishing notes

- MV3, no deprecated APIs. No remote code, no analytics, no network calls.
- Chrome Web Store: single-purpose "video utilities"; the `scripting` +
  `activeTab` justification is user-initiated PiP on the current tab.
- Icons are generated; screenshots of the popup + a floating button are good
  listing assets.
