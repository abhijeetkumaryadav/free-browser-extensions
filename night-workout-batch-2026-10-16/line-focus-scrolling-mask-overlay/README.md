# Line Focus — Scrolling Mask Overlay

User-triggered line-focus overlay for the active tab.

**What it does**
- Click **Enable on this tab**: the page dims (black overlay) except a
  highlighted reading band with cyan edges that follows your scroll or mouse.
- Adjust **band height** (24–120px), **dim strength** (20–85%), and whether the
  band follows scroll or the mouse Y position.
- Click **Disable on this tab**: every element the extension added is removed.
  The page is left completely untouched.

**Honest scope**
- Reversible, user-triggered, current-tab-only overlay. It does not modify the
  page content, does not read your data, and does not work on browser internal
  pages (`chrome://`, Chrome Web Store, etc. — the browser forbids injection).

**Permissions**
- `activeTab` + `scripting` — inject the reversible overlay into the tab you clicked from.
- `storage` — remember your band/dim settings and on/off state only.

No network calls. Everything stays on your device.
