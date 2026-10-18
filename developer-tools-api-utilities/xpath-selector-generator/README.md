# XPath Selector Generator v1.0.0

Click **Pick element**, then click any element on the page. The
extension generates three XPath options for it — **Robust** (stable
attributes like `data-testid` / `aria-label`), **ID-based** (anchored
on the nearest `id`), and **Absolute** (full path) — each with a live
**match count** so you can see at a glance whether a selector is
unique. One-click **Copy** per XPath. Press **Esc** to cancel picking.

## Try it
1. Unzip `xpath-selector-generator.zip`.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.
3. Pin the extension, open any website, click the icon → **Pick element** → click an element.
4. Reopen the popup to see and copy the generated XPaths.

## Permissions (minimal)
- `activeTab` + `scripting` — injects the element picker into the
  tab only when you click "Pick element". No background monitoring.
- `storage` — keeps your last capture on-device so the popup can show
  it after it closes. Nothing leaves the machine.

## Publishing notes
- Single-purpose, no remote code, no data collection — straightforward
  Chrome Web Store / Edge Add-ons review.
- Firefox: same MV3 manifest works; submit via AMO.
