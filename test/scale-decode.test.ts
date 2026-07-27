/**
 * Validates `classify()` against 4,714 published Paizo creatures.
 *
 * Archives of Nethys tags every creature statistic with a `*_scale_number`.
 * Decoded (see `BAND_BY_SCALE_NUMBER`) these are band labels, which makes the
 * whole bestiary an independent oracle for our classifier — far stronger
 * evidence than assertions we wrote ourselves.
 *
 * Run `npm run fetch:corpus` to generate the fixture. It is gitignored: several
 * MB, and regenerable.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classify,
  rowFor,
  bandFromScaleNumber,
  type Band,
} from "../src/scaling/bands.js";

const FIXTURE = resolve(import.meta.dirname, "fixtures/creature-corpus.json");
const available = existsSync(FIXTURE);

interface Creature {
  name: string;
  level: number;
  [key: string]: unknown;
}

const corpus: Creature[] = available
  ? (JSON.parse(readFileSync(FIXTURE, "utf8")).creatures as Creature[])
  : [];

type TableKey = Parameters<typeof rowFor>[0];

const STATS: { stat: string; scale: string; table: TableKey }[] = [
  { stat: "perception", scale: "perception_scale_number", table: "perception" },
  { stat: "fortitude_save", scale: "fortitude_save_scale_number", table: "savingThrows" },
  { stat: "reflex_save", scale: "reflex_save_scale_number", table: "savingThrows" },
  { stat: "will_save", scale: "will_save_scale_number", table: "savingThrows" },
  { stat: "strength", scale: "strength_scale_number", table: "attributeModifiers" },
  { stat: "dexterity", scale: "dexterity_scale_number", table: "attributeModifiers" },
  { stat: "constitution", scale: "constitution_scale_number", table: "attributeModifiers" },
  { stat: "wisdom", scale: "wisdom_scale_number", table: "attributeModifiers" },
  { stat: "charisma", scale: "charisma_scale_number", table: "attributeModifiers" },
  { stat: "ac", scale: "ac_scale_number", table: "armorClass" },
  { stat: "attack_bonus", scale: "attack_bonus_scale_number", table: "strikeAttackBonus" },
  { stat: "strike_damage_average", scale: "strike_damage_scale_number", table: "strikeDamage" },
  { stat: "hp", scale: "hp_scale_number", table: "hitPoints" },
];

/** Some statistics are arrays — one entry per Strike. HP needs digits pulled out. */
function observations(c: Creature, stat: string, scale: string): [number, number][] {
  let values: unknown[];
  let scales: unknown[];

  if (stat === "hp") {
    const m = /(\d+)/.exec(String(c["hp_raw"] ?? ""));
    values = m?.[1] !== undefined ? [Number(m[1])] : [];
    scales = [c["hp_scale_number"]];
  } else {
    const v = c[stat];
    const s = c[scale];
    values = Array.isArray(v) ? v : [v];
    scales = Array.isArray(s) ? s : [s];
  }

  const out: [number, number][] = [];
  for (let i = 0; i < Math.min(values.length, scales.length); i++) {
    const v = values[i];
    const s = scales[i];
    if (typeof v === "number" && typeof s === "number") out.push([v, s]);
  }
  return out;
}

interface Score {
  hits: number;
  total: number;
  mismatches: Map<string, number>;
}

function score(stat: string, scale: string, table: TableKey): Score {
  const mismatches = new Map<string, number>();
  let hits = 0;
  let total = 0;

  for (const c of corpus) {
    if (typeof c.level !== "number") continue;
    let row;
    try {
      row = rowFor(table, c.level);
    } catch {
      continue;
    }
    for (const [value, scaleNumber] of observations(c, stat, scale)) {
      const expected: Band | null = bandFromScaleNumber(scaleNumber);
      if (!expected) continue; // 0 means "not computed"
      const got = classify(value, row).band;
      total++;
      if (got === expected) {
        hits++;
      } else {
        const k = `we say ${got}, AoN says ${expected}`;
        mismatches.set(k, (mismatches.get(k) ?? 0) + 1);
      }
    }
  }
  return { hits, total, mismatches };
}

const pct = (s: Score) => (s.total ? (s.hits / s.total) * 100 : 0);

describe.skipIf(!available)("classify() vs 4,714 published creatures", () => {
  it("loaded a substantial corpus", () => {
    expect(corpus.length).toBeGreaterThan(4000);
  });

  it("decodes scale numbers as a single global worst-to-best scale", () => {
    expect(bandFromScaleNumber(1)).toBe("terrible");
    expect(bandFromScaleNumber(5)).toBe("extreme");
    expect(bandFromScaleNumber(0)).toBeNull();
  });

  /**
   * The headline result. These five reproduce AoN's labels with zero
   * disagreements across the whole bestiary. If this ever drops below 100%,
   * the classifier or the tables have regressed — do not relax the threshold.
   */
  it.each([
    ["perception", "perception_scale_number", "perception"],
    ["fortitude_save", "fortitude_save_scale_number", "savingThrows"],
    ["reflex_save", "reflex_save_scale_number", "savingThrows"],
    ["will_save", "will_save_scale_number", "savingThrows"],
    ["hp", "hp_scale_number", "hitPoints"],
  ] as const)("matches AoN exactly for %s", (stat, scale, table) => {
    const s = score(stat, scale, table as TableKey);
    expect(s.total).toBeGreaterThan(4000);
    expect(s.hits).toBe(s.total);
  });

  it.each([
    ["strength", "strength_scale_number"],
    ["dexterity", "dexterity_scale_number"],
    ["constitution", "constitution_scale_number"],
    ["wisdom", "wisdom_scale_number"],
    ["charisma", "charisma_scale_number"],
  ] as const)("matches AoN for %s at 99%+", (stat, scale) => {
    expect(pct(score(stat, scale, "attributeModifiers"))).toBeGreaterThan(99);
  });

  /**
   * Known AoN quirk, not a bug here.
   *
   * The AC table's columns sit at constant offsets from Low (+0/+2/+3/+6 at
   * every level). AoN's boundaries fall on row.low, row.high and row.extreme —
   * it skips the `moderate` column and calls everything from row.low upward
   * "moderate". So a creature whose AC is exactly the table's Low is reported
   * by AoN as Moderate, where we correctly report Low.
   *
   * Every single disagreement has that one shape. If another shape ever
   * appears, something real has broken.
   */
  it("disagrees with AoN on AC only at the low/moderate boundary", () => {
    const s = score("ac", "ac_scale_number", "armorClass");
    const shapes = [...s.mismatches.keys()];
    expect(shapes).toEqual(["we say low, AoN says moderate"]);
    expect(pct(s)).toBeGreaterThan(85);
  });

  it("matches AoN for attack bonus and strike damage at 90%+", () => {
    expect(pct(score("attack_bonus", "attack_bonus_scale_number", "strikeAttackBonus")))
      .toBeGreaterThan(90);
    expect(pct(score("strike_damage_average", "strike_damage_scale_number", "strikeDamage")))
      .toBeGreaterThan(90);
  });

  it("reports the full scoreboard", () => {
    const lines = STATS.map(({ stat, scale, table }) => {
      const s = score(stat, scale, table);
      return `  ${stat.padEnd(24)} ${pct(s).toFixed(1).padStart(6)}%  (${s.hits}/${s.total})`;
    });
    console.log("\n" + lines.join("\n"));
    expect(lines).toHaveLength(STATS.length);
  });
});
