# Word Frequency Highlighter

## Honest scope
A **local word-frequency analyzer**. Paste text (or grab it from the active field on the page)
and it shows total/unique/repeated word counts, a ranked table of overused words (click a row to
highlight every occurrence in the preview), and a preview pane.

It counts words — it makes no grammar or style judgments and uses no AI. Stopwords are excluded
from the overused list unless used 5+ times.

## Permissions
- `storage` — UI prefs only.
- `activeTab` + `scripting` — "Grab active field" reads the focused input or current selection,
  only when you click it.

## Privacy
100% local, zero network. Your text is never stored or transmitted.
