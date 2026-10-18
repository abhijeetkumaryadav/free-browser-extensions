# Medicine Price Logbook

A personal medicine **price logbook** — you log the prices you saw at pharmacies and
see your history with a "lowest seen" highlight per medicine.

## Deliberate, honest scope

- **Logs only.** You enter name, pharmacy, price, and date.
- **Never suggests, compares, or recommends medicines or generics.**
- **Not medical advice.** The popup always shows this banner:

> ⚠️ Not medical advice — ask your pharmacist about generics.

Talk to your doctor or pharmacist before changing any medication.

## Features

- Add price entries (medicine name, pharmacy, price, date)
- Search your log and sort by newest, oldest, lowest, or highest price
- "Lowest seen" badge on your cheapest recorded price per medicine
- Delete individual entries, export the whole log as JSON, or clear all

## Privacy

- 100% local — entries live in `chrome.storage.local`
- No network calls, no accounts, no tracking

## Permissions

- `storage` — save your entries locally
