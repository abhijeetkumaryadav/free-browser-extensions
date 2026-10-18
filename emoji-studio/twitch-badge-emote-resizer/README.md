# EmoteForge — Twitch Badge & Emote Resizer

Resize your images to Twitch's exact emote sizes (**28×28**, **56×56**, **112×112** px PNG),
name them with valid emote codes, and walk a submission checklist before you upload them
to Twitch yourself.

## What it does

- Drag & drop (or browse) PNG / JPG / WebP images — processed **100% locally** in your browser
- Center-crop + high-quality resize to all three Twitch emote sizes
- Live previews with per-file KB size and a warning when a file exceeds Twitch's **25 KB** limit
- One-click download of each size as `<emote-code>-<size>.png`
- Emote-code field auto-sanitized to Twitch's rules (letters/numbers, 4–100 chars)
- Persistent submission checklist so you don't miss a requirement

## Honest scope

- EmoteForge **never uploads anything anywhere**. Twitch requires manual upload through the
  Creator Dashboard (**Creator Dashboard → Viewer Rewards → Emotes**). There is no OAuth,
  no API integration, and no network access in this extension at all.
- It cannot guarantee an emote will pass Twitch review — originality, content rules, and
  approval are between you and Twitch.

## Install

1. Unzip `twitch-badge-emote-resizer.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:addons` → gear → Debug Add-ons)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your submission-checklist progress and emote-code list locally |

No host permissions, no tabs, no scripting — the extension never touches web pages.

## Publishing notes

- Manifest V3, no remote code, no analytics, single-purpose utility
- Suitable for the Chrome Web Store "Productivity" category; privacy policy can state
  "no data collected, no network access"
