# Closed Caption Font Styler

Style HTML5 video captions your way: **font size**, **font family**, **text color**,
**background color + opacity**, and **edge style** (none / outline / drop shadow /
raised / depressed) — applied as `::cue` overrides with a live preview.

## How it works

- A lightweight content script injects a single `<style>` element with your
  `video::cue` rules. Turning the master switch off removes it — fully reversible.
- **Global settings** apply everywhere; **Save for this site** stores a per-site
  override (shown in the context bar, removable with "Use global").
- **Copy CSS** copies the generated `::cue` block for use in your own stylesheets.

## Honest scope & limitations

- Only affects **native HTML5 `<video>` captions** rendered through `::cue`
  (i.e. `<track>` elements). Sites with custom caption renderers — YouTube,
  Netflix, Twitch, Disney+ — draw their own captions and are **not affected**.
- Cannot run on browser-internal pages (`chrome://`, Web Store, `about:`).

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox / Opera:** MV3 with `::cue` styling works the same; install via
`about:debugging` → "Load Temporary Add-on" (Firefox) or developer mode (Opera).

## Permissions (all justified)

| Permission | Why |
|---|---|
| `storage` | Persist global settings, per-site overrides, and the master switch. |
| `activeTab` | Read the current tab's origin for per-site overrides. |
| Host `http(s)://*/*` | Inject the `::cue` style overrides on pages with video. |

No network calls. No data leaves the device. No remote code.

## Publishing notes

- Chrome Web Store: single purpose (caption styling), minimal permissions.
- The host permission is core to the feature — explain in the store listing that
  it only injects caption CSS and reads nothing from pages.
