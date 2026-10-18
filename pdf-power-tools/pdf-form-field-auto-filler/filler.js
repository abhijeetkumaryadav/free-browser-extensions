/* FormPilot injected page script — scans fillable fields and fills approved ones.
 * Loaded on demand via chrome.scripting; exposes two globals:
 *   window.__fpScan() -> [{ idx, label, name, inputType, matchedKey, value }]
 *   window.__fpFill(mapping, values) -> { filled, total }
 * Never touches passwords, hidden, file, or disabled inputs. Read-only until
 * the user approves a fill.
 */
(() => {
  if (window.__fpLoaded) return;
  window.__fpLoaded = true;

  // Profile field keys FormPilot knows about.
  const FIELDS = [
    'firstName', 'lastName', 'fullName', 'email', 'phone',
    'address1', 'address2', 'city', 'state', 'zip', 'country',
    'company', 'website', 'dob',
  ];

  const SKIP_TYPES = new Set([
    'password', 'hidden', 'file', 'submit', 'button', 'checkbox',
    'radio', 'image', 'reset', 'color', 'range',
  ]);

  /** Map of autocomplete tokens -> profile key (checked first). */
  const AUTOCOMPLETE_MAP = {
    'given-name': 'firstName',
    'family-name': 'lastName',
    'additional-name': 'fullName',
    name: 'fullName',
    email: 'email',
    tel: 'phone',
    'tel-national': 'phone',
    'tel-area-code': 'phone',
    'street-address': 'address1',
    'address-line1': 'address1',
    'address-line2': 'address2',
    'address-level2': 'city',
    'address-level1': 'state',
    'postal-code': 'zip',
    country: 'country',
    'country-name': 'country',
    organization: 'company',
    url: 'website',
    bday: 'dob',
  };

  /** Multi-token patterns, checked before single tokens (most specific first). */
  const COMPOUND_RULES = [
    [['full', 'name'], 'fullName'],
    [['first', 'name'], 'firstName'],
    [['last', 'name'], 'lastName'],
    [['given', 'name'], 'firstName'],
    [['family', 'name'], 'lastName'],
    [['sur', 'name'], 'lastName'],
    [['email', 'address'], 'email'],
    [['e', 'mail'], 'email'],
    [['phone', 'number'], 'phone'],
    [['mobile', 'number'], 'phone'],
    [['contact', 'number'], 'phone'],
    [['street', 'address'], 'address1'],
    [['address', 'line', '1'], 'address1'],
    [['address', 'line', '2'], 'address2'],
    [['postal', 'code'], 'zip'],
    [['zip', 'code'], 'zip'],
    [['pin', 'code'], 'zip'],
    [['date', 'of', 'birth'], 'dob'],
  ];

  /** Single tokens -> profile key. */
  const TOKEN_MAP = {
    email: 'email',
    mail: 'email',
    phone: 'phone',
    tel: 'phone',
    mobile: 'phone',
    cell: 'phone',
    firstname: 'firstName',
    fname: 'firstName',
    given: 'firstName',
    forename: 'firstName',
    lastname: 'lastName',
    lname: 'lastName',
    surname: 'lastName',
    family: 'lastName',
    fullname: 'fullName',
    name: 'fullName', // only reached when nothing more specific matched
    address: 'address1',
    street: 'address1',
    addr: 'address1',
    apt: 'address2',
    suite: 'address2',
    unit: 'address2',
    city: 'city',
    town: 'city',
    locality: 'city',
    state: 'state',
    province: 'state',
    region: 'state',
    county: 'state',
    zip: 'zip',
    postal: 'zip',
    postcode: 'zip',
    pincode: 'zip',
    country: 'country',
    company: 'company',
    organization: 'company',
    org: 'company',
    business: 'company',
    employer: 'company',
    website: 'website',
    url: 'website',
    dob: 'dob',
    birthday: 'dob',
  };

  function tokens(str) {
    return String(str || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  function matchKey(haystackTokens, autocomplete) {
    // 1. autocomplete attribute wins when it maps cleanly.
    const acTokens = tokens(autocomplete);
    for (const t of acTokens) {
      if (AUTOCOMPLETE_MAP[t]) return AUTOCOMPLETE_MAP[t];
    }
    // 2. compound patterns, longest first.
    const joined = ' ' + haystackTokens.join(' ') + ' ';
    const ordered = [...COMPOUND_RULES].sort((a, b) => b[0].length - a[0].length);
    for (const [seq, key] of ordered) {
      if (joined.includes(' ' + seq.join(' ') + ' ')) return key;
    }
    // 3. single tokens, in haystack order.
    for (const t of haystackTokens) {
      if (TOKEN_MAP[t]) return TOKEN_MAP[t];
    }
    return null;
  }

  function fieldLabel(el) {
    const parts = [];
    if (el.labels && el.labels.length > 0) {
      parts.push(el.labels[0].innerText.trim());
    }
    parts.push(
      el.getAttribute('aria-label'),
      el.placeholder,
      el.name,
      el.id,
      el.title
    );
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function collectFields() {
    const els = [...document.querySelectorAll('input, textarea, select')];
    const out = [];
    els.forEach((el, idx) => {
      const type = (el.type || el.tagName.toLowerCase()).toLowerCase();
      if (SKIP_TYPES.has(type)) return;
      if (el.disabled || el.readOnly) return;
      if (el.offsetParent === null && type !== 'select') return; // not visible
      const label = fieldLabel(el) || `${el.tagName.toLowerCase()} field ${idx + 1}`;
      const haystack = tokens(
        [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), label].join(' ')
      );
      const matchedKey = matchKey(haystack, el.getAttribute('autocomplete'));
      out.push({
        idx,
        label: label.slice(0, 80),
        name: el.name || el.id || '',
        inputType: type,
        matchedKey,
        value: el.value || '',
      });
    });
    return out;
  }

  function setNativeValue(el, value) {
    const proto =
      el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  window.__fpScan = function () {
    return collectFields();
  };

  window.__fpFill = function (mapping, values) {
    const fields = collectFields();
    let filled = 0;
    for (const f of fields) {
      const key = mapping[f.idx];
      const value = key ? values[key] : '';
      if (!key || value == null || String(value).trim() === '') continue;
      const el = document.querySelectorAll('input, textarea, select')[f.idx];
      if (!el || el.disabled || el.readOnly) continue;
      try {
        if (el.tagName === 'SELECT') {
          const needle = String(value).toLowerCase();
          let picked = -1;
          for (let i = 0; i < el.options.length; i++) {
            const o = el.options[i];
            const hay = (o.text + ' ' + o.value).toLowerCase();
            if (hay.includes(needle) || needle.includes(o.value.toLowerCase())) {
              picked = i;
              break;
            }
          }
          if (picked >= 0) {
            el.selectedIndex = picked;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            filled++;
          }
        } else {
          setNativeValue(el, String(value));
          filled++;
        }
      } catch (e) {
        /* skip fields that refuse programmatic input */
      }
    }
    return { filled, total: Object.keys(mapping).length };
  };
})();
