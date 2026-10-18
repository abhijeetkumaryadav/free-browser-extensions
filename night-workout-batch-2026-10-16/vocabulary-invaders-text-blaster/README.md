# Vocabulary Invaders — Text Blaster

A user-triggered typing game that runs on a canvas overlay on the current tab.

**How to play:** click the extension, pick a difficulty, hit *Start game on this tab*.
Invaders carrying vocabulary words (from a bundled local word list) fall from the
top. Type a word exactly to blast it before it reaches the bottom.

- Score: `10 × word length + streak × 5`
- Waves get faster every 12 blasts; falling to the bottom costs a life
- Best score persists on your device (`chrome.storage.local`)

**Honest scope:** this is a game overlay only. The page DOM is **never modified** —
everything renders on one removable layer. Esc or *Quit* removes every trace.
100% local, zero network, no remote libraries.
