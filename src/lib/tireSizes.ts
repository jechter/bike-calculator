// Tire size designation conversion. Parse any common format into ISO/ETRTO
// (width + bead diameter, the unambiguous truth) and re-express it in the other
// formats. Legacy inch/fractional sizes are ambiguous by design, so ISO is the
// anchor and the rest is generated from it.

export interface DiaName {
  format: "french" | "decimal" | "fraction";
  dia: string; // diameter token, e.g. "700", "29", "28"
  letter?: string; // French width letter, e.g. "C"
  /** Which tire widths this designation is normally used for. */
  width: "narrow" | "wide" | "any";
}

export interface WheelSize {
  iso: number; // ISO/ETRTO bead seat diameter (mm)
  commonNames: string[]; // human "also known as" labels
  dias: DiaName[];
}

// Common wheel sizes keyed by ISO bead diameter. narrow < 40 mm, wide >= 40 mm.
export const WHEEL_SIZES: WheelSize[] = [
  {
    iso: 622,
    commonNames: ["700C", "29-inch (29er)", "28-inch"],
    dias: [
      { format: "french", dia: "700", letter: "C", width: "any" },
      { format: "fraction", dia: "28", width: "narrow" },
      { format: "decimal", dia: "29", width: "wide" },
    ],
  },
  {
    iso: 635,
    commonNames: ["700B", "28 × 1½"],
    dias: [
      { format: "french", dia: "700", letter: "B", width: "any" },
      { format: "fraction", dia: "28", width: "any" },
    ],
  },
  {
    iso: 630,
    commonNames: ['27-inch (old road)'],
    dias: [{ format: "fraction", dia: "27", width: "any" }],
  },
  {
    iso: 584,
    commonNames: ["650B", "27.5-inch"],
    dias: [
      { format: "french", dia: "650", letter: "B", width: "any" },
      { format: "decimal", dia: "27.5", width: "wide" },
    ],
  },
  {
    iso: 571,
    commonNames: ["650C", "26 × 1 (tubular)"],
    dias: [{ format: "french", dia: "650", letter: "C", width: "narrow" }],
  },
  {
    iso: 590,
    commonNames: ["650A", "26 × 1⅜ (EA3)"],
    dias: [
      { format: "french", dia: "650", letter: "A", width: "any" },
      { format: "fraction", dia: "26", width: "any" },
    ],
  },
  {
    iso: 597,
    commonNames: ["26 × 1¼ (S-6)"],
    dias: [{ format: "fraction", dia: "26", width: "narrow" }],
  },
  {
    iso: 559,
    commonNames: ["26-inch (MTB)"],
    dias: [{ format: "decimal", dia: "26", width: "any" }],
  },
  {
    iso: 507,
    commonNames: ["24-inch (MTB)"],
    dias: [{ format: "decimal", dia: "24", width: "any" }],
  },
  {
    iso: 540,
    commonNames: ["24 × 1⅜ (junior / wheelchair)"],
    dias: [{ format: "fraction", dia: "24", width: "any" }],
  },
  {
    iso: 451,
    commonNames: ["20-inch (BMX race / 451)"],
    dias: [
      { format: "decimal", dia: "20", width: "narrow" },
      { format: "fraction", dia: "20", width: "narrow" },
    ],
  },
  {
    iso: 406,
    commonNames: ["20-inch (BMX / folder / 406)"],
    dias: [{ format: "decimal", dia: "20", width: "wide" }],
  },
  {
    iso: 349,
    commonNames: ["16-inch (Brompton / 349)"],
    dias: [{ format: "decimal", dia: "16", width: "any" }],
  },
  {
    iso: 305,
    commonNames: ["16-inch (305)"],
    dias: [{ format: "decimal", dia: "16", width: "narrow" }],
  },
];

// Fractional-inch is ambiguous (e.g. 28×1½ = 635 but 28×1⅜ = 622), so parse it
// through an explicit lookup keyed by diameter + width fraction.
const FRACTION_LOOKUP: Array<{ dia: string; w: string; iso: number; mm: number }> = [
  { dia: "28", w: "1 1/2", iso: 635, mm: 40 },
  { dia: "28", w: "1 3/8", iso: 622, mm: 35 },
  { dia: "28", w: "1 1/8", iso: 622, mm: 28 },
  { dia: "27", w: "1 1/4", iso: 630, mm: 32 },
  { dia: "27", w: "1 3/8", iso: 630, mm: 35 },
  { dia: "26", w: "1 3/8", iso: 590, mm: 35 },
  { dia: "26", w: "1 1/4", iso: 597, mm: 32 },
  { dia: "24", w: "1 3/8", iso: 540, mm: 35 },
  { dia: "20", w: "1 1/8", iso: 451, mm: 28 },
  { dia: "20", w: "1 3/8", iso: 451, mm: 35 },
];

const DECIMAL_DIA_ISO: Record<string, number> = {
  "29": 622,
  "28": 622,
  "27.5": 584,
  "26": 559,
  "24": 507,
  "20": 406,
  "16": 349,
  "12": 203,
};

function frenchToIso(dia: string, letter?: string): number | null {
  const key = dia + (letter ?? "").toUpperCase();
  const map: Record<string, number> = {
    "700C": 622,
    "700B": 635,
    "700A": 642,
    "700": 622,
    "650B": 584,
    "650C": 571,
    "650A": 590,
    "650": 584,
  };
  return map[key] ?? map[dia] ?? null;
}

export interface ParsedTire {
  iso: number;
  widthMm: number;
}

/** Parse a tire size in any supported format into ISO bead + width (mm). */
export function parseTireSize(raw: string): ParsedTire | null {
  if (!raw) return null;
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/×/g, "x")
    .replace(/["″]/g, "")
    .replace(/\s+/g, " ");

  // ETRTO: two numbers with a dash (either order) — 28-622 or 622-28.
  let m = s.match(/^(\d{2,3})\s*-\s*(\d{2,3})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    return { iso: Math.max(a, b), widthMm: Math.min(a, b) };
  }

  // Fractional inch: 28 x 1 1/8, 26 x 1 3/8
  m = s.match(/^(\d{2})\s*x\s*(\d+)\s+(\d+)\/(\d+)$/);
  if (m) {
    const dia = m[1];
    const w = `${m[2]} ${m[3]}/${m[4]}`;
    const hit = FRACTION_LOOKUP.find((x) => x.dia === dia && x.w === w);
    if (hit) return { iso: hit.iso, widthMm: hit.mm };
    return null;
  }

  // French: 700x28c, 700c x 28, 650b x 47, or 700x28 (no letter).
  m = s.match(/^(\d{3})\s*([abcd])?\s*x\s*(\d{2}(?:\.\d)?)\s*([abcd])?$/);
  if (m) {
    const iso = frenchToIso(m[1], m[2] || m[4]);
    if (iso) return { iso, widthMm: Math.round(+m[3]) };
  }

  // Inch decimal: 26x2.1, 27.5x2.4, 29x2.3. Keep the width precise (unrounded)
  // so a decimal input round-trips back to exactly what was typed.
  m = s.match(/^(\d{2}(?:\.\d)?)\s*x\s*(\d(?:\.\d+)?)$/);
  if (m) {
    const iso = DECIMAL_DIA_ISO[m[1]];
    if (iso) return { iso, widthMm: +m[2] * 25.4 };
  }

  return null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Width in mm as a mixed inch fraction to the nearest 1/8", e.g. 28 -> "1 1/8". */
export function toFractionInch(mm: number): string {
  const inch = mm / 25.4;
  const whole = Math.floor(inch);
  let num = Math.round((inch - whole) * 8);
  let den = 8;
  if (num === 0) return `${whole}`;
  if (num === 8) return `${whole + 1}`;
  const g = gcd(num, den);
  num /= g;
  den /= g;
  return `${whole} ${num}/${den}`;
}

export interface Designation {
  format: string;
  value: string;
}

function widthMatches(w: DiaName["width"], mm: number): boolean {
  if (w === "any") return true;
  if (w === "narrow") return mm < 40;
  return mm >= 40;
}

/** Express an ISO bead + width as designations in every applicable format. */
export function formatDesignations(iso: number, widthMm: number): Designation[] {
  const w = Math.round(widthMm);
  const out: Designation[] = [{ format: "ETRTO / ISO", value: `${w}-${iso}` }];
  const size = WHEEL_SIZES.find((s) => s.iso === iso);
  if (size) {
    for (const d of size.dias) {
      if (d.format === "fraction") continue; // handled via the lookup below
      if (!widthMatches(d.width, widthMm)) continue;
      if (d.format === "french") {
        out.push({ format: "French", value: `${d.dia} × ${w}${d.letter ?? ""}` });
      } else {
        // trim a trailing zero (2.10 -> 2.1) but keep at least one decimal
        let dec = (widthMm / 25.4).toFixed(2);
        if (dec.endsWith("0")) dec = dec.slice(0, -1);
        out.push({ format: "Inch (decimal)", value: `${d.dia} × ${dec}″` });
      }
    }
  }
  // Fractional markings are nominal, not exact, so use the conventional string
  // from the lookup rather than computing it.
  const frac = FRACTION_LOOKUP.filter((f) => f.iso === iso && Math.abs(f.mm - widthMm) <= 6).sort(
    (a, b) => Math.abs(a.mm - widthMm) - Math.abs(b.mm - widthMm),
  )[0];
  if (frac) out.push({ format: "Inch (fractional)", value: `${frac.dia} × ${frac.w}″` });
  return out;
}

export function commonNamesFor(iso: number): string[] {
  return WHEEL_SIZES.find((s) => s.iso === iso)?.commonNames ?? [];
}

// The tire sizes people actually ride and search for, ordered roughly by how
// common they are. These double as the clickable suggestions: we filter them
// against whatever the user has typed and show the most typical matches.
const COMMON_SIZE_LABELS = [
  // Road — 700C
  "700x23C",
  "700x25C",
  "700x28C",
  "700x32C",
  "700x35C",
  "700x38C",
  // Gravel / all-road — 700C (29er)
  "700x40C",
  "700x45C",
  "700x47C",
  "29x2.1",
  "29x2.25",
  "29x2.35",
  "29x2.4",
  // 650B / 27.5"
  "650b x 47",
  "27.5x2.1",
  "27.5x2.25",
  "27.5x2.4",
  "27.5x2.6",
  // 26" MTB
  "26x1.95",
  "26x2.1",
  "26x2.25",
  "26x2.4",
  // City / classic
  "28x1 3/8",
  "28x1 1/2",
  "27x1 1/4",
  "26x1 3/8",
  "26x1 1/4",
  // Small wheels
  "24x1.95",
  "20x1.75",
  "20x2.125",
  "16x1.75",
];

// The spread shown before the user types anything — deliberately mixed across
// wheel sizes and all three notations (French, ETRTO, inch, fractional) so the
// chips advertise the range of formats the field accepts.
const BROAD_DEFAULTS = [
  "700x28C", // road — French
  "28-622", // road — ETRTO
  "700x40C", // gravel — French
  "650b x 47", // 650B gravel — French
  "27.5x2.4", // trail — inch decimal
  "26x2.1", // MTB — inch decimal
  "28x1 3/8", // city — fractional
  "20x1.75", // small wheel — inch decimal
];

export interface TireSuggestion {
  label: string; // clickable/settable string, e.g. "700x28C" or "28-622"
  iso: number;
  widthMm: number;
}

// Fold a size string to a canonical form for matching: lowercase, × -> x, drop
// quotes and whitespace, keep the dash so ETRTO ("28-622") stays searchable.
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/["″]/g, "")
    .replace(/\s+/g, "");
}

interface CommonSize {
  iso: number;
  widthMm: number;
  natural: string; // the curated label, in its native format (French / inch / fractional)
  etrto: string; // the same size written as ETRTO, e.g. "28-622"
  search: string; // haystack of every notation for matching
}

// Precompute each common size with its ETRTO form and a haystack covering every
// notation it can be written in (ETRTO, French, decimal, fractional, "also known
// as" names), so a query like "622", "29er" or "700" all surface the right sizes.
const COMMON_SIZES: CommonSize[] = COMMON_SIZE_LABELS.map((label) => {
  const parsed = parseTireSize(label)!;
  const etrto = `${Math.round(parsed.widthMm)}-${parsed.iso}`;
  const notations = [
    label,
    etrto,
    `${parsed.iso}`,
    ...formatDesignations(parsed.iso, parsed.widthMm).map((d) => d.value),
    ...commonNamesFor(parsed.iso),
  ];
  return {
    iso: parsed.iso,
    widthMm: parsed.widthMm,
    natural: label,
    etrto,
    // Normalize each notation separately and join with a separator so a query
    // can't match across a token boundary (e.g. "622"+"622" spuriously has "26").
    search: notations.map(normalizeForMatch).join("|"),
  };
});

/**
 * Common tire sizes whose notation matches `query`, most typical first.
 * An empty query returns a broad cross-format spread (see BROAD_DEFAULTS).
 * Each size can be shown as its native format or as ETRTO, and a query is shown
 * in whichever form it matched. Ranks a label-prefix match above a label
 * substring above a match anywhere in the size's other notations.
 */
export function suggestTireSizes(query: string, limit = 8): TireSuggestion[] {
  const q = normalizeForMatch(query);
  if (!q) {
    return BROAD_DEFAULTS.slice(0, limit).map((label) => {
      const p = parseTireSize(label)!;
      return { label, iso: p.iso, widthMm: p.widthMm };
    });
  }
  const ranked = COMMON_SIZES.map((c, i) => {
    // Fallback display (matched only via an "also known as" name): cycle ETRTO
    // in among the native labels so that notation shows up too.
    let label = i % 3 === 2 ? c.etrto : c.natural;
    let score = c.search.includes(q) ? 1 : 0;
    for (const form of [c.etrto, c.natural]) {
      const nf = normalizeForMatch(form);
      const s = nf.startsWith(q) ? 3 : nf.includes(q) ? 2 : 0;
      if (s > score) {
        score = s;
        label = form;
      }
    }
    return { label, iso: c.iso, widthMm: c.widthMm, score, i };
  });

  const seen = new Set<string>();
  const out: TireSuggestion[] = [];
  for (const x of ranked
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (seen.has(x.label)) continue; // two sizes can collapse to the same ETRTO
    seen.add(x.label);
    out.push({ label: x.label, iso: x.iso, widthMm: x.widthMm });
    if (out.length >= limit) break;
  }
  return out;
}
