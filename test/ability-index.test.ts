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
  buildEmbeddedAbilityIndex,
  collapseByName,
  toEmbeddedAbilityEntry,
  EMBEDDED_INDEX_FIELDS,
  type AbilityEntry,
} from "../src/foundry/ability-index.js";
import {
  EMPTY_ABILITY_PANEL,
  renderAbilities,
  renderAbilityPanel,
} from "../src/foundry/editor-view.js";
import { areaColumnFor, EditSession } from "../src/editor/edit-session.js";
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
 * Area damage, and the one table that has anything to say about it.
 *
 * Ability damage is not rescaled and should not be: measured across 799 area
 * abilities, Table 2-12 is right only 30.5% of the time — three times better
 * than the Strike table, and nowhere near good enough to move a number on
 * someone's behalf. What it *is* good enough for is an offer. So an area term
 * carries both of Table 2-12's columns as choices, and everything else carries
 * the reason it has none.
 *
 * Every string here is real PF2e syntax taken from the bestiary sample that the
 * parameter parsing was built against.
 */
describe("area damage", () => {
  const src = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/ability-creature.json"), "utf8")
  ) as NPCSource;

  /** Level 5: Table 2-12 reads "2d10 (12)" unlimited, "6d6 (21)" limited. */
  const withText = (text: string) => {
    const s = new EditSession(src, rescaleCreature(src, 5));
    const id = s.addAbility("Spore Cloud");
    s.setAbilityField(id, "description", text);
    return { s, id };
  };

  it("offers both of Table 2-12's columns for an area term", () => {
    const { s, id } = withText("<p>@Damage[7d8[poison]|options:area-damage]</p>");
    const fields = s.abilityDamage(id);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ expr: "7d8", damageType: "poison", isArea: true, note: null });
    expect(fields[0]!.options.map((o) => o.key)).toEqual(["unlimited use", "limited use"]);
    expect(fields[0]!.options.map((o) => o.average)).toEqual([12, 21]);
  });

  /**
   * The Bog Elder's own breath is @Damage[6d6[poison]] with no parameter, and
   * that is the ordinary case. It is still listed — with the reason — because
   * "considered and left alone" must not look like "not noticed".
   */
  it("offers nothing for damage that is not marked as area, and says why", () => {
    const s = new EditSession(src, rescaleCreature(src, 5));
    const fields = s.abilityDamage("own:breathofthebog01");

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ expr: "6d6", isArea: false });
    expect(fields[0]!.options).toEqual([]);
    expect(fields[0]!.note).toContain("Not marked as area damage");
  });

  it("rewrites only the chosen term, keeping the parameter and the label", () => {
    const { s, id } = withText(
      "<p>Spores burst: @Damage[7d8[poison]|options:area-damage]{Spore Explosion} " +
        "and @Damage[1d6[fire]] splash.</p>"
    );
    const limited = s.abilityDamage(id)[0]!.options[1]!;
    expect(s.setAbilityDamage(id, 0, 0, limited.expr)).toBe(true);

    const text = s.abilityText(id);
    expect(text).toContain("@Damage[4d8+3[poison]|options:area-damage]{Spore Explosion}");
    // Everything else is byte for byte what it was.
    expect(text).toContain("Spores burst:");
    expect(text).toContain("@Damage[1d6[fire]] splash.");
  });

  /**
   * The lesson from 6.1, applied before it could happen twice: the dropdown
   * advertised Table 2-10's own dice while the override preserved the chassis's
   * die size, so it promised 2d4+6 and delivered 2d6+4. The option here is
   * built through the same re-expression the write uses, so a d8 ability offered
   * the level's "6d6 (21)" both reads and writes as a d8.
   */
  it("keeps the ability's die size when the table's figure uses another", () => {
    const { s, id } = withText("<p>@Damage[7d8[poison]|options:area-damage]</p>");
    const options = s.abilityDamage(id)[0]!.options;

    expect(options.map((o) => o.expr)).toEqual(["2d8+3", "4d8+3"]);
    s.setAbilityDamage(id, 0, 0, options[0]!.expr);
    expect(s.abilityText(id)).toContain("@Damage[2d8+3[poison]|options:area-damage]");
  });

  it("leaves a flat area amount alone", () => {
    const { s, id } = withText("<p>@Damage[20[force]|options:area-damage]</p>");
    const field = s.abilityDamage(id)[0]!;

    expect(field).toMatchObject({ expr: "20", isArea: true, average: 20 });
    expect(field.options).toEqual([]);
    expect(field.note).toContain("Flat amount");
  });

  /**
   * Dragon Breath, verified live on a level 5 creature: the sheet renders it as
   * 5d6, because `@actor.level` resolves at roll time. It is not a formula this
   * module can do arithmetic on, and it is also not broken - it already tracks
   * level, so offering it a fixed Table 2-12 figure would be a downgrade. The
   * note has to say which of those two things is true.
   */
  it("says a self-scaling formula scales, rather than calling it unreadable", () => {
    const { s, id } = withText(
      "<p>@Damage[(@actor.level)d6[untyped]|options:area-damage]</p>"
    );
    const field = s.abilityDamage(id)[0]!;

    expect(field.average).toBeNull();
    expect(field.options).toEqual([]);
    expect(field.note).toContain("already scales");
    expect(field.note).not.toContain("cannot read");
  });

  it("still says so plainly when a formula really is unreadable", () => {
    const { s, id } = withText("<p>@Damage[lots[poison]|options:area-damage]</p>");
    const field = s.abilityDamage(id)[0]!;

    expect(field.options).toEqual([]);
    expect(field.note).toContain("Not a formula this module can read");
  });

  it("lists each term of a multi-term element separately", () => {
    const { s, id } = withText(
      "<p>@Damage[2d4[piercing],2d8[electricity]|options:area-damage]</p>"
    );
    const fields = s.abilityDamage(id);

    expect(fields.map((f) => [f.index, f.termIndex, f.expr])).toEqual([
      [0, 0, "2d4"],
      [0, 1, "2d8"],
    ]);
    // The second term is rewritten without disturbing the first.
    expect(s.setAbilityDamage(id, 0, 1, fields[1]!.options[0]!.expr)).toBe(true);
    expect(s.abilityText(id)).toContain(
      "@Damage[2d4[piercing],2d8+3[electricity]|options:area-damage]"
    );
  });

  it("refuses an expression it cannot read rather than writing it", () => {
    const { s, id } = withText("<p>@Damage[7d8[poison]|options:area-damage]</p>");
    expect(s.setAbilityDamage(id, 0, 0, "banana")).toBe(false);
    expect(s.setAbilityDamage(id, 0, 0, "")).toBe(false);
    // The index has to be a damage element, not just any inline.
    expect(s.setAbilityDamage(id, 9, 0, "2d8")).toBe(false);
    expect(s.setAbilityDamage(id, 0, 9, "2d8")).toBe(false);
    expect(s.abilityText(id)).toContain("@Damage[7d8[poison]|options:area-damage]");
  });

  /**
   * Labelled by column, not by band. Table 2-12's two columns are a frequency
   * scale, not a quality one, and which applies depends on the ability's
   * Frequency — which nothing in a PF2e action item records. Calling them
   * "High" and "Moderate" would invent a judgement the table does not make.
   */
  it("renders the two columns named by frequency", () => {
    const { s, id } = withText("<p>@Damage[7d8[poison]|options:area-damage]</p>");
    const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL }, id);

    expect(html).toContain("ability-damage-area");
    expect(html).toContain("Unlimited use — 2d8+3 (12)");
    expect(html).toContain("Limited use — 4d8+3 (21)");
    expect(html).toContain("Poison damage");
  });

  /**
   * The frequency rule, and the rule that was expected and did not survive.
   *
   * Measured across 875 area terms on 2,131 published creatures. `round` is
   * decisive (5.4% nearer Limited, 0% exact on it); `day` is not (37.5% nearer
   * Limited, *below* the 46.6% of abilities with no frequency at all). The
   * second of those is the one worth a test: it is the rule anyone would write
   * from intuition, and Paizo's numbers do not support it.
   */
  describe("what an ability's own markers argue for", () => {
    /** Verbatim from a black dragon's Breath Weapon in a live world. */
    const breath =
      "<p>The dragon breathes a spray of acid that deals " +
      "@Damage[12d6[acid]|options:area-damage] damage in an 80-foot line " +
      "(@Check[reflex|dc:22|basic] save).</p><p>It can't use Breath Weapon " +
      "again for @Damage[1d4]{1d4} rounds.</p>";
    const plain = "<p>The bog elder breathes out. Each creature must save.</p>";

    it("reads a once-per-round frequency as unlimited use", () => {
      expect(areaColumnFor({ per: "round" }, plain)?.key).toBe("unlimited use");
    });

    /**
     * The opposite direction from `per: "round"`, and the whole reason the
     * "a recharge is at-will" explanation had to go: 77.0% of these sit nearer
     * Limited Use, against that group's 5.4%.
     */
    it("reads a recharge written in prose as limited use", () => {
      expect(areaColumnFor(null, breath)?.key).toBe("limited use");
    });

    it("reads the prose recharge however the book spells the apostrophe", () => {
      for (const variant of ["can't", "can\u2019t", "can&#39;t", "can&rsquo;t"]) {
        const text = `<p>It ${variant} use Breath Weapon again for 1d4 rounds.</p>`;
        expect(areaColumnFor(null, text)?.key).toBe("limited use");
      }
    });

    it("declines to read once-per-day as limited use", () => {
      expect(areaColumnFor({ per: "day" }, plain)).toBeNull();
    });

    it("declines on the clock-based limits, which are too rare to call", () => {
      expect(areaColumnFor({ per: "PT1H" }, plain)).toBeNull();
      expect(areaColumnFor({ per: "PT10M" }, plain)).toBeNull();
    });

    /**
     * The 77% was measured only on abilities carrying no frequency field at
     * all - anything with one went into its own bucket. Reading the prose on
     * an ability that also has a frequency would apply a figure to rows it was
     * never measured over.
     */
    it("ignores the prose when the ability also carries a frequency field", () => {
      expect(areaColumnFor({ per: "day" }, breath)).toBeNull();
      expect(areaColumnFor({ per: "PT1H" }, breath)).toBeNull();
    });

    it("declines when there is no marker of either kind", () => {
      expect(areaColumnFor(null, plain)).toBeNull();
      expect(areaColumnFor({ per: null }, plain)).toBeNull();
    });
  });

  describe("suggesting a column in the editor", () => {
    const grafted = (per: string | null) => {
      const s = new EditSession(src, rescaleCreature(src, 5));
      const index = s.graftedCount;
      s.graft(
        {
          name: "Spore Burst",
          type: "action",
          system: {
            actionType: { value: "action" },
            actions: { value: 2 },
            traits: { value: [] },
            description: { value: "<p>@Damage[7d8[poison]|options:area-damage]</p>" },
            ...(per === null ? {} : { frequency: { value: 0, max: 1, per } }),
          },
        },
        { fromLevel: 5 }
      );
      return { s, id: `graft:${index}` };
    };

    it("suggests unlimited use for a once-per-round ability, with the evidence", () => {
      const { s, id } = grafted("round");
      const field = s.abilityDamage(id)[0]!;

      expect(field.suggested).toBe("unlimited use");
      expect(field.suggestion).toContain("Fires once per round");
      expect(field.suggestion).toContain("129");
      expect(field.suggestion).toContain("nothing changes until you pick it");
    });

    it("suggests nothing for once-per-day, or for no marker at all", () => {
      expect(grafted("day").s.abilityDamage("graft:0")[0]!.suggested).toBeNull();
      expect(grafted(null).s.abilityDamage("graft:0")[0]!.suggested).toBeNull();
    });

    /**
     * The case that started this: a black dragon's Breath Weapon, which has no
     * `system.frequency` at all and says so in prose instead. Before the prose
     * rule the editor was silent on the single most obvious area ability in the
     * game.
     */
    it("suggests limited use for a breath weapon that recharges in its text", () => {
      const s = new EditSession(src, rescaleCreature(src, 5));
      const index = s.graftedCount;
      s.graft(
        {
          name: "Breath Weapon",
          type: "action",
          system: {
            actionType: { value: "action" },
            actions: { value: 2 },
            traits: { value: ["acid", "arcane"] },
            description: {
              value:
                "<p>The dragon breathes acid, dealing " +
                "@Damage[7d8[acid]|options:area-damage] damage.</p>" +
                "<p>It can't use Breath Weapon again for 1d4 rounds.</p>",
            },
          },
        },
        { fromLevel: 5 }
      );
      const field = s.abilityDamage(`graft:${index}`)[0]!;

      expect(field.suggested).toBe("limited use");
      expect(field.suggestion).toContain("Recharges in its text");
      expect(field.suggestion).toContain("283");
      // Suggested, not applied: the damage is exactly as it was written.
      expect(field.expr).toBe("7d8");
    });

    /**
     * The point of the whole no-silent-adjustment rule, applied to a dropdown:
     * a suggestion that looked like a selection would be claiming the damage
     * had changed when it had not.
     */
    it("does not touch the damage it suggests a figure for", () => {
      const { s, id } = grafted("round");
      expect(s.abilityDamage(id)[0]!.expr).toBe("7d8");
      expect(s.abilityText(id)).toContain("@Damage[7d8[poison]|options:area-damage]");
    });

    it("renders the suggestion as a suggestion, not as the current value", () => {
      const { s, id } = grafted("round");
      const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL }, id);

      expect(html).toContain("Suggested: Unlimited use — 2d8+3 (12)");
      expect(html).toContain("· suggested");
      expect(html).toContain("suggesting");
      expect(html).toContain("Fires once per round");
      // The real option is still there to be chosen, unselected.
      expect(html).toContain(">Unlimited use — 2d8+3 (12) · suggested</option>");
    });

    it("drops the suggestion once a figure has actually been picked", () => {
      const { s, id } = grafted("round");
      const option = s.abilityDamage(id)[0]!.options[0]!;
      expect(s.setAbilityDamage(id, 0, 0, option.expr)).toBe(true);

      const html = renderAbilities(s, { ...EMPTY_ABILITY_PANEL }, id);
      expect(html).not.toContain("Suggested:");
      expect(html).not.toContain("Fires once per round");
      expect(s.abilityText(id)).toContain("@Damage[2d8+3[poison]|options:area-damage]");
    });
  });

  it("tells an area ability that a table applies, and other damage that none does", () => {
    const { s, id } = withText("<p>@Damage[7d8[poison]|options:area-damage]</p>");
    expect(s.abilityNotes(id)[0]!.detail).toContain("Table 2-12");
    expect(s.abilityNotes(id)[0]!.detail).toContain("Frequency");

    const plain = withText("<p>@Damage[7d8[poison]]</p>");
    expect(plain.s.abilityNotes(plain.id)[0]!.detail).toContain("No published table governs");
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

/**
 * Abilities embedded in creatures.
 *
 * The pool `ability-index.ts` used to describe as unreachable. Measured on a
 * real install at 33,268 abilities across 7,894 creatures in 2.0s, because
 * `getIndex({fields:["items"]})` returns embedded items outright — see
 * tools/probe-embedded-index.js.
 */
describe("embedded ability index", () => {
  const bestiary = {
    collection: "pf2e.pathfinder-monster-core",
    id: "pathfinder-monster-core",
    label: "Pathfinder Monster Core",
    type: "Actor",
    packageType: "system",
    packageName: "pf2e",
  };

  const actor = (name: string, level: number | null, items: unknown[]) => ({
    _id: name.replace(/\W/g, "").slice(0, 16),
    name,
    type: "npc",
    ...(level === null ? {} : { system: { details: { level: { value: level } } } }),
    items,
  });

  const grab = (over: Record<string, unknown> = {}) => ({
    _id: "grabitem00000001",
    name: "Grab",
    type: "action",
    system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: ["attack"] } },
    ...over,
  });

  it("builds a uuid that addresses the item on its actor", () => {
    const e = toEmbeddedAbilityEntry(bestiary, actor("Bog Dragon", 11, []) as any, grab());
    expect(e?.uuid).toBe("Compendium.pf2e.pathfinder-monster-core.Actor.BogDragon.Item.grabitem00000001");
    expect(e?.creature).toEqual({
      uuid: "Compendium.pf2e.pathfinder-monster-core.Actor.BogDragon",
      name: "Bog Dragon",
      level: 11,
    });
  });

  it("carries the creature's level, because grafting rescales from it", () => {
    expect(toEmbeddedAbilityEntry(bestiary, actor("A", 7, []) as any, grab())?.creature.level).toBe(7);
    expect(toEmbeddedAbilityEntry(bestiary, actor("B", null, []) as any, grab())?.creature.level).toBeNull();
  });

  it("refuses anything that is not an action on an Actor pack", () => {
    expect(toEmbeddedAbilityEntry(bestiary, actor("A", 1, []) as any, grab({ type: "melee" }))).toBeNull();
    expect(toEmbeddedAbilityEntry(bestiary, actor("A", 1, []) as any, grab({ name: "" }))).toBeNull();
    expect(toEmbeddedAbilityEntry({ ...bestiary, type: "Item" }, actor("A", 1, []) as any, grab())).toBeNull();
  });

  describe("collapseByName", () => {
    const at = (creature: string, level: number | null) =>
      toEmbeddedAbilityEntry(bestiary, actor(creature, level, []) as any, grab())!;

    it("keeps the instance from the creature closest to the target level", () => {
      const out = collapseByName([at("Low", 2), at("Near", 9), at("High", 20)], 10);
      expect(out).toHaveLength(1);
      expect(out[0]!.creature.name).toBe("Near");
    });

    it("counts how many creatures carried the name, rather than hiding them", () => {
      const out = collapseByName([at("A", 1), at("B", 2), at("C", 3)], 2);
      expect(out[0]!.sources).toBe(3);
    });

    it("prefers a known level to an unknown one, so the rescale is not a guess", () => {
      const out = collapseByName([at("Unknown", null), at("Known", 18)], 1);
      expect(out[0]!.creature.name).toBe("Known");
    });

    it("keeps distinct names apart", () => {
      const other = toEmbeddedAbilityEntry(
        bestiary, actor("X", 5, []) as any, grab({ _id: "b", name: "Constrict" })
      )!;
      expect(collapseByName([at("A", 5), other], 5)).toHaveLength(2);
    });
  });

  it("sweeps Actor packs and survives a broken one", async () => {
    const good = {
      collection: bestiary.collection,
      metadata: bestiary,
      getIndex: async () => ({
        contents: [actor("Bog Dragon", 11, [grab(), grab({ _id: "b", name: "Tail Lash" })])],
      }),
    };
    const broken = {
      collection: "pf2e.broken",
      metadata: { ...bestiary, collection: "pf2e.broken", id: "broken" },
      getIndex: async () => { throw new Error("pack is corrupt"); },
    };
    const items = { ...good, metadata: { ...bestiary, type: "Item" } };

    const out = await buildEmbeddedAbilityIndex([good, broken, items] as any);
    expect(out.map((e) => e.name).sort()).toEqual(["Grab", "Tail Lash"]);
  });

  it("asks the index for items and the creature's level", () => {
    expect(EMBEDDED_INDEX_FIELDS).toContain("items");
    expect(EMBEDDED_INDEX_FIELDS).toContain("system.details.level.value");
  });
});
