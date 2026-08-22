/**
 * Reading and writing stat block values by dotted path.
 *
 * The rescale engine reports changes as paths ("saves.fortitude",
 * "strikes.Fist.attack"), and the editor needs to write user edits back to the
 * same addresses. Keeping that mapping in one place means the two cannot drift.
 *
 * Strikes and spellcasting entries are addressed by name rather than index,
 * because indices shift and names are what the user sees.
 */

import type { StatBlock } from "./npc.js";
import { ABILITY_KEYS, SAVE_KEYS, type AbilityKey, type SaveKey } from "./npc.js";
import type { CREATURE_TABLES } from "../data/creature-tables.js";

export type TableKey = keyof typeof CREATURE_TABLES;

/** Which Building Creatures table governs a given path. */
export function tableForPath(path: string): TableKey | null {
  const head = path.split(".")[0];
  switch (head) {
    case "ac": return "armorClass";
    case "hp": return "hitPoints";
    case "perception": return "perception";
    case "saves": return "savingThrows";
    case "abilities": return "attributeModifiers";
    case "skills": return "skills";
    case "spellcasting": return "spellDC";
    case "strikes":
      return path.endsWith(".attack") ? "strikeAttackBonus" : "strikeDamage";
    default: return null;
  }
}

/** Numeric value at a path, or null if the path does not address a number. */
export function getNumberAt(block: StatBlock, path: string): number | null {
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
  if (head === "strikes" && parts[1] && parts[2] === "attack") {
    return block.strikes.find((s) => s.name === parts[1])?.attack ?? null;
  }
  if (head === "spellcasting" && parts.length >= 3) {
    const label = parts.slice(1, -1).join(".");
    const entry = block.spellcasting.find((s) => (s.name || s.tradition) === label);
    if (!entry) return null;
    return parts[parts.length - 1] === "dc" ? entry.dc : entry.attack;
  }
  return null;
}

/** String value at a path (currently only Strike damage formulas). */
export function getStringAt(block: StatBlock, path: string): string | null {
  const parts = path.split(".");
  if (parts[0] === "strikes" && parts[2] === "damage") {
    const strike = block.strikes.find((s) => s.name === parts[1]);
    return strike?.damage[0]?.formula ?? null;
  }
  return null;
}

/**
 * Write a value back. Mutates the block in place and reports whether the path
 * was recognised, so a typo in a path surfaces rather than silently doing
 * nothing.
 */
export function setAt(block: StatBlock, path: string, value: number | string): boolean {
  const parts = path.split(".");
  const head = parts[0];
  const num = typeof value === "number" ? value : Number(value);

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
  if (head === "strikes" && parts[1]) {
    const strike = block.strikes.find((s) => s.name === parts[1]);
    if (!strike) return false;
    if (parts[2] === "attack") {
      strike.attack = num;
      return true;
    }
    if (parts[2] === "damage" && strike.damage[0]) {
      strike.damage[0].formula = String(value);
      return true;
    }
    return false;
  }
  if (head === "spellcasting" && parts.length >= 3) {
    const label = parts.slice(1, -1).join(".");
    const entry = block.spellcasting.find((s) => (s.name || s.tradition) === label);
    if (!entry) return false;
    if (parts[parts.length - 1] === "dc") entry.dc = num;
    else entry.attack = num;
    return true;
  }
  return false;
}

/** True when a path holds a damage formula rather than a number. */
export function isFormulaPath(path: string): boolean {
  return path.startsWith("strikes.") && path.endsWith(".damage");
}
