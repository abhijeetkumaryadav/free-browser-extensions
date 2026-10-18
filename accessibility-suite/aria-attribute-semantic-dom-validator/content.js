/* ARIA Lens — content-side audit engine.
 * Injected on demand via chrome.scripting.executeScript. Everything runs
 * locally against document; nothing is sent anywhere.
 * Exposes window.__ariaAudit() -> { issues: [...], stats: {...} },
 * window.__ariaHighlightIssues() and window.__ariaClearHighlight().
 */
(() => {
  'use strict';

  // --- reference data -------------------------------------------------------
  const VALID_ROLES = new Set([
    'alert','alertdialog','application','article','banner','button','cell','checkbox',
    'columnheader','combobox','complementary','contentinfo','definition','dialog',
    'directory','document','feed','figure','form','grid','gridcell','group','heading',
    'img','link','list','listbox','listitem','log','main','marquee','math','menu',
    'menubar','menuitem','menuitemcheckbox','menuitemradio','navigation','none',
    'note','option','presentation','progressbar','radio','radiogroup','region','row',
    'rowgroup','rowheader','scrollbar','search','searchbox','separator','slider',
    'spinbutton','status','switch','tab','table','tablist','tabpanel','term',
    'textbox','timer','toolbar','tooltip','tree','treegrid','treeitem'
  ]);

  // aria-* attributes that exist in the spec
  const VALID_ARIA = new Set([
    'aria-activedescendant','aria-atomic','aria-autocomplete','aria-busy','aria-checked',
    'aria-colcount','aria-colindex','aria-colspan','aria-controls','aria-current',
    'aria-describedby','aria-details','aria-disabled','aria-dropeffect','aria-errormessage',
    'aria-expanded','aria-flowto','aria-grabbed','aria-haspopup','aria-hidden',
    'aria-invalid','aria-keyshortcuts','aria-label','aria-labelledby','aria-level',
    'aria-live','aria-modal','aria-multiline','aria-multiselectable','aria-orientation',
    'aria-owns','aria-placeholder','aria-posinset','aria-pressed','aria-readonly',
    'aria-relevant','aria-required','aria-roledescription','aria-rowcount','aria-rowindex',
    'aria-rowspan','aria-selected','aria-setsize','aria-sort','aria-valuemax',
    'aria-valuemin','aria-valuenow','aria-valuetext'
  ]);

  // roles that REQUIRE an accessible name
  const NAME_REQUIRED_ROLES = new Set([
    'button','link','checkbox','menuitem','menuitemcheckbox','menuitemradio',
    'option','radio','switch','tab','treeitem','slider','spinbutton','textbox',
    'combobox','searchbox','progressbar','scrollbar','separator','img','figure','heading'
  ]);

  // required owned aria-* per role (subset of the spec's required states)
  const REQUIRED_ARIA = {
    slider: ['aria-valuenow'],
    spinbutton: ['aria-valuenow'],
    checkbox: ['aria-checked'],
    switch: ['aria-checked'],
    radio: ['aria-checked'],
    menuitemcheckbox: ['aria-checked'],
    menuitemradio: ['aria-checked'],
    scrollbar: ['aria-valuenow'],
    separator: ['aria-valuenow'],
    combobox: ['aria-expanded'],
    listbox: ['aria-orientation']
  };

  // --- helpers --------------------------------------------------------------
  const issues = [];
  const seen = new Set(); // dedupe identical (type, element)

  function snippet(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.textContent || '').trim().slice(0, 40);
    return `<${tag}${id}${cls}>${txt ? ' "' + txt + '"' : ''}`;
  }

  function add(el, type, severity, message) {
    const key = type + '::' + snippet(el);
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ type, severity, message, snippet: snippet(el) });
  }

  function accessibleName(el) {
    // Simplified accessible-name computation (spec order approximation)
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const parts = labelledby.split(/\s+/)
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(n => n.textContent.trim())
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    if (el.tagName === 'INPUT') {
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label && label.textContent.trim()) return label.textContent.trim();
      }
      const wrap = el.closest('label');
      if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
      const ph = el.getAttribute('placeholder');
      if (ph) return ph; // weak but present — flagged separately
    }
    if (el.tagName === 'IMG' || el.tagName === 'AREA') {
      const alt = el.getAttribute('alt');
      if (alt !== null) return alt; // may be empty (decorative) — handled by caller
    }
    const text = (el.textContent || '').trim();
    if (text) return text;
    const title = el.getAttribute('title');
    if (title) return title;
    return '';
  }

  function isHidden(el) {
    if (el.getAttribute('aria-hidden') === 'true') return true;
    const style = getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  // --- the audit ------------------------------------------------------------
  function audit() {
    issues.length = 0;
    seen.clear();
    const all = document.querySelectorAll('*');

    // 1. duplicate ids
    const idCount = {};
    all.forEach(el => { if (el.id) idCount[el.id] = (idCount[el.id] || 0) + 1; });
    Object.entries(idCount).forEach(([id, n]) => {
      if (n > 1) {
        const el = document.getElementById(id);
        add(el, 'duplicate-id', 'error',
          `id="${id}" is used ${n} times — ids must be unique`);
      }
    });

    // 2. per-element checks
    let lastHeadingLevel = 0;
    let h1Count = 0;
    all.forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const tag = el.tagName.toLowerCase();

      // --- images need alt ---
      if (tag === 'img' && !isHidden(el)) {
        const alt = el.getAttribute('alt');
        if (alt === null) add(el, 'img-missing-alt', 'error', '<img> has no alt attribute');
        else if (alt === '' && el.getAttribute('role') !== 'presentation' && el.getAttribute('role') !== 'none')
          add(el, 'img-empty-alt', 'warning', '<img> has empty alt — fine only if decorative');
      }

      // --- buttons / links need accessible names ---
      if ((tag === 'button' || (tag === 'input' && /^(button|submit|reset)$/i.test(el.type || ''))) && !isHidden(el)) {
        if (!accessibleName(el)) add(el, 'button-no-name', 'error', '<button> has no accessible name');
      }
      if (tag === 'a' && el.hasAttribute('href') && !isHidden(el)) {
        if (!accessibleName(el)) add(el, 'link-no-name', 'error', '<a> has no accessible name');
      }

      // --- form controls need labels ---
      if (/^(input|select|textarea)$/.test(tag) && !/^(hidden|button|submit|reset|image)$/i.test(el.type || '') && !isHidden(el)) {
        const id = el.id;
        const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrapped = !!el.closest('label');
        const ariaName = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (!hasFor && !wrapped && !ariaName) {
          const ph = el.getAttribute('placeholder');
          add(el, 'input-no-label', ph ? 'warning' : 'error',
            ph ? 'Input relies on placeholder alone — add a real <label>'
               : 'Form control has no <label>, aria-label or aria-labelledby');
        }
      }

      // --- role validity ---
      const role = el.getAttribute('role');
      if (role !== null) {
        role.trim().split(/\s+/).forEach(r => {
          if (!VALID_ROLES.has(r)) add(el, 'invalid-role', 'error', `role="${r}" is not a valid ARIA role`);
        });
        const first = role.trim().split(/\s+/)[0];
        if (VALID_ROLES.has(first)) {
          if (NAME_REQUIRED_ROLES.has(first) && !isHidden(el) && !accessibleName(el))
            add(el, 'role-no-name', 'error', `role="${first}" requires an accessible name`);
          (REQUIRED_ARIA[first] || []).forEach(attr => {
            if (!el.hasAttribute(attr))
              add(el, 'role-missing-aria', 'error', `role="${first}" requires ${attr}`);
          });
        }
        // aria-hidden on focusable element
        if (el.getAttribute('aria-hidden') === 'true' &&
            /^(a|button|input|select|textarea)$/.test(tag) && el.tabIndex >= 0)
          add(el, 'aria-hidden-focusable', 'error', 'Focusable element has aria-hidden="true"');
      }

      // --- aria-* attribute validity ---
      for (const attr of el.getAttributeNames()) {
        if (attr.startsWith('aria-') && !VALID_ARIA.has(attr))
          add(el, 'invalid-aria-attr', 'error', `${attr} is not a valid ARIA attribute`);
      }

      // --- positive tabindex ---
      const ti = el.getAttribute('tabindex');
      if (ti !== null && /^\d+$/.test(ti) && parseInt(ti, 10) > 0)
        add(el, 'positive-tabindex', 'warning', `tabindex="${ti}" disrupts natural tab order`);

      // --- heading order ---
      const hm = tag.match(/^h([1-6])$/);
      if (hm) {
        const lvl = parseInt(hm[1], 10);
        if (lvl === 1) h1Count++;
        if (lastHeadingLevel && lvl > lastHeadingLevel + 1)
          add(el, 'heading-skip', 'warning', `Heading jumps from h${lastHeadingLevel} to h${lvl}`);
        lastHeadingLevel = lvl;
        if (!accessibleName(el)) add(el, 'empty-heading', 'warning', `<${tag}> is empty`);
      }
    });

    if (h1Count === 0) add(document.body || document.documentElement, 'no-h1', 'warning', 'Page has no <h1>');
    if (h1Count > 1) add(document.body || document.documentElement, 'multiple-h1', 'warning', `Page has ${h1Count} <h1> elements`);

    // --- landmark sanity ---
    if (!document.querySelector('main, [role="main"]'))
      add(document.body || document.documentElement, 'no-main', 'warning', 'No <main> landmark found');
    if (!document.querySelector('nav, [role="navigation"]'))
      add(document.body || document.documentElement, 'no-nav', 'info', 'No <nav> landmark found');

    // --- stats ---
    const stats = { error: 0, warning: 0, info: 0 };
    issues.forEach(i => stats[i.severity]++);
    return { issues, stats, url: location.href, title: document.title };
  }

  // --- highlighting ---------------------------------------------------------
  // Highlighting re-runs a lightweight pass that adds outline classes
  // directly to offending elements (best-effort pairing with audit rows).
  const HL_CLASS = '__aria-lens-hl';
  function ensureStyle() {
    if (document.getElementById('__aria-lens-style')) return;
    const st = document.createElement('style');
    st.id = '__aria-lens-style';
    st.textContent = `
      .${HL_CLASS}-error { outline: 3px solid #f87171 !important; outline-offset: 2px !important; }
      .${HL_CLASS}-warning { outline: 3px dashed #fbbf24 !important; outline-offset: 2px !important; }
      .${HL_CLASS}-info { outline: 2px dotted #38bdf8 !important; outline-offset: 2px !important; }`;
    document.documentElement.appendChild(st);
  }

  const HL_CLASSES = [`${HL_CLASS}-error`, `${HL_CLASS}-warning`, `${HL_CLASS}-info`];

  window.__ariaClearHighlight = function () {
    ensureStyle();
    document.querySelectorAll('.' + HL_CLASSES.join(',.'))
      .forEach(el => el.classList.remove(...HL_CLASSES));
  };

  // Direct highlight pass: same core checks, classes applied inline.
  window.__ariaHighlightIssues = function () {
    ensureStyle();
    window.__ariaClearHighlight();
    const mark = (el, sev) => { if (el && el.classList) el.classList.add(`${HL_CLASS}-${sev}`); };
    const all = document.querySelectorAll('*');
    const idCount = {};
    all.forEach(el => { if (el.id) idCount[el.id] = (idCount[el.id] || 0) + 1; });
    Object.entries(idCount).forEach(([id, n]) => {
      if (n > 1) mark(document.getElementById(id), 'error');
    });
    all.forEach(el => {
      if (!(el instanceof HTMLElement) || isHidden(el)) return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' && el.getAttribute('alt') === null) mark(el, 'error');
      if (tag === 'button' && !accessibleName(el)) mark(el, 'error');
      if (tag === 'a' && el.hasAttribute('href') && !accessibleName(el)) mark(el, 'error');
      if (/^(input|select|textarea)$/.test(tag) && !/^(hidden|button|submit|reset|image)$/i.test(el.type || '')) {
        const id = el.id;
        const ok = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (!ok) mark(el, 'error');
      }
      const role = el.getAttribute('role');
      if (role !== null && !role.trim().split(/\s+/).every(r => VALID_ROLES.has(r))) mark(el, 'error');
      const ti = el.getAttribute('tabindex');
      if (ti !== null && /^\d+$/.test(ti) && parseInt(ti, 10) > 0) mark(el, 'warning');
      const hm = tag.match(/^h([1-6])$/);
      if (hm && !accessibleName(el)) mark(el, 'warning');
    });
  };

  window.__ariaAudit = audit;

  // The injected file's completion value is the audit result.
  return audit();
})();
