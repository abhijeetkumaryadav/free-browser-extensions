/* Schema Markup Validator — LocalBusiness JSON-LD validation, 100% client-side.
 * Checks required/recommended fields per schema.org + Google's LocalBusiness
 * guidance, with fix hints. Also scans the active tab's embedded JSON-LD. */
'use strict';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

// Recognized LocalBusiness types (schema.org). Anything else gets an info note.
const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'AnimalShelter', 'AutomotiveBusiness', 'AutoBodyShop',
  'AutoDealer', 'AutoPartsStore', 'AutoRental', 'AutoRepair', 'AutoWash',
  'GasStation', 'MotorcycleDealer', 'MotorcycleRepair', 'ChildCare',
  'Dentist', 'EmergencyService', 'FireStation', 'Hospital',
  'PoliceStation', 'EmploymentAgency', 'EntertainmentBusiness', 'AdultEntertainment',
  'AmusementPark', 'ArtGallery', 'Casino', 'ComedyClub', 'MovieTheater',
  'NightClub', 'FinancialService', 'AccountingService', 'AutomatedTeller',
  'BankOrCreditUnion', 'InsuranceAgency', 'FoodEstablishment', 'Bakery',
  'BarOrPub', 'Brewery', 'CafeOrCoffeeShop', 'Distillery', 'FastFoodRestaurant',
  'IceCreamShop', 'Restaurant', 'Winery', 'GovernmentOffice', 'PostOffice',
  'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon', 'HealthClub',
  'NailSalon', 'TattooParlor', 'HomeAndConstructionBusiness', 'Electrician',
  'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany',
  'Plumber', 'RoofingContractor', 'InternetCafe', 'LegalService', 'Attorney',
  'Notary', 'Library', 'LodgingBusiness', 'BedAndBreakfast', 'Campground',
  'Hostel', 'Hotel', 'Motel', 'Resort', 'MedicalBusiness', 'CommunityHealth',
  'Dermatology', 'DietNutrition', 'Emergency', 'Geriatric',
  'Gynecologic', 'MedicalClinic', 'Midwifery', 'Nursing', 'Obstetric',
  'Oncologic', 'Optician', 'Optometric', 'Otolaryngologic', 'Pediatric',
  'Pharmacy', 'Physician', 'Physiotherapy', 'PlasticSurgery', 'Podiatric',
  'PrimaryCare', 'Psychiatric', 'PublicHealth', 'ProfessionalService',
  'RadioStation', 'RealEstateAgent', 'RecyclingCenter', 'SelfStorage',
  'ShoppingCenter', 'SportsActivityLocation', 'ExerciseGym', 'GolfCourse',
  'SkiResort', 'SportsClub', 'StadiumOrArena', 'SwimmingPool', 'TennisComplex',
  'Store', 'BikeStore', 'BookStore', 'ClothingStore',
  'ComputerStore', 'ConvenienceStore', 'DepartmentStore', 'ElectronicsStore',
  'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore',
  'HobbyShop', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
  'MobilePhoneStore', 'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore',
  'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
  'TireShop', 'ToyStore', 'WholesaleStore', 'TelevisionStation', 'TouristInformationCenter',
  'TravelAgency'
]);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'PublicHolidays'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Recommended (warning-level) top-level fields for a rich LocalBusiness result.
const RECOMMENDED = ['address', 'telephone', 'url', 'image', 'priceRange',
  'openingHoursSpecification', 'geo'];

/* ------------------------------------------------------------------ */
/* Issue model                                                         */
/* ------------------------------------------------------------------ */

function issue(sev, field, message, hint) {
  return { sev, field, message, hint: hint || '' };
}

/* ------------------------------------------------------------------ */
/* Small validators                                                    */
/* ------------------------------------------------------------------ */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function asArray(v) {
  return Array.isArray(v) ? v : [v];
}

function checkUrl(value, field, issues) {
  if (!isNonEmptyString(value)) {
    issues.push(issue('warning', field, 'Should be a non-empty URL string.', 'Use an absolute URL starting with https://.'));
  } else if (!URL_RE.test(value.trim())) {
    issues.push(issue('warning', field, `"${value}" doesn't look like a valid absolute URL.`, 'Use an absolute URL starting with https://.'));
  }
}

/* ------------------------------------------------------------------ */
/* Field validators                                                    */
/* ------------------------------------------------------------------ */

function validateAddress(addr, issues) {
  if (typeof addr === 'string') {
    if (!addr.trim()) issues.push(issue('warning', 'address', 'Address string is empty.', 'Provide the full postal address as text.'));
    else issues.push(issue('info', 'address', 'Address is a plain string.', 'A PostalAddress object with streetAddress, addressLocality, postalCode and addressCountry is richer.'));
    return;
  }
  if (typeof addr !== 'object' || addr === null) {
    issues.push(issue('warning', 'address', 'Address has an unexpected shape.', 'Use a PostalAddress object or a plain address string.'));
    return;
  }
  const type = addr['@type'];
  if (type && type !== 'PostalAddress') {
    issues.push(issue('warning', 'address.@type', `Expected "PostalAddress", found "${type}".`, 'Set "@type": "PostalAddress".'));
  }
  ['streetAddress', 'addressLocality', 'postalCode', 'addressCountry'].forEach((f) => {
    if (!isNonEmptyString(addr[f])) {
      issues.push(issue('warning', `address.${f}`, `Missing "${f}".`, `Add "${f}" to the PostalAddress object.`));
    }
  });
  if (addr.addressRegion && typeof addr.addressRegion !== 'string') {
    issues.push(issue('warning', 'address.addressRegion', 'addressRegion should be a string.', 'Use the region/state name or code as a string.'));
  }
}

function validateOpeningHours(spec, issues) {
  asArray(spec).forEach((s, i) => {
    const base = `openingHoursSpecification[${i}]`;
    if (typeof s !== 'object' || s === null) {
      issues.push(issue('warning', base, 'Entry should be an OpeningHoursSpecification object.', 'Use { "@type": "OpeningHoursSpecification", "dayOfWeek": "Monday", "opens": "09:00", "closes": "17:00" }.'));
      return;
    }
    if (s['@type'] && s['@type'] !== 'OpeningHoursSpecification') {
      issues.push(issue('warning', `${base}.@type`, `Expected "OpeningHoursSpecification", found "${s['@type']}".`, 'Set "@type": "OpeningHoursSpecification".'));
    }
    asArray(s.dayOfWeek || []).forEach((d) => {
      const name = typeof d === 'string' ? d.split('/').pop() : '';
      if (!DAYS.includes(name)) {
        issues.push(issue('warning', `${base}.dayOfWeek`, `"${d}" is not a valid day.`, 'Use "Monday"…"Sunday" (or "PublicHolidays"), optionally as https://schema.org/Monday.'));
      }
    });
    if (!s.dayOfWeek) issues.push(issue('warning', `${base}.dayOfWeek`, 'Missing dayOfWeek.', 'Add e.g. "dayOfWeek": ["Monday", "Tuesday"].'));
    [['opens', s.opens], ['closes', s.closes]].forEach(([k, v]) => {
      if (!isNonEmptyString(v)) {
        issues.push(issue('warning', `${base}.${k}`, `Missing "${k}".`, `Add "${k}" in 24h "HH:MM" format, e.g. "09:00".`));
      } else if (!TIME_RE.test(v.trim())) {
        issues.push(issue('warning', `${base}.${k}`, `"${v}" is not valid 24h "HH:MM" time.`, 'Use 24-hour format like "09:00" or "21:30".'));
      }
    });
  });
}

function validateGeo(geo, issues) {
  if (typeof geo !== 'object' || geo === null) {
    issues.push(issue('warning', 'geo', 'geo should be a GeoCoordinates object.', 'Use { "@type": "GeoCoordinates", "latitude": 51.5, "longitude": -0.12 }.'));
    return;
  }
  if (geo['@type'] && geo['@type'] !== 'GeoCoordinates') {
    issues.push(issue('warning', 'geo.@type', `Expected "GeoCoordinates", found "${geo['@type']}".`, 'Set "@type": "GeoCoordinates".'));
  }
  const { latitude, longitude } = geo;
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    issues.push(issue('warning', 'geo.latitude', 'latitude must be a number between -90 and 90.', 'Use decimal degrees, e.g. 51.5074.'));
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    issues.push(issue('warning', 'geo.longitude', 'longitude must be a number between -180 and 180.', 'Use decimal degrees, e.g. -0.1278.'));
  }
}

function validateRating(r, issues) {
  if (typeof r !== 'object' || r === null) {
    issues.push(issue('warning', 'aggregateRating', 'aggregateRating should be an AggregateRating object.', 'Use { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "12" }.'));
    return;
  }
  const val = parseFloat(r.ratingValue);
  const best = r.bestRating !== undefined ? parseFloat(r.bestRating) : 5;
  const worst = r.worstRating !== undefined ? parseFloat(r.worstRating) : 1;
  if (Number.isNaN(val)) {
    issues.push(issue('warning', 'aggregateRating.ratingValue', 'ratingValue must be numeric.', 'Use a number like "4.5" or 4.5.'));
  } else if (val < worst || val > best) {
    issues.push(issue('warning', 'aggregateRating.ratingValue', `ratingValue ${val} is outside [${worst}, ${best}].`, 'Keep ratingValue between worstRating and bestRating.'));
  }
  if (r.reviewCount !== undefined && !/^\d+$/.test(String(r.reviewCount))) {
    issues.push(issue('warning', 'aggregateRating.reviewCount', 'reviewCount should be a non-negative integer.', 'Use e.g. "24".'));
  }
}

function validateImage(img, issues) {
  if (typeof img === 'string') { checkUrl(img, 'image', issues); return; }
  const first = asArray(img)[0];
  if (typeof first === 'string') { checkUrl(first, 'image[0]', issues); return; }
  if (typeof first === 'object' && first !== null) {
    if (!isNonEmptyString(first.url)) {
      issues.push(issue('warning', 'image.url', 'ImageObject is missing "url".', 'Add "url" with an absolute image URL.'));
    } else checkUrl(first.url, 'image.url', issues);
  } else {
    issues.push(issue('warning', 'image', 'image has an unexpected shape.', 'Use a URL string or an ImageObject with "url".'));
  }
}

/* ------------------------------------------------------------------ */
/* Node validation                                                     */
/* ------------------------------------------------------------------ */

function validateNode(node, label) {
  const issues = [];
  const at = (f) => (label ? `${label}.${f}` : f);

  // @context
  const ctx = node['@context'];
  if (!ctx) {
    issues.push(issue('error', at('@context'), 'Missing "@context".', 'Add "@context": "https://schema.org".'));
  } else {
    const ctxStr = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
    if (!/schema\.org/i.test(ctxStr)) {
      issues.push(issue('error', at('@context'), 'The @context does not reference schema.org.', 'Set "@context": "https://schema.org".'));
    }
  }

  // @type
  const types = node['@type'] ? asArray(node['@type']) : [];
  if (!types.length) {
    issues.push(issue('error', at('@type'), 'Missing "@type".', 'Add "@type": "LocalBusiness" (or a more specific subtype like "Restaurant").'));
  } else {
    const known = types.some((t) => LOCAL_BUSINESS_TYPES.has(String(t).split('/').pop()));
    if (!known) {
      issues.push(issue('info', at('@type'), `Type "${types.join(', ')}" isn't a recognized LocalBusiness subtype.`, 'Use "LocalBusiness" or a schema.org subtype (e.g. Dentist, Hotel, Store) for local rich results.'));
    }
  }

  // name (required)
  if (!isNonEmptyString(node.name)) {
    issues.push(issue('error', at('name'), 'Missing "name".', 'Add the business name, e.g. "name": "Acme Bakery".'));
  }

  // recommended fields
  RECOMMENDED.forEach((f) => {
    if (node[f] === undefined || node[f] === null || node[f] === '') {
      const hintMap = {
        address: 'Add an "address" PostalAddress object.',
        telephone: 'Add "telephone" in international format, e.g. "+1-555-0100".',
        url: 'Add the business website "url".',
        image: 'Add an "image" URL for richer results.',
        priceRange: 'Add "priceRange", e.g. "$$" or "$10–$30".',
        openingHoursSpecification: 'Add opening hours so hours can show in results.',
        geo: 'Add "geo" coordinates to help map placement.'
      };
      issues.push(issue('warning', at(f), `Recommended field "${f}" is missing.`, hintMap[f]));
    }
  });

  // shape checks for present fields
  if (node.address !== undefined) validateAddress(node.address, issues);
  if (node.openingHoursSpecification !== undefined) validateOpeningHours(node.openingHoursSpecification, issues);
  if (node.geo !== undefined) validateGeo(node.geo, issues);
  if (node.aggregateRating !== undefined) validateRating(node.aggregateRating, issues);
  if (node.image !== undefined) validateImage(node.image, issues);
  if (node.url !== undefined) checkUrl(node.url, at('url'), issues);
  if (node.sameAs !== undefined) {
    asArray(node.sameAs).forEach((u, i) => checkUrl(u, at(`sameAs[${i}]`), issues));
  }
  if (node.telephone !== undefined && !isNonEmptyString(node.telephone)) {
    issues.push(issue('warning', at('telephone'), 'telephone is empty.', 'Add the business phone in international format.'));
  }
  if (node.priceRange !== undefined && typeof node.priceRange !== 'string') {
    issues.push(issue('warning', at('priceRange'), 'priceRange should be a string.', 'Use e.g. "$$" or "$10–$30".'));
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function extractNodes(parsed) {
  // Returns { nodes: [{node, label}], note }
  const out = [];
  const push = (n, label) => { if (n && typeof n === 'object') out.push({ node: n, label }); };

  const walk = (v, label) => {
    if (Array.isArray(v)) { v.forEach((item, i) => walk(item, `${label}[${i}]`)); return; }
    if (v && typeof v === 'object') {
      if (v['@graph']) { walk(v['@graph'], `${label}.@graph`); return; }
      push(v, label);
    }
  };
  walk(parsed, 'root');
  return out;
}

function findLocalBusiness(nodes) {
  return nodes.filter(({ node }) => {
    const types = node['@type'] ? asArray(node['@type']).map((t) => String(t).split('/').pop()) : [];
    return types.some((t) => LOCAL_BUSINESS_TYPES.has(t));
  });
}

function validateText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { parseError: `Invalid JSON: ${e.message}` };
  }
  const all = extractNodes(parsed);
  if (!all.length) return { parseError: 'No JSON objects found in the input.' };
  let targets = findLocalBusiness(all);
  let note = '';
  if (!targets.length) {
    // Validate the first object anyway so the user gets structural feedback.
    targets = [all[0]];
    note = 'No LocalBusiness type detected — validating the first object generically.';
  }
  const allIssues = [];
  targets.forEach(({ node, label }, i) => {
    const lbl = targets.length > 1 ? `node ${i + 1}` : '';
    allIssues.push(...validateNode(node, lbl || undefined).map((is) => ({ ...is, nodeLabel: lbl })));
  });
  return { issues: allIssues, note, nodeCount: targets.length };
}

/* ------------------------------------------------------------------ */
/* Page scanning                                                       */
/* ------------------------------------------------------------------ */

// NOTE: must be self-contained — it runs in the page's context.
function collectJsonLd() {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent || '')
    .filter((t) => t.trim().length > 0);
}

async function scanCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) throw new Error('No active tab found.');
  if (!/^https?:|^file:/.test(tab.url || '')) {
    throw new Error('Can only scan regular web pages (not browser-internal pages).');
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectJsonLd
  });
  const blocks = (results && results[0] && results[0].result) || [];
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render(result, sourceLabel) {
  const box = $('results');
  const summary = $('summary');
  const list = $('issues');
  box.classList.remove('hidden');
  list.innerHTML = '';

  if (result.parseError) {
    summary.innerHTML = `<div class="score bad">!</div><p><b>Couldn’t parse ${sourceLabel}.</b><br>${escapeHtml(result.parseError)}</p>`;
    return;
  }

  const { issues, note, nodeCount } = result;
  const errors = issues.filter((i) => i.sev === 'error').length;
  const warnings = issues.filter((i) => i.sev === 'warning').length;

  let score = 100;
  score -= errors * 25 + warnings * 5;
  score = Math.max(0, score);
  const cls = errors ? 'bad' : warnings ? 'warn' : '';
  const verdict = errors ? 'Needs fixes' : warnings ? 'Good, with suggestions' : 'Valid';

  summary.innerHTML =
    `<div class="score ${cls}">${score}</div>` +
    `<p><b>${verdict}</b> — ${nodeCount} LocalBusiness node${nodeCount === 1 ? '' : 's'} checked<br>` +
    `${errors} error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}` +
    (note ? `<br>${escapeHtml(note)}` : '') + `</p>`;

  if (!issues.length) {
    list.innerHTML = '<li class="empty">All checks passed — this markup looks solid.</li>';
  } else {
    const order = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => order[a.sev] - order[b.sev]);
    issues.forEach((is) => {
      const li = document.createElement('li');
      li.className = `issue ${is.sev}`;
      li.innerHTML =
        `<div class="top"><span class="badge ${is.sev}">${is.sev}</span>` +
        `<code class="field">${escapeHtml(is.field)}${is.nodeLabel ? ` <span class="hint">(${escapeHtml(is.nodeLabel)})</span>` : ''}</code></div>` +
        `<p class="msg">${escapeHtml(is.message)}</p>` +
        (is.hint ? `<p class="fix">${escapeHtml(is.hint)}</p>` : '');
      list.appendChild(li);
    });
  }

  // Remember last input on-device.
  chrome.storage.local.set({ lastInput: $('input').value }).catch(() => {});
  box.scrollIntoView({ block: 'start' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function toReport(result) {
  if (result.parseError) return `Schema validation report\n\nParse error: ${result.parseError}\n`;
  const lines = ['Schema validation report', ''];
  result.issues.forEach((is) => {
    lines.push(`[${is.sev.toUpperCase()}] ${is.field}: ${is.message}`);
    if (is.hint) lines.push(`  Fix: ${is.hint}`);
  });
  if (!result.issues.length) lines.push('All checks passed.');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let lastResult = null;

$('validate').addEventListener('click', () => {
  const text = $('input').value.trim();
  if (!text) {
    lastResult = { parseError: 'Paste some JSON-LD first, or use “Scan this page”.' };
  } else {
    lastResult = validateText(text);
  }
  render(lastResult, 'the pasted markup');
});

$('scan').addEventListener('click', async () => {
  $('scan').disabled = true;
  $('scan').textContent = 'Scanning…';
  try {
    const blocks = await scanCurrentPage();
    if (!blocks.length) {
      lastResult = { parseError: 'No application/ld+json blocks found on this page.' };
    } else {
      // Validate each block and merge issues with block labels.
      const merged = [];
      let nodeCount = 0;
      let note = '';
      blocks.forEach((b, i) => {
        const r = validateText(b);
        if (r.parseError) {
          merged.push(issue('error', `block ${i + 1}`, r.parseError, 'Fix the JSON syntax so the block can be parsed.'));
        } else {
          nodeCount += r.nodeCount;
          if (r.note && !note) note = r.note;
          r.issues.forEach((is) => merged.push({ ...is, field: `block ${i + 1} › ${is.field}` }));
        }
      });
      lastResult = { issues: merged, note, nodeCount };
    }
    render(lastResult, 'this page');
  } catch (e) {
    lastResult = { parseError: e.message || 'Scan failed.' };
    render(lastResult, 'this page');
  } finally {
    $('scan').disabled = false;
    $('scan').textContent = 'Scan this page';
  }
});

$('copy').addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(toReport(lastResult));
    $('copy').textContent = 'Copied ✓';
    setTimeout(() => { $('copy').textContent = 'Copy report'; }, 1500);
  } catch {
    $('copy').textContent = 'Copy failed';
    setTimeout(() => { $('copy').textContent = 'Copy report'; }, 1500);
  }
});

$('clear').addEventListener('click', () => {
  $('input').value = '';
  $('results').classList.add('hidden');
  lastResult = null;
  chrome.storage.local.remove('lastInput').catch(() => {});
});

// Restore last pasted input (on-device only).
chrome.storage.local.get('lastInput').then((d) => {
  if (d.lastInput) $('input').value = d.lastInput;
}).catch(() => {});
