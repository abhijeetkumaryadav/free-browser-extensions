# ComicSansify — Font Prank

A harmless prank: swap every font on the current page to Comic Sans
(with cursive fallbacks) with one click. Fully reversible.

## Install (Chrome / Edge / Opera / Firefox)

1. Unzip `font-comic-sans-inforcer.zip` anywhere.
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`, `about:debugging#/runtime/this-firefox` for Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Use

- Click the toolbar icon to see the current tab's prank state.
- **Comic Sans-ify this page** injects a stylesheet forcing
  `'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', 'Segoe Print', cursive`
  on every element.
- **Restore original fonts** removes the injected stylesheet — the page's
  own fonts return exactly as they were.
- Refreshing the page also restores everything (nothing is persisted on
  the page itself).

The prank is clearly labeled as a joke everywhere in the UI. It only
runs on the active tab when you click — never automatically, never on
browser UI pages.

## Permissions

- `activeTab` — run the injection only on the tab you clicked the
  extension on.
- `scripting` — inject/remove the stylesheet via `chrome.scripting.executeScript`.
- `storage` — counts how many times you've pranked (a vanity stat,
  on-device only).

## Publishing notes

- Manifest V3, no remote code, no network calls, no background scripts.
- Injected functions are fully self-contained (no popup-scope references),
  per MV3 CSP requirements. All user-visible text is static HTML.
- All assets local; icons generated with PIL.
