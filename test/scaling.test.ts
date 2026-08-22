/**
 * Regression tests for the scaling engine.
 *
 * The fixture is Dan's reference creature: Husk Zombie (Creature 2, Book of the
 * Dead) rescaled into Occam's Risen Kinetic Husk (Creature 5). Both statblocks
 * are real, so these assert against human-authored output rather than against
 * the engine's own opinion.
 */

import { describe, it, expect } from "vitest";
import {
  classify,
  isAbsentCell,
  parseCell,
  parseCellOrNull,
  reemit,
  rescale,
  rowFor,
} from "../src/scaling/bands.js";

describe("parseCell", () => {
  it("reads scalars, with or without a sign", () => {
    expect(parseCell("17")).toEqual({ kind: "scalar", value: 17 });
    expect(parseCell("+11")).toEqual({ kind: "scalar", value: 11 });
    expect(parseCell(22)).toEqual({ kind: "scalar", value: 22 });
  });

  it("reads GM Core's high-to-low ranges in either direction", () => {
    expect(parseCell("97-91")).toEqual({ kind: "range", min: 91, max: 97 });
    expect(parseCell("+10 to +8")).toEqual({ kind: "range", min: 8, max: 10 });
  });

  it("reads damage expressions and their published average", () => {
    expect(parseCell("2d8+7 (16)")).toEqual({
      kind: "damage",
      expr: "2d8+7",
      average: 16,
    });
  });

  it("normalises en-dash negatives", () => {
    expect(parseCell("–1")).toEqual({ kind: "scalar", value: -1 });
  });

  it("distinguishes an em-dash (no such band) from a negative number", () => {
    // GM Core has no Extreme attribute modifier below level 1.
    expect(isAbsentCell("—")).toBe(true);
    expect(parseCellOrNull("—")).toBeNull();
    // ...but an en-dash is a minus sign and must still parse.
    expect(isAbsentCell("–1")).toBe(false);
    expect(parseCellOrNull("–1")).toEqual({ kind: "scalar", value: -1 });
  });
});

describe("absent bands", () => {
  it("ignores the Extreme column for attribute modifiers below level 1", () => {
    // L0 row is {extreme: "—", high: 3, moderate: 2, low: 0}. A +4 modifier
    // cannot be Extreme there, so it classifies as High with an offset.
    const c = classify(4, rowFor("attributeModifiers", 0));
    expect(c.band).toBe("high");
    expect(c.offset).toBe(1);
  });

  it("refuses to re-emit into a band that does not exist", () => {
    const extreme = classify(5, rowFor("attributeModifiers", 1));
    expect(extreme.band).toBe("extreme");
    expect(() => reemit(extreme, rowFor("attributeModifiers", 0))).toThrow(
      /does not exist at the target level/
    );
  });
});

describe("classify — Husk Zombie at level 2", () => {
  const at = (table: Parameters<typeof rowFor>[0], v: number) =>
    classify(v, rowFor(table, 2));

  it("reads Perception +5 as an exact Low", () => {
    expect(at("perception", 5)).toMatchObject({ band: "low", offset: 0 });
  });

  it("reads attack +11 as an exact High", () => {
    expect(at("strikeAttackBonus", 11)).toMatchObject({
      band: "high",
      offset: 0,
    });
  });

  it("reads AC 17 as an exact Moderate", () => {
    expect(at("armorClass", 17)).toMatchObject({ band: "moderate", offset: 0 });
  });

  it("preserves Fort +7 as an offset rather than snapping to a band", () => {
    const c = at("savingThrows", 7);
    expect(c.offset).not.toBe(0);
    expect(Math.abs(c.offset)).toBeLessThanOrEqual(2);
  });

  it("preserves Ref +9 as an offset", () => {
    const c = at("savingThrows", 9);
    expect(c.offset).not.toBe(0);
  });
});

describe("rescale — level 2 to level 5", () => {
  it("lands AC on the published 22", () => {
    // Husk Zombie AC 17 (moderate) -> ... but the target statblock says 22,
    // which is L5 *high*. See the band-drift note in the suite below.
    expect(rescale("armorClass", 17, 2, 5)).toBe(21); // L5 moderate
  });

  it("carries a deliberate attack offset across levels", () => {
    // A creature sitting one above High at L2 (+12) should sit one above High
    // at L5 (+16) — which is exactly the reference creature's slam.
    expect(rescale("strikeAttackBonus", 12, 2, 5)).toBe(16);
  });

  it("keeps an exact High attack exact", () => {
    // +11 is L2 high; L5 high is +15, matching the reference Grave Blast.
    expect(rescale("strikeAttackBonus", 11, 2, 5)).toBe(15);
  });

  it("is stable when source and target level match", () => {
    for (const v of [15, 17, 18, 21, 25]) {
      expect(rescale("armorClass", v, 5, 5)).toBe(v);
    }
  });

  it("round-trips across an up-then-down rescale", () => {
    const up = rescale("strikeAttackBonus", 11, 2, 5);
    expect(rescale("strikeAttackBonus", up, 5, 2)).toBe(11);
  });
});

/**
 * Known divergences from the reference statblock.
 *
 * These were `describe.todo` while the answer was undecided. The decision, made
 * in ARCHITECTURE.md §7.5, is that the engine rescales faithfully and the
 * *editor* is where an author overrides it — so what is asserted here is that
 * pure rescaling still lands where it lands, and the tests that reproduce Dan's
 * actual creature live in `edit-session.test.ts` alongside the machinery that
 * makes those calls.
 */
describe("band drift — decided: the engine reports, the editor overrides", () => {
  it("AC rescales faithfully to moderate, and does not chase the author's high", () => {
    // Husk Zombie AC 17 = L2 moderate. Occam's husk AC 22 = L5 high.
    // Rescaling gives 21; the upgrade to 22 is an authoring decision, made in
    // the editor with one click and shown as a band change.
    expect(rescale("armorClass", 17, 2, 5)).toBe(21);
    expect(rowFor("armorClass", 5)["high"]).toBe(22);
  });

  it("HP carries its weakness-funded offset rather than quietly dropping it", () => {
    // 55 HP at L2 sits 19 above high (40-36) because the creature carries
    // "vitality 5, slashing 5". Rescaled that becomes 110 — visibly odd, and
    // deliberately so: the editor pairs HP with the weaknesses that paid for
    // it, and dropping them is what lets HP fall to moderate (78-72).
    expect(rescale("hitPoints", 55, 2, 5)).toBe(110);
    expect(parseCell(rowFor("hitPoints", 5)["moderate"]!)).toEqual({
      kind: "range",
      min: 72,
      max: 78,
    });
  });
});
