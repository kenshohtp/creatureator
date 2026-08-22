/**
 * Ability discovery and the attach panel.
 *
 * The pack shapes here match a real PF2e install: `collection` lives on the
 * pack rather than in its metadata (the bug that once produced
 * `Compendium.undefined.Item.<id>`), and action cost, category and traits are
 * only present because the index asks for them.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ABILITY_INDEX_FIELDS,
  buildAbilityIndex,
  filterAbilities,
  sortAbilities,
  toAbilityEntry,
  traitsIn,
  type AbilityEntry,
} from "../src/foundry/ability-index.js";
import { renderAbilities, renderAbilityPanel } from "../src/foundry/editor-view.js";
import { EditSession } from "../src/editor/edit-session.js";
import { rescaleCreature } from "../src/scaling/rescale-creature.js";
import type { NPCSource } from "../src/pf2e/npc.js";

const glossary = {
  collection: "pf2e.bestiary-ability-glossary-srd",
  id: "bestiary-ability-glossary-srd",
  label: "Bestiary Ability Glossary",
  type: "Item",
  packageType: "system",
  packageName: "pf2e",
};

const row = (over: Record<string, unknown> = {}) => ({
  _id: "abc123",
  name: "Grab",
  type: "action",
  system: {
    actionType: { value: "action" },
    actions: { value: 1 },
    category: "offensive",
    traits: { value: ["attack"] },
  },
  ...over,
});

describe("indexing an ability", () => {
  it("builds a usable uuid from the pack's collection", () => {
    expect(toAbilityEntry(glossary, row())?.uuid).toBe(
      "Compendium.pf2e.bestiary-ability-glossary-srd.Item.abc123"
    );
  });

  it("rebuilds the collection when only metadata is available", () => {
    const { collection, ...withoutCollection } = glossary;
    expect(toAbilityEntry(withoutCollection, row())?.uuid).toContain(
      "pf2e.bestiary-ability-glossary-srd"
    );
  });

  it("reads action cost, category and traits", () => {
    expect(toAbilityEntry(glossary, row())).toMatchObject({
      name: "Grab",
      actionType: "action",
      actions: 1,
      category: "offensive",
      traits: ["attack"],
      provenance: "system",
    });
  });

  it("treats an unfamiliar action type as passive rather than guessing", () => {
    const entry = toAbilityEntry(glossary, row({ system: { actionType: { value: "" } } }));
    expect(entry).toMatchObject({ actionType: "passive", actions: null });
  });

  it("skips anything that is not an ability item", () => {
    expect(toAbilityEntry(glossary, row({ type: "feat" }))).toBeNull();
    expect(toAbilityEntry({ ...glossary, type: "Actor" }, row())).toBeNull();
    expect(toAbilityEntry(glossary, row({ name: "" }))).toBeNull();
  });
});

describe("searching", () => {
  const entries: AbilityEntry[] = [
    { uuid: "u1", name: "Grab", pack: "p", packLabel: "P", provenance: "system", actionType: "action", actions: 1, category: "offensive", traits: ["attack"] },
    { uuid: "u2", name: "Improved Grab", pack: "p", packLabel: "P", provenance: "system", actionType: "free", actions: null, category: "offensive", traits: ["attack"] },
    { uuid: "u3", name: "Constrict", pack: "p", packLabel: "P", provenance: "world", actionType: "action", actions: 1, category: "offensive", traits: ["grapple"] },
    { uuid: "u4", name: "Wing Buffet", pack: "p", packLabel: "P", provenance: "module", actionType: "passive", actions: null, category: "defensive", traits: [] },
  ];

  it("matches on name and on traits", () => {
    expect(filterAbilities(entries, { search: "grab" }).map((e) => e.name)).toEqual([
      "Grab", "Improved Grab",
    ]);
    expect(filterAbilities(entries, { search: "grapple" }).map((e) => e.name)).toEqual([
      "Constrict",
    ]);
  });

  it("filters by action cost, category and provenance", () => {
    expect(filterAbilities(entries, { actionType: ["passive"] })).toHaveLength(1);
    expect(filterAbilities(entries, { category: ["defensive"] })).toHaveLength(1);
    expect(filterAbilities(entries, { provenance: ["world"] })).toHaveLength(1);
  });

  /**
   * Searching "grab" and getting "Improved Grab" first is the kind of small
   * wrongness that makes a picker feel broken.
   */
  it("puts an exact match above a compound one", () => {
    const found = sortAbilities(filterAbilities(entries, { search: "grab" }), "grab");
    expect(found.map((e) => e.name)).toEqual(["Grab", "Improved Grab"]);
  });

  it("collects the traits present, for a filter list", () => {
    expect(traitsIn(entries)).toEqual(["attack", "grapple"]);
  });
});

describe("building the index from packs", () => {
  const pack = (over: Record<string, unknown>) => ({
    collection: "pf2e.x",
    metadata: { ...glossary, ...over },
    async getIndex(options?: { fields?: string[] }) {
      requested = options?.fields ?? [];
      return { contents: [row(), row({ _id: "d4", name: "Constrict", type: "action" }), row({ _id: "z9", type: "feat" })] };
    },
  });
  let requested: string[] = [];

  it("asks for the fields that are not in the default index", async () => {
    await buildAbilityIndex([pack({})]);
    expect(requested).toEqual(ABILITY_INDEX_FIELDS);
  });

  it("keeps only ability items", async () => {
    const index = await buildAbilityIndex([pack({})]);
    expect(index.map((e) => e.name)).toEqual(["Grab", "Constrict"]);
  });

  it("ignores Actor packs entirely", async () => {
    expect(await buildAbilityIndex([pack({ type: "Actor" })])).toEqual([]);
  });

  it("survives a pack that will not index", async () => {
    const broken = {
      collection: "bad.pack",
      metadata: { ...glossary },
      async getIndex() { throw new Error("corrupt"); },
    };
    const index = await buildAbilityIndex([broken, pack({})]);
    expect(index).toHaveLength(2);
  });
});

describe("the abilities section", () => {
  const src = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/ability-creature.json"), "utf8")
  ) as NPCSource;

  const session = () => new EditSession(src, rescaleCreature(src, 5));
  const panel = {
    search: "",
    results: [] as AbilityEntry[],
    total: 1319,
    loading: false,
    sourceLevel: 5,
  };

  it("lists what the creature has, with its action cost", () => {
    const html = renderAbilities(session(), panel);
    expect(html).toContain("Breath of the Bog");
    expect(html).toContain("2 actions");
    expect(html).toContain("passive");
  });

  /** A DC that moved must say so, with the band, like every other number. */
  it("shows what the rescale did to an ability's DC", () => {
    const html = renderAbilities(session(), panel);
    expect(html).toContain("Fortitude DC");
    expect(html).toContain("<b>28</b>");
    expect(html).toContain("<b>22</b>");
    expect(html).toContain('class="band high"');
  });

  it("says what it left alone and why", () => {
    const html = renderAbilities(session(), panel);
    expect(html).toContain("Flat checks are");
    expect(html).toContain("No published table governs");
  });

  it("marks a grafted ability and reports the trait it had to drop", () => {
    const s = session();
    s.graft(
      (src.items ?? []).find((i) => i["name"] === "Breath of the Bog")!,
      { fromLevel: 9, name: "Borrowed Breath" }
    );
    const html = renderAbilities(s, panel);
    expect(html).toContain("ability-row grafted");
    expect(html).toContain("Borrowed Breath");
    expect(html).toContain("Dropped evil");
  });

  it("strikes through a removed ability instead of hiding it", () => {
    const s = session();
    s.setAbilityRemoved("bogrot0000000001", true);
    const html = renderAbilities(s, panel);
    expect(html).toContain("ability-row removed");
    expect(html).toContain("Restore");
  });

  it("says how many abilities are indexed before a search is typed", () => {
    expect(renderAbilityPanel(panel, 5)).toContain("1319 abilities indexed");
  });

  it("says it is still reading while the index builds", () => {
    expect(renderAbilityPanel({ ...panel, loading: true }, 5)).toContain(
      "Reading your compendia"
    );
  });

  it("says plainly when a search finds nothing", () => {
    expect(renderAbilityPanel({ ...panel, search: "zzz" }, 5)).toContain(
      'Nothing matches "zzz"'
    );
  });

  /**
   * A compendium ability carries no level of its own, so the level it was
   * written for is asked rather than assumed - and the default is the
   * creature's own level, which changes nothing.
   */
  it("defaults the source level to the creature's, so attaching changes nothing", () => {
    const html = renderAbilityPanel(panel, 5);
    expect(html).toContain('class="ability-level" value="5"');
    expect(html).toContain("Leave it as 5 to attach the ability exactly as written");
  });

  it("offers an attach button per result", () => {
    const results: AbilityEntry[] = [{
      uuid: "Compendium.pf2e.bestiary-ability-glossary-srd.Item.abc",
      name: "Grab", pack: "p", packLabel: "Glossary", provenance: "system",
      actionType: "action", actions: 1, category: "offensive", traits: ["attack"],
    }];
    const html = renderAbilityPanel({ ...panel, search: "grab", results }, 5);
    expect(html).toContain('class="ability-attach"');
    expect(html).toContain("Official");
    expect(html).toContain("1 action");
  });
});
