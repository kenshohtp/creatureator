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
  prettyPath,
  setAt,
  tableForPath,
  isFormulaPath,
} from "../src/pf2e/paths.js";
import { readStatBlock, type NPCSource, type StatBlock } from "../src/pf2e/npc.js";
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

/**
 * Damage addressing.
 *
 * `system.damageRolls` is an object keyed by random id, so the rider comes
 * first about as often as it comes second — in the bestiary, Fortune Dragon's
 * Tail lists "1d6" force before "4d10+15" bludgeoning. A path that meant
 * "damage[0]" would edit the wrong roll on every such creature, silently.
 */
describe("damage paths", () => {
  const dragonish = (): StatBlock => ({
    name: "Fortune Dragonish",
    level: 10,
    ac: 30,
    hp: 200,
    perception: 20,
    saves: { fortitude: 20, reflex: 18, will: 22 },
    abilities: { str: 6, dex: 3, con: 5, int: 3, wis: 4, cha: 5 },
    skills: {},
    strikes: [
      {
        itemId: "tail0001",
        name: "Tail",
        attack: 24,
        ranged: false,
        traits: [],
        damage: [
          { id: "aaa", formula: "1d6", damageType: "force", category: null },
          { id: "bbb", formula: "4d10+15", damageType: "bludgeoning", category: null },
        ],
      },
    ],
    spellcasting: [],
    weaknesses: [],
    resistances: [],
  });

  it("resolves the bare damage path to the main damage, not to index 0", () => {
    expect(getStringAt(dragonish(), "strikes.Tail.damage")).toBe("4d10+15");
  });

  it("writes the main damage even when it is not first", () => {
    const block = dragonish();
    expect(setAt(block, "strikes.Tail.damage", "5d10+20")).toBe(true);
    expect(block.strikes[0]!.damage[0]!.formula).toBe("1d6");
    expect(block.strikes[0]!.damage[1]!.formula).toBe("5d10+20");
  });

  it("addresses a specific roll by index, which is how riders get edited", () => {
    const block = dragonish();
    expect(getStringAt(block, "strikes.Tail.damage.0")).toBe("1d6");
    expect(setAt(block, "strikes.Tail.damage.0", "2d6")).toBe(true);
    expect(block.strikes[0]!.damage[0]!.formula).toBe("2d6");
    expect(block.strikes[0]!.damage[1]!.formula).toBe("4d10+15");
  });

  it("reports a roll that is not there instead of creating one", () => {
    expect(setAt(dragonish(), "strikes.Tail.damage.7", "1d4")).toBe(false);
    expect(getStringAt(dragonish(), "strikes.Tail.damage.7")).toBeNull();
  });

  it("recognises indexed damage paths as formulas and routes them to Table 2-10", () => {
    expect(isFormulaPath("strikes.Tail.damage.1")).toBe(true);
    expect(isFormulaPath("strikes.Tail.attack")).toBe(false);
    expect(tableForPath("strikes.Tail.damage.1")).toBe("strikeDamage");
  });

  it("survives a Strike whose name contains a dot", () => {
    const block = dragonish();
    block.strikes[0]!.name = "Dr. Chill's Cane";
    expect(getStringAt(block, "strikes.Dr. Chill's Cane.damage")).toBe("4d10+15");
    expect(setAt(block, "strikes.Dr. Chill's Cane.attack", 30)).toBe(true);
    expect(block.strikes[0]!.attack).toBe(30);
  });
});

describe("prettyPath", () => {
  it("names every kind of path the way a stat block does", () => {
    expect(prettyPath("ac")).toBe("AC");
    expect(prettyPath("saves.fortitude")).toBe("Fortitude save");
    expect(prettyPath("abilities.str")).toBe("STR");
    expect(prettyPath("skills.athletics")).toBe("Athletics");
    expect(prettyPath("strikes.Fist.attack")).toBe("Fist attack");
    expect(prettyPath("strikes.Fist.damage.1")).toBe("Fist damage");
    expect(prettyPath("spellcasting.Arcane Prepared Spells.dc")).toBe(
      "Arcane Prepared Spells DC"
    );
    expect(prettyPath("spellcasting.Arcane Prepared Spells.attack")).toBe(
      "Arcane Prepared Spells spell attack"
    );
  });
});
