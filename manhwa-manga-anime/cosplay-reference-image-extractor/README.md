# MoodBoard — Cosplay Reference Extractor (v1.0.0)

Scan the current tab for images and pin them to per-costume reference boards
with notes. Downloads only what you explicitly click.

**Honest scope:** read-only listing of images the page already loads. Tiny
icons and tracking pixels (< 80px) are skipped. No hotlink protections are
bypassed — the browser itself renders each thumbnail, and `chrome.downloads`
only handles plain `http(s)` URLs (data:/blob: URLs are skipped rather than
worked around).

## Features

- **Scan tab** lists images with dimensions (capped at 120 for performance)
- Pin images to boards — one board per costume/project, with a notes field
- Boards persist locally; create, rename (via name prompt), delete
- **Download board images** queues each `http(s)` image via `chrome.downloads`
  into a `moodboard/` folder with safe filenames
- Click a thumbnail to pin; hover reveals the pin/remove button

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.

**Firefox:** sideload via `about:debugging#/runtime/this-firefox` →
*Load Temporary Add-on*. (`chrome.downloads` is supported; `scripting`
execution needs the active tab grant.)

**Opera:** enable Developer mode on `opera://extensions` → *Load unpacked*.

## Permissions (why each is needed)

| Permission   | Why                                                            |
|--------------|----------------------------------------------------------------|
| `activeTab`  | Scan images on the tab you are viewing, only when you click.   |
| `scripting`  | Run the read-only image-listing function in the active tab.    |
| `downloads`  | Save board images you explicitly choose to download.           |
| `storage`    | Persist boards, notes and pinned image URLs locally.           |

## Publishing notes

- No remote code, no external requests, no data collection → minimal privacy
  disclosure ("does not collect or transmit any user data").
- Downloads are always user-initiated; there are no silent downloads.
- Respect image copyright: this tool is for gathering *references*; only
  download images you have the right to use.
