/* data.js — standard emission factors (g CO2e per tonne-km).
 * These are representative published figures for illustration; real values
 * vary by route, carrier, load factor and fuel. ALL RESULTS ARE ESTIMATES.
 */
const EMISSION_FACTORS = {
  air:  { label: "Air freight",   gPerTkm: 500, note: "long-haul belly/hold estimate" },
  sea:  { label: "Sea freight",   gPerTkm: 12,  note: "container ship estimate" },
  road: { label: "Road freight",  gPerTkm: 80,  note: "HGV estimate" },
  rail: { label: "Rail freight",  gPerTkm: 25,  note: "electric/diesel mix estimate" },
};

function co2eKg(mode, distanceKm, weightKg) {
  const f = EMISSION_FACTORS[mode];
  if (!f) throw new Error("Unknown mode: " + mode);
  // g per tonne-km * tonnes * km = g ; /1000 = kg
  return (f.gPerTkm * (weightKg / 1000) * distanceKm) / 1000;
}

function fmtKg(kg) {
  if (kg >= 1000) return (kg / 1000).toFixed(2) + " t";
  if (kg >= 10) return kg.toFixed(1) + " kg";
  return kg.toFixed(2) + " kg";
}
