# My Page Notes — Personal Annotations

Private annotations on web pages. Select text on any page, add a note anchored
to it, and see your notes highlighted when you revisit the page.

## Honest scope

- **Your notes — not community notes.** There is no shared overlay mesh, no
  server, no other users. Everything is stored locally in your browser.
- Notes are injected on click only (`activeTab` + `scripting`); nothing runs on
  pages you don't interact with.

## Features

- Note on selected text or on the whole page
- "This page" view shows notes for the current tab
- "All notes" view with search
- Highlight my notes on this page (click-only, reversible refresh)
- Delete notes individually

## Tech

- Manifest V3, `activeTab` + `scripting` + `storage` permissions, fully local.
