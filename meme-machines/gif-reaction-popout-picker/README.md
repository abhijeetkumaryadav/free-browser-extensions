# ReactPop — Reaction GIF Picker

A playful reaction picker with **12 original animated GIFs** (happy, sad, lol, facepalm, wow, love, angry, cool, sleepy, confused, party, shrug).

- Pick a reaction from the grid.
- **Pop out** — drops the GIF onto the current page as a larger **draggable overlay** (shadow-DOM, so page styles can't break it). Drag it anywhere, click × to dismiss.
- **Copy** — copies a static PNG of the reaction to your clipboard.

All art is original placeholder content drawn for this extension — no copyrighted GIFs, no network calls, everything stays on-device.

## Install (Chrome / Edge / Opera)

1. Unzip `gif-reaction-popout-picker.zip`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox supports Manifest V3; `chrome.*` calls need the `browser` polyfill or Firefox ≥ 109's `chrome` compatibility. Load via `about:debugging → This Firefox → Load Temporary Add-on`. Pop-out uses `scripting`, supported in Firefox.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Inject the pop-out overlay only into the tab you clicked on. |
| `scripting` | Execute the overlay content script on-demand after you press "Pop out". |

No `storage`, no host permissions, no remote code, no analytics.

## Publishing notes

- No remote code execution, no data collection — declare accordingly in the store privacy questionnaire.
- All images are original; no trademark or copyright concerns.
