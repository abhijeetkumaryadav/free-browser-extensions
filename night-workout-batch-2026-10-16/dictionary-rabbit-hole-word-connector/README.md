# Word Rabbit Hole — Personal Word Map

Your own word-connection explorer. Link words with your own notes (synonyms, rhymes, personal associations) and wander your map as a node graph.

## What it does
- **Words tab:** add words, search, delete; each shows its link count.
- **Links tab:** link any two words with a connection type (association, synonym, rhyme, opposite, personal) and an optional note.
- **Map tab:** spring-layout node graph — drag nodes to rearrange, click a node to inspect its connections, search to dim non-matches.
- **Export:** download your whole map as JSON. Delete-all with confirmation.

## Honest scope (labeled in the popup)
- Every word and connection is one **you** added. This tool draws YOUR map only — it has no dictionary, defines nothing, and suggests nothing.
- Ships with 4 starter words so the map isn't empty; edit or delete them freely.
- 100% local: `chrome.storage.local` only, zero network, no content script.

## Files
- `manifest.json` — MV3 manifest (permission: `storage` only)
- `popup.html` / `popup.css` / `popup.js` — UI, storage, and canvas graph
- `icons/` — generated PNG icons
