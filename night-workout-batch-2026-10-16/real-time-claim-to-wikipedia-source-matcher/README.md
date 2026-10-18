# Claim Check — Wikipedia Source Matcher

Paste a claim, launch a Wikipedia search for it, and keep your own verdict log.

## Honest scope

**Your research — not automated fact-checking.** This extension does not verify
anything. It builds a Wikipedia search URL from the text you paste and opens it
in a new tab. You read the sources and log your own verdict: Confirmed,
Unconfirmed, Disputed, or False. Nothing is uploaded anywhere; the log lives in
`chrome.storage.local` on your machine.

## Features

- Paste a claim → open a Wikipedia search in one click
- Verdict chips: Confirmed / Unconfirmed / Disputed / False
- Optional notes per verdict ("what the sources said")
- Newest-first log with timestamps, per-entry delete, clear-all
- Zero network calls from the extension itself (only the tab you open)

## Permissions

- `storage` — your verdict log
- `tabs` — opening the Wikipedia search tab

## Privacy

Fully local. No accounts, no analytics, no remote calls.
