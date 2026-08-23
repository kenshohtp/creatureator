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
 * **Damage.** Ability `@Damage` does not fit any single published table: the
 * best of the two candidates (Table 2-10 Strike Damage, Table 2-12 Area Damage)
 * reaches only 13.8% exact. Ability damage covers headline area damage, small
 * riders, persistent damage and healing all at once, and until those can be
 * told apart the honest thing is to surface it and leave it alone.
 *
 * No Foundry dependency: pure text in, pure text out.
 */

import { classify, reemit, type Band } from "./bands.js";
import { rowFor, parseCellOrNull, threshold } from "./bands.js";
import {
  findInlines,
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
    return {
      reason: "damage",
      detail:
        `Left ${shown || inline.inner} unchanged. No published table governs ` +
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
