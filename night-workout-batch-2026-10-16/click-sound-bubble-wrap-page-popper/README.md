# Bubble Wrap Popper — Click Sound Toy

A harmless bubble-wrap popping toy for any tab.

## How it works

1. Click **Pop on this tab** — a full-viewport overlay filled with bubbles appears on the current tab (explicit click only; internal `chrome://` pages are guarded).
2. Click any bubble to pop it — a satisfying pop sound is synthesized with the **Web Audio API** (no audio files bundled).
3. A counter tracks total bubbles popped across sessions.
4. Press **Esc**, click the empty area, or hit **Remove** in the popup — the overlay is deleted completely.

## Honest scope

- Labeled as a **toy**.
- The overlay is the only thing added to the page; **the page itself is never modified** — no DOM of the page is touched.
- Pop sounds toggle and bubble size are adjustable; nothing runs until you click.
- 100% local, zero network. No remote code, no secrets.

## Tech

- Manifest V3, `storage` + `activeTab` + `scripting` (click-only injection).
- 380px deep-dark glassmorphism popup, single green `#4ade80` accent, Lucide-style outline icons.

## Install (developer mode)

1. Open `chrome://extensions`, enable Developer mode.
2. Load unpacked → this folder (or install the `.zip`).
3. Click the toolbar icon, then "Pop on this tab".
