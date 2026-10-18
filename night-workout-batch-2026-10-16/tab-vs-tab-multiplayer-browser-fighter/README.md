# Tab vs Tab Fighter

A harmless, **user-triggered** 2-player arena fighting game played across **two tabs of the same browser**.

## How it works

1. Open any page in **Tab A**, open the extension popup, choose **Player 1**, click **Join arena on this tab**.
2. In **Tab B** (any other tab in the same browser), open the popup, choose **Player 2**, click **Join arena on this tab**.
3. Both tabs show the same arena overlay. Fight!

## Controls (same on both tabs)

- **A / D** — move left / right
- **W** — jump
- **J** — punch (fast, short range)
- **K** — kick (slower, longer range, more damage)
- **L** — fireball (ranged, cooldown)
- **S** — block (halves incoming damage)
- **R** — new round · **Esc** — leave the arena

## Honest scope

- **Same browser only — NOT online multiplayer.** The two fighters sync through `chrome.storage.local` on your machine. There is no server, no matchmaking, no accounts.
- The arena overlay is the **only** thing added to the page; closing it removes every trace. The page itself is **never modified**.
- Nothing runs until you click the button, and nothing leaves your computer.

## Permissions

- `storage` — role, arena state, and scores (also the local cross-tab bus).
- `activeTab` + `scripting` — shows the arena on the tabs you explicitly join, nothing else.
