# Cageify — Replace All Images with Funny Faces

A harmless joke extension. One click swaps every image on the current tab for
one of four goofy faces bundled with the extension. One click puts everything
back. Fully reversible, nothing leaves your device.

## Install

**Chrome / Edge / Opera**
1. Unzip `cageify-replace-all-images-face.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab only when you click the popup button |
| `scripting` | Inject the swap/restore logic into the active tab on demand |

No host permissions, no background service worker, no network calls. The four
face images live inside the extension (`faces/`) and are exposed to pages via
`web_accessible_resources` so `<img>` tags can load them.

## How it works

- Clicking **Cageify this page** replaces every `<img>` `src` with a random
  bundled face. Original `src`/`srcset` are stashed in `data-*` attributes.
- A `MutationObserver` keeps cageifying images that load later (lazy loading,
  infinite scroll) while the mode is on.
- **Restore originals** (or toggling off) puts every original source back and
  removes the observer. Nothing on the page is permanently changed.

## Limits (honest scope)

- Only `<img>` elements are swapped; CSS background images and `<video>`
  posters are left alone.
- Cannot run on `chrome://`, `edge://`, `about:` or Chrome Web Store pages —
  the browser blocks injection there.
- Single-page apps that fully re-render may need a second click.

## Publishing notes

- Manifest V3, no remote code, no analytics.
- Chrome Web Store "single purpose" policy: describe it clearly as a joke /
  prank utility in the listing.
