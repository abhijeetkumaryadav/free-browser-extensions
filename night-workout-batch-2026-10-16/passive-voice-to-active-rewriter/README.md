# Passive Pattern Flagger — Style Helper

Flags likely **passive-voice patterns** in pasted text and shows rewrite guidance
you apply yourself.

## Honest scope

- **Flags patterns — you do the rewriting.** This extension has no AI, no grammar
  engine, and never rewrites anything.
- Heuristic only: be-verb + past-participle patterns, "get + participle", and
  "by …" doer phrases. It can miss real passives and flag things that are fine
  ("The patient was treated" is often better passive).
- 100% local. Zero network. Draft text is saved in `chrome.storage.local` only.

## Use

1. Paste text into the box.
2. Click **Scan for passive patterns**.
3. Review each flagged pattern with its explanation, then rewrite in your own words.
4. Open **How to rewrite** for guidance: find the doer, move it to the front,
   keep passives that serve a purpose.

## Permissions

- `storage` — remembers your draft and scan count. Nothing else.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `icons/` · `README.md`
