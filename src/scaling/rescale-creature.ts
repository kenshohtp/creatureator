/**
 * Whole-creature rescaling: chassis in, retargeted creature out.
 *
 * Composes the band engine (`bands.ts`) with the PF2e NPC mapping (`pf2e/npc.ts`).
 *
 * Every derived number is reported alongside the band it came from and the
 * offset that was preserved, because the project rule is that no adjustment is
 * ever silent — the UI shows the reasoning and the user can override any of it.
 * Nothing here decides anything on the user's behalf; it reports and lets them
 * choose.
 */

import {
  classify,
  parseCellOrNull,
  reemit,
  rowFor,
  type Band,
} from "./bands.js";
import type { CREATURE_TABLES } from "../data/creature-tables.js";
import {
  readStatBlock,
  applyStatBlock,
  primaryDamageIndex,
  ABILITY_KEYS,
  SAVE_KEYS,
  type NPCSource,
  type StatBlock,
} from "../pf2e/npc.js";
import {
  parseDamage,
  averageDamage,
  isFlat,
  rescaleDamageFormula,
} from "../pf2e/damage.js";

type TableKey = keyof typeof CREATURE_TABLES;

export interface StatChange {
  /** Dotted path, e.g. "ac", "saves.fortitude", "strikes.Fist.attack". */
  path: string;
  from: number | string;
  to: number | string;
  band: Band;
  /** Distance above the band's threshold, carried across the rescale. */
  offset: number;
  table: TableKey;
}

export interface RescaleWarning {
  path: string;
  message: string;
}

export interface RescaleResult {
  actor: NPCSource;
  block: StatBlock;
  fromLevel: number;
  toLevel: number;
  changes: StatChange[];
  warnings: RescaleWarning[];
}

interface Ctx {
  from: number;
  to: number;
  changes: StatChange[];
  warnings: RescaleWarning[];
}

/**
 * GM Core's Building Creatures tables cover levels -1 to 24.
 *
 * The bestiary does contain level 25 creatures, so this is a real boundary and
 * not a theoretical one. We refuse rather than extrapolate: inventing a level 25
 * row would produce numbers with no published basis, presented with the same
 * confidence as ones that have it.
 */
export const TABLE_MIN_LEVEL = -1;
export const TABLE_MAX_LEVEL = 24;

export function isLevelSupported(level: number): boolean {
  return Number.isInteger(level) && level >= TABLE_MIN_LEVEL && level <= TABLE_MAX_LEVEL;
}

/**
 * Rescale a single numeric statistic, recording what happened.
 * Returns the original value unchanged if the band cannot be re-emitted.
 */
function step(ctx: Ctx, path: string, table: TableKey, value: number): number {
  let fromRow;
  let toRow;
  try {
    fromRow = rowFor(table, ctx.from);
    toRow = rowFor(table, ctx.to);
  } catch (e) {
    ctx.warnings.push({ path, message: `No table row: ${(e as Error).message}` });
    return value;
  }
  return stepWith(ctx, path, table, value, fromRow, toRow);
}

type Row = Record<string, number | string>;

/**
 * Table 2-11 does not share the shape of the others: it has three bands
 * (Extreme, High, Moderate - no Low or Terrible) and pairs two statistics per
 * band, as `"high dc"` and `"high spell attack bonus"`. `classify` expects
 * plain band keys, so project one of the two out into a normal row.
 */
function spellRow(level: number, which: "dc" | "attack"): Row {
  const raw = rowFor("spellDC", level);
  const suffix = which === "dc" ? "dc" : "spell attack bonus";
  const row: Row = {};
  for (const band of ["extreme", "high", "moderate"] as const) {
    const v = raw[`${band} ${suffix}`];
    if (v !== undefined) row[band] = v;
  }
  return row;
}

function stepWith(
  ctx: Ctx,
  path: string,
  table: TableKey,
  value: number,
  fromRow: Row,
  toRow: Row
): number {
  const c = classify(value, fromRow);
  let next: number;
  try {
    next = Math.round(reemit(c, toRow));
  } catch (e) {
    ctx.warnings.push({
      path,
      message: `Left at ${value}: ${(e as Error).message}`,
    });
    return value;
  }

  ctx.changes.push({
    path,
    from: value,
    to: next,
    band: c.band,
    offset: c.offset,
    table,
  });
  return next;
}

/**
 * Classify a value against a table at a given level.
 *
 * Used by the editor to re-derive a band when the user types a number by hand,
 * so an edited statistic still shows where it sits rather than losing its band.
 */
export function classifyAt(
  table: TableKey,
  level: number,
  value: number
): { band: Band; offset: number } | null {
  try {
    const row = table === "spellDC" ? spellRow(level, "dc") : rowFor(table, level);
    return classify(value, row);
  } catch {
    return null;
  }
}

/** The value a band produces at a level, before any offset. */
export function bandValueAt(
  table: TableKey,
  level: number,
  band: Band,
  which: "dc" | "attack" = "dc"
): number | null {
  try {
    const row = table === "spellDC" ? spellRow(level, which) : rowFor(table, level);
    return Math.round(reemit({ band, offset: 0 }, row));
  } catch {
    return null;
  }
}

export function rescaleCreature(src: NPCSource, toLevel: number): RescaleResult {
  const original = readStatBlock(src);
  const ctx: Ctx = { from: original.level, to: toLevel, changes: [], warnings: [] };

  const block: StatBlock = structuredClone(original);
  block.level = toLevel;

  if (original.level === toLevel) {
    return {
      actor: structuredClone(src),
      block: original,
      fromLevel: original.level,
      toLevel,
      changes: [],
      warnings: [{ path: "level", message: "Source and target level are the same." }],
    };
  }

  // Check the range once, up front. Without this every statistic fails
  // separately and buries the single real cause under twenty identical
  // warnings.
  for (const [label, level] of [["chassis", original.level], ["target", toLevel]] as const) {
    if (!isLevelSupported(level)) {
      return {
        actor: structuredClone(src),
        block: original,
        fromLevel: original.level,
        toLevel,
        changes: [],
        warnings: [
          {
            path: "level",
            message:
              `Cannot rescale: ${label} level ${level} is outside the Building ` +
              `Creatures tables, which cover ${TABLE_MIN_LEVEL} to ${TABLE_MAX_LEVEL}. ` +
              `Extrapolating would invent numbers Paizo never published.`,
          },
        ],
      };
    }
  }

  block.ac = step(ctx, "ac", "armorClass", original.ac);
  block.perception = step(ctx, "perception", "perception", original.perception);

  for (const k of SAVE_KEYS) {
    block.saves[k] = step(ctx, `saves.${k}`, "savingThrows", original.saves[k]);
  }

  for (const k of ABILITY_KEYS) {
    block.abilities[k] = step(
      ctx, `abilities.${k}`, "attributeModifiers", original.abilities[k]
    );
  }

  for (const [slug, value] of Object.entries(original.skills)) {
    block.skills[slug] = step(ctx, `skills.${slug}`, "skills", value);
  }

  block.hp = step(ctx, "hp", "hitPoints", original.hp);

  /**
   * Hit Points cannot be rescaled in isolation.
   *
   * GM Core explicitly trades weaknesses for extra HP, so a creature carrying a
   * numeric weakness sits above its band on purpose. Preserving that offset
   * across a large level jump amplifies it. The reference chassis (Husk Zombie,
   * 55 HP at level 2 with vitality 5 / slashing 5) is exactly this case.
   *
   * We warn rather than guess: adjusting HP is the user's call, and quietly
   * "correcting" it would be the silent rewrite this project exists to avoid.
   */
  if (original.weaknesses.length > 0 || original.resistances.length > 0) {
    const traits = [...original.weaknesses, ...original.resistances]
      .map((w) => `${w.type} ${w.value}`)
      .join(", ");
    ctx.warnings.push({
      path: "hp",
      message:
        `Chassis has ${traits}. GM Core trades weaknesses and resistances ` +
        `against Hit Points, so this HP figure may sit off-band by design. ` +
        `Review HP and weakness values together.`,
    });
  }

  /**
   * Spell DCs and spell attack modifiers, per casting entry.
   *
   * A creature can have more than one - the Pitborn Adept has separate Arcane
   * Prepared and Divine Innate entries with different DCs - so each is scaled
   * on its own rather than collapsed into a single value.
   *
   * Spell *ranks* are deliberately untouched. Raising a creature's level does
   * not automatically entitle it to higher-rank spells; that is an authoring
   * decision, and GM Core caps innate and prepared ranks by level in a way the
   * user should apply knowingly.
   */
  for (const entry of block.spellcasting) {
    const label = entry.name || entry.tradition || entry.itemId;
    entry.dc = stepWith(
      ctx, `spellcasting.${label}.dc`, "spellDC", entry.dc,
      spellRow(ctx.from, "dc"), spellRow(ctx.to, "dc")
    );
    entry.attack = stepWith(
      ctx, `spellcasting.${label}.attack`, "spellDC", entry.attack,
      spellRow(ctx.from, "attack"), spellRow(ctx.to, "attack")
    );

    const maxRank = Math.max(1, Math.ceil(toLevel / 2));
    ctx.warnings.push({
      path: `spellcasting.${label}`,
      message:
        `Spell ranks left unchanged. At level ${toLevel}, GM Core suggests a ` +
        `maximum spell rank of ${maxRank} - review the spell list separately.`,
    });
  }

  for (const strike of block.strikes) {
    strike.attack = step(
      ctx, `strikes.${strike.name}.attack`, "strikeAttackBonus", strike.attack
    );

    // Identify the main damage by size, not by position - damageRolls is
    // keyed by random id and enumerates in no meaningful order.
    const primary = primaryDamageIndex(strike.damage);

    strike.damage.forEach((roll, index) => {
      const parsed = parseDamage(roll.formula);
      if (!parsed) {
        ctx.warnings.push({
          path: `strikes.${strike.name}.damage`,
          message: `Left "${roll.formula}" unchanged - unrecognised damage formula.`,
        });
        return;
      }

      if (isFlat(parsed)) {
        ctx.warnings.push({
          path: `strikes.${strike.name}.damage`,
          message:
            `Left flat ${roll.formula} ${roll.damageType} unchanged - the Strike ` +
            `damage table governs dice damage, not fixed riders.`,
        });
        return;
      }

      // Riders (energy, persistent, splash) are not what Table 2-10 describes;
      // it governs a Strike's main damage.
      if (index !== primary) {
        const tag = roll.category ? ` ${roll.category}` : "";
        ctx.warnings.push({
          path: `strikes.${strike.name}.damage.rider`,
          message:
            `Left "${roll.formula}"${tag} ${roll.damageType} unchanged - the ` +
            `damage table covers a Strike's main damage only.`,
        });
        return;
      }

      const current = averageDamage(parsed);
      const fromRow = rowFor("strikeDamage", ctx.from);
      const toRow = rowFor("strikeDamage", ctx.to);
      const c = classify(current, fromRow);
      const targetAverage = reemit(c, toRow);

      // Table 2-10 cells look like "2d4+6 (11)" - expression plus its average.
      // Parse via the band engine, which understands that shape; handing the
      // raw cell to parseDamage() fails silently and collapses the dice count
      // back to the chassis's, dumping the whole increase into the modifier
      // (producing absurdities like "1d6+9").
      const rawCell = toRow[c.band];
      const cell = rawCell === undefined ? null : parseCellOrNull(rawCell);
      const tableExpression = cell?.kind === "damage" ? cell.expr : null;

      const before = roll.formula;
      roll.formula = rescaleDamageFormula(before, targetAverage, tableExpression);

      ctx.changes.push({
        path: `strikes.${strike.name}.damage`,
        from: before,
        to: roll.formula,
        band: c.band,
        offset: c.offset,
        table: "strikeDamage",
      });
    });
  }

  return {
    actor: applyStatBlock(src, block),
    block,
    fromLevel: original.level,
    toLevel,
    changes: ctx.changes,
    warnings: ctx.warnings,
  };
}

/** One-line-per-change summary, for logs and quick inspection. */
export function summarise(result: RescaleResult): string {
  const head = `${result.block.name}: level ${result.fromLevel} -> ${result.toLevel}`;
  const rows = result.changes.map((c) => {
    const off = c.offset === 0 ? "" : ` ${c.offset > 0 ? "+" : ""}${c.offset}`;
    return `  ${c.path.padEnd(28)} ${String(c.from).padStart(8)} -> ${String(c.to).padEnd(8)} [${c.band}${off}]`;
  });
  const warns = result.warnings.map((w) => `  ! ${w.path}: ${w.message}`);
  return [head, ...rows, ...(warns.length ? ["", ...warns] : [])].join("\n");
}
