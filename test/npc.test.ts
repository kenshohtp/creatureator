/**
 * NPC mapping tests, pinned against a real Husk Zombie actor dump.
 *
 * The fixture is trimmed but its values are verbatim from
 * pf2e.book-of-the-dead-bestiary on PF2e 8.3.0. If PF2e moves a data path in a
 * future version, these tests are what will catch it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readStatBlock,
  applyStatBlock,
  type NPCSource,
} from "../src/pf2e/npc.js";
import {
  parseDamage,
  averageDamage,
  formatDamage,
  expressForAverage,
  isFlat,
  rescaleDamageFormula,
} from "../src/pf2e/damage.js";

const husk = () =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/husk-zombie.json"), "utf8")
  ) as NPCSource;

describe("readStatBlock", () => {
  const b = readStatBlock(husk());

  it("reads the core defences", () => {
    expect(b.level).toBe(2);
    expect(b.ac).toBe(17);
    expect(b.hp).toBe(55);
  });

  it("reads perception from system.perception, not system.attributes", () => {
    expect(b.perception).toBe(5);
  });

  it("reads all three saves", () => {
    expect(b.saves).toEqual({ fortitude: 7, reflex: 9, will: 7 });
  });

  it("reads ability modifiers including negatives", () => {
    expect(b.abilities.str).toBe(4);
    expect(b.abilities.int).toBe(-1);
    expect(b.abilities.cha).toBe(0);
  });

  it("reads skills by slug", () => {
    expect(b.skills["athletics"]).toBe(8);
    expect(b.skills["stealth"]).toBe(7);
  });

  it("picks up only melee-type items as Strikes, not the linked weapon", () => {
    expect(b.strikes.map((s) => s.name)).toEqual(["Shortsword", "Fist"]);
  });

  it("reads Strike attack and damage, preserving the damage-roll key", () => {
    const fist = b.strikes.find((s) => s.name === "Fist")!;
    expect(fist.attack).toBe(11);
    expect(fist.damage).toHaveLength(1);
    expect(fist.damage[0]!.formula).toBe("1d8+4");
    expect(fist.damage[0]!.damageType).toBe("bludgeoning");
    expect(fist.damage[0]!.id).toBe("kzcqwmczmmzcxxfk");
  });

  it("reads Remaster weakness terminology", () => {
    expect(b.weaknesses).toContainEqual({ type: "vitality", value: 5 });
  });
});

describe("applyStatBlock", () => {
  it("does not mutate the input", () => {
    const src = husk();
    const before = JSON.stringify(src);
    applyStatBlock(src, { ...readStatBlock(src), ac: 99 });
    expect(JSON.stringify(src)).toBe(before);
  });

  it("round-trips unchanged", () => {
    const src = husk();
    const out = applyStatBlock(src, readStatBlock(src));
    expect(readStatBlock(out)).toEqual(readStatBlock(src));
  });

  it("writes defences back to the right paths", () => {
    const src = husk();
    const b = readStatBlock(src);
    const out = applyStatBlock(src, { ...b, level: 5, ac: 22, hp: 75, perception: 12 });

    expect(out.system["details"].level.value).toBe(5);
    expect(out.system["attributes"].ac.value).toBe(22);
    expect(out.system["attributes"].hp.max).toBe(75);
    expect(out.system["attributes"].hp.value).toBe(75);
    expect(out.system["perception"].mod).toBe(12);
  });

  it("updates Strike damage in place, keeping PF2e's random roll keys", () => {
    const src = husk();
    const b = readStatBlock(src);
    const fist = b.strikes.find((s) => s.name === "Fist")!;
    fist.attack = 16;
    fist.damage[0]!.formula = "2d8+6";

    const out = applyStatBlock(src, b);
    const item = out.items.find((i) => i["name"] === "Fist")!;
    expect(item["system"].bonus.value).toBe(16);
    expect(item["system"].damageRolls["kzcqwmczmmzcxxfk"].damage).toBe("2d8+6");
    expect(item["system"].damageRolls["kzcqwmczmmzcxxfk"].damageType).toBe("bludgeoning");
  });

  it("carries through everything it does not own", () => {
    const src = husk();
    const out = applyStatBlock(src, { ...readStatBlock(src), ac: 30 });

    // Non-Strike items survive untouched - this is why we clone a compendium
    // actor instead of building one from scratch.
    expect(out.items.filter((i) => i["type"] === "action")).toHaveLength(4);
    expect(out.items.find((i) => i["type"] === "weapon")).toBeDefined();
    expect(out.system["attributes"].immunities).toHaveLength(6);
    expect(out.system["attributes"].hp.details).toBe("void healing");
  });
});

describe("damage formulas", () => {
  it("parses and averages", () => {
    expect(parseDamage("1d6+4")).toEqual({ count: 1, faces: 6, modifier: 4 });
    expect(averageDamage({ count: 1, faces: 8, modifier: 4 })).toBe(8.5);
    expect(parseDamage("2d8")).toEqual({ count: 2, faces: 8, modifier: 0 });
    expect(parseDamage("d4+1")).toEqual({ count: 1, faces: 4, modifier: 1 });
  });

  it("rejects things that are neither dice nor flat", () => {
    expect(parseDamage("1d6+1d4")).toBeNull();
    expect(parseDamage("special")).toBeNull();
  });

  /**
   * Flat riders are common in the bestiary - a 720-creature sample turned up
   * bare values like "1", "2", "4" repeatedly, as persistent and splash damage.
   * They must parse, and must not be scaled against the Strike damage table.
   */
  it("parses flat damage riders", () => {
    expect(parseDamage("1")).toEqual({ count: 0, faces: 0, modifier: 1 });
    expect(parseDamage("4")).toEqual({ count: 0, faces: 0, modifier: 4 });
    expect(isFlat(parseDamage("2")!)).toBe(true);
    expect(isFlat(parseDamage("1d6")!)).toBe(false);
    expect(averageDamage(parseDamage("3")!)).toBe(3);
    expect(formatDamage(parseDamage("3")!)).toBe("3");
  });

  it("never rescales a flat rider", () => {
    expect(rescaleDamageFormula("1", 20, "2d8+7")).toBe("1");
    expect(rescaleDamageFormula("4", 30, "3d10+9")).toBe("4");
  });

  it("formats round-trip", () => {
    expect(formatDamage({ count: 2, faces: 8, modifier: 7 })).toBe("2d8+7");
    expect(formatDamage({ count: 2, faces: 8, modifier: 0 })).toBe("2d8");
  });

  it("hits the target average while preserving die size", () => {
    // L5 high strike damage is "2d8+7 (16)". Keep a d8 chassis.
    const e = expressForAverage(8, 16, 2);
    expect(e.faces).toBe(8);
    expect(averageDamage(e)).toBeCloseTo(16, 0);
  });

  it("keeps a d12 creature swinging a d12", () => {
    const out = rescaleDamageFormula("1d12+4", 16, "2d8+7");
    expect(out).toMatch(/d12/);
    expect(averageDamage(parseDamage(out)!)).toBeCloseTo(16, 0);
  });

  it("shrinks the dice pool rather than going negative on the modifier", () => {
    const e = expressForAverage(12, 8, 4); // 4d12 averages 26, way over 8
    expect(e.modifier).toBeGreaterThanOrEqual(0);
    expect(e.count).toBe(1);

    // Even-faced dice have half-integer averages (a d12 averages 6.5), so an
    // integer target is often unreachable: 1d12+1 is 7.5 and 1d12+2 is 8.5,
    // both exactly 0.5 from a target of 8. Half a point is therefore the best
    // achievable error, not a tolerance we are being generous about.
    expect(Math.abs(averageDamage(e) - 8)).toBeLessThanOrEqual(0.5);
  });

  it("lands exactly when the die size allows it", () => {
    // 2d12 averages 13, so +3 reaches 16 with no rounding error at all.
    expect(averageDamage(expressForAverage(12, 16, 2))).toBe(16);
  });

  it("leaves non-standard formulas alone", () => {
    expect(rescaleDamageFormula("1d6+1d4", 20, "2d8+7")).toBe("1d6+1d4");
  });
});
