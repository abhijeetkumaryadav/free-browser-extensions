# Dual-Language Parallel Text Reader

Read two versions of a text side by side — original and translation, draft and edit, any pair you want to compare.

## What it does

- **Paste both texts** in the Edit tab (blank lines split paragraphs) and they open as aligned pairs.
- **Side-by-side columns** with synced scrolling (toggleable) — paragraphs align by order.
- **Per-pair notes** — click any paragraph pair to attach a note; a dot marks pairs that have notes.
- **Saved documents** — keep multiple texts on this device, open or delete them anytime.
- **100% local** — `storage` permission only. No network, no accounts, no machine translation.

## Honest scope

**You supply both texts — the extension never translates.** Paragraph alignment is by order, not by meaning: if one version has extra paragraphs, pairs may drift. Check alignment when the counts differ.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click it to open the 380px popup.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3, `storage` only |
| `popup.html` / `popup.css` / `popup.js` | UI and all logic |
| `icons/` | 16 / 48 / 128 px icons |
