# KernTune — Letter-Spacing Fine Tuner

Typography tool: adjust **letter-spacing (tracking)** on the current tab's text with a slider, see a live preview, and restore the original in one click.

## Install

**Chrome / Edge / Opera**
1. Unzip `kerning-tracking-fine-tuner.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** — this build targets Chromium MV3; Firefox support would need a manifest tweak (`browser_specific_settings`).

## How to use
1. Open any page and click the KernTune toolbar icon.
2. Toggle **Apply to this tab** on.
3. Drag the tracking slider from **-2 px to +10 px** — the page text updates live.
4. Click **Restore original** (or reload the page) to revert everything.

## Permissions — why each is needed
- `storage` — remembers your slider position between popup opens (on-device only).
- `activeTab` — applies the style to the tab you explicitly opened the popup on.
- `scripting` — injects a single `<style>` element into the active tab on your click.

## Safety & honesty notes
- Injection happens **only when you toggle or move the slider**; nothing runs automatically.
- The tweak is a single injected stylesheet — **restoring removes it exactly**, and reloading the page also reverts.
- Does not run on browser-restricted pages (`chrome://`, Web Store, `about:`) — the toggle simply stays off.
- **No network calls, no data collection, no remote code.** Everything stays on-device.

## Publishing notes
- MV3, no deprecated APIs, minimal permissions.
- Store listing category: Productivity / Accessibility.
