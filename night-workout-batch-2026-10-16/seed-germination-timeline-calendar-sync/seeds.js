/* seeds.js — bundled local database of common seed varieties.
 * Values are standard published gardening figures (typical ranges from
 * common seed-sowing references); they are ESTIMATES and vary by
 * cultivar, soil, weather and seed age. 100% local, no network.
 *
 * Fields:
 *   name        display name
 *   germMin/Max germination days range
 *   soilMinC    minimum soil temp for germination (°C)
 *   depthCm     sowing depth (cm)
 *   spacingCm   in-row spacing (cm)
 *   daysHarvest days from sowing to harvest (typical)
 *   transplant  true if usually started indoors / transplanted
 */

const SEEDS = [
  { name: "Tomato",        germMin: 5,  germMax: 10, soilMinC: 21, depthCm: 0.6, spacingCm: 45, daysHarvest: 80,  transplant: true  },
  { name: "Pepper (Bell)", germMin: 7,  germMax: 14, soilMinC: 24, depthCm: 0.6, spacingCm: 45, daysHarvest: 75,  transplant: true  },
  { name: "Cucumber",      germMin: 3,  germMax: 7,  soilMinC: 21, depthCm: 1.5, spacingCm: 90, daysHarvest: 55,  transplant: false },
  { name: "Carrot",        germMin: 14, germMax: 21, soilMinC: 7,  depthCm: 0.6, spacingCm: 5,  daysHarvest: 75,  transplant: false },
  { name: "Lettuce",       germMin: 4,  germMax: 8,  soilMinC: 4,  depthCm: 0.3, spacingCm: 20, daysHarvest: 45,  transplant: false },
  { name: "Spinach",       germMin: 7,  germMax: 14, soilMinC: 2,  depthCm: 1.2, spacingCm: 15, daysHarvest: 45,  transplant: false },
  { name: "Radish",        germMin: 3,  germMax: 6,  soilMinC: 4,  depthCm: 1.2, spacingCm: 5,  daysHarvest: 30,  transplant: false },
  { name: "Bean (Bush)",   germMin: 5,  germMax: 10, soilMinC: 16, depthCm: 2.5, spacingCm: 10, daysHarvest: 50, transplant: false },
  { name: "Pea",           germMin: 7,  germMax: 14, soilMinC: 4,  depthCm: 2.5, spacingCm: 7,  daysHarvest: 60,  transplant: false },
  { name: "Corn (Sweet)",  germMin: 5,  germMax: 10, soilMinC: 16, depthCm: 2.5, spacingCm: 30, daysHarvest: 80,  transplant: false },
  { name: "Onion (Sets)",  germMin: 7,  germMax: 14, soilMinC: 10, depthCm: 2.5, spacingCm: 10, daysHarvest: 100, transplant: false },
  { name: "Cabbage",       germMin: 5,  germMax: 10, soilMinC: 7,  depthCm: 1.2, spacingCm: 45, daysHarvest: 75,  transplant: true  },
  { name: "Broccoli",      germMin: 5,  germMax: 10, soilMinC: 10, depthCm: 1.2, spacingCm: 45, daysHarvest: 70,  transplant: true  },
  { name: "Basil",         germMin: 5,  germMax: 10, soilMinC: 21, depthCm: 0.3, spacingCm: 25, daysHarvest: 65,  transplant: true  },
  { name: "Coriander",     germMin: 7,  germMax: 14, soilMinC: 10, depthCm: 0.6, spacingCm: 15, daysHarvest: 50,  transplant: false },
  { name: "Zucchini",      germMin: 3,  germMax: 7,  soilMinC: 21, depthCm: 2.5, spacingCm: 90, daysHarvest: 50,  transplant: false },
  { name: "Pumpkin",       germMin: 5,  germMax: 10, soilMinC: 21, depthCm: 2.5, spacingCm: 120,daysHarvest: 110, transplant: false },
  { name: "Sunflower",     germMin: 7,  germMax: 14, soilMinC: 13, depthCm: 2.5, spacingCm: 30, daysHarvest: 80,  transplant: false },
  { name: "Marigold",      germMin: 5,  germMax: 10, soilMinC: 18, depthCm: 0.6, spacingCm: 25, daysHarvest: 50,  transplant: true  },
  { name: "Eggplant",      germMin: 7,  germMax: 14, soilMinC: 24, depthCm: 0.6, spacingCm: 45, daysHarvest: 80,  transplant: true  },
];

/* ICS helpers -------------------------------------------------------------- */
function icsEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
function icsDate(date) {
  // All-day event date in UTC: YYYYMMDD
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function buildIcs(entries) {
  // entries: [{title, date (Date), desc}]
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muse//SeedTimeline//EN",
    "CALSCALE:GREGORIAN",
  ];
  entries.forEach((e, i) => {
    const dt = icsDate(e.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:seed-${i}-${dt}@seedtimeline.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `DESCRIPTION:${icsEscape(e.desc)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
