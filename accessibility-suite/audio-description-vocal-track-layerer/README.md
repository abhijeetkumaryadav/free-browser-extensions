# Audio Description Layer

Attach your own spoken audio-description track to videos on any page. You write timed cues (`mm:ss` + description text); the extension speaks each line aloud via **on-device speech synthesis** at the right moment during playback.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

## How to use

1. Open a page with a `<video>` and click the extension icon.
2. Click **Find** — pick the video from the dropdown.
3. Click **+ Add cue** and fill in time (`mm:ss`) + the description to speak.
4. Adjust **rate / pitch / volume**, then click **Start description track**.
5. Play the video — each cue is spoken when playback reaches its timestamp. **Stop** ends the track and silences speech.
6. **Save cues for this site** stores them in `chrome.storage.local` keyed by site origin; **Export/Import** moves cue sets as JSON.

## Behavior details

- Cues are sorted by time; each cue fires once per pass.
- Seeking backward re-arms future cues; seeking cancels in-flight speech.
- Speech uses the Web Speech API (`speechSynthesis`) — fully on-device, no network.

## Permissions

- `activeTab` + `scripting` — find videos and attach the timing listener on the current page, only when you ask.
- `storage` — save your cue sets per site.

## Honest scope

- Cues are **written entirely by you**. This tool does **not** auto-generate, transcribe, or analyze video content.
- Speech quality depends on the voices installed on the user's OS/browser.
- Pages that heavily sandbox or shadow-DOM their players may not expose a standard `<video>` element; in that case the finder reports "no videos".

## Publishing notes

- No remote code, no external resources, no analytics — MV3 compliant.
- The content script only activates on explicit user action.
