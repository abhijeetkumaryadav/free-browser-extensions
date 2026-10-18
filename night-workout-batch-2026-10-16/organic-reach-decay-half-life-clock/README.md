# Reach Half-Life Clock

Log your own engagement snapshots for your posts and estimate each post's **reach half-life** from your data — fully local, zero network.

## What it does
- Add posts (title, platform, publish time) and log engagement snapshots over time (likes/views at a moment you record).
- Canvas decay curve per post, drawn from **your snapshots only**.
- Estimated half-life via a simple exponential model (first snapshot as the peak anchor, last snapshot as the decayed point), shown in plain words with an explicit "rough and approximate" caveat.
- Autosaved personal notes tab.

## What it does NOT do
- No platform analytics, no API calls, no scraping. You type the numbers yourself. Estimates are heuristic — treat them as rough guesses, not measurements.

## Permissions
- `storage` — saves your posts, snapshots, and notes in `chrome.storage.local`.
