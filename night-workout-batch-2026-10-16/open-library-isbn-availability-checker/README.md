# ISBN Wishlist — Book Tracker & Open Library Links

**Your wishlist — not live availability.** This extension keeps your personal
list of ISBNs. It performs no availability checks and calls no book APIs.
Each entry has an "Open Library search" button that simply opens an
Open Library search page for that ISBN in a new tab, for you to read yourself.

## Features

- Add books with validated ISBN-10 / ISBN-13 (check digit verified), title, author, notes
- Case-insensitive search across title, author, ISBN, and notes
- Per-book "Open Library search" button (`https://openlibrary.org/search?q=<isbn>`)
- Per-book delete, clear-all with confirm
- Everything stored in `chrome.storage.local` — zero network calls by the extension itself

## Permissions

- `storage` — save your wishlist locally.

## Install (developer mode)

1. `chrome://extensions` → Developer mode → Load unpacked → select this folder.
2. Pin "ISBN Wishlist" and add books by ISBN.

## Honest scope

This tool does not check whether a book is in stock, in a library, or
available anywhere. It is a list you maintain; the Open Library links are a
convenience for your own research.
