/**
 * Rescaling a grafted ability's numbers.
 *
 * The rules asserted here are not opinions - each one was measured against
 * 2,790 checks and 2,368 damage expressions harvested from 2,131 published
 * creatures. See the header of `src/scaling/rescale-ability.ts` for the
 * figures; the tests below are the behaviour those figures license.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  abilityDCAt,
  classifyAbilityDC,
  rescaleAbilityText,
} from "../src/scaling/rescale-ability.js";

describe("save DCs follow Table 2-11", () => {
  it("classifies a DC against the spell DC columns", () => {
    // Level 5: extreme 26, high 22, moderate 19.
    expect(classifyAbilityDC(5, 22)).toEqual({ band: "high", offset: 0 });
    expect(classifyAbilityDC(5, 23)).toEqual({ band: "high", offset: 1 });
    expect(classifyAbilityDC(5, 19)).toEqual({ band: "moderate", offset: 0 });
  });

  it("re-emits a DC at another level, carrying the offset", () => {
    const { html, changes } = rescaleAbilityText(
      "<p>@Check[fortitude|dc:22|basic]</p>", 5, 10
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ from: 22, band: "high", offset: 0 });
    expect(html).toContain(`dc:${changes[0]!.to}`);
    expect(html).toContain("|basic]"); // everything else survives
  });

  it("moves all three saves", () => {
    const text =
      "@Check[fortitude|dc:22] @Check[reflex|dc:22] @Check[will|dc:19]";
    const { changes } = rescaleAbilityText(text, 5, 12);
    expect(changes.map((c) => c.label)).toEqual([
      "Fortitude DC",
      "Reflex DC",
      "Will DC",
    ]);
  });

  it("reports the band it used, like every other number in this module", () => {
    const { changes } = rescaleAbilityText("@Check[will|dc:26]", 5, 8);
    expect(changes[0]!.band).toBe("extreme");
    expect(changes[0]!.offset).toBe(0);
  });

  it("says nothing changed when the level does not move", () => {
    const { html, changes } = rescaleAbilityText("@Check[will|dc:19]", 5, 5);
    expect(changes).toEqual([]);
    expect(html).toBe("@Check[will|dc:19]");
  });

  it("exposes each band's DC for a one-click override", () => {
    expect(abilityDCAt(5, "high")).toBe(22);
    expect(abilityDCAt(5, "moderate")).toBe(19);
    expect(abilityDCAt(5, "extreme")).toBe(26);
    // Table 2-11 has no Low or Terrible.
    expect(abilityDCAt(5, "low")).toBeNull();
  });
});

/**
 * The measured exclusions. Each of these would be a silent change to what an
 * ability does, which is the one thing this project refuses to do.
 */
describe("numbers that must not move", () => {
  it("never touches a flat check", () => {
    const { html, changes, notes } = rescaleAbilityText(
      "@Check[flat|dc:15]", 5, 20
    );
    expect(html).toBe("@Check[flat|dc:15]");
    expect(changes).toEqual([]);
    expect(notes[0]!.reason).toBe("flat-check");
  });

  it("leaves a skill DC alone and says why", () => {
    const { html, notes } = rescaleAbilityText("@Check[athletics|dc:24]", 9, 3);
    expect(html).toContain("dc:24");
    expect(notes[0]).toMatchObject({ reason: "skill-check" });
    expect(notes[0]!.detail).toContain("athletics");
  });

  it("leaves damage alone and says why", () => {
    const { html, notes } = rescaleAbilityText("@Damage[6d6[poison]]", 9, 3);
    expect(html).toBe("@Damage[6d6[poison]]");
    expect(notes[0]).toMatchObject({ reason: "damage" });
    expect(notes[0]!.detail).toContain("6d6 poison");
  });

  it("refuses a DC that is not a plain number", () => {
    const text = "@Check[fortitude|dc:resolve(@actor.level)]";
    const { html, notes } = rescaleAbilityText(text, 9, 3);
    expect(html).toBe(text);
    expect(notes[0]!.reason).toBe("unreadable");
  });

  it("does not scale a save DC out of the tables' range", () => {
    const { html, notes } = rescaleAbilityText("@Check[will|dc:19]", 5, 40);
    expect(html).toContain("dc:19");
    expect(notes.some((n) => n.detail.includes("level 40"))).toBe(true);
  });
});

describe("a whole ability", () => {
  const bogBreath =
    "<p>The bog breathes out. Each creature in a @Template[cone|distance:30] " +
    "must attempt a @Check[fortitude|dc:28|basic] save, taking " +
    "@Damage[6d6[poison]] damage. On a critical failure it is also sickened 2 " +
    "and must succeed at a @Check[flat|dc:11] check each round to act.</p>";

  const result = rescaleAbilityText(bogBreath, 9, 5);

  it("moves the save and nothing else", () => {
    // DC 28 is exactly High at level 9; High at level 5 is 22.
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ from: 28, to: 22, band: "high", offset: 0 });
    expect(result.html).toContain("@Check[fortitude|dc:22|basic]");
    expect(result.html).toContain("@Damage[6d6[poison]]");
    expect(result.html).toContain("@Check[flat|dc:11]");
    expect(result.html).toContain("@Template[cone|distance:30]");
    expect(result.html).toContain("The bog breathes out.");
  });

  it("accounts for every number it did not move", () => {
    expect(result.notes.map((n) => n.reason).sort()).toEqual([
      "damage",
      "flat-check",
    ]);
  });
});

/**
 * Corpus check, skipped when the harvest is absent.
 *
 * This is the same trick that caught the classifier: assert against numbers
 * Paizo authored rather than numbers we did. If ability save DCs ever stop
 * landing on Table 2-11, this is where it shows.
 */
const FIXTURE = resolve(import.meta.dirname, "fixtures/ability-numbers.tsv");
const available = existsSync(FIXTURE);

describe.skipIf(!available)("save DCs vs the published bestiary", () => {
  const rows = readFileSync(FIXTURE, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("C\t"))
    .map((l) => l.split("\t"))
    .map((r) => ({ level: Number(r[1]), dc: Number(r[2]), type: r[3] ?? "" }))
    .filter((r) => Number.isFinite(r.level) && Number.isFinite(r.dc));

  const saves = rows.filter((r) => ["fortitude", "reflex", "will"].includes(r.type));

  it("harvested a substantial sample", () => {
    expect(saves.length).toBeGreaterThan(2000);
  });

  it("lands on a published DC column far more often than not", () => {
    let exact = 0;
    let within2 = 0;
    for (const s of saves) {
      const c = classifyAbilityDC(s.level, s.dc);
      if (!c) continue;
      if (c.offset === 0) exact++;
      if (Math.abs(c.offset) <= 2) within2++;
    }
    // Measured: 48.5% sit exactly on High alone; 70% on one of the three
    // columns; 98.6% within two. The floors here are deliberately below the
    // measurement so a data refresh does not fail the suite spuriously.
    expect(exact / saves.length).toBeGreaterThan(0.4);
    expect(within2 / saves.length).toBeGreaterThan(0.9);
  });

  it("confirms flat check DCs are not level-scaled", () => {
    const flat = rows.filter((r) => r.type === "flat");
    const byDC = new Map<number, Set<number>>();
    for (const f of flat) {
      const set = byDC.get(f.dc) ?? byDC.set(f.dc, new Set()).get(f.dc)!;
      set.add(f.level);
    }
    // The same flat DC recurring across many levels is the proof: DC 5, 11 and
    // 15 each appear on creatures at 14 or more different levels.
    const spread = [...byDC.values()].map((s) => s.size).sort((a, b) => b - a);
    expect(spread[0]).toBeGreaterThan(10);
  });
});
