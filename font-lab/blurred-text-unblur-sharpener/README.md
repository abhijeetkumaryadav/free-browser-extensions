# SharpView — Unblur & Contrast Booster

Removes CSS `filter: blur()` from text on the current page and adds adjustable
contrast/brightness — useful on pages that blur content with local CSS.

## What it does

- **Sharpen this page** — one click finds every element whose *computed* CSS
  filter includes `blur()` and strips just the blur, keeping any other filters
  (brightness, contrast, etc.) intact.
- **Contrast / Brightness sliders** (50–150%) — applied to the page root, live
  while you drag. Settings are remembered between sessions.
- **Restore original** — puts every inline filter back exactly as it was.

## Honest scope

This only affects **local CSS rendering**. It cannot recover text that the site
baked into blurred images, video frames, or canvas — server-side blur is not
reversible from the browser. Elements added to the page *after* you click
Sharpen won't be de-blurred; click Sharpen again to catch them.

## Install

**Chrome / Edge / Opera**
1. Download and unzip `blurred-text-unblur-sharpener.zip`
2. Go to `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Select `manifest.json` in the unzipped folder

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Run the sharpener only on the tab you click it in |
| `scripting` | Inject the on-demand sharpen/restore function |
| `storage` | Remember your contrast/brightness slider settings |

No network calls. Nothing leaves your device.

## Publishing notes

- MV3, no remote code, no data collection — store-safe.
- Chrome Web Store: single-purpose accessibility/readability tool.
