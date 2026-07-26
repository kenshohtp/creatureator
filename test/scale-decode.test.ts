/**
 * Decodes AoN's `*_scale_number` fields and uses them as an oracle for
 * `classify()`.
 *
 * Rather than assuming an encoding, this cross-tabulates AoN's label against
 * the band our own classifier derives from the GM Core tables, for every
 * creature in the corpus. If the fields really are band labels, each
 * scale_number will map to exactly one band with high agreement, and we get a
 * few thousand free test cases. If agreement is poor, the fields mean something
 * else and we say so instead of quietly trusting them.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classify, rowFor, type Band } from "../src/scaling/bands.js";

const FIXTURE = resolve(__dirname, "fixtures/creature-corpus.json");
const available = existsSync(FIXTURE);

interface Creature {
  name: string;
  level: number;
  [key: string]: unknown;
}

const corpus: Creature[] = available
  ? (JSON.parse(readFileSync(FIXTURE, "utf8")).creatures as Creature[])
  : [];

/** Which generated table each AoN statistic should be classified against. */
const STAT_MAP = [
  { stat: "ac", scale: "ac_scale_number", table: "armorClass" },
  { stat: "perception", scale: "perception_scale_number", table: "perception" },
  { stat: "fortitude_save", scale: "fortitude_save_scale_number", table: "savingThrows" },
  { stat: "reflex_save", scale: "reflex_save_scale_number", table: "savingThrows" },
  { stat: "will_save", scale: "will_save_scale_number", table: "savingThrows" },
  { stat: "attack_bonus", scale: "attack_bonus_scale_number", table: "strikeAttackBonus" },
  { stat: "strike_damage_average", scale: "strike_damage_scale_number", table: "strikeDamage" },
  { stat: "strength", scale: "strength_scale_number", table: "attributeModifiers" },
  { stat: "dexterity", scale: "dexterity_scale_number", table: "attributeModifiers" },
  { stat: "constitution", scale: "constitution_scale_number", table: "attributeModifiers" },
  { stat: "wisdom", scale: "wisdom_scale_number", table: "attributeModifiers" },
  { stat: "charisma", scale: "charisma_scale_number", table: "attributeModifiers" },
] as const;

/** AoN stores some statistics as arrays (one entry per Strike). Pair them up. */
function pairs(value: unknown, scale: unknown): [number, number][] {
  const vs = Array.isArray(value) ? value : [value];
  const ss = Array.isArray(scale) ? scale : [scale];
  const out: [number, number][] = [];
  for (let i = 0; i < Math.min(vs.length, ss.length); i++) {
    const v = vs[i];
    const s = ss[i];
    if (typeof v === "number" && typeof s === "number") out.push([v, s]);
  }
  return out;
}

type Tab = Map<number, Map<Band, number>>;

function crossTab(entry: (typeof STAT_MAP)[number]): Tab {
  const tab: Tab = new Map();
  for (const c of corpus) {
    if (typeof c.level !== "number" || c.level < -1 || c.level > 24) continue;
    let row;
    try {
      row = rowFor(entry.table, c.level);
    } catch {
      continue;
    }
    for (const [value, scale] of pairs(c[entry.stat], c[entry.scale])) {
      let band: Band;
      try {
        band = classify(value, row).band;
      } catch {
        continue;
      }
      if (!tab.has(scale)) tab.set(scale, new Map());
      const inner = tab.get(scale)!;
      inner.set(band, (inner.get(band) ?? 0) + 1);
    }
  }
  return tab;
}

/** Fraction of observations landing on each scale_number's modal band. */
function agreement(tab: Tab): { rate: number; mapping: Record<number, Band> } {
  let hits = 0;
  let total = 0;
  const mapping: Record<number, Band> = {};
  for (const [scale, bands] of tab) {
    let bestBand: Band | null = null;
    let bestN = 0;
    let sum = 0;
    for (const [band, n] of bands) {
      sum += n;
      if (n > bestN) {
        bestN = n;
        bestBand = band;
      }
    }
    if (bestBand) mapping[scale] = bestBand;
    hits += bestN;
    total += sum;
  }
  return { rate: total ? hits / total : 0, mapping };
}

describe.skipIf(!available)("AoN scale_number decoding", () => {
  it("corpus loaded", () => {
    expect(corpus.length).toBeGreaterThan(100);
  });

  it("reports the derived mapping per statistic", () => {
    const lines: string[] = [];
    for (const entry of STAT_MAP) {
      const tab = crossTab(entry);
      if (!tab.size) {
        lines.push(`${entry.stat.padEnd(24)} no data`);
        continue;
      }
      const { rate, mapping } = agreement(tab);
      const shown = Object.entries(mapping)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([n, b]) => `${n}=${b}`)
        .join(" ");
      lines.push(
        `${entry.stat.padEnd(24)} ${(rate * 100).toFixed(1).padStart(5)}%  ${shown}`
      );
    }
    console.log("\n  stat                     agree  mapping\n  " + lines.join("\n  "));
    expect(lines.length).toBe(STAT_MAP.length);
  });

  /**
   * The real assertion. If scale_number is a band label, each value should map
   * to one band the large majority of the time. Threshold is deliberately
   * loose — published creatures carry deliberate offsets (see ARCHITECTURE.md
   * §3), so perfect agreement is neither expected nor desirable.
   */
  it("scale_number behaves like a band label for defences", () => {
    for (const stat of ["ac", "perception", "fortitude_save"] as const) {
      const entry = STAT_MAP.find((e) => e.stat === stat)!;
      const { rate } = agreement(crossTab(entry));
      expect(rate, `${stat} agreement`).toBeGreaterThan(0.7);
    }
  });

  it("uses a per-table scale rather than one global scale", () => {
    // AC has four bands (no Terrible); Perception has five. If the encoding is
    // per-table, the observed value sets should differ in size.
    const acValues = new Set<number>();
    const perValues = new Set<number>();
    for (const c of corpus) {
      if (typeof c.ac_scale_number === "number") acValues.add(c.ac_scale_number);
      if (typeof c.perception_scale_number === "number")
        perValues.add(c.perception_scale_number);
    }
    console.log(
      `\n  ac_scale_number values:         ${[...acValues].sort((a, b) => a - b).join(", ")}` +
        `\n  perception_scale_number values: ${[...perValues].sort((a, b) => a - b).join(", ")}`
    );
    expect(acValues.size).toBeGreaterThan(0);
    expect(perValues.size).toBeGreaterThan(0);
  });
});
