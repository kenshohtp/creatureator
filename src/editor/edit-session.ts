/**
 * The editing model: a rescaled creature you can still change your mind about.
 *
 * Rescaling answers "what would this creature look like at level 5?". It does
 * not answer "what do I actually want?" — and the reference creature is proof
 * that the two differ. Occam's Risen Kinetic Husk is a Husk Zombie moved from
 * level 2 to 5, but its author also pushed AC up a band and traded away a
 * numeric weakness for lower HP. Neither of those is a rescaling error; both
 * are authoring decisions the engine must not make on his behalf.
 *
 * So this layer holds three things at once:
 *
 *   - the *baseline*: the creature exactly as the rescale produced it,
 *   - the *working block*: the creature as the user has since edited it,
 *   - for every statistic, the band it currently sits in — re-derived on each
 *     edit, so a hand-typed number is never a number without provenance.
 *
 * Nothing here touches Foundry, so the whole editing model is unit testable
 * without a running game.
 */

import {
  bandDamageAverageAt,
  bandFormulaAt,
  bandRangeAt,
  bandValueAt,
  bandsAt,
  classifyAt,
  type RescaleResult,
  type RescaleWarning,
} from "../scaling/rescale-creature.js";
import type { Band } from "../scaling/bands.js";
import {
  applyStatBlock,
  primaryDamageIndex,
  type NPCSource,
  type StatBlock,
} from "../pf2e/npc.js";
import {
  averageDamage,
  isFlat,
  parseDamage,
  rescaleDamageFormula,
} from "../pf2e/damage.js";
import {
  getNumberAt,
  getStringAt,
  isFormulaPath,
  prettyPath,
  setAt,
  spellStatFor,
  tableForPath,
  type TableKey,
} from "../pf2e/paths.js";

export type DefenceKind = "weakness" | "resistance";

/** One band the user can switch a statistic to, and what it would produce. */
export interface BandOption {
  band: Band;
  /** The figure that band emits at this level, with no offset. */
  value: number | string;
  /** Published span, for the tables that write ranges ("78-72"). */
  range: { min: number; max: number } | null;
}

export interface EditField {
  path: string;
  label: string;
  kind: "number" | "formula";
  /** null when no Building Creatures table governs this value (riders). */
  table: TableKey | null;
  value: number | string;
  /** The value the rescale produced, before any editing. */
  baseline: number | string;
  dirty: boolean;
  band: Band | null;
  offset: number | null;
  options: BandOption[];
  /** Why this field has no band, or what is wrong with what was typed. */
  note: string | null;
  /** Damage rows carry their type so a rider reads as what it is. */
  damageType?: string;
}

export interface EditSection {
  title: string;
  fields: EditField[];
}

/** A weakness or resistance, addressed by type rather than by index. */
export interface DefenceRow {
  kind: DefenceKind;
  type: string;
  /** null once removed — the row stays visible so it can be restored. */
  value: number | null;
  baseline: number | null;
  dirty: boolean;
}

const SECTION_ORDER = [
  "Defences",
  "Perception & Skills",
  "Attributes",
  "Strikes",
  "Spellcasting",
] as const;

function sectionFor(path: string): (typeof SECTION_ORDER)[number] {
  if (path === "ac" || path === "hp" || path.startsWith("saves.")) return "Defences";
  if (path === "perception" || path.startsWith("skills.")) return "Perception & Skills";
  if (path.startsWith("abilities.")) return "Attributes";
  if (path.startsWith("spellcasting.")) return "Spellcasting";
  return "Strikes";
}

export class EditSession {
  /** The chassis, untouched. Everything is applied to a clone of it. */
  readonly source: NPCSource;
  readonly baseline: StatBlock;
  readonly fromLevel: number;
  readonly toLevel: number;
  /** Warnings the rescale itself produced; some are re-derived as you edit. */
  readonly rescaleWarnings: readonly RescaleWarning[];

  block: StatBlock;

  /**
   * Which damage roll is each Strike's main damage.
   *
   * Fixed from the baseline rather than recomputed, because `primaryDamageIndex`
   * picks the largest roll: editing a rider up could otherwise make it "the
   * main damage" mid-edit and silently move which row the damage table governs.
   */
  readonly #primary = new Map<string, number>();

  constructor(source: NPCSource, result: RescaleResult) {
    this.source = structuredClone(source);
    this.baseline = structuredClone(result.block);
    this.block = structuredClone(result.block);
    this.fromLevel = result.fromLevel;
    this.toLevel = result.toLevel;
    this.rescaleWarnings = result.warnings;

    for (const strike of this.baseline.strikes) {
      this.#primary.set(strike.name, primaryDamageIndex(strike.damage));
    }
  }

  static fromRescale(source: NPCSource, result: RescaleResult): EditSession {
    return new EditSession(source, result);
  }

  get level(): number {
    return this.block.level;
  }

  get name(): string {
    return this.block.name;
  }

  rename(name: string): void {
    this.block.name = name;
  }

  // --- fields ------------------------------------------------------------

  /** Every editable statistic, in the order a GM reads a stat block. */
  paths(): string[] {
    const out: string[] = ["ac", "hp"];
    for (const k of ["fortitude", "reflex", "will"] as const) out.push(`saves.${k}`);
    out.push("perception");
    for (const slug of Object.keys(this.block.skills).sort()) out.push(`skills.${slug}`);
    for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      out.push(`abilities.${k}`);
    }
    for (const strike of this.block.strikes) {
      out.push(`strikes.${strike.name}.attack`);
      strike.damage.forEach((_, i) => out.push(`strikes.${strike.name}.damage.${i}`));
    }
    for (const entry of this.block.spellcasting) {
      const label = entry.name || entry.tradition || entry.itemId;
      out.push(`spellcasting.${label}.dc`, `spellcasting.${label}.attack`);
    }
    return out;
  }

  sections(): EditSection[] {
    const byTitle = new Map<string, EditField[]>();
    for (const path of this.paths()) {
      const field = this.field(path);
      if (!field) continue;
      const title = sectionFor(path);
      const bucket = byTitle.get(title);
      if (bucket) bucket.push(field);
      else byTitle.set(title, [field]);
    }
    return SECTION_ORDER.filter((t) => byTitle.get(t)?.length).map((title) => ({
      title,
      fields: byTitle.get(title)!,
    }));
  }

  field(path: string): EditField | null {
    return isFormulaPath(path) ? this.#damageField(path) : this.#numberField(path);
  }

  #numberField(path: string): EditField | null {
    const value = getNumberAt(this.block, path);
    if (value === null) return null;

    const baseline = getNumberAt(this.baseline, path);
    const table = tableForPath(path);
    const which = spellStatFor(path);
    const c = table ? classifyAt(table, this.level, value, which) : null;

    return {
      path,
      label: prettyPath(path),
      kind: "number",
      table,
      value,
      baseline: baseline ?? value,
      dirty: baseline !== null && baseline !== value,
      band: c?.band ?? null,
      offset: c?.offset ?? null,
      options: table ? this.#optionsFor(table, which) : [],
      note: table
        ? c
          ? null
          : "No table row at this level - left unclassified."
        : "Not governed by a Building Creatures table.",
    };
  }

  #optionsFor(table: TableKey, which: "dc" | "attack"): BandOption[] {
    return bandsAt(table, this.level, which).flatMap((band) => {
      const value = bandValueAt(table, this.level, band, which);
      if (value === null) return [];
      return [{ band, value, range: bandRangeAt(table, this.level, band, which) }];
    });
  }

  #damageField(path: string): EditField | null {
    const formula = getStringAt(this.block, path);
    if (formula === null) return null;

    const parts = path.split(".");
    const index = Number(parts[parts.length - 1]);
    const strikeName = parts.slice(1, -2).join(".");
    const strike = this.block.strikes.find((s) => s.name === strikeName);
    const roll = strike?.damage[index];

    const baseline = getStringAt(this.baseline, path);
    const parsed = parseDamage(formula);
    const isPrimary = this.#primary.get(strikeName) === index;

    /**
     * Only a Strike's main dice damage is governed by Table 2-10. Riders and
     * flat damage are shown, and are editable, but carry no band — claiming
     * one for them would be applying the wrong rule confidently.
     */
    const governed = isPrimary && parsed !== null && !isFlat(parsed);
    const c =
      governed && parsed
        ? classifyAt("strikeDamage", this.level, averageDamage(parsed))
        : null;

    let note: string | null = null;
    if (!parsed) note = "Unrecognised formula - left exactly as typed.";
    else if (!isPrimary) note = "Rider - the damage table covers main damage only.";
    else if (isFlat(parsed)) note = "Flat damage - the damage table governs dice.";

    return {
      path,
      label: prettyPath(path),
      kind: "formula",
      table: governed ? "strikeDamage" : null,
      value: formula,
      baseline: baseline ?? formula,
      dirty: baseline !== null && baseline !== formula,
      band: c?.band ?? null,
      offset: c?.offset ?? null,
      options: governed ? this.#damageOptions(formula) : [],
      note,
      ...(roll ? { damageType: roll.damageType } : {}),
    };
  }

  /**
   * What each band would actually produce for *this* Strike.
   *
   * Not the table's own expression. Rescaling preserves the chassis's die size
   * (a d12 club still swings a d12), so offering Table 2-10's "2d4+6" to a d6
   * weapon advertises a result the module will not deliver - the user picks Low
   * and gets 2d6+4. The dropdown is built through the same re-expression the
   * override uses, so what it promises is what it does.
   */
  #damageOptions(formula: string): BandOption[] {
    return bandsAt("strikeDamage", this.level).flatMap((band) => {
      const average = bandDamageAverageAt(this.level, band);
      if (average === null) return [];
      const expr = bandFormulaAt(this.level, band);
      return [{ band, value: rescaleDamageFormula(formula, average, expr), range: null }];
    });
  }

  // --- editing -----------------------------------------------------------

  /**
   * Write a hand-typed value. Rejects anything that is not a finite number for
   * numeric fields, so a half-typed or cleared box leaves the last good value
   * in place rather than writing NaN onto the creature.
   */
  set(path: string, value: number | string): boolean {
    if (!isFormulaPath(path)) {
      const num = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(num) || String(value).trim() === "") return false;
      return setAt(this.block, path, num);
    }
    return setAt(this.block, path, String(value));
  }

  /**
   * Switch a statistic to a band.
   *
   * The offset is deliberately dropped. An offset records that the *chassis*
   * sat deliberately above its band; once the user picks a band by hand, that
   * intent has been replaced by theirs, and silently carrying the old number's
   * spread would make the chosen band produce something other than its figure.
   *
   * Damage keeps the chassis's die size and takes only the dice count and
   * average from the table, for the same reason rescaling does: a monster whose
   * thing is a big d12 club should still swing a d12.
   */
  setBand(path: string, band: Band): boolean {
    const field = this.field(path);
    if (!field?.table) return false;

    if (field.kind === "formula") {
      const target = bandDamageAverageAt(this.level, band);
      if (target === null) return false;
      const expr = bandFormulaAt(this.level, band);
      return this.set(path, rescaleDamageFormula(String(field.value), target, expr));
    }

    const value = bandValueAt(field.table, this.level, band, spellStatFor(path));
    return value === null ? false : this.set(path, value);
  }

  /** Put one statistic back to what the rescale produced. */
  reset(path: string): boolean {
    const baseline = isFormulaPath(path)
      ? getStringAt(this.baseline, path)
      : getNumberAt(this.baseline, path);
    return baseline === null ? false : this.set(path, baseline);
  }

  resetAll(): void {
    this.block = structuredClone(this.baseline);
  }

  get dirtyPaths(): string[] {
    return this.paths().filter((p) => this.field(p)?.dirty);
  }

  get isDirty(): boolean {
    return this.block.name !== this.baseline.name || this.dirtyPaths.length > 0;
  }

  // --- weaknesses and resistances ----------------------------------------

  #list(kind: DefenceKind, block: StatBlock) {
    return kind === "weakness" ? block.weaknesses : block.resistances;
  }

  /**
   * Weakness and resistance rows, addressed by type.
   *
   * Removed entries stay in the list with a null value rather than vanishing,
   * so removing one is undoable and so the user can see what the chassis had.
   */
  defenceRows(): DefenceRow[] {
    const rows: DefenceRow[] = [];
    for (const kind of ["weakness", "resistance"] as const) {
      const current = this.#list(kind, this.block);
      const base = this.#list(kind, this.baseline);
      const types = [...new Set([...base.map((d) => d.type), ...current.map((d) => d.type)])];

      for (const type of types) {
        const value = current.find((d) => d.type === type)?.value ?? null;
        const baseline = base.find((d) => d.type === type)?.value ?? null;
        rows.push({ kind, type, value, baseline, dirty: value !== baseline });
      }
    }
    return rows;
  }

  /** Set a weakness/resistance value, or pass null to remove it. */
  setDefence(kind: DefenceKind, type: string, value: number | null): boolean {
    const list = this.#list(kind, this.block);
    const at = list.findIndex((d) => d.type === type);

    if (value === null) {
      if (at < 0) return false;
      list.splice(at, 1);
      return true;
    }
    if (!Number.isFinite(value)) return false;
    if (at >= 0) list[at]!.value = value;
    else list.push({ type, value });
    return true;
  }

  /** Total numeric weakness, which is what GM Core trades against HP. */
  get weaknessTotal(): number {
    return this.block.weaknesses.reduce((sum, w) => sum + w.value, 0);
  }

  // --- warnings ----------------------------------------------------------

  /**
   * Warnings as they stand *now*, not as the rescale left them.
   *
   * The HP-versus-weakness warning is the whole reason this is re-derived: it
   * is the one the user is expected to act on, and it must disappear when they
   * have. A warning that survives being addressed teaches people to ignore
   * warnings.
   */
  warnings(): RescaleWarning[] {
    const kept = this.rescaleWarnings.filter(
      (w) =>
        w.path !== "hp" &&
        // "Source and target level are the same" is a fact, not a problem, and
        // the editor header already states it. Rendering it in the warning
        // style tells the user something is wrong when nothing is.
        !(w.path === "level" && this.fromLevel === this.toLevel)
    );
    const out = [...kept];

    const hp = this.field("hp");
    const defences = [...this.block.weaknesses, ...this.block.resistances];
    if (defences.length && hp && hp.offset !== null && hp.offset !== 0) {
      const listed = defences.map((d) => `${d.type} ${d.value}`).join(", ");
      const direction = hp.offset > 0 ? "above" : "below";
      out.push({
        path: "hp",
        message:
          `${this.block.hp} HP sits ${Math.abs(hp.offset)} ${direction} the ` +
          `${hp.band} band while the creature carries ${listed}. GM Core trades ` +
          `these against each other - decide them together.`,
      });
    }

    for (const strike of this.block.strikes) {
      for (const roll of strike.damage) {
        if (parseDamage(roll.formula) === null) {
          out.push({
            path: `strikes.${strike.name}.damage`,
            message: `"${roll.formula}" is not a formula this module can read. It will be written to the creature exactly as typed.`,
          });
        }
      }
    }

    return out;
  }

  // --- output ------------------------------------------------------------

  /** The actor source to create, with every edit applied. */
  toActorSource(): NPCSource {
    return applyStatBlock(this.source, this.block);
  }

  /** One line per edit, for the console log that accompanies creation. */
  summarise(): string {
    const head = `${this.block.name}: level ${this.fromLevel} -> ${this.toLevel}`;
    const edits = this.dirtyPaths.map((p) => {
      const f = this.field(p)!;
      const band = f.band
        ? ` [${f.band}${f.offset ? (f.offset > 0 ? ` +${f.offset}` : ` ${f.offset}`) : ""}]`
        : "";
      return `  edited ${f.label.padEnd(24)} ${String(f.baseline)} -> ${String(f.value)}${band}`;
    });
    const defences = this.defenceRows()
      .filter((d) => d.dirty)
      .map(
        (d) =>
          `  ${d.value === null ? "removed" : "edited "} ${d.kind} ${d.type.padEnd(16)} ` +
          `${d.baseline ?? "-"} -> ${d.value ?? "removed"}`
      );
    return [head, ...edits, ...defences].join("\n");
  }
}
