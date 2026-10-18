/* content.js — Twitch Phrasebook side panel (injected on twitch.tv pages).
 * User-triggered only. Renders the user's OWN phrasebook in a toggleable
 * side panel. Does NOT read, translate, or modify chat. Read-only overlay. */
'use strict';

(function () {
  const PANEL_ID = '__twitch_phrasebook_panel';
  const BTN_ID = '__twitch_phrasebook_btn';

  /** Fetch the phrasebook from the extension's local storage. */
  function getEntries() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['phrasebook'], (res) => {
          resolve(res.phrasebook || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  function buildPanel(entries) {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const head = document.createElement('div');
    head.className = 'tpb-head';

    const title = document.createElement('span');
    title.className = 'tpb-title';
    title.textContent = 'My Phrasebook';

    const scope = document.createElement('span');
    scope.className = 'tpb-scope';
    scope.textContent = 'my reference — not live translation';

    const close = document.createElement('button');
    close.className = 'tpb-close';
    close.textContent = '×';
    close.title = 'Close panel';
    close.addEventListener('click', hidePanel);

    head.appendChild(title);
    head.appendChild(scope);
    head.appendChild(close);
    panel.appendChild(head);

    const list = document.createElement('div');
    list.className = 'tpb-list';

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'tpb-empty';
      empty.textContent = 'No phrases yet. Add them from the extension popup.';
      list.appendChild(empty);
    } else {
      entries.forEach((e) => {
        const row = document.createElement('div');
        row.className = 'tpb-row';

        const phrase = document.createElement('div');
        phrase.className = 'tpb-phrase';
        phrase.textContent = e.phrase;

        const meaning = document.createElement('div');
        meaning.className = 'tpb-meaning';
        meaning.textContent = e.meaning;

        row.appendChild(phrase);
        row.appendChild(meaning);
        list.appendChild(row);
      });
    }
    panel.appendChild(list);

    const foot = document.createElement('div');
    foot.className = 'tpb-foot';
    foot.textContent = 'Manual phrasebook — does not translate chat.';
    panel.appendChild(foot);

    return panel;
  }

  function injectStyles() {
    if (document.getElementById('__tpb_styles')) return;
    const style = document.createElement('style');
    style.id = '__tpb_styles';
    style.textContent = [
      '#' + PANEL_ID + ' {',
      '  position: fixed; top: 64px; right: 12px; width: 280px; max-height: 70vh;',
      '  display: flex; flex-direction: column;',
      '  background: rgba(20,20,26,0.92); backdrop-filter: blur(12px);',
      '  border: 1px solid #bf94ff; border-radius: 12px;',
      '  color: #f1f1f4; font-family: sans-serif; z-index: 999999;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.5); overflow: hidden;',
      '}',
      '#' + PANEL_ID + ' .tpb-head { display: flex; align-items: center; gap: 8px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.09); }',
      '#' + PANEL_ID + ' .tpb-title { font-weight: 700; font-size: 13px; color: #bf94ff; }',
      '#' + PANEL_ID + ' .tpb-scope { font-size: 10px; color: #a8a8b3; flex: 1; }',
      '#' + PANEL_ID + ' .tpb-close { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #f1f1f4; border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 16px; line-height: 1; }',
      '#' + PANEL_ID + ' .tpb-list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }',
      '#' + PANEL_ID + ' .tpb-row { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 10px; }',
      '#' + PANEL_ID + ' .tpb-phrase { font-size: 12.5px; font-weight: 700; color: #bf94ff; }',
      '#' + PANEL_ID + ' .tpb-meaning { font-size: 11.5px; color: #a8a8b3; margin-top: 2px; }',
      '#' + PANEL_ID + ' .tpb-empty { font-size: 12px; color: #a8a8b3; text-align: center; padding: 14px 6px; }',
      '#' + PANEL_ID + ' .tpb-foot { padding: 8px 12px; font-size: 10px; color: #a8a8b3; border-top: 1px solid rgba(255,255,255,0.09); text-align: center; }',
      '#' + BTN_ID + ' {',
      '  position: fixed; bottom: 16px; right: 16px; z-index: 999999;',
      '  background: rgba(20,20,26,0.92); color: #bf94ff; border: 1px solid #bf94ff;',
      '  border-radius: 20px; padding: 8px 14px; font-size: 12px; font-weight: 700;',
      '  cursor: pointer; font-family: sans-serif; backdrop-filter: blur(12px);',
      '}'
    ].join('\n');
    document.documentElement.appendChild(style);
  }

  async function showPanel() {
    hidePanel();
    injectStyles();
    const entries = await getEntries();
    document.documentElement.appendChild(buildPanel(entries));
  }

  function hidePanel() {
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
  }

  /** Public toggle, called from the popup on explicit user click. */
  window.__tpbToggle = function () {
    if (document.getElementById(PANEL_ID)) hidePanel();
    else showPanel();
  };

  // Floating launcher button (page overlay only, does not touch chat DOM).
  injectStyles();
  if (!document.getElementById(BTN_ID)) {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = 'Phrasebook';
    btn.title = 'Toggle my phrasebook panel';
    btn.addEventListener('click', window.__tpbToggle);
    document.documentElement.appendChild(btn);
  }
})();
