/* FormFill Buddy — content script.
 * Runs ONLY when the user clicks "Fill form fields on this page" in the popup.
 * Matches page fields to the locally saved profile using name/id/label heuristics.
 * Never transmits anything. Never fills password fields.
 */
(() => {
  'use strict';

  // keyword → profile key, checked against input name/id/label text
  const RULES = [
    { key: 'fullName',  re: /(full[-_ ]?name|your[-_ ]?name|^name$|applicant[-_ ]?name|customer[-_ ]?name)/i },
    { key: 'firstName', re: /(first[-_ ]?name|given[-_ ]?name|forename)/i },
    { key: 'lastName',  re: /(last[-_ ]?name|surname|family[-_ ]?name)/i },
    { key: 'email',     re: /(e[-_ ]?mail|email[-_ ]?address)/i },
    { key: 'phone',     re: /(phone|mobile|cell|telephone|contact[-_ ]?number|tel)/i },
    { key: 'address1',  re: /(address[-_ ]?(line)?[-_ ]?1|street[-_ ]?address|street|addr1)/i },
    { key: 'address2',  re: /(address[-_ ]?(line)?[-_ ]?2|addr2|apartment|apt|suite|unit)/i },
    { key: 'city',      re: /(city|town|locality)/i },
    { key: 'state',     re: /(state|province|region|county)/i },
    { key: 'postal',    re: /(postal|zip|pin[-_ ]?code|postcode)/i },
    { key: 'country',   re: /(country)/i },
    { key: 'dob',       re: /(date[-_ ]?of[-_ ]?birth|birth[-_ ]?date|dob)/i }
  ];

  function labelText(el) {
    const bits = [];
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) bits.push(lab.textContent);
    }
    const wrap = el.closest('label');
    if (wrap) bits.push(wrap.textContent);
    bits.push(el.name || '', el.id || '', el.placeholder || '',
      el.getAttribute('aria-label') || '');
    return bits.join(' ');
  }

  function setValue(el, value) {
    el.focus();
    // Use the native value setter so frameworks (React etc.) notice the change
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function fill(profile) {
    const fields = document.querySelectorAll('input, textarea, select');
    let filled = 0, skipped = 0;
    fields.forEach(el => {
      // Never touch sensitive field types
      const type = (el.type || '').toLowerCase();
      if (['password', 'hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(type)) return;
      if (el.disabled || el.readOnly) return;

      const hay = labelText(el);
      for (const rule of RULES) {
        const val = (profile[rule.key] || '').trim();
        if (!val) continue;
        if (rule.re.test(hay)) {
          if (el.tagName === 'SELECT') {
            // Try to select a matching option by text
            const opt = [...el.options].find(o =>
              o.text.trim().toLowerCase() === val.toLowerCase() ||
              o.value.trim().toLowerCase() === val.toLowerCase());
            if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; }
            else skipped++;
          } else {
            setValue(el, val);
            filled++;
          }
          // Visual tick so the user sees what was filled
          el.style.outline = '2px solid #34d399';
          el.style.outlineOffset = '1px';
          setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 2500);
          break;
        }
      }
    });
    return { filled, skipped, total: fields.length };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg && msg.type === 'formfill-buddy-fill' && msg.profile) {
      respond(fill(msg.profile));
    }
    return false;
  });
})();
