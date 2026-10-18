# Minesweeper Sandbox — Popup Minesweeper Game

Classic minesweeper that lives entirely in the extension popup.

**What it does**
- Three difficulties: Easy (9×9, 10 mines), Medium (16×16, 40), Hard (16×30, 99)
- Left-click reveals, right-click flags; a Flag toggle button (+ `F` key) for touch users
- Live mine counter, timer, win/lose banners
- First click is always safe (mines are placed after it)
- Best time per difficulty persisted in `chrome.storage.local`

**Honest scope:** offline game in the popup. Zero network calls, no permissions beyond
`storage`. Nothing leaves the machine.

**Files:** `manifest.json` (MV3), `popup.html`, `popup.css`, `popup.js`, `icons/`, `README.md`.
