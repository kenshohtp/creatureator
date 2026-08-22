/**
 * Path addressing: the bridge between what the rescale engine reports and what
 * the editor writes back. If these drift, edits land on the wrong statistic or
 * silently do nothing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getNumberAt,
  getStringAt,
  setAt,
  tableForPath,
  isFormulaPath,
} from "../src/pf2e/paths.js";
import { readStatBlock, type NPCSource } from "../src/pf2e/npc.js";
import { rescaleCreature } from "../src/scaling/rescale-creature.js";

const load = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, `fixtures/${name}.json`), "utf8")
  ) as NPCSource;

describe("tableForPath", () => {
  it("routes each path to its governing table", () => {
    expect(tableForPath("ac")).toBe("armorClass");
    expect(tableForPath("hp")).toBe("hitPoints");
    expect(tableForPath("perception")).toBe("perception");
    expect(tableForPath("saves.will")).toBe("savingThrows");
    expect(tableForPath("abilities.str")).toBe("attributeModifiers");
    expect(tableForPath("skills.stealth")).toBe("skills");
    expect(tableForPath("strikes.Fist.attack")).toBe("strikeAttackBonus");
    expect(tableForPath("strikes.Fist.damage")).toBe("strikeDamage");
    expect(tableForPath("spellcasting.Arcane Prepared Spells.dc")).toBe("spellDC");
  });

  it("returns null for an unknown path", () => {
    expect(tableForPath("nonsense")).toBeNull();
  });
});

describe("reading", () => {
  const block = readStatBlock(load("husk-zombie"));

  it("reads every kind of path", () => {
    expect(getNumberAt(block, "ac")).toBe(17);
    expect(getNumberAt(block, "hp")).toBe(55);
    expect(getNumberAt(block, "perception")).toBe(5);
    expect(getNumberAt(block, "saves.reflex")).toBe(9);
    expect(getNumberAt(block, "abilities.int")).toBe(-1);
    expect(getNumberAt(block, "skills.athletics")).toBe(8);
    expect(getNumberAt(block, "strikes.Fist.attack")).toBe(11);
    expect(getStringAt(block, "strikes.Fist.damage")).toBe("1d8+4");
  });

  it("reads spellcasting by entry name", () => {
    const caster = readStatBlock(load("spellcaster"));
    expect(getNumberAt(caster, "spellcasting.Arcane Prepared Spells.dc")).toBe(21);
    expect(getNumberAt(caster, "spellcasting.Divine Innate Spells.attack")).toBe(9);
  });

  it("returns null rather than guessing at unknown paths", () => {
    expect(getNumberAt(block, "strikes.Nonexistent.attack")).toBeNull();
    expect(getNumberAt(block, "skills.nope")).toBeNull();
  });
});

describe("writing", () => {
  it("writes each kind of path", () => {
    const block = readStatBlock(load("husk-zombie"));
    expect(setAt(block, "ac", 30)).toBe(true);
    expect(setAt(block, "saves.will", 14)).toBe(true);
    expect(setAt(block, "abilities.cha", 3)).toBe(true);
    expect(setAt(block, "skills.stealth", 20)).toBe(true);
    expect(setAt(block, "strikes.Shortsword.attack", 22)).toBe(true);
    expect(setAt(block, "strikes.Shortsword.damage", "3d6+9")).toBe(true);

    expect(block.ac).toBe(30);
    expect(block.saves.will).toBe(14);
    expect(block.abilities.cha).toBe(3);
    expect(block.skills["stealth"]).toBe(20);
    const sword = block.strikes.find((s) => s.name === "Shortsword")!;
    expect(sword.attack).toBe(22);
    expect(sword.damage[0]!.formula).toBe("3d6+9");
  });

  it("reports failure instead of silently ignoring a bad path", () => {
    const block = readStatBlock(load("husk-zombie"));
    expect(setAt(block, "strikes.Nonexistent.attack", 5)).toBe(false);
    expect(setAt(block, "made.up.path", 5)).toBe(false);
  });

  it("does not touch a sibling when writing one entry", () => {
    const caster = readStatBlock(load("spellcaster"));
    setAt(caster, "spellcasting.Arcane Prepared Spells.dc", 40);
    expect(caster.spellcasting.find((s) => s.tradition === "arcane")!.dc).toBe(40);
    expect(caster.spellcasting.find((s) => s.tradition === "divine")!.dc).toBe(17);
  });
});

/**
 * The property that matters: every path the engine emits must be addressable.
 * A path the editor cannot read or write is a field the user cannot edit.
 */
describe("engine paths are all addressable", () => {
  it.each([
    ["husk-zombie", 5],
    ["spellcaster", 10],
  ] as const)("%s", (fixture, level) => {
    const result = rescaleCreature(load(fixture), level);
    expect(result.changes.length).toBeGreaterThan(5);

    for (const change of result.changes) {
      expect(tableForPath(change.path), `table for ${change.path}`).not.toBeNull();

      const value = isFormulaPath(change.path)
        ? getStringAt(result.block, change.path)
        : getNumberAt(result.block, change.path);
      expect(value, `read ${change.path}`).not.toBeNull();

      expect(
        setAt(result.block, change.path, isFormulaPath(change.path) ? "1d4" : 1),
        `write ${change.path}`
      ).toBe(true);
    }
  });
});
