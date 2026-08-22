/**
 * The editing model.
 *
 * The suite is built around the reference creature, because it is the one case
 * where a human's answer exists to compare against: Occam's Risen Kinetic Husk
 * is a Husk Zombie taken from level 2 to 5, with AC pushed up a band and the
 * numeric weakness traded away for lower HP. If the editor cannot reproduce
 * those three decisions, it does not do the job it was built for.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EditSession } from "../src/editor/edit-session.js";
import { rescaleCreature } from "../src/scaling/rescale-creature.js";
import { readStatBlock, type NPCSource } from "../src/pf2e/npc.js";
import { getNumberAt, getStringAt, isFormulaPath } from "../src/pf2e/paths.js";

const load = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, `fixtures/${name}.json`), "utf8")
  ) as NPCSource;

const session = (fixture: string, level: number) => {
  const src = load(fixture);
  return new EditSession(src, rescaleCreature(src, level));
};

describe("fields", () => {
  const s = session("husk-zombie", 5);

  it("offers every statistic the stat block holds, not just the changed ones", () => {
    const paths = s.paths();
    expect(paths).toContain("ac");
    expect(paths).toContain("hp");
    expect(paths).toContain("saves.will");
    expect(paths).toContain("perception");
    expect(paths).toContain("abilities.str");
    expect(paths).toContain("skills.athletics");
    expect(paths).toContain("strikes.Fist.attack");
    expect(paths).toContain("strikes.Fist.damage.0");
  });

  it("every path it offers can actually be read", () => {
    for (const path of s.paths()) {
      const value = isFormulaPath(path)
        ? getStringAt(s.block, path)
        : getNumberAt(s.block, path);
      expect(value, `read ${path}`).not.toBeNull();
      expect(s.field(path), `field ${path}`).not.toBeNull();
    }
  });

  it("groups fields the way a stat block reads", () => {
    expect(s.sections().map((x) => x.title)).toEqual([
      "Defences",
      "Perception & Skills",
      "Attributes",
      "Strikes",
    ]);
  });

  it("carries the band and the offset, not just a number", () => {
    expect(s.field("ac")).toMatchObject({ value: 21, band: "moderate", offset: 0 });
    // 55 HP at level 2 was 19 above High; the rescale preserves that.
    expect(s.field("hp")).toMatchObject({ value: 110, band: "high", offset: 19 });
  });

  it("offers only the bands the table actually has at this level", () => {
    expect(s.field("hp")!.options.map((o) => o.band)).toEqual([
      "high",
      "moderate",
      "low",
    ]);
    expect(s.field("saves.will")!.options.map((o) => o.band)).toEqual([
      "extreme",
      "high",
      "moderate",
      "low",
      "terrible",
    ]);
  });

  it("publishes the whole span for the tables written as ranges", () => {
    const moderate = s.field("hp")!.options.find((o) => o.band === "moderate")!;
    expect(moderate.value).toBe(72);
    expect(moderate.range).toEqual({ min: 72, max: 78 });

    // AC is a single figure, so there is no span to show.
    expect(s.field("ac")!.options[0]!.range).toBeNull();
  });

  it("does not offer an Extreme attribute modifier where GM Core has none", () => {
    const low = session("husk-zombie", 0);
    expect(low.field("abilities.str")!.options.map((o) => o.band)).not.toContain(
      "extreme"
    );
  });
});

describe("editing", () => {
  it("re-derives the band as a number is typed", () => {
    const s = session("husk-zombie", 5);
    expect(s.set("ac", 25)).toBe(true);
    expect(s.field("ac")).toMatchObject({ band: "extreme", offset: 0, dirty: true });

    s.set("ac", 23);
    expect(s.field("ac")).toMatchObject({ band: "high", offset: 1 });
  });

  it("refuses a half-typed or cleared box rather than writing NaN", () => {
    const s = session("husk-zombie", 5);
    expect(s.set("ac", "")).toBe(false);
    expect(s.set("ac", "not a number")).toBe(false);
    expect(s.field("ac")!.value).toBe(21);
  });

  it("keeps the rescaled value so an edit can be undone", () => {
    const s = session("husk-zombie", 5);
    s.set("hp", 42);
    expect(s.field("hp")).toMatchObject({ value: 42, baseline: 110, dirty: true });
    expect(s.reset("hp")).toBe(true);
    expect(s.field("hp")).toMatchObject({ value: 110, dirty: false });
  });

  it("reverts everything at once", () => {
    const s = session("husk-zombie", 5);
    s.set("ac", 30);
    s.set("saves.will", 3);
    s.setDefence("weakness", "vitality", null);
    expect(s.isDirty).toBe(true);

    s.resetAll();
    expect(s.isDirty).toBe(false);
    expect(s.dirtyPaths).toEqual([]);
    expect(s.defenceRows().every((d) => !d.dirty)).toBe(true);
  });

  it("counts a rename as an edit", () => {
    const s = session("husk-zombie", 5);
    expect(s.isDirty).toBe(false);
    s.rename("Occam's Risen Kinetic Husk");
    expect(s.isDirty).toBe(true);
    expect(s.toActorSource().name).toBe("Occam's Risen Kinetic Husk");
  });
});

describe("band override", () => {
  it("sets the band's own figure and drops the inherited offset", () => {
    const s = session("husk-zombie", 5);
    // Fortitude arrives as Low +2 (11). Choosing Low should give plain Low.
    expect(s.field("saves.fortitude")).toMatchObject({ band: "low", offset: 2 });
    expect(s.setBand("saves.fortitude", "low")).toBe(true);
    expect(s.field("saves.fortitude")).toMatchObject({ value: 9, offset: 0 });
  });

  it("moves a statistic up a band in one click", () => {
    const s = session("husk-zombie", 5);
    expect(s.setBand("ac", "high")).toBe(true);
    expect(s.field("ac")).toMatchObject({ value: 22, band: "high", offset: 0 });
  });

  it("keeps the chassis die size when overriding damage", () => {
    const s = session("husk-zombie", 5);
    // The Shortsword is a d6 creature; Extreme is published as 2d12+7.
    expect(s.setBand("strikes.Shortsword.damage.0", "extreme")).toBe(true);
    const field = s.field("strikes.Shortsword.damage.0")!;
    expect(String(field.value)).toMatch(/^\d+d6/);
    expect(field.band).toBe("extreme");
  });

  it("refuses on a field no table governs", () => {
    const s = session("husk-zombie", 5);
    const rider = s
      .paths()
      .map((p) => s.field(p)!)
      .find((f) => f.kind === "formula" && f.table === null);
    if (rider) expect(s.setBand(rider.path, "high")).toBe(false);
  });
});

describe("damage rows", () => {
  const s = session("husk-zombie", 5);

  it("bands the main damage and refuses to band a rider", () => {
    const fields = s
      .paths()
      .filter((p) => p.includes(".damage."))
      .map((p) => s.field(p)!);

    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      if (f.table === "strikeDamage") expect(f.band).not.toBeNull();
      else expect(f.note).not.toBeNull();
    }
  });

  it("warns rather than rewriting a formula it cannot read", () => {
    const edited = session("husk-zombie", 5);
    edited.set("strikes.Fist.damage.0", "1d8 plus something odd");
    expect(edited.field("strikes.Fist.damage.0")!.band).toBeNull();
    expect(edited.warnings().some((w) => w.message.includes("exactly as typed"))).toBe(
      true
    );
    // And it is still written out untouched, not silently dropped.
    const strike = readStatBlock(edited.toActorSource()).strikes.find(
      (x) => x.name === "Fist"
    )!;
    expect(strike.damage.some((d) => d.formula === "1d8 plus something odd")).toBe(true);
  });
});

describe("weaknesses and Hit Points, as one decision", () => {
  it("shows the chassis's weaknesses alongside HP", () => {
    const s = session("husk-zombie", 5);
    expect(s.defenceRows()).toEqual([
      { kind: "weakness", type: "vitality", value: 5, baseline: 5, dirty: false },
      { kind: "weakness", type: "slashing", value: 5, baseline: 5, dirty: false },
    ]);
    expect(s.weaknessTotal).toBe(10);
  });

  it("warns while HP sits off-band with a weakness in play", () => {
    const s = session("husk-zombie", 5);
    const hp = s.warnings().filter((w) => w.path === "hp");
    expect(hp).toHaveLength(1);
    expect(hp[0]!.message).toContain("vitality 5");
  });

  it("clears the warning once the decision is actually made", () => {
    const s = session("husk-zombie", 5);
    s.setDefence("weakness", "vitality", null);
    s.setDefence("weakness", "slashing", null);
    s.setBand("hp", "moderate");
    expect(s.warnings().filter((w) => w.path === "hp")).toHaveLength(0);
  });

  it("keeps a removed weakness restorable", () => {
    const s = session("husk-zombie", 5);
    expect(s.setDefence("weakness", "slashing", null)).toBe(true);
    const row = s.defenceRows().find((d) => d.type === "slashing")!;
    expect(row).toMatchObject({ value: null, baseline: 5, dirty: true });

    s.setDefence("weakness", "slashing", row.baseline!);
    expect(s.defenceRows().find((d) => d.type === "slashing")!.dirty).toBe(false);
  });

  it("adds one the chassis never had", () => {
    const s = session("husk-zombie", 5);
    expect(s.setDefence("weakness", "fire", 10)).toBe(true);
    expect(s.defenceRows()).toContainEqual({
      kind: "weakness",
      type: "fire",
      value: 10,
      baseline: null,
      dirty: true,
    });
    expect(readStatBlock(s.toActorSource()).weaknesses).toContainEqual({
      type: "fire",
      value: 10,
    });
  });
});

/**
 * The acceptance test: can the editor produce the creature Dan built by hand?
 *
 * This is what the two `describe.todo` blocks in scaling.test.ts were waiting
 * for. The engine cannot make these calls, and should not; the editor is where
 * they get made, and this asserts that all three are reachable.
 */
describe("reproducing Occam's Risen Kinetic Husk", () => {
  const build = () => {
    const s = session("husk-zombie", 5);
    s.rename("Occam's Risen Kinetic Husk");
    s.setBand("ac", "high"); // 21 moderate -> 22 high
    s.setDefence("weakness", "vitality", null);
    s.setDefence("weakness", "slashing", null);
    s.set("hp", 75); // inside L5 moderate (72-78)
    return s;
  };

  it("lands on the hand-authored numbers", () => {
    const block = readStatBlock(build().toActorSource());
    expect(block.name).toBe("Occam's Risen Kinetic Husk");
    expect(block.level).toBe(5);
    expect(block.ac).toBe(22);
    expect(block.hp).toBe(75);
    expect(block.weaknesses).toEqual([]);
  });

  it("still explains every number it produced", () => {
    const s = build();
    expect(s.field("ac")).toMatchObject({ band: "high", offset: 0 });
    expect(s.field("hp")).toMatchObject({ band: "moderate", offset: 3 });
    expect(s.warnings()).toEqual([]);
  });

  it("leaves everything it was not asked to change alone", () => {
    const before = readStatBlock(load("husk-zombie"));
    const after = readStatBlock(build().toActorSource());
    // Immunities, rule elements and non-Strike items ride along untouched.
    expect(after.strikes.map((x) => x.name)).toEqual(before.strikes.map((x) => x.name));
    expect(build().toActorSource().items.length).toBe(load("husk-zombie").items.length);
  });

  it("says what it did, in one readable block", () => {
    const summary = build().summarise();
    expect(summary).toContain("Occam's Risen Kinetic Husk: level 2 -> 5");
    expect(summary).toContain("AC");
    expect(summary).toContain("removed weakness vitality");
  });
});

describe("spellcasters", () => {
  const s = session("spellcaster", 10);

  /**
   * Table 2-11 pairs a DC column with a spell attack column per band, and the
   * two are different numbers. Classifying a +20 spell attack against the DC
   * columns would read it as Moderate *minus six* and offer DCs as its band
   * options - so this asserts the attack half is used throughout.
   *
   * The two need not agree on a band: this fixture's Arcane entry is High DC
   * with a Moderate spell attack, which is how the published creature is
   * written. That is preserved rather than tidied up.
   */
  it("classifies a spell attack against the attack columns, not the DC ones", () => {
    const dc = s.field("spellcasting.Arcane Prepared Spells.dc")!;
    const attack = s.field("spellcasting.Arcane Prepared Spells.attack")!;

    expect(dc).toMatchObject({ value: 30, band: "high", offset: 1 });
    expect(attack).toMatchObject({ value: 20, band: "moderate", offset: 2 });
    expect(attack.options.map((o) => o.value)).toEqual([25, 21, 18]);
    expect(dc.options.map((o) => o.value)).toEqual([33, 29, 26]);
  });

  it("offers only the three bands Table 2-11 defines", () => {
    expect(s.field("spellcasting.Divine Innate Spells.dc")!.options.map((o) => o.band))
      .toEqual(["extreme", "high", "moderate"]);
  });

  it("overrides a spell DC without touching its sibling entry", () => {
    const local = session("spellcaster", 10);
    const paths = local.paths().filter((p) => p.endsWith(".dc"));
    expect(paths.length).toBeGreaterThan(1);

    const other = local.field(paths[1]!)!.value;
    local.setBand(paths[0]!, "extreme");
    expect(local.field(paths[0]!)!.band).toBe("extreme");
    expect(local.field(paths[1]!)!.value).toBe(other);
  });
});

describe("a chassis kept at its own level", () => {
  const s = session("husk-zombie", 2);

  it("is still fully editable even though nothing was rescaled", () => {
    expect(s.field("ac")!.value).toBe(17);
    expect(s.field("ac")!.band).toBe("moderate");
    expect(s.set("ac", 19)).toBe(true);
    expect(s.field("ac")).toMatchObject({ band: "high", dirty: true });
  });
});
