/**
 * Editor markup.
 *
 * The rule these enforce is the same one the renderer exists for: a number the
 * user can change is never shown without the band it currently sits in, and the
 * value the rescale produced is never thrown away. Both are easy to break by
 * accident while rearranging markup, and neither is visible in a unit test of
 * the model alone.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bandSelect,
  fieldBandLabel,
  fieldChip,
  renderDefenceBlock,
  renderEditor,
  renderWarnings,
  revertButton,
} from "../src/foundry/editor-view.js";
import { EditSession } from "../src/editor/edit-session.js";
import { rescaleCreature } from "../src/scaling/rescale-creature.js";
import type { NPCSource } from "../src/pf2e/npc.js";

const load = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, `fixtures/${name}.json`), "utf8")
  ) as NPCSource;

const session = (fixture = "husk-zombie", level = 5) => {
  const src = load(fixture);
  return new EditSession(src, rescaleCreature(src, level));
};

describe("band labels", () => {
  it("spells out the offset, because that is the deliberate part", () => {
    const s = session();
    expect(fieldBandLabel(s.field("ac")!)).toBe("Moderate");
    expect(fieldBandLabel(s.field("hp")!)).toBe("High +19");
    expect(fieldBandLabel(s.field("abilities.int")!)).toBe("Low -2");
  });

  it("shows a dash rather than inventing a band for a rider", () => {
    const s = session();
    s.set("strikes.Fist.damage.0", "not a formula");
    expect(fieldBandLabel(s.field("strikes.Fist.damage.0")!)).toBe("—");
    expect(fieldChip(s.field("strikes.Fist.damage.0")!)).toContain("band none");
  });
});

describe("rows", () => {
  it("gives every editable statistic an input and a chip", () => {
    const s = session();
    const html = renderEditor(s);
    for (const path of s.paths()) {
      expect(html, `input for ${path}`).toContain(`data-path="${path}"`);
    }
    // One chip per row, and every row has one.
    const rows = html.match(/class="edit-row/g)?.length ?? 0;
    const chips = html.match(/class="band /g)?.length ?? 0;
    const dashes = html.match(/class="band none"/g)?.length ?? 0;
    expect(rows).toBe(s.paths().length);
    expect(chips + dashes).toBe(rows);
  });

  it("offers the band's own figure in the dropdown, and its span where there is one", () => {
    const s = session();
    const hp = bandSelect(s.field("hp")!);
    expect(hp).toContain(">Moderate 72 (72–78)<");
    expect(hp).toContain(">High 91 (91–97)<");

    const ac = bandSelect(s.field("ac")!);
    expect(ac).toContain(">High 22<");
    expect(ac).not.toContain("(");
  });

  it("selects the option that matches the value, and nothing when it is off band", () => {
    const s = session();
    // AC 21 is exactly L5 moderate, so that option is the selected one.
    expect(bandSelect(s.field("ac")!)).toContain('value="moderate" selected');
    // HP 110 is High +19 - no band produces it, so the placeholder stands.
    const hp = bandSelect(s.field("hp")!);
    expect(hp).toContain("Set band…</option>");
    expect(hp).toMatch(/<option value="" disabled selected>/);
    expect(hp).not.toContain('value="high" selected');
  });

  it("keeps the rescaled value as the way back to it", () => {
    const s = session();
    expect(revertButton(s.field("hp")!)).toBe("");
    s.set("hp", 75);
    const button = revertButton(s.field("hp")!);
    expect(button).toContain("was 110");
    expect(button).toContain('data-path="hp"');
    expect(renderEditor(s)).toContain("edit-row dirty");
  });

  it("labels a damage rider as one instead of banding it", () => {
    const s = session();
    s.set("strikes.Fist.damage.0", "1");
    const html = renderEditor(s);
    expect(html).toContain("Flat damage");
  });
});

describe("Hit Points and weaknesses", () => {
  it("puts the weakness block inside Defences, where HP is", () => {
    const html = renderEditor(session());
    const defences = html.slice(html.indexOf('data-section="Defences"'));
    const nextSection = defences.indexOf('data-section="Perception');
    const block = defences.slice(0, nextSection > 0 ? nextSection : undefined);
    expect(block).toContain("Weaknesses &amp; resistances");
    expect(block).toContain('data-defence="weakness:vitality"');
    expect(block).toContain('data-path="hp"');
  });

  it("says why they are one decision", () => {
    expect(renderDefenceBlock(session().defenceRows())).toContain(
      "trades weaknesses and resistances against Hit Points"
    );
  });

  it("keeps a removed weakness on screen, struck through and restorable", () => {
    const s = session();
    s.setDefence("weakness", "slashing", null);
    const html = renderDefenceBlock(s.defenceRows());
    expect(html).toContain("defence-row removed");
    expect(html).toContain("Restore 5");
  });

  it("says so plainly when there is nothing to trade", () => {
    expect(renderDefenceBlock([])).toContain("no weaknesses or resistances");
  });
});

describe("warnings", () => {
  it("renders the HP warning where it cannot be missed", () => {
    const html = renderWarnings(session());
    expect(html).toContain('data-warning-path="hp"');
    expect(html).not.toContain("hidden");
  });

  it("keeps the container when there is nothing to say, so it can be updated", () => {
    const s = session();
    s.setDefence("weakness", "vitality", null);
    s.setDefence("weakness", "slashing", null);
    s.setBand("hp", "moderate");
    const html = renderWarnings(s);
    expect(html).toContain("warnings hidden");
    expect(html).not.toContain("<p class=\"warning\"");
  });
});

describe("the header", () => {
  it("leads with the name, because renaming is the point", () => {
    const html = renderEditor(session());
    expect(html.indexOf("creature-name")).toBeLessThan(html.indexOf("edit-row"));
    expect(html).toContain("Creature 2 → 5");
  });

  it("says plainly when nothing is being rescaled", () => {
    expect(renderEditor(session("husk-zombie", 2))).toContain("unmodified copy");
  });

  it("escapes a creature name rather than trusting it", () => {
    const s = session();
    s.rename('<script>alert("x")</script>');
    expect(renderEditor(s)).not.toContain("<script>");
  });
});
