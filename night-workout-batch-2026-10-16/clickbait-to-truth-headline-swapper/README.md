# Headline Calmer — Clickbait to Neutral

A headline **de-sensationalizer**. Paste a headline (or grab the page's main headline) and it proposes a calm, neutral rewording using local language heuristics.

## ⚠️ Honest scope

- This is a **rewording aid only** — it does **not** verify truth, fact-check claims, or detect misinformation.
- All processing is local heuristics (caps normalization, bait-phrase swaps, punctuation trimming). Nothing leaves the device; no network calls.

## How it works

1. Type or paste a headline, or click **Grab page headline** to pull the active tab's `<h1>` / `og:title` (runs on click only).
2. Click **Calm it down** — the extension applies pattern swaps and explains each change in "What changed".
3. Edit the rewording freely and **Copy rewording** when you're happy.

## Permissions

- `storage` — remembers nothing sensitive; reserved for future prefs.
- `activeTab` + `scripting` — reads the page headline only when you click "Grab page headline".

## Install

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or install the `.zip`).

## Development

`node --check popup.js` passes. No dependencies.
