/**
 * Stat block rendering.
 *
 * These assert the rule the whole design rests on: a derived number never
 * appears without its band, and warnings are never dropped.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bandLabel,
  prettyPath,
  groupChanges,
  renderRescalePreview,
  renderStatBlock,
  escapeHtml,
} from "../src/foundry/statblock.js";
import { rescaleCreature } from "../src/scaling/rescale-creature.js";
import { readStatBlock, type NPCSource } from "../src/pf2e/npc.js";

const husk = () =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "fixtures/husk-zombie.json"), "utf8")
  ) as NPCSource;

describe("bandLabel", () => {
  const c = (band: string, offset: number) =>
    ({ path: "ac", from: 1, to: 2, band, offset, table: "armorClass" }) as never;

  it("shows a bare band when there is no offset", () => {
    expect(bandLabel(c("moderate", 0))).toBe("Moderate");
  });

  it("shows the offset when the chassis sat off-band", () => {
    expect(bandLabel(c("low", 2))).toBe("Low +2");
    expect(bandLabel(c("high", -1))).toBe("High -1");
  });

  it("rounds fractional offsets from damage averages", () => {
    expect(bandLabel(c("moderate", 0.5))).toBe("Moderate +0.5");
    expect(bandLabel(c("low", -2.5))).toBe("Low -2.5");
  });
});

describe("prettyPath", () => {
  it("turns paths into things a GM reads", () => {
    expect(prettyPath("ac")).toBe("AC");
    expect(prettyPath("hp")).toBe("HP");
    expect(prettyPath("saves.fortitude")).toBe("Fortitude save");
    expect(prettyPath("abilities.str")).toBe("STR");
    expect(prettyPath("skills.athletics")).toBe("Athletics");
    expect(prettyPath("strikes.Fist.attack")).toBe("Fist attack");
    expect(prettyPath("strikes.Fist.damage")).toBe("Fist damage");
    expect(prettyPath("spellcasting.Arcane Prepared Spells.dc"))
      .toBe("Arcane Prepared Spells DC");
  });
});

describe("groupChanges", () => {
  const result = rescaleCreature(husk(), 5);

  it("sorts statistics into readable sections", () => {
    const titles = groupChanges(result.changes).map((s) => s.title);
    expect(titles).toContain("Defences");
    expect(titles).toContain("Strikes");
    expect(titles).toContain("Attributes");
  });

  it("drops empty sections", () => {
    // The husk has no spellcasting, so that section must not appear.
    expect(groupChanges(result.changes).map((s) => s.title))
      .not.toContain("Spellcasting");
  });

  it("accounts for every change", () => {
    const grouped = groupChanges(result.changes).flatMap((s) => s.rows);
    expect(grouped).toHaveLength(result.changes.length);
  });
});

describe("renderRescalePreview", () => {
  const html = renderRescalePreview(rescaleCreature(husk(), 5));

  it("shows the level transition", () => {
    expect(html).toContain("Husk Zombie");
    expect(html).toMatch(/Creature.*2[\s\S]*5/);
  });

  it("shows both the old and new value for a statistic", () => {
    expect(html).toContain(">17<");
    expect(html).toContain(">21<");
  });

  /** The core rule: never a number without its band. */
  it("attaches a band chip to every statistic", () => {
    const rows = html.match(/<tr class="(changed|unchanged)">/g) ?? [];
    const chips = html.match(/<span class="band /g) ?? [];
    expect(chips.length).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(10);
  });

  it("surfaces the HP warning rather than dropping it", () => {
    expect(html).toContain("vitality 5");
    expect(html).toContain("class=\"warning\"");
  });

  it("places warnings before the statistics, not after", () => {
    expect(html.indexOf("class=\"warnings\"")).toBeLessThan(
      html.indexOf("class=\"stat-section\"")
    );
  });

  it("escapes names rather than injecting them raw", () => {
    const src = husk();
    src.name = '<img src=x onerror="alert(1)">';
    const out = renderRescalePreview(rescaleCreature(src, 5));
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });
});

describe("renderStatBlock", () => {
  const html = renderStatBlock(readStatBlock(husk()));

  it("shows defences and abilities", () => {
    expect(html).toContain("AC");
    expect(html).toContain("17");
    expect(html).toContain("STR");
  });

  it("lists strikes with their damage", () => {
    expect(html).toContain("Shortsword");
    expect(html).toContain("1d6+4 piercing");
  });

  it("shows weaknesses, which drive the HP decision", () => {
    expect(html).toContain("vitality 5");
  });
});

describe("escapeHtml", () => {
  it("neutralises markup", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&#39;");
  });
});
