# CatalogCross — Plex/Stremio List Cross-Checker

Maintain two manual title lists — **My Plex** and **My Stremio** — and instantly see
the **overlap**, what's **only on Plex**, and what's **only on Stremio**.

## Features

- Two editable lists with add (Enter key works), duplicate detection, delete
- Smart title matching: case-insensitive, ignores years in parentheses and punctuation
- Overlap / Only-Plex / Only-Stremio views with live counts and search
- JSON export / import (duplicates skipped on import)
- Everything stored locally in `chrome.storage.local`

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
select `manifest.json`.
**Opera:** `opera://extensions` → enable *Developer mode* → *Load unpacked*.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Persist your two title lists on-device |

That's the only permission. No host access, no network calls.

## Honest scope

This is a **manual list cross-checker**. It is not connected to Plex or Stremio
accounts and cannot read your real libraries (those services offer no
extension-friendly user-library API). You type the titles; it does the set math.

## Publishing notes

- Manifest V3, single minimal permission, no remote code — clean privacy review.
- Title rendering uses `textContent` only (XSS-safe).
