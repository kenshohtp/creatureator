/**
 * Reading and writing stat block values by dotted path.
 *
 * The rescale engine reports changes as paths ("saves.fortitude",
 * "strikes.Fist.attack"), and the editor writes user edits back to the same
 * addresses. Keeping that mapping in one place means the two cannot drift.
 *
 * Strikes and spellcasting entries are addressed by name rather than index,
 * because indices shift and names are what the user sees.
 *
 * Damage is addressed two ways. `strikes.Fist.damage` means *the Strike's main
 * damage*, resolved through `primaryDamageIndex()` rather than by taking the
 * first entry — `system.damageRolls` is an object keyed by random id and its
 * enumeration order means nothing, so index 0 is frequently a rider (Fortune
 * Dragon's Tail lists "1d6" force before "4d10+15" bludgeoning). An explicit
 * `strikes.Fist.damage.1` addresses one roll by position, which is how the
 * editor exposes riders for hand-editing.
 */

import type { StatBlock, DamageRoll, Strike } from "./npc.js";
import {
  ABILITY_KEYS,
  SAVE_KEYS,
  primaryDamageIndex,
  type AbilityKey,
  type SaveKey,
} from "./npc.js";
import type { CREATURE_TABLES } from "../data/creature-tables.js";

export type TableKey = keyof typeof CREATURE_TABLES;

/**
 * Strike paths, parsed with a regex rather than by splitting on ".".
 *
 * The terminal token is known ("attack" or "damage", optionally followed by an
 * index), so a lazy capture lets the Strike's *name* contain dots — which
 * happens ("Jaws (Bite)" is fine, "Dr. Chill's Cane" is not, without this).
 */
const STRIKE_PATH = /^strikes\.(.+?)\.(attack|damage)(?:\.(\d+))?$/;

interface StrikePath {
  name: string;
  what: "attack" | "damage";
  /** null means "the main damage", resolved at read/write time. */
  index: number | null;
}

export function parseStrikePath(path: string): StrikePath | null {
  const m = STRIKE_PATH.exec(path);
  if (!m?.[1] || !m[2]) return null;
  return {
    name: m[1],
    what: m[2] as "attack" | "damage",
    index: m[3] === undefined ? null : Number(m[3]),
  };
}

/** Resolve a strike path to the actual damage roll it addresses. */
function damageRollAt(block: StatBlock, p: StrikePath): DamageRoll | null {
  const strike = findStrike(block, p.name);
  if (!strike) return null;
  const index = p.index ?? primaryDamageIndex(strike.damage);
  return strike.damage[index] ?? null;
}

function findStrike(block: StatBlock, name: string): Strike | undefined {
  return block.strikes.find((s) => s.name === name);
}

/** The index `strikes.<name>.damage` resolves to, for building explicit paths. */
export function primaryDamagePath(block: StatBlock, strikeName: string): string | null {
  const strike = findStrike(block, strikeName);
  if (!strike || !strike.damage.length) return null;
  return `strikes.${strikeName}.damage.${primaryDamageIndex(strike.damage)}`;
}

/** Which Building Creatures table governs a given path. */
export function tableForPath(path: string): TableKey | null {
  const strike = parseStrikePath(path);
  if (strike) return strike.what === "attack" ? "strikeAttackBonus" : "strikeDamage";

  const head = path.split(".")[0];
  switch (head) {
    case "ac": return "armorClass";
    case "hp": return "hitPoints";
    case "perception": return "perception";
    case "saves": return "savingThrows";
    case "abilities": return "attributeModifiers";
    case "skills": return "skills";
    case "spellcasting": return "spellDC";
    default: return null;
  }
}

/** For spellcasting paths, which half of Table 2-11 applies. */
export function spellStatFor(path: string): "dc" | "attack" {
  return path.endsWith(".attack") ? "attack" : "dc";
}

/** Numeric value at a path, or null if the path does not address a number. */
export function getNumberAt(block: StatBlock, path: string): number | null {
  const strike = parseStrikePath(path);
  if (strike) {
    if (strike.what !== "attack") return null;
    return findStrike(block, strike.name)?.attack ?? null;
  }

  const parts = path.split(".");
  const head = parts[0];

  if (head === "ac") return block.ac;
  if (head === "hp") return block.hp;
  if (head === "perception") return block.perception;

  if (head === "saves" && parts[1]) {
    return block.saves[parts[1] as SaveKey] ?? null;
  }
  if (head === "abilities" && parts[1]) {
    return block.abilities[parts[1] as AbilityKey] ?? null;
  }
  if (head === "skills" && parts[1]) {
    return block.skills[parts[1]] ?? null;
  }
  if (head === "spellcasting" && parts.length >= 3) {
    const label = parts.slice(1, -1).join(".");
    const entry = block.spellcasting.find((s) => (s.name || s.tradition) === label);
    if (!entry) return null;
    return spellStatFor(path) === "dc" ? entry.dc : entry.attack;
  }
  return null;
}

/** String value at a path (currently only Strike damage formulas). */
export function getStringAt(block: StatBlock, path: string): string | null {
  const strike = parseStrikePath(path);
  if (!strike || strike.what !== "damage") return null;
  return damageRollAt(block, strike)?.formula ?? null;
}

/**
 * Write a value back. Mutates the block in place and reports whether the path
 * was recognised, so a typo in a path surfaces rather than silently doing
 * nothing.
 */
export function setAt(block: StatBlock, path: string, value: number | string): boolean {
  const num = typeof value === "number" ? value : Number(value);

  const strikePath = parseStrikePath(path);
  if (strikePath) {
    const strike = findStrike(block, strikePath.name);
    if (!strike) return false;
    if (strikePath.what === "attack") {
      if (!Number.isFinite(num)) return false;
      strike.attack = num;
      return true;
    }
    const roll = damageRollAt(block, strikePath);
    if (!roll) return false;
    roll.formula = String(value);
    return true;
  }

  const parts = path.split(".");
  const head = parts[0];

  if (head === "ac") { block.ac = num; return true; }
  if (head === "hp") { block.hp = num; return true; }
  if (head === "perception") { block.perception = num; return true; }

  if (head === "saves" && parts[1] && SAVE_KEYS.includes(parts[1] as SaveKey)) {
    block.saves[parts[1] as SaveKey] = num;
    return true;
  }
  if (head === "abilities" && parts[1] && ABILITY_KEYS.includes(parts[1] as AbilityKey)) {
    block.abilities[parts[1] as AbilityKey] = num;
    return true;
  }
  if (head === "skills" && parts[1]) {
    block.skills[parts[1]] = num;
    return true;
  }
  if (head === "spellcasting" && parts.length >= 3) {
    const label = parts.slice(1, -1).join(".");
    const entry = block.spellcasting.find((s) => (s.name || s.tradition) === label);
    if (!entry) return false;
    if (spellStatFor(path) === "dc") entry.dc = num;
    else entry.attack = num;
    return true;
  }
  return false;
}

/** True when a path holds a damage formula rather than a number. */
export function isFormulaPath(path: string): boolean {
  return parseStrikePath(path)?.what === "damage";
}

/**
 * Human-friendly name for a path.
 *
 * Lives here rather than in the renderer because it is the same mapping in the
 * other direction: paths.ts is the single place that knows what a path means.
 */
export function prettyPath(path: string): string {
  const strike = parseStrikePath(path);
  if (strike) {
    return `${strike.name} ${strike.what === "attack" ? "attack" : "damage"}`;
  }

  const parts = path.split(".");
  const head = parts[0];

  if (head === "saves") return `${capitalise(parts[1] ?? "")} save`;
  if (head === "abilities") return (parts[1] ?? "").toUpperCase();
  if (head === "skills") return capitalise(parts[1] ?? "");
  if (head === "spellcasting") {
    const what = spellStatFor(path) === "dc" ? "DC" : "spell attack";
    return `${parts.slice(1, -1).join(".")} ${what}`;
  }
  if (head === "ac") return "AC";
  if (head === "hp") return "HP";
  if (head === "perception") return "Perception";
  return path;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
