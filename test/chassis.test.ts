/**
 * Chassis discovery and filtering.
 *
 * Pack metadata shapes are taken from a real clean PF2e 8.3.0 install, where
 * all 66 Actor packs report packageType "system" / packageName "pf2e".
 */

import { describe, it, expect } from "vitest";
import {
  toChassisEntry,
  filterChassis,
  sortChassis,
  groupByProvenance,
  normaliseProvenance,
  resolveCollection,
  buildChassisIndex,
  type PackMeta,
  type ChassisEntry,
} from "../src/foundry/chassis.js";

const officialPack: PackMeta = {
  collection: "pf2e.pathfinder-monster-core",
  label: "Monster Core",
  type: "Actor",
  packageType: "system",
  packageName: "pf2e",
};

const worldPack: PackMeta = {
  collection: "world.my-homebrew",
  label: "My Homebrew",
  type: "Actor",
  packageType: "world",
  packageName: "world",
};

const row = (id: string, name: string, level?: number) => ({
  _id: id,
  name,
  type: "npc",
  ...(level === undefined ? {} : { system: { details: { level: { value: level } } } }),
});

describe("toChassisEntry", () => {
  it("builds a usable uuid", () => {
    const e = toChassisEntry(officialPack, row("abc123", "Husk Zombie", 2))!;
    expect(e.uuid).toBe("Compendium.pf2e.pathfinder-monster-core.Actor.abc123");
    expect(e.name).toBe("Husk Zombie");
    expect(e.level).toBe(2);
  });

  it("marks system/pf2e content as official", () => {
    expect(toChassisEntry(officialPack, row("a", "Goblin", 1))!.official).toBe(true);
    expect(toChassisEntry(officialPack, row("a", "Goblin", 1))!.provenance).toBe("system");
  });

  it("marks world content as homebrew, not official", () => {
    const e = toChassisEntry(worldPack, row("b", "Occam's Husk", 5))!;
    expect(e.provenance).toBe("world");
    expect(e.official).toBe(false);
  });

  it("survives a missing level rather than inventing one", () => {
    const e = toChassisEntry(officialPack, row("c", "Mystery"))!;
    expect(e.level).toBeNull();
  });

  it("rejects non-Actor packs and non-npc rows", () => {
    const itemPack = { ...officialPack, type: "Item" };
    expect(toChassisEntry(itemPack, row("d", "Longsword", 1))).toBeNull();
    expect(toChassisEntry(officialPack, { _id: "e", name: "A Party", type: "party" }))
      .toBeNull();
  });

  /**
   * Regression: Foundry does not put `collection` on `pack.metadata` - it lives
   * on the CompendiumCollection. Building a uuid from metadata alone produced
   * "Compendium.undefined.Actor.<id>", which only failed at lookup time.
   */
  it("rebuilds the collection from packageName and id when absent", () => {
    const rawMetadata: PackMeta = {
      id: "pathfinder-monster-core",
      label: "Monster Core",
      type: "Actor",
      packageType: "system",
      packageName: "pf2e",
    };
    const e = toChassisEntry(rawMetadata, row("xyz", "Goblin", 1))!;
    expect(e.uuid).toBe("Compendium.pf2e.pathfinder-monster-core.Actor.xyz");
    expect(e.pack).toBe("pf2e.pathfinder-monster-core");
  });

  it("prefers an explicit collection over a rebuilt one", () => {
    expect(resolveCollection(officialPack)).toBe("pf2e.pathfinder-monster-core");
    expect(resolveCollection({ ...officialPack, collection: "world.custom" }))
      .toBe("world.custom");
  });

  it("refuses an entry whose collection cannot be determined", () => {
    const broken: PackMeta = {
      label: "Mystery",
      type: "Actor",
      packageType: "system",
      packageName: "",
    };
    expect(toChassisEntry(broken, row("a", "Goblin", 1))).toBeNull();
  });

  it("treats unknown package types as module content", () => {
    expect(normaliseProvenance("system")).toBe("system");
    expect(normaliseProvenance("world")).toBe("world");
    expect(normaliseProvenance("something-new")).toBe("module");
  });
});

describe("filterChassis", () => {
  const entries: ChassisEntry[] = [
    toChassisEntry(officialPack, row("1", "Husk Zombie", 2))!,
    toChassisEntry(officialPack, row("2", "Ravener Husk", 14))!,
    toChassisEntry(officialPack, row("3", "Oliphaunt of Jandelay", 25))!,
    toChassisEntry(worldPack, row("4", "Occam's Risen Kinetic Husk", 5))!,
    toChassisEntry(officialPack, row("5", "Nameless"))!,
  ];

  it("matches names case-insensitively", () => {
    expect(filterChassis(entries, { search: "husk" }).map((e) => e.name)).toEqual([
      "Husk Zombie",
      "Ravener Husk",
      "Occam's Risen Kinetic Husk",
    ]);
  });

  it("filters by level range", () => {
    expect(filterChassis(entries, { minLevel: 2, maxLevel: 5 }).map((e) => e.name))
      .toEqual(["Husk Zombie", "Occam's Risen Kinetic Husk"]);
  });

  it("filters by provenance", () => {
    expect(filterChassis(entries, { provenance: ["world"] }).map((e) => e.name))
      .toEqual(["Occam's Risen Kinetic Husk"]);
  });

  /**
   * Level 25 creatures exist (Oliphaunt of Jandelay) but the Building Creatures
   * tables stop at 24, so they cannot be used as a chassis. Better to exclude
   * them from the picker than to let someone choose one and hit a refusal.
   */
  it("excludes creatures the tables cannot scale", () => {
    const names = filterChassis(entries, { scalableOnly: true }).map((e) => e.name);
    expect(names).not.toContain("Oliphaunt of Jandelay");
    expect(names).not.toContain("Nameless");
    expect(names).toContain("Husk Zombie");
  });
});

describe("sortChassis", () => {
  const entries: ChassisEntry[] = [
    toChassisEntry(officialPack, row("1", "Zombie Brute", 4))!,
    toChassisEntry(officialPack, row("2", "Husk Zombie", 2))!,
    toChassisEntry(officialPack, row("3", "Ravener Husk", 14))!,
  ];

  it("sorts by name with no target level", () => {
    expect(sortChassis(entries).map((e) => e.name)).toEqual([
      "Husk Zombie",
      "Ravener Husk",
      "Zombie Brute",
    ]);
  });

  it("puts the closest level first when a target is given", () => {
    expect(sortChassis(entries, 5).map((e) => e.name)).toEqual([
      "Zombie Brute",
      "Husk Zombie",
      "Ravener Husk",
    ]);
  });
});

describe("groupByProvenance", () => {
  it("always returns all three buckets", () => {
    const g = groupByProvenance([toChassisEntry(officialPack, row("1", "Goblin", 1))!]);
    expect(Object.keys(g).sort()).toEqual(["module", "system", "world"]);
    expect(g.system).toHaveLength(1);
    expect(g.module).toEqual([]);
  });
});

describe("buildChassisIndex", () => {
  /**
   * Mirrors the real shape: `collection` on the pack, not inside `metadata`.
   */
  const fakePack = (meta: PackMeta, contents: ReturnType<typeof row>[]) => {
    const { collection, ...metadata } = meta;
    return {
      collection,
      metadata: metadata as PackMeta,
      getIndex: async () => ({ contents }),
    };
  };

  it("collects across packs and skips non-Actor ones", async () => {
    const packs = [
      fakePack(officialPack, [row("1", "Goblin", 1)]),
      fakePack(worldPack, [row("2", "My Monster", 5)]),
      fakePack({ ...officialPack, type: "Item", collection: "pf2e.equipment" }, [
        row("3", "Longsword", 1),
      ]),
    ];
    const index = await buildChassisIndex(packs);
    expect(index.map((e) => e.name)).toEqual(["Goblin", "My Monster"]);
  });

  it("produces resolvable uuids from a realistic pack shape", async () => {
    const index = await buildChassisIndex([
      fakePack(officialPack, [row("qO20so7Mv2pmsLL1", "Husk Zombie", 2)]),
    ]);
    expect(index[0]!.uuid).toBe(
      "Compendium.pf2e.pathfinder-monster-core.Actor.qO20so7Mv2pmsLL1"
    );
    expect(index[0]!.uuid).not.toContain("undefined");
  });

  /** One broken pack should not take out the whole index. */
  it("skips packs that fail to load", async () => {
    const broken = {
      metadata: { ...officialPack, collection: "pf2e.broken" },
      getIndex: async () => {
        throw new Error("corrupt");
      },
    };
    const index = await buildChassisIndex([
      broken,
      fakePack(officialPack, [row("1", "Goblin", 1)]),
    ]);
    expect(index).toHaveLength(1);
  });
});
