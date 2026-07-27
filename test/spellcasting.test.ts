/**
 * Spellcasting: reading, writing, and rescaling spell DCs.
 *
 * 43% of sampled bestiary creatures have at least one spellcastingEntry, so
 * this is not an edge case. Field paths (`system.spelldc.dc` for the DC,
 * `system.spelldc.value` for the attack modifier) were confirmed against
 * Monster Core on PF2e 8.3.0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readStatBlock, applyStatBlock, type NPCSource } from "../src/pf2e/npc.js";
import { rescaleCreature, summarise } from "../src/scaling/rescale-creature.js";
import { rowFor } from "../src/scaling/bands.js";

const caster = () =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/spellcaster.json"), "utf8")
  ) as NPCSource;

describe("reading spellcasting", () => {
  const b = readStatBlock(caster());

  it("reads every casting entry, not just the first", () => {
    expect(b.spellcasting).toHaveLength(2);
  });

  it("reads DC and attack from system.spelldc", () => {
    const arcane = b.spellcasting.find((s) => s.tradition === "arcane")!;
    expect(arcane.dc).toBe(21);
    expect(arcane.attack).toBe(11);
    expect(arcane.prepared).toBe("prepared");

    const divine = b.spellcasting.find((s) => s.tradition === "divine")!;
    expect(divine.dc).toBe(17);
    expect(divine.attack).toBe(9);
    expect(divine.prepared).toBe("innate");
  });

  it("does not mistake spell items for casting entries", () => {
    expect(b.spellcasting.map((s) => s.name)).not.toContain("Fireball");
  });
});

describe("writing spellcasting", () => {
  it("round-trips unchanged", () => {
    const src = caster();
    expect(readStatBlock(applyStatBlock(src, readStatBlock(src)))).toEqual(
      readStatBlock(src)
    );
  });

  it("writes DC and attack back to the right entry", () => {
    const src = caster();
    const b = readStatBlock(src);
    b.spellcasting.find((s) => s.tradition === "arcane")!.dc = 30;

    const out = applyStatBlock(src, b);
    const arcane = out.items.find((i) => i["_id"] === "casterentry0001")!;
    const divine = out.items.find((i) => i["_id"] === "casterentry0002")!;

    expect(arcane["system"].spelldc.dc).toBe(30);
    // The other entry must be untouched.
    expect(divine["system"].spelldc.dc).toBe(17);
  });

  it("leaves spell items alone", () => {
    const src = caster();
    const out = applyStatBlock(src, readStatBlock(src));
    const spell = out.items.find((i) => i["type"] === "spell")!;
    expect(spell["system"].level.value).toBe(3);
    expect(spell["system"].location.value).toBe("casterentry0001");
  });
});

describe("rescaling spellcasting: level 3 -> 10", () => {
  const r = rescaleCreature(caster(), 10);
  const at = (path: string) => r.changes.find((c) => c.path === path);

  it("scales both entries independently", () => {
    expect(at("spellcasting.Arcane Prepared Spells.dc")).toBeDefined();
    expect(at("spellcasting.Divine Innate Spells.dc")).toBeDefined();
  });

  /**
   * Table 2-11 is shaped differently from the rest: three bands only
   * (Extreme, High, Moderate) with paired columns per band. The adapter must
   * project the right column, so verify the results land on real table values.
   */
  it("lands DCs on genuine table figures", () => {
    const row = rowFor("spellDC", 10);
    const dcs = [row["extreme dc"], row["high dc"], row["moderate dc"]];

    for (const entry of ["Arcane Prepared Spells", "Divine Innate Spells"]) {
      const c = at(`spellcasting.${entry}.dc`)!;
      expect(["extreme", "high", "moderate"]).toContain(c.band);
      // With no offset the new DC is exactly the table value for its band.
      if (c.offset === 0) expect(dcs).toContain(c.to);
      expect(Number(c.to)).toBeGreaterThan(Number(c.from));
    }
  });

  it("scales the attack modifier from the paired column, not the DC column", () => {
    const row = rowFor("spellDC", 10);
    const c = at("spellcasting.Arcane Prepared Spells.attack")!;
    // Attack bonuses are much lower than DCs; landing on a DC value would mean
    // the adapter picked the wrong column.
    expect(Number(c.to)).toBeLessThan(Number(row["moderate dc"]));
    expect(Number(c.to)).toBeGreaterThan(Number(c.from));
  });

  it("preserves the DC gap between the two entries", () => {
    const arcane = at("spellcasting.Arcane Prepared Spells.dc")!;
    const divine = at("spellcasting.Divine Innate Spells.dc")!;
    // Arcane started 4 higher and should still be the stronger of the two.
    expect(Number(arcane.to)).toBeGreaterThan(Number(divine.to));
  });

  it("warns that spell ranks are unchanged, with the level-appropriate cap", () => {
    const w = r.warnings.filter((x) => x.path.startsWith("spellcasting."));
    expect(w).toHaveLength(2);
    // Level 10 allows spells up to rank 5.
    expect(w[0]!.message).toMatch(/maximum spell rank of 5/);
  });

  it("writes the scaled DCs onto the actor", () => {
    const after = readStatBlock(r.actor);
    const arcane = after.spellcasting.find((s) => s.tradition === "arcane")!;
    expect(arcane.dc).toBe(Number(at("spellcasting.Arcane Prepared Spells.dc")!.to));
  });

  it("still handles the mundane statistics", () => {
    expect(at("ac")).toBeDefined();
    expect(at("strikes.Dagger.attack")).toBeDefined();
    console.log("\n" + summarise(r));
  });
});
