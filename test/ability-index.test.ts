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
import {
  EMPTY_ABILITY_PANEL,
  renderAbilities,
  renderAbilityPanel,
} from "../src/foundry/editor-view.js";
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
  const panel = { ...EMPTY_ABILITY_PANEL, total: 1319, sourceLevel: 5 };

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

/**
 * Reflavouring: seeing what an ability does, and changing it.
 *
 * This is the complaint the whole module exists to answer — "I can't see or
 * edit what these abilities do, or re-flavour them, which is kind of the
 * point." A grafted ability and one written from scratch are edited by exactly
 * the same controls, which is what makes two of the three authoring routes one
 * feature rather than two.
 */
describe("editing an ability", () => {
  const src = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/ability-creature.json"), "utf8")
  ) as NPCSource;
  const session = () => new EditSession(src, rescaleCreature(src, 5));
  const breathId = "own:breathofthebog01";

  it("shows the text the ability will actually have", () => {
    const text = session().abilityText(breathId);
    expect(text).toContain("The bog elder breathes out");
    expect(text).toContain("dc:22"); // already rescaled
  });

  it("renames, retitles the cost, and retypes the traits", () => {
    const s = session();
    s.setAbilityField(breathId, "name", "Breath of Occam");
    s.setAbilityField(breathId, "traits", "Kineticist, VOID , ");
    s.setAbilityField(breathId, "actionType", "reaction");

    const row = s.abilityRows().find((r) => r.rowId === breathId)!;
    expect(row.ability.name).toBe("Breath of Occam");
    expect(row.ability.traits).toEqual(["kineticist", "void"]);
    expect(row.ability.actionType).toBe("reaction");
    // A reaction has no action count; a stale 2 would render as "2 actions".
    expect(row.ability.actions).toBeNull();
  });

  it("gives an action a count, and clamps it to what PF2e allows", () => {
    const s = session();
    s.setAbilityField(breathId, "actionType", "action");
    s.setAbilityField(breathId, "actions", 9);
    expect(s.abilityRows().find((r) => r.rowId === breathId)!.ability.actions).toBe(3);
  });

  it("rewrites the description wholesale", () => {
    const s = session();
    s.setAbilityField(breathId, "description", "<p>It shrieks. @Check[will|dc:19]</p>");
    expect(s.abilityText(breathId)).toContain("It shrieks");
    expect(s.toActorSource().items.find((i) => i["_id"] === "breathofthebog01")!
      ["system"].description.value).toContain("It shrieks");
  });

  /** A DC the user typed is still a number that needs its band shown. */
  it("surfaces the save DCs in the text as editable fields, with bands", () => {
    const s = session();
    const dcs = s.abilityDCs(breathId);
    expect(dcs).toHaveLength(1);
    expect(dcs[0]).toMatchObject({ label: "Fortitude DC", dc: 22, band: "high", offset: 0 });
    expect(dcs[0]!.options.map((o) => o.value)).toEqual([26, 22, 19]);
  });

  it("does not offer a band control for a number no table governs", () => {
    const s = session();
    s.setAbilityField(breathId, "description", "@Check[flat|dc:11] @Check[athletics|dc:20]");
    expect(s.abilityDCs(breathId)).toEqual([]);
  });

  it("writes an edited DC back into the text without disturbing it", () => {
    const s = session();
    expect(s.setAbilityDC(breathId, 1, 26)).toBe(true);
    const text = s.abilityText(breathId);
    expect(text).toContain("@Check[fortitude|dc:26|basic]");
    expect(text).toContain("@Damage[6d6[poison]]");
    expect(text).toContain("@Check[flat|dc:11]");
    expect(s.abilityDCs(breathId)[0]!.band).toBe("extreme");
  });

  it("writes a brand new ability from nothing", () => {
    const s = session();
    const id = s.addAbility("Bound to Occam");
    s.setAbilityField(id, "actionType", "reaction");
    s.setAbilityField(id, "traits", "occam, leash");
    s.setAbilityField(id, "description", "<p>The husk cannot move more than 30 feet from Occam.</p>");

    const row = s.abilityRows().find((r) => r.rowId === id)!;
    expect(row.origin).toBe("authored");
    expect(row.ability.name).toBe("Bound to Occam");

    const created = s.toActorSource().items.find((i) => i["name"] === "Bound to Occam")!;
    expect(created["type"]).toBe("action");
    expect(created["system"].actionType.value).toBe("reaction");
    expect(created["system"].description.value).toContain("30 feet from Occam");
  });

  it("counts a reflavour as an edit, and reverts it", () => {
    const s = session();
    expect(s.isDirty).toBe(false);
    s.setAbilityField(breathId, "name", "Something Else");
    expect(s.isDirty).toBe(true);

    s.resetAll();
    expect(s.isDirty).toBe(false);
    expect(s.abilityRows().find((r) => r.rowId === breathId)!.ability.name).toBe(
      "Breath of the Bog"
    );
  });

  it("renders the form with the text and the DC field in it", () => {
    const s = session();
    const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL, sourceLevel: 5 }, breathId);
    expect(html).toContain("ability-form");
    expect(html).toContain("The bog elder breathes out");
    expect(html).toContain("ability-dc-input");
    expect(html).toContain("Write a new ability");
    // Only the open row gets a form.
    expect(html.match(/ability-form"/g)).toHaveLength(1);
  });
});

/**
 * Copying an ability off another creature.
 *
 * This is where the abilities actually are: the shared packs hold about 1,300,
 * the bestiary's creatures roughly 30,000 between them. They cannot be indexed
 * — that means loading every actor — so they are reached one creature at a time,
 * and the trade is worth it because a creature has a level, which a compendium
 * ability item does not.
 */
describe("the from-a-creature panel", () => {
  const creatureEntry = {
    uuid: "Compendium.pf2e.pathfinder-bestiary.Actor.dragon01",
    name: "Fortune Dragon",
    level: 12,
    pack: "pf2e.pathfinder-bestiary",
    packLabel: "Bestiary",
    provenance: "system" as const,
    official: true,
  };

  const abilities = [
    { id: "a1", name: "Breath Weapon", actionType: "action" as const, actions: 2, category: "offensive", traits: ["fire"], description: "", ruleCount: 0 },
    { id: "a2", name: "Frightful Presence", actionType: "passive" as const, actions: null, category: "offensive", traits: ["aura"], description: "", ruleCount: 2 },
  ];

  it("offers the two sources as a choice", () => {
    const html = renderAbilityPanel({ ...EMPTY_ABILITY_PANEL }, 5);
    expect(html).toContain("From a compendium");
    expect(html).toContain("From another creature");
    expect(html).toContain('data-mode="creature"');
  });

  it("searches creatures before it lists abilities", () => {
    const html = renderAbilityPanel(
      { ...EMPTY_ABILITY_PANEL, mode: "creature", creatureSearch: "dragon", creatureResults: [creatureEntry] },
      5
    );
    expect(html).toContain("Fortune Dragon");
    expect(html).toContain("Creature 12");
    expect(html).toContain('class="ability-browse"');
  });

  it("lists a chosen creature's abilities, with a Copy on each", () => {
    const html = renderAbilityPanel(
      {
        ...EMPTY_ABILITY_PANEL,
        mode: "creature",
        creature: { uuid: creatureEntry.uuid, name: "Fortune Dragon", level: 12 },
        creatureAbilities: abilities,
      },
      5
    );
    expect(html).toContain("Breath Weapon");
    expect(html).toContain("2 actions");
    expect(html).toContain('class="ability-copy"');
    // A rule element means real automation comes along with the copy.
    expect(html).toContain("automated");
  });

  /** The point of this route: the source level is known, so nothing is asked. */
  it("says it will rescale from the source creature's level, not ask for one", () => {
    const html = renderAbilityPanel(
      {
        ...EMPTY_ABILITY_PANEL,
        mode: "creature",
        creature: { uuid: creatureEntry.uuid, name: "Fortune Dragon", level: 12 },
        creatureAbilities: abilities,
      },
      5
    );
    expect(html).toContain("from level 12 to 5");
    expect(html).toContain("nothing to guess");
    expect(html).not.toContain("written for level");
  });

  it("says so plainly when the levels match", () => {
    const html = renderAbilityPanel(
      {
        ...EMPTY_ABILITY_PANEL,
        mode: "creature",
        creature: { uuid: creatureEntry.uuid, name: "Fortune Dragon", level: 5 },
        creatureAbilities: abilities,
      },
      5
    );
    expect(html).toContain("comes across unchanged");
  });

  it("says so when the creature has nothing to copy", () => {
    const html = renderAbilityPanel(
      {
        ...EMPTY_ABILITY_PANEL,
        mode: "creature",
        creature: { uuid: creatureEntry.uuid, name: "Plain Ox", level: 1 },
        creatureAbilities: [],
      },
      5
    );
    expect(html).toContain("Plain Ox has no abilities to copy");
  });

  it("shows it is reading while the actor loads", () => {
    const html = renderAbilityPanel(
      {
        ...EMPTY_ABILITY_PANEL,
        mode: "creature",
        creature: { uuid: creatureEntry.uuid, name: "Fortune Dragon", level: 12 },
        creatureLoading: true,
      },
      5
    );
    expect(html).toContain("Reading Fortune Dragon");
  });
});

/**
 * A DC that is a formula, found by copying "Dragon Breath" onto a husk zombie
 * in a live world: the sheet rendered "DC 0 Basic Reflex", because the ability
 * resolves its DC from a character's class DC and a creature has none.
 */
describe("a DC that cannot resolve on a creature", () => {
  const src = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/ability-creature.json"), "utf8")
  ) as NPCSource;
  // Verbatim from the ability as it shipped, which is how it broke.
  const dragonBreath =
    "<p>You breathe fire. It deals 1d6 damage per level " +
    "(@Damage[(@actor.level)d6[untyped]|options:area-damage]), with a " +
    "@Check[reflex|basic|against:class-spell|options:area-effect] save.</p>";

  const session = () => {
    const s = new EditSession(src, rescaleCreature(src, 5));
    const id = s.addAbility("Dragon Breath");
    s.setAbilityField(id, "description", dragonBreath);
    return { s, id };
  };

  it("offers the DC as a field rather than hiding it", () => {
    const { s, id } = session();
    const dcs = s.abilityDCs(id);
    expect(dcs).toHaveLength(1);
    expect(dcs[0]).toMatchObject({ label: "Reflex DC", dc: null, unresolved: true, index: 1 });
    // And the bands are still offered, so it can be given a real value.
    expect(dcs[0]!.options.map((o) => o.value)).toEqual([26, 22, 19]);
  });

  it("says on screen that it renders as DC 0", () => {
    const { s, id } = session();
    const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL }, id);
    expect(html).toContain("DC 0 on a creature");
    expect(html).toContain("Give it a DC…");
  });

  it("gives it a real DC, and takes the broken reference out with it", () => {
    const { s, id } = session();
    // Index 1: the @Damage comes first in the text.
    expect(s.setAbilityDC(id, 1, 22)).toBe(true);
    const text = s.abilityText(id);
    expect(text).toContain("@Check[reflex|dc:22|basic|options:area-effect]");
    expect(text).not.toContain("against:class-spell");
    // The level-scaling damage is none of our business and stays as written.
    expect(text).toContain("@Damage[(@actor.level)d6[untyped]|options:area-damage]");
    expect(s.abilityDCs(id)[0]).toMatchObject({ dc: 22, band: "high", unresolved: false });
  });

  it("names the reference in the note, rather than calling it a formula", () => {
    const { s, id } = session();
    const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL }, id);
    expect(html).toContain("class-spell");
    expect(html).toContain("which a creature does not have");
  });

  it("still refuses to repair one automatically", () => {
    const { s, id } = session();
    // Rescaling must never invent a number where the ability had none.
    const rescaled = rescaleCreature(src, 20);
    expect(
      rescaled.abilityChanges.every((a) => a.changes.every((c) => Number.isFinite(c.from)))
    ).toBe(true);
    expect(s.abilityText(id)).toContain("against:class-spell");
    expect(s.abilityText(id)).not.toContain("dc:");
  });
});
