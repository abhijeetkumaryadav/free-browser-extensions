# HookPace — Video Pacing Timeline

A manual pacing-analysis aid for video creators. You watch a video, tap a beat
type (Hook / Build / Payoff / CTA / Note) when it happens, and HookPace draws a
timeline bar showing beat spacing, flags long lulls, and offers heuristic
pacing guidance. You can also draw the timeline as a floating overlay on the
current page and export your session as JSON.

## Honest scope

- **Manual analysis aid.** Every beat is logged by you with a click; the
  "patterns" are your own observations, not a platform signal or an AI verdict.
- **Heuristic guidance only.** Tips like "no hook in the first 5 seconds" are
  generic storytelling rules of thumb, not guarantees of performance.
- **100% local.** Sessions live in `chrome.storage.local`. Nothing is sent
  anywhere; there is no network code at all.
- The page overlay is injected only when you click
  "Draw timeline overlay on this page", and only into the active tab.

## How to use

1. Enter the video title and length in seconds, then click **Start session**.
   A clock tracks elapsed time.
2. While watching, click **Hook / Build / Payoff / CTA / Note** when each beat
   happens. Notes accept a custom label.
3. Read the **Timeline** (long gaps are shaded red) and **guidance** tips.
4. Optionally draw the timeline as a floating overlay on the current page.
5. **Export JSON** to keep the session, or **Clear beats** to start over.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage`, `activeTab`, `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, glassmorphism styling, session logic |
| `content.js` | Optional on-page timeline overlay (shadow DOM, dismissible) |
| `icons/` | Generated PNG icons (16/48/128) |

## Permissions

- `storage` — save your beat sessions locally.
- `activeTab` + `scripting` — draw the optional timeline overlay on the tab you
  explicitly choose. Never used without your click.

## Build & validation

- `node --check` passes on `popup.js` and `content.js`.
- `manifest.json` parses and targets Manifest V3.
- Icons generated locally with Pillow at exact 16/48/128 sizes.
- Not yet tested in a live browser; packaged as a development build.
