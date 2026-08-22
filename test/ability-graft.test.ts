/**
 * Abilities on a rescaled creature: its own, and grafted ones.
 *
 * The fixture is assembled for the test, but every piece of ability text in it
 * is real syntax lifted from the harvest — nested `@Damage[6d6[poison]]`, a
 * `basic` save, a flat check, and an `evil` trait of the kind the AP bestiaries
 * still carry and PF2e 8.x refuses.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rescaleCreature, summarise } from "../src/scaling/rescale-creature.js";
import { EditSession } from "../src/editor/edit-session.js";
import { graftAbility, readAbility, actionCostLabel } from "../src/pf2e/ability.js";
import type { NPCSource } from "../src/pf2e/npc.js";

const load = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, `fixtures/${name}.json`), "utf8")
  ) as NPCSource;

const bogElder = () => load("ability-creature");
const abilityNamed = (actor: NPCSource, name: string) =>
  (actor.items ?? []).find((i) => i["name"] === name)!;
const textOf = (actor: NPCSource, name: string) =>
  String(abilityNamed(actor, name)["system"].description.value);

describe("reading an ability", () => {
  const items = bogElder().items ?? [];

  it("reads action cost, category and traits", () => {
    const breath = readAbility(items.find((i) => i["name"] === "Breath of the Bog")!);
    expect(breath).toMatchObject({
      name: "Breath of the Bog",
      actionType: "action",
      actions: 2,
      category: "offensive",
    });
    expect(breath.traits).toContain("poison");
  });

  /** 226 of 400 sampled abilities are passive — this is the common case. */
  it("treats a passive ability as normal, not as a broken action", () => {
    const rot = readAbility(items.find((i) => i["name"] === "Bog Rot")!);
    expect(rot).toMatchObject({ actionType: "passive", actions: null });
    expect(actionCostLabel(rot)).toBe("passive");
  });

  it("labels each action cost the way a sheet reads it", () => {
    const breath = readAbility(items.find((i) => i["name"] === "Breath of the Bog")!);
    expect(actionCostLabel(breath)).toBe("2 actions");
  });
});

describe("a creature's own abilities scale with it", () => {
  const result = rescaleCreature(bogElder(), 5);

  it("moves the save DCs written into ability text", () => {
    // Level 9 High DC is 28; level 5 High is 22.
    expect(textOf(result.actor, "Breath of the Bog")).toContain("@Check[fortitude|dc:22|basic]");
    // Bog Rot's 21 is Moderate -4 at level 9, so Moderate -4 at level 5 = 15.
    expect(textOf(result.actor, "Bog Rot")).toContain("dc:15");
  });

  it("reports each one with the band it came from", () => {
    const breath = result.abilityChanges.find((a) => a.itemName === "Breath of the Bog")!;
    expect(breath.changes[0]).toMatchObject({
      label: "Fortitude DC",
      from: 28,
      to: 22,
      band: "high",
      offset: 0,
    });
  });

  it("leaves the flat check and the damage alone, and says so", () => {
    expect(textOf(result.actor, "Breath of the Bog")).toContain("@Check[flat|dc:11]");
    expect(textOf(result.actor, "Breath of the Bog")).toContain("@Damage[6d6[poison]]");

    const breath = result.abilityChanges.find((a) => a.itemName === "Breath of the Bog")!;
    expect(breath.notes.map((n) => n.reason).sort()).toEqual(["damage", "flat-check"]);
  });

  it("says nothing at all about an ability with no numbers", () => {
    expect(result.abilityChanges.some((a) => a.itemName === "Silent Stalker")).toBe(false);
  });

  it("leaves the prose untouched", () => {
    expect(textOf(result.actor, "Breath of the Bog")).toContain("The bog elder breathes out.");
    expect(textOf(result.actor, "Breath of the Bog")).toContain("@Template[cone|distance:30]");
  });

  it("mentions the ability changes in the summary", () => {
    const text = summarise(result);
    expect(text).toContain("Breath of the Bog Fortitude DC");
  });
});

describe("grafting an ability", () => {
  const source = () => abilityNamed(bogElder(), "Breath of the Bog");

  it("rescales the DC for the creature it is landing on", () => {
    const { item, report } = graftAbility(source(), { fromLevel: 9, toLevel: 5 });
    expect(String(item["system"].description.value)).toContain("dc:22");
    expect(report.changes[0]).toMatchObject({ from: 28, to: 22, band: "high" });
  });

  /**
   * Without this the create fails: PF2e 8.x rejects `evil`, and the AP
   * bestiaries are full of abilities still carrying it.
   */
  it("strips a trait the current system refuses, and says which", () => {
    const { item, report } = graftAbility(source(), { fromLevel: 9, toLevel: 9 });
    expect(item["system"].traits.value).not.toContain("evil");
    expect(item["system"].traits.value).toContain("poison");
    expect(report.removedTraits).toEqual(["evil"]);
  });

  it("drops the id so it cannot collide with something already there", () => {
    const { item } = graftAbility(source(), { fromLevel: 9, toLevel: 5 });
    expect(item["_id"]).toBeUndefined();
  });

  it("records where it came from", () => {
    const uuid = "Compendium.pf2e.book-of-the-dead-bestiary.Actor.abc.Item.def";
    const { item } = graftAbility(source(), { fromLevel: 9, toLevel: 5, sourceUuid: uuid });
    expect(item["_stats"].compendiumSource).toBe(uuid);
  });

  it("can rename on the way in", () => {
    const { item, report } = graftAbility(source(), {
      fromLevel: 9, toLevel: 5, name: "Breath of Occam",
    });
    expect(item["name"]).toBe("Breath of Occam");
    expect(report.name).toBe("Breath of Occam");
  });

  it("never mutates the ability it copied", () => {
    const original = source();
    const before = JSON.stringify(original);
    graftAbility(original, { fromLevel: 9, toLevel: 1, name: "Something Else" });
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe("abilities in the editor", () => {
  const session = () => {
    const src = bogElder();
    return new EditSession(src, rescaleCreature(src, 5));
  };

  it("lists the creature's own abilities", () => {
    const rows = session().abilityRows();
    expect(rows.map((r) => r.ability.name)).toEqual([
      "Breath of the Bog",
      "Bog Rot",
      "Silent Stalker",
    ]);
    expect(rows.every((r) => r.origin === "chassis")).toBe(true);
  });

  /**
   * The session works from the rescaled actor, not the raw chassis. If it went
   * back to the chassis, applying stat edits would silently restore the level 9
   * DCs into a level 5 creature's abilities.
   */
  it("keeps the rescaled ability text when a statistic is edited", () => {
    const s = session();
    s.set("ac", 30);
    expect(textOf(s.toActorSource(), "Breath of the Bog")).toContain("dc:22");
  });

  it("attaches an ability and reports what happened to it", () => {
    const s = session();
    const report = s.graft(abilityNamed(bogElder(), "Breath of the Bog"), {
      fromLevel: 9,
      name: "Second Breath",
    });

    expect(report.changes[0]).toMatchObject({ to: 22 });
    expect(report.removedTraits).toEqual(["evil"]);

    const rows = s.abilityRows();
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ origin: "grafted", removed: false });
    expect(rows[3]!.ability.name).toBe("Second Breath");
  });

  it("writes grafted abilities onto the created actor", () => {
    const s = session();
    s.graft(abilityNamed(bogElder(), "Bog Rot"), { fromLevel: 9, name: "Worse Rot" });
    const actor = s.toActorSource();
    expect((actor.items ?? []).filter((i) => i["type"] === "action")).toHaveLength(4);
    expect(abilityNamed(actor, "Worse Rot")).toBeDefined();
  });

  it("removes one of the creature's own abilities, reversibly", () => {
    const s = session();
    s.setAbilityRemoved("bogrot0000000001", true);
    expect(s.abilityRows().find((r) => r.ability.id === "bogrot0000000001")!.removed).toBe(true);
    expect(abilityNamed(s.toActorSource(), "Bog Rot")).toBeUndefined();

    s.setAbilityRemoved("bogrot0000000001", false);
    expect(abilityNamed(s.toActorSource(), "Bog Rot")).toBeDefined();
  });

  it("counts ability edits as edits", () => {
    const s = session();
    expect(s.isDirty).toBe(false);
    s.graft(abilityNamed(bogElder(), "Bog Rot"), { fromLevel: 9 });
    expect(s.isDirty).toBe(true);
    expect(s.summarise()).toContain("grafted Bog Rot");
  });

  it("reverts abilities along with everything else", () => {
    const s = session();
    s.graft(abilityNamed(bogElder(), "Bog Rot"), { fromLevel: 9 });
    s.setAbilityRemoved("silentstalker001", true);
    s.set("ac", 30);

    s.resetAll();
    expect(s.isDirty).toBe(false);
    expect(s.abilityRows()).toHaveLength(3);
    expect(s.graftedCount).toBe(0);
  });

  it("drops a grafted ability without touching the creature's own", () => {
    const s = session();
    s.graft(abilityNamed(bogElder(), "Bog Rot"), { fromLevel: 9, name: "Extra" });
    expect(s.ungraft(0)).toBe(true);
    expect(s.ungraft(5)).toBe(false);
    expect(s.abilityRows().map((r) => r.ability.name)).toEqual([
      "Breath of the Bog",
      "Bog Rot",
      "Silent Stalker",
    ]);
  });
});
