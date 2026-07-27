/**
 * Whole-creature rescaling, exercised on the real Husk Zombie chassis.
 *
 * Level 2 -> 5 is the transformation behind the reference creature
 * (Occam's Risen Kinetic Husk), so these assertions are checkable against a
 * human-authored stat block rather than only against our own model.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rescaleCreature, summarise } from "../src/scaling/rescale-creature.js";
import { readStatBlock, type NPCSource } from "../src/pf2e/npc.js";
import { parseDamage, averageDamage } from "../src/pf2e/damage.js";

const husk = () =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/husk-zombie.json"), "utf8")
  ) as NPCSource;

describe("rescaleCreature: Husk Zombie 2 -> 5", () => {
  const r = rescaleCreature(husk(), 5);
  const at = (path: string) => r.changes.find((c) => c.path === path);

  it("sets the target level", () => {
    expect(r.fromLevel).toBe(2);
    expect(r.toLevel).toBe(5);
    expect(r.block.level).toBe(5);
    expect(r.actor.system["details"].level.value).toBe(5);
  });

  it("moves AC along its band", () => {
    // L2 AC 17 is exactly Moderate; L5 Moderate is 21.
    expect(at("ac")).toMatchObject({ from: 17, to: 21, band: "moderate", offset: 0 });
  });

  it("moves Perception along its band", () => {
    // L2 Perception +5 is exactly Low; L5 Low is +9.
    expect(at("perception")).toMatchObject({ from: 5, to: 9, band: "low", offset: 0 });
  });

  it("carries save offsets rather than snapping to a band", () => {
    // Fort +7 at L2 is Low (+5) plus 2. L5 Low is +9, so +11.
    expect(at("saves.fortitude")).toMatchObject({
      from: 7, to: 11, band: "low", offset: 2,
    });
    // Ref +9 is Moderate (+8) plus 1. L5 Moderate is +12, so +13.
    expect(at("saves.reflex")).toMatchObject({
      from: 9, to: 13, band: "moderate", offset: 1,
    });
  });

  it("moves an exact-band attack bonus to the matching band", () => {
    // +11 at L2 is exactly High; L5 High is +15 - matching the reference
    // creature's Grave Blast at +15.
    expect(at("strikes.Fist.attack")).toMatchObject({
      from: 11, to: 15, band: "high", offset: 0,
    });
  });

  it("rescales Strike damage keeping the chassis die size", () => {
    const c = at("strikes.Fist.damage")!;
    expect(c.from).toBe("1d8+4");
    expect(String(c.to)).toMatch(/d8/);
    // L2 1d8+4 (avg 8.5) is Moderate; L5 Moderate averages 13.
    const avg = averageDamage(parseDamage(String(c.to))!);
    expect(Math.abs(avg - 13.5)).toBeLessThanOrEqual(1);
  });

  /**
   * Growth must come mostly from dice, not the flat modifier.
   *
   * Table 2-10 publishes "2d6+6 (13)" at L5 Moderate, so the dice count should
   * follow the table while the die size stays the chassis's. A regression here
   * produces averages that are technically correct but stat blocks that no
   * published creature resembles, e.g. "1d8+9".
   */
  it("takes the dice count from the table, not just the modifier", () => {
    for (const name of ["Fist", "Shortsword"]) {
      const to = String(at(`strikes.${name}.damage`)!.to);
      const parsed = parseDamage(to)!;
      expect(parsed.count, `${name} -> ${to}`).toBeGreaterThan(1);
      // Modifier should not dwarf the dice contribution.
      const diceAverage = (parsed.count * (parsed.faces + 1)) / 2;
      expect(parsed.modifier, `${name} -> ${to}`).toBeLessThanOrEqual(diceAverage + 3);
    }
  });

  it("keeps ability modifiers on their bands", () => {
    // Str +4 at L2 is exactly High; L5 High is +5.
    expect(at("abilities.str")).toMatchObject({ from: 4, to: 5, band: "high" });
  });

  it("writes results back onto the actor", () => {
    const after = readStatBlock(r.actor);
    expect(after.ac).toBe(21);
    expect(after.perception).toBe(9);
    expect(after.strikes.find((s) => s.name === "Fist")!.attack).toBe(15);
  });

  it("preserves everything it does not own", () => {
    expect(r.actor.items.filter((i) => i["type"] === "action")).toHaveLength(4);
    expect(r.actor.system["attributes"].immunities).toHaveLength(6);
    expect(r.actor.system["attributes"].hp.details).toBe("void healing");
  });

  /**
   * The important one. The chassis carries vitality 5 / slashing 5, which GM
   * Core trades against Hit Points, so its 55 HP sits far above band on
   * purpose. Rescaling amplifies that. We must warn, not silently "fix" it.
   */
  it("warns that HP cannot be rescaled independently of weaknesses", () => {
    const w = r.warnings.find((x) => x.path === "hp");
    expect(w).toBeDefined();
    expect(w!.message).toMatch(/vitality 5/);
    expect(w!.message).toMatch(/slashing 5/);
  });

  it("reports a band and offset for every change", () => {
    expect(r.changes.length).toBeGreaterThan(10);
    for (const c of r.changes) {
      expect(c.band).toBeTruthy();
      expect(typeof c.offset).toBe("number");
      expect(c.path).toBeTruthy();
    }
  });

  it("produces a readable summary", () => {
    const s = summarise(r);
    expect(s).toContain("Husk Zombie: level 2 -> 5");
    console.log("\n" + s);
  });
});

describe("rescaleCreature: edge cases", () => {
  it("is a no-op when the level is unchanged", () => {
    const r = rescaleCreature(husk(), 2);
    expect(r.changes).toHaveLength(0);
    expect(r.warnings[0]!.message).toMatch(/same/);
    expect(readStatBlock(r.actor)).toEqual(readStatBlock(husk()));
  });

  it("round-trips a creature back to its original level", () => {
    const up = rescaleCreature(husk(), 5);
    const down = rescaleCreature(up.actor, 2);
    const original = readStatBlock(husk());
    const back = readStatBlock(down.actor);

    // Statistics that sat exactly on a band must return exactly.
    expect(back.ac).toBe(original.ac);
    expect(back.perception).toBe(original.perception);
    expect(back.saves.fortitude).toBe(original.saves.fortitude);
    expect(back.strikes.find((s) => s.name === "Fist")!.attack).toBe(11);
  });

  it("scales down as well as up", () => {
    const r = rescaleCreature(husk(), 1);
    expect(r.toLevel).toBe(1);
    expect(readStatBlock(r.actor).ac).toBeLessThan(17);
  });

  it("handles the full supported range", () => {
    for (const level of [-1, 0, 24]) {
      const r = rescaleCreature(husk(), level);
      expect(r.changes.length, `level ${level}`).toBeGreaterThan(5);
    }
  });

  /**
   * The bestiary contains level 25 creatures but GM Core's tables stop at 24.
   * Refuse once, clearly, rather than emitting an identical warning for every
   * statistic and burying the actual cause.
   */
  it("refuses a target level outside the tables, with one clear warning", () => {
    const r = rescaleCreature(husk(), 25);
    expect(r.changes).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]!.message).toMatch(/outside the Building Creatures tables/);
    expect(r.warnings[0]!.message).toMatch(/target level 25/);
    // The actor must come back untouched.
    expect(readStatBlock(r.actor)).toEqual(readStatBlock(husk()));
  });

  it("refuses a chassis whose own level is off the tables", () => {
    const src = husk();
    src.system["details"].level.value = 25;
    const r = rescaleCreature(src, 10);
    expect(r.changes).toHaveLength(0);
    expect(r.warnings[0]!.message).toMatch(/chassis level 25/);
  });
});
