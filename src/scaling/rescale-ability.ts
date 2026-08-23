/**
 * Rescaling the numbers inside a grafted ability's text.
 *
 * When an ability is taken off a level 9 creature and put on a level 5 one, the
 * save DC written into its description has to move with it. This is the piece
 * that does that — and the piece that knows which numbers must NOT move.
 *
 * ## What governs an ability's save DC
 *
 * Table 2-11 (Spell DC) does — the same table as spellcasting, not a separate
 * one. Measured against 2,437 save DCs harvested from 2,131 published creatures
 * (`tools/probe-ability-numbers.js`, PF2e 8.4.0):
 *
 *   - **70.0% sit exactly on one of the table's three DC columns**, 95.9%
 *     within 1, 98.6% within 2.
 *   - The distribution across the three columns is High 1,529 / Moderate 822 /
 *     Extreme 79 — High is the ordinary case, not the exception.
 *   - It holds per save: Fortitude 66.8% exact, Reflex 75.3%, Will 68.7%.
 *
 * So a grafted save DC is classified and re-emitted exactly like a spellcasting
 * DC, through the same table, carrying its offset across.
 *
 * ## What must not move
 *
 * **Flat checks.** A flat check is a fixed probability, not a difficulty. Only
 * 0.8% of the 125 in the sample land on a table column, and the DCs used are
 * the familiar fixed values — DC 5 (35 uses), DC 11 (23), DC 15 (34). The proof
 * they are level-independent is that the *same* DC recurs across the whole
 * level range: DC 5 appears on creatures at 15 different levels, DC 11 at 14,
 * DC 15 at 15. Scaling one would change what the ability does.
 *
 * **Skill DCs.** `@Check[athletics|dc:24]` and friends fit the table far worse
 * — 20.2% exact across 109 samples, and Medicine only 12.5%. That is not good
 * enough to move a number on someone's behalf, so they are reported and left
 * for the user.
 *
 * **Damage.** Ability `@Damage` is never rescaled automatically, but the reason
 * is narrower than it once was. Ability damage covers headline area damage,
 * small riders, persistent damage and healing all at once — and area abilities
 * mark themselves, via `options:area-damage`. Re-measured on all 799 of them
 * (the first pass ran on 81; the parser was dropping the rest), area damage
 * lands on one of Table 2-12's two columns 30.5% of the time against 10.5% for
 * the Strike table. That is decisive about which table is relevant and useless
 * as an automatic rule, because which of the two columns applies depends on the
 * ability's Frequency, which nothing in the item records.
 *
 * So: still nothing moves on its own, but for area damage the editor offers
 * both Table 2-12 figures for the target level as explicit, labelled choices
 * (`areaDamageAt` below). Everything else is surfaced, explained, left alone.
 *
 * No Foundry dependency: pure text in, pure text out.
 */

import { classify, reemit, type Band } from "./bands.js";
import { rowFor, parseCellOrNull, threshold } from "./bands.js";
import {
  findInlines,
  isAreaDamage,
  withDC,
  type Inline,
  type InlineCheck,
} from "../pf2e/inline.js";
import { mapInlines } from "../pf2e/inline.js";

/** The three saves whose DCs Table 2-11 demonstrably governs. */
export const SCALED_CHECK_TYPES: ReadonlySet<string> = new Set([
  "fortitude",
  "reflex",
  "will",
]);

export interface AbilityChange {
  kind: "check";
  /** "Fortitude DC", for display. */
  label: string;
  from: number;
  to: number;
  band: Band;
  offset: number;
}

export interface AbilityNote {
  /** Why a number in this ability was left exactly as it was. */
  reason:
    | "flat-check"
    | "skill-check"
    | "damage"
    | "legacy-roll"
    | "unresolved-dc"
    | "unreadable";
  detail: string;
}

/** Keep a formula readable in a note without letting it break the markup. */
const escapeInner = (inner: string) =>
  inner.length > 60 ? `${inner.slice(0, 57)}...` : inner;

export interface AbilityRescaleResult {
  /** The description, with governed DCs rewritten and nothing else touched. */
  html: string;
  changes: AbilityChange[];
  /** Everything deliberately left alone, with the reason. Never silent. */
  notes: AbilityNote[];
}

/** Project Table 2-11's paired columns down to plain band keys. */
function dcRow(level: number): Record<string, number | string> {
  const raw = rowFor("spellDC", level);
  const row: Record<string, number | string> = {};
  for (const band of ["extreme", "high", "moderate"] as const) {
    const v = raw[`${band} dc`];
    if (v !== undefined) row[band] = v;
  }
  return row;
}

/** The DC a band produces at a level, for the editor's band override. */
export function abilityDCAt(level: number, band: Band): number | null {
  const raw = dcRow(level)[band];
  const cell = raw === undefined ? null : parseCellOrNull(raw);
  return cell === null ? null : Math.round(threshold(cell));
}

/**
 * Table 2-12's two columns, in the order GM Core prints them.
 *
 * Which one applies to a given ability depends on its Frequency — an at-will
 * blast is "unlimited use", a once-per-day breath weapon is "limited use" —
 * and a PF2e action item does not record its own frequency in any field the
 * module can read. So this is never inferred; both are offered and the user
 * picks.
 */
export type AreaDamageColumn = "unlimited use" | "limited use";

export const AREA_DAMAGE_COLUMNS: readonly AreaDamageColumn[] = [
  "unlimited use",
  "limited use",
];

/**
 * What Table 2-12 publishes for one column at a level: `"2d10 (12)"` read as
 * its expression and its average.
 *
 * Both halves matter to the caller. The average is the target; the expression
 * supplies the dice *count* to aim for, while the ability keeps its own die
 * size — the same rule Strike damage follows, for the same reason. Null when
 * the level is outside the table (it runs -1 to 24) rather than throwing, so a
 * field can explain itself instead of a panel failing to render.
 */
export function areaDamageAt(
  level: number,
  column: AreaDamageColumn
): { expr: string; average: number } | null {
  try {
    const raw = rowFor("areaDamage", level)[column];
    const cell = raw === undefined ? null : parseCellOrNull(raw);
    return cell?.kind === "damage" ? { expr: cell.expr, average: cell.average } : null;
  } catch {
    return null;
  }
}

/** Classify a save DC against Table 2-11, or null if the level has no row. */
export function classifyAbilityDC(
  level: number,
  dc: number
): { band: Band; offset: number } | null {
  try {
    return classify(dc, dcRow(level));
  } catch {
    return null;
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function noteFor(inline: Inline): AbilityNote | null {
  if (inline.kind === "template") return null;

  if (inline.kind === "damage") {
    const shown = inline.terms
      .map((t) => `${t.expr}${t.damageType ? ` ${t.damageType}` : ""}`)
      .join(" plus ");
    /**
     * Two different truths, and saying the general one about an area ability
     * would now be a lie of omission: Table 2-12 *is* the relevant table for
     * these, it is simply not decisive enough to apply on someone's behalf.
     */
    return {
      reason: "damage",
      detail: isAreaDamage(inline)
        ? `Left ${shown || inline.inner} unchanged. This is marked as area ` +
          `damage, so Table 2-12's two figures for this level are offered as ` +
          `choices - which one applies depends on the ability's Frequency.`
        : `Left ${shown || inline.inner} unchanged. No published table governs ` +
          `ability damage closely enough to move it for you - set it by hand if ` +
          `it should change.`,
    };
  }

  if (inline.isFlat) {
    return {
      reason: "flat-check",
      detail:
        `Left the DC ${inline.dc ?? "?"} flat check unchanged. Flat checks are ` +
        `fixed probabilities and do not scale with level.`,
    };
  }

  if (!SCALED_CHECK_TYPES.has(inline.checkType)) {
    return {
      reason: "skill-check",
      detail:
        `Left the ${inline.checkType} DC ${inline.dc ?? "?"} unchanged. Skill ` +
        `DCs in creature abilities do not follow the spell DC table reliably ` +
        `enough to rescale automatically.`,
    };
  }

  if (inline.dc === null) {
    /**
     * A DC written as a formula rather than a number. Player-facing actions do
     * this - "Dragon Breath" resolves its DC from the character's class DC -
     * and a creature has no class DC, so PF2e renders it as **DC 0** on the
     * sheet. Refusing to touch it is right; refusing quietly is not, because
     * the result is a save nobody can fail.
     */
    const source = inline.against
      ? `it takes its DC from "${inline.against}" - the owner's own class or ` +
        `spell DC - which a creature does not have`
      : `its DC is a formula rather than a number ("${escapeInner(inline.inner)}")`;

    return {
      reason: "unresolved-dc",
      detail:
        `This ${inline.checkType} save has no DC of its own: ${source}, so the ` +
        `sheet shows it as DC 0. Set a number for it below.`,
    };
  }

  return null;
}

/**
 * Rescale the DCs written into an ability's description.
 *
 * Everything that is not a governed save DC is carried through byte for byte,
 * and every such decision is reported in `notes` rather than being silent.
 */
export function rescaleAbilityText(
  html: string,
  fromLevel: number,
  toLevel: number
): AbilityRescaleResult {
  const changes: AbilityChange[] = [];
  const notes: AbilityNote[] = [];

  for (const inline of findInlines(html)) {
    const note = noteFor(inline);
    if (note) notes.push(note);
  }

  const out = mapInlines(html, (inline) => {
    if (inline.kind !== "check") return null;
    const check = inline as InlineCheck;
    if (check.dc === null || check.isFlat) return null;
    if (!SCALED_CHECK_TYPES.has(check.checkType)) return null;

    const classified = classifyAbilityDC(fromLevel, check.dc);
    if (!classified) {
      notes.push({
        reason: "unreadable",
        detail: `Left ${capitalise(check.checkType)} DC ${check.dc} unchanged - level ${fromLevel} is outside the tables.`,
      });
      return null;
    }

    let next: number;
    try {
      next = Math.round(reemit(classified, dcRow(toLevel)));
    } catch {
      notes.push({
        reason: "unreadable",
        detail: `Left ${capitalise(check.checkType)} DC ${check.dc} unchanged - no ${classified.band} DC exists at level ${toLevel}.`,
      });
      return null;
    }

    if (next === check.dc) return null;

    changes.push({
      kind: "check",
      label: `${capitalise(check.checkType)} DC`,
      from: check.dc,
      to: next,
      band: classified.band,
      offset: classified.offset,
    });
    return withDC(check, next);
  });

  /**
   * `mapInlines` walks back to front so earlier offsets stay valid while it
   * splices. That is right for rewriting and wrong for reading: a change list
   * should run in the order the numbers appear in the text.
   */
  changes.reverse();

  return { html: out, changes, notes };
}
