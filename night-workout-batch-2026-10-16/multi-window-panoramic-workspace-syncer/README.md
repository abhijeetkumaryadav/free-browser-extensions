# Layout Saver — Window Layout Manager

## What it does
Save named snapshots of your browser windows (position + size) and restore them later with one click.

**Honest scope (labeled in popup):** saves YOUR window layouts — not panoramic sync. There is no spatial/panoramic API; this is a local layout snapshot tool.

## Features
- Save current arrangement under a name (counts normal browser windows)
- Restore a layout: repositions/resizes your open windows in order
- Overwrite a layout with the current arrangement, or delete it
- Live count of detected windows; timestamps on every layout
- 100% local (`chrome.storage.local`), no network, no analytics

## Permissions (minimal)
- `storage` — save layout snapshots locally
- *(Note: `windows` read/update requires no extra permission for own windows in MV3)*

## Limitations
- Restores at most as many windows as are currently open; extras are ignored
- Maximized/fullscreen states are preserved where reported by the browser
- OS-level window snapping is outside the extension's control
