"use strict";
/* Background service worker — routes toolbar clicks to the popup logic
 * via storage so the popup can restore toggle state. Kept minimal. */
chrome.action.onClicked.addListener(() => { /* popup opens on click */ });
