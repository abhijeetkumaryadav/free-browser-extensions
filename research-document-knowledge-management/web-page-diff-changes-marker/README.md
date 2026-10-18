# PageDiff — Page Change Tracker

Snapshot any page's text, revisit later, and **compare** to see what was added or removed — with an inline highlight of new blocks and a diff summary. Snapshots are stored per URL on-device.

## Install

**Chrome / Edge:**
1. Download and unzip `web-page-diff-changes-marker.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:** Uses Manifest V3 with `chrome.scripting` in Chromium form; a Firefox port would need `browser.*` namespace tweaks and is not included.

## Usage
1. Open a page you want to monitor, click the PageDiff toolbar button.
2. Click **Take snapshot** — the page's text blocks are hashed and stored.
3. Later, reopen the page and click **Compare now** — see added/removed/unchanged counts.
4. Click **Highlight additions on page** to outline new blocks in green.
5. Manage snapshots (up to 20 per page) in the history list; delete any with ×.

## Permissions (justified)
| Permission | Why |
|---|---|
| `activeTab` | Read the title/URL of the tab you clicked on |
| `scripting` | Extract text blocks / apply highlights in the current tab, only when you click |
| `storage` | Store your snapshots per URL on-device |

## Publishing notes
- Manifest V3, no remote code, no network calls.
- Honest scope: block-level text comparison — reordered paragraphs may show as add+remove; dynamic pages (feeds, ads) will naturally differ between visits. Stated in the popup.
