# Textbook Price Log — Manual Price Comparator

**Your price log — manual, not live prices.** This extension does not scan
barcodes and does not fetch prices from any store. You type prices in
yourself; the log groups them by book, shows the best price per book, and
keeps a per-store price history.

## Features

- Log prices with title, optional ISBN, store, price, currency
- Best price per book (grouped by title, newest-first history per store)
- Case-insensitive search across title, store, ISBN
- Per-entry delete, clear-all with confirm
- Export / import JSON backup of the whole log
- Stored in `chrome.storage.local` — zero network calls

## Permissions

- `storage` — save your price log locally.

## Install (developer mode)

1. `chrome://extensions` → Developer mode → Load unpacked → select this folder.
2. Pin "Textbook Price Log" and log prices as you shop.

## Honest scope

This is a manual price diary. Any "best price" it shows is only the best
among prices *you* entered. It cannot tell you what stores charge right now.
