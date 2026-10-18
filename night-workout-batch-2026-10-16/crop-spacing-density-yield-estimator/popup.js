/* CropCalc popup logic — standard agronomy formulas, 100% local.
 *
 * plants_per_m2   = 10_000 / (row_cm * plant_cm)   (1 m² = 10,000 cm²)
 * population_ha   = plants_per_m2 * 10_000
 * effective_ha    = population_ha * germination%
 * yield_kg_ha     = effective_ha * yield_per_plant_kg
 * range shown as ±20% around the expected value, clearly labeled an estimate.
 */
(() => {
  'use strict';

  // Crop presets: typical row spacing, in-row spacing (cm), and per-plant yield (kg).
  // Values are agronomy-textbook-typical starting points — user-editable.
  const CROPS = {
    custom:  { label: 'Custom (manual entry)', row: 75,  plant: 20,  ypp: 0.2 },
    maize:   { label: 'Maize / Corn',          row: 75,  plant: 20,  ypp: 0.18 },
    wheat:   { label: 'Wheat (drilled)',       row: 17.5, plant: 2,  ypp: 0.0016 },
    rice:    { label: 'Rice (transplanted)',   row: 20,  plant: 15,  ypp: 0.016 },
    soybean: { label: 'Soybean',               row: 45,  plant: 5,   ypp: 0.008 },
    cotton:  { label: 'Cotton',                row: 90,  plant: 30,  ypp: 0.055 },
    potato:  { label: 'Potato',                row: 75,  plant: 25,  ypp: 0.8 },
    tomato:  { label: 'Tomato',                row: 100, plant: 50,  ypp: 3.0 },
    onion:   { label: 'Onion',                 row: 30,  plant: 10,  ypp: 0.12 }
  };

  const $ = id => document.getElementById(id);
  const els = {
    crop: $('crop'), rowCm: $('rowCm'), plantCm: $('plantCm'),
    area: $('area'), areaUnit: $('areaUnit'), germ: $('germ'), yieldPlant: $('yieldPlant'),
    results: $('results')
  };

  // Populate crop select
  Object.entries(CROPS).forEach(([key, c]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = c.label;
    els.crop.appendChild(opt);
  });

  // storage helper (chrome.storage with localStorage fallback for robustness)
  const store = {
    async get(k) {
      try { const r = await chrome.storage.local.get(k); return r[k]; }
      catch { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
    },
    async set(k, v) {
      try { await chrome.storage.local.set({ [k]: v }); }
      catch { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
    }
  };

  function applyPreset(key) {
    const c = CROPS[key] || CROPS.custom;
    els.rowCm.value = c.row;
    els.plantCm.value = c.plant;
    els.yieldPlant.value = c.ypp;
  }

  els.crop.addEventListener('change', () => applyPreset(els.crop.value));

  function fmt(n, digits = 1) {
    if (!isFinite(n) || n < 0) return '–';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 10_000) return Math.round(n).toLocaleString('en-US');
    if (n >= 100) return n.toFixed(0);
    return n.toFixed(digits);
  }

  function fmtTonnes(kg) {
    const t = kg / 1000;
    if (t >= 100) return t.toFixed(1) + ' t';
    if (t >= 1) return t.toFixed(2) + ' t';
    return kg.toFixed(1) + ' kg';
  }

  function areaToHa(area, unit) {
    if (unit === 'acre') return area * 0.404686;
    if (unit === 'm2') return area / 10000;
    return area;
  }

  function calculate() {
    const row = parseFloat(els.rowCm.value);
    const plant = parseFloat(els.plantCm.value);
    const area = parseFloat(els.area.value);
    const germ = parseFloat(els.germ.value);
    const ypp = parseFloat(els.yieldPlant.value);

    if (!(row > 0) || !(plant > 0) || !(area > 0) || !(germ > 0 && germ <= 100) || !(ypp > 0)) {
      alert('Please enter positive numbers (germination: 1–100%).');
      return;
    }

    const plantsPerM2 = 10000 / (row * plant);
    const popHa = plantsPerM2 * 10000;
    const areaHa = areaToHa(area, els.areaUnit.value);
    const totalPlants = popHa * areaHa;
    const effectiveHa = popHa * (germ / 100);
    const yieldKgHa = effectiveHa * ypp;

    // ±20% range, clearly labeled as an estimate
    const low = yieldKgHa * 0.8, high = yieldKgHa * 1.2;

    $('rDensity').textContent = fmt(plantsPerM2, 2) + ' /m²';
    $('rPopHa').textContent = fmt(popHa, 0);
    $('rTotal').textContent = fmt(totalPlants, 0);
    $('rEffective').textContent = fmt(effectiveHa, 0) + ' /ha';

    $('yLow').textContent = fmtTonnes(low) + '/ha';
    $('yMid').textContent = fmtTonnes(yieldKgHa) + '/ha';
    $('yHigh').textContent = fmtTonnes(high) + '/ha';
    $('yTotal').textContent = fmtTonnes(yieldKgHa * areaHa) + ` over ${fmt(areaHa, 2)} ha`;

    // Bar widths relative to the high end
    $('barLow').style.width = (low / high * 100).toFixed(1) + '%';
    $('barMid').style.width = ((yieldKgHa - low) / high * 100).toFixed(1) + '%';
    $('barHigh').style.width = ((high - yieldKgHa) / high * 100).toFixed(1) + '%';

    els.results.classList.remove('hidden');

    // Persist inputs
    store.set('cropCalcInputs', {
      crop: els.crop.value, row, plant, area,
      areaUnit: els.areaUnit.value, germ, ypp
    });

    return { plantsPerM2, popHa, totalPlants, effectiveHa, yieldKgHa, low, high, areaHa };
  }

  let lastCalc = null;
  $('calcBtn').addEventListener('click', () => { lastCalc = calculate(); });

  $('copyBtn').addEventListener('click', async () => {
    if (!lastCalc) { alert('Run a calculation first.'); return; }
    const c = CROPS[els.crop.value];
    const lines = [
      'CropCalc estimate — ' + c.label,
      `Spacing: ${els.rowCm.value} cm rows × ${els.plantCm.value} cm in-row`,
      `Density: ${fmt(lastCalc.plantsPerM2, 2)} plants/m² (${fmt(lastCalc.popHa, 0)}/ha)`,
      `Field: ${fmt(lastCalc.areaHa, 2)} ha → ${fmt(lastCalc.totalPlants, 0)} plants`,
      `Yield range: ${fmtTonnes(lastCalc.low)}/ha – ${fmtTonnes(lastCalc.high)}/ha`,
      `Field total: ${fmtTonnes(lastCalc.yieldKgHa * lastCalc.areaHa)} (expected)`,
      'Estimates only — actual yield depends on soil, weather, and management.'
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    $('copyBtn').textContent = 'Copied ✓';
    setTimeout(() => { $('copyBtn').textContent = 'Copy summary'; }, 1500);
  });

  $('resetBtn').addEventListener('click', () => {
    els.crop.value = 'custom';
    applyPreset('custom');
    els.area.value = 1; els.areaUnit.value = 'ha'; els.germ.value = 90;
    els.results.classList.add('hidden');
    lastCalc = null;
  });

  // Restore last inputs on open
  (async () => {
    const saved = await store.get('cropCalcInputs');
    if (saved) {
      els.crop.value = saved.crop || 'custom';
      els.rowCm.value = saved.row ?? 75;
      els.plantCm.value = saved.plant ?? 20;
      els.area.value = saved.area ?? 1;
      els.areaUnit.value = saved.areaUnit || 'ha';
      els.germ.value = saved.germ ?? 90;
      els.yieldPlant.value = saved.ypp ?? 0.2;
    }
  })();
})();
