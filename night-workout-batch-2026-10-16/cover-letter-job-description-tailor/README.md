# Cover Letter Kit — Templates + Keyword Checklist

A cover-letter helper with **no AI**: template outlines with writing prompts,
plus a heuristic keyword checklist extracted from a pasted job description.

## Honest scope

- **You write the letter.** Templates are static outlines; the keyword list is a
  frequency heuristic (words appearing 2+ times, minus stopwords). Nothing is
  generated or tailored by AI.
- Keywords are suggestions — review them yourself; heuristics can miss or
  surface junk.
- 100% local. Zero network. Drafts and job descriptions live in
  `chrome.storage.local` only.

## Use

**Outline tab**
1. Pick a template (Standard, Career change, Referred).
2. Write each section following its prompt.
3. **Save draft** (stored locally) or **Copy text**.

**Keywords tab**
1. Paste a job description.
2. **Extract keyword checklist** → repeated keywords with counts.
3. Check each off as you address it in your letter.

**Drafts tab** — copy or delete saved drafts.

## Permissions

- `storage` — saves drafts locally. Nothing else.
- Clipboard access is used only when you click copy (no permission needed for
  user-gesture writes).

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `icons/` · `README.md`
