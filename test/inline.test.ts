/**
 * Inline element parsing.
 *
 * Every string in this file is real text from a published creature, harvested
 * by `tools/probe-abilities.js` against a live PF2e 8.3.0 install. That matters:
 * the first regex I wrote for this ("\\[[^\\]]+\\]") looked right and silently
 * truncated `@Damage[2d6[poison]]` to `@Damage[2d6[poison]`, because nested
 * brackets are normal and I had assumed they were not.
 */

import { describe, it, expect } from "vitest";
import {
  findInlines,
  hasLegacyRoll,
  mapInlines,
  withDC,
  withDamageTerm,
  type InlineCheck,
  type InlineDamage,
} from "../src/pf2e/inline.js";

const check = (text: string) => findInlines(text)[0] as InlineCheck;
const damage = (text: string) => findInlines(text)[0] as InlineDamage;

describe("checks", () => {
  it("reads the plain form", () => {
    expect(check("@Check[fortitude|dc:28]")).toMatchObject({
      kind: "check",
      checkType: "fortitude",
      dc: 28,
      isFlat: false,
    });
  });

  it("reads the older type: spelling", () => {
    expect(check("@Check[type:will|dc:33]")).toMatchObject({
      checkType: "will",
      dc: 33,
    });
  });

  it("keeps basic and options out of the way", () => {
    const c = check("@Check[reflex|dc:22|basic|options:area-effect]");
    expect(c).toMatchObject({ checkType: "reflex", dc: 22 });
    expect(withDC(c, 30)).toBe("@Check[reflex|dc:30|basic|options:area-effect]");
  });

  /**
   * The one that would have been a silent bug. A flat check is a fixed
   * probability - Volluk Azrinae's Discorporate is DC 15 flat at level 7 and
   * would still be DC 15 flat at level 20. Scaling it changes what the ability
   * does, quietly.
   */
  it("marks a flat check as flat", () => {
    expect(check("@Check[flat|dc:15]")).toMatchObject({ checkType: "flat", isFlat: true });
  });

  it("refuses to touch a DC that is not a plain number", () => {
    const c = check("@Check[fortitude|dc:resolve(@actor.level)]");
    expect(c.dc).toBeNull();
    expect(withDC(c, 30)).toBe(c.raw);
  });

  it("carries a label through a rewrite", () => {
    const c = check("@Check[fortitude|dc:28]{Bog Rot}");
    expect(c.label).toBe("Bog Rot");
    expect(withDC(c, 31)).toBe("@Check[fortitude|dc:31]{Bog Rot}");
  });
});

describe("damage", () => {
  it("reads a typed die expression through its nested brackets", () => {
    const d = damage("@Damage[2d6[poison]]");
    expect(d.terms).toEqual([
      { expr: "2d6", damageType: "poison", isFlat: false, offset: 0 },
    ]);
  });

  it("reads a parenthesised expression", () => {
    expect(damage("@Damage[(4d6+8)[slashing]]").terms[0]).toMatchObject({
      expr: "(4d6+8)",
      damageType: "slashing",
    });
  });

  it("reads several terms", () => {
    const d = damage("@Damage[1d6[mental],1d6[fire]]");
    expect(d.terms.map((t) => `${t.expr} ${t.damageType}`)).toEqual([
      "1d6 mental",
      "1d6 fire",
    ]);
  });

  /**
   * Flat damage is fixed by design: the Remnant of Barzillai deals 20 force,
   * and Mulventok's Stay in the Fight heals a flat 1. The engine already
   * refuses to scale flat Strike riders; the same rule applies here.
   */
  it("marks flat amounts as flat", () => {
    expect(damage("@Damage[20[force]]").terms[0]!.isFlat).toBe(true);
    expect(damage("@Damage[1[healing]]").terms[0]!.isFlat).toBe(true);
    expect(damage("@Damage[2d12[untyped]]").terms[0]!.isFlat).toBe(false);
  });

  it("rewrites one term without disturbing its siblings or its type", () => {
    const d = damage("@Damage[1d6[mental],1d6[fire]]");
    expect(withDamageTerm(d, 0, "3d6")).toBe("@Damage[3d6[mental],1d6[fire]]");
    expect(withDamageTerm(d, 1, "3d6")).toBe("@Damage[1d6[mental],3d6[fire]]");
  });

  it("keeps a label on a rewritten damage element", () => {
    const d = damage("@Damage[4d6[untyped]]{Shield Breaker}");
    expect(withDamageTerm(d, 0, "6d6")).toBe("@Damage[6d6[untyped]]{Shield Breaker}");
  });
});

describe("finding elements in real ability text", () => {
  const text =
    "<p>The bog breathes out. Each creature in a @Template[cone|distance:30] " +
    "must attempt a @Check[fortitude|dc:28|basic] save, taking " +
    "@Damage[6d6[poison]] damage on a failure. A creature that fails is " +
    "sickened and must succeed at a @Check[flat|dc:11] check each round.</p>";

  it("finds every element, in order, with its kind", () => {
    expect(findInlines(text).map((i) => i.kind)).toEqual([
      "template",
      "check",
      "damage",
      "check",
    ]);
  });

  it("rewrites only what it is told to, and leaves the prose alone", () => {
    const out = mapInlines(text, (inline) => {
      if (inline.kind !== "check" || inline.isFlat || inline.dc === null) return null;
      return withDC(inline, inline.dc + 5);
    });

    expect(out).toContain("@Check[fortitude|dc:33|basic]");
    expect(out).toContain("@Check[flat|dc:11]"); // untouched
    expect(out).toContain("@Damage[6d6[poison]]"); // untouched
    expect(out).toContain("The bog breathes out.");
    expect(out.length - text.length).toBe(0);
  });

  it("rewrites several elements at once without offsets drifting", () => {
    const out = mapInlines(text, (inline) =>
      inline.kind === "damage" ? withDamageTerm(inline, 0, "12d6") : null
    );
    expect(out).toContain("@Damage[12d6[poison]]");
    expect(out).toContain("@Check[fortitude|dc:28|basic]");
  });
});

describe("malformed and legacy text", () => {
  it("leaves an unclosed element alone rather than guessing where it ends", () => {
    expect(findInlines("@Check[fortitude|dc:28")).toEqual([]);
    expect(findInlines("@Damage[2d6[poison]")).toEqual([]);
  });

  it("ignores text that merely mentions the syntax", () => {
    expect(findInlines("Write it as @Check followed by a bracket")).toEqual([]);
  });

  it("spots a legacy roll so the UI can say it was left alone", () => {
    expect(hasLegacyRoll("returns after [[/br 2d4 #days]] days")).toBe(true);
    expect(hasLegacyRoll("@Damage[2d6[poison]]")).toBe(false);
  });
});

/**
 * Dragon Breath, verbatim from a live PF2e 8.4.0 install.
 *
 * Copied onto a husk zombie, this rendered as "DC 0 Basic Reflex" on the sheet.
 * The reason is in the parameters: there is no `dc:` at all. The DC comes from
 * `against:class-spell`, meaning "the owner's class or spell DC", and a
 * creature has neither.
 *
 * The first repair attempt failed on exactly this: a rewriter that replaces a
 * `dc:` parameter has nothing to replace, so it silently changed nothing.
 */
describe("a check whose DC comes from `against:`", () => {
  const dragonBreath =
    "@Check[reflex|basic|against:class-spell|options:area-effect]";

  it("reads the against: reference and reports no numeric DC", () => {
    expect(check(dragonBreath)).toMatchObject({
      checkType: "reflex",
      dc: null,
      against: "class-spell",
      isFlat: false,
    });
  });

  it("still refuses to touch it without being told to", () => {
    expect(withDC(check(dragonBreath), 22)).toBe(dragonBreath);
  });

  it("inserts a DC where there was none, and drops the reference with it", () => {
    expect(withDC(check(dragonBreath), 22, { force: true })).toBe(
      "@Check[reflex|dc:22|basic|options:area-effect]"
    );
  });

  it("leaves an ordinary check's against-free parameters alone", () => {
    const ordinary = check("@Check[fortitude|dc:28|basic]");
    expect(ordinary.against).toBeNull();
    expect(withDC(ordinary, 22)).toBe("@Check[fortitude|dc:22|basic]");
  });

  /** A check with both keeps its `against:` — that is a rescale, not a repair. */
  it("keeps against: when the check already had a real DC", () => {
    const both = check("@Check[reflex|dc:30|against:class-spell]");
    expect(withDC(both, 22)).toBe("@Check[reflex|dc:22|against:class-spell]");
  });
});

describe("the whole Dragon Breath description", () => {
  const text =
    "<p>You breathe deeply and exhale a line or cone of powerful breath. If the " +
    "dragon had a cone-shaped breath, your breath is a @Template[type:cone|distance:30]. " +
    "It deals 1d6 damage per level (@Damage[(@actor.level)d6[untyped]|options:area-damage]), " +
    "with a @Check[reflex|basic|against:class-spell|options:area-effect] save.</p>";

  it("finds every element in it", () => {
    expect(findInlines(text).map((i) => i.kind)).toEqual([
      "template",
      "damage",
      "check",
    ]);
  });

  it("repairs only the save, leaving the level-scaling damage untouched", () => {
    const out = mapInlines(text, (inline) =>
      inline.kind === "check" ? withDC(inline, 22, { force: true }) : null
    );
    expect(out).toContain("@Check[reflex|dc:22|basic|options:area-effect]");
    expect(out).toContain("@Damage[(@actor.level)d6[untyped]|options:area-damage]");
    expect(out).toContain("@Template[type:cone|distance:30]");
  });
});
