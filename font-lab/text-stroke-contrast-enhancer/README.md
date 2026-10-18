# StrokeBoost — Text Contrast Enhancer

Accessibility tool: add a subtle **text stroke** (`-webkit-text-stroke`) or **text shadow** to the current tab's text to boost legibility, with an intensity slider and one-click restore.

## Install

**Chrome / Edge / Opera**
1. Unzip `text-stroke-contrast-enhancer.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** — this build targets Chromium MV3; Firefox support would need a manifest tweak (`browser_specific_settings`).

## How to use
1. Open any page and click the StrokeBoost toolbar icon.
2. Toggle **Enhance this tab** on.
3. Pick **Stroke** or **Shadow** mode and drag the intensity slider (0.2–2 px) — the page text updates live.
4. Click **Restore original** (or reload the page) to revert everything.

## Permissions — why each is needed
- `storage` — remembers your mode and intensity between popup opens (on-device only).
- `activeTab` — applies the style to the tab you explicitly opened the popup on.
- `scripting` — injects a single `<style>` element into the active tab on your click.

## Safety & honesty notes
- Injection happens **only on your explicit toggle / slider / mode click**; nothing runs automatically.
- The enhancement is a single injected stylesheet — **restoring removes it exactly**, and reloading the page also reverts.
- Does not run on browser-restricted pages (`chrome://`, Web Store, `about:`) — the toggle simply stays off.
- **No network calls, no data collection, no remote code.** Everything stays on-device.

## Publishing notes
- MV3, no deprecated APIs, minimal permissions.
- Store listing category: Productivity / Accessibility.
