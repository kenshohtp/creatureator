/**
 * Mapping between a PF2e NPC actor and a normalised stat block.
 *
 * Every path below was read off a real actor rather than assumed — the
 * Husk Zombie from `pf2e.book-of-the-dead-bestiary`, on PF2e 8.3.0 / Foundry
 * core 14.361. Notable things that are easy to get wrong:
 *
 *   - `perception` sits at `system.perception.mod`, NOT under `system.attributes`.
 *   - Strike damage is an object keyed by random id, not an array.
 *   - NPC attacks are items of type `melee` for both melee and ranged; a ranged
 *     attack is distinguished by a non-null `system.range`.
 *   - Remaster terminology: weaknesses use `vitality`, not `positive`.
 *
 * This module is deliberately free of Foundry globals so it can be unit tested.
 * It operates on plain actor *source* objects (`actor.toObject()`).
 */

import { averageDamage, isFlat, parseDamage } from "./damage.js";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITY_KEYS: readonly AbilityKey[] = [
  "str", "dex", "con", "int", "wis", "cha",
] as const;

export type SaveKey = "fortitude" | "reflex" | "will";
export const SAVE_KEYS: readonly SaveKey[] = ["fortitude", "reflex", "will"] as const;

export interface DamageRoll {
  /** The random key PF2e uses inside `system.damageRolls`. */
  id: string;
  formula: string;
  damageType: string;
  category: string | null;
}

export interface Strike {
  itemId: string;
  name: string;
  /** `system.bonus.value` — the attack modifier. */
  attack: number;
  damage: DamageRoll[];
  /** PF2e uses item type `melee` for both; range being set marks it ranged. */
  ranged: boolean;
  traits: string[];
}

/**
 * A creature's spellcasting, one entry per `spellcastingEntry` item.
 *
 * Creatures can have several — the Pitborn Adept carries both "Arcane Prepared
 * Spells" (DC 21) and "Divine Innate Spells" (DC 17), each with its own DC and
 * attack modifier, so these must be handled individually rather than collapsed.
 *
 * `prepared` is PF2e's field name but describes the casting *kind*: sampling
 * Monster Core found `innate` (54), `prepared` (17), `focus` (11) and
 * `spontaneous` (5). All four scale their DC the same way.
 */
export interface SpellcastingEntry {
  itemId: string;
  name: string;
  /** arcane | divine | occult | primal */
  tradition: string;
  /** innate | prepared | spontaneous | focus */
  prepared: string;
  /** `system.spelldc.dc` */
  dc: number;
  /** `system.spelldc.value` - the spell attack modifier. */
  attack: number;
}

export interface StatBlock {
  name: string;
  level: number;
  ac: number;
  hp: number;
  perception: number;
  saves: Record<SaveKey, number>;
  abilities: Record<AbilityKey, number>;
  skills: Record<string, number>;
  strikes: Strike[];
  spellcasting: SpellcastingEntry[];
  weaknesses: { type: string; value: number }[];
  resistances: { type: string; value: number }[];
}

/** Minimal shape of a PF2e NPC actor source object. */
export interface NPCSource {
  name: string;
  type: string;
  system: Record<string, any>;
  items: Record<string, any>[];
  [key: string]: unknown;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Which damage roll is the Strike's main damage?
 *
 * `system.damageRolls` is an object keyed by random id, so **iteration order
 * means nothing**. Assuming the first entry is the primary is wrong, and
 * observably so: in the bestiary, Fortune Dragon's Claw enumerates as
 * `"1d6"` then `"4d6+15" piercing`, and Omen Dragon's Jaws as `"1d8"` then
 * `"2d8+11" piercing`. Taking index 0 would rescale the rider and leave the
 * actual damage untouched.
 *
 * The main damage is the largest die-based roll that is not a persistent or
 * splash rider. Verified against every multi-roll example sampled from Monster
 * Core, Monster Core 2 and NPC Core.
 */
export function primaryDamageIndex(rolls: DamageRoll[]): number {
  if (rolls.length <= 1) return 0;

  let bestIndex = -1;
  let bestAverage = -Infinity;

  rolls.forEach((roll, i) => {
    // Persistent and splash are riders by definition, never main damage.
    if (roll.category === "persistent" || roll.category === "splash") return;
    const parsed = parseDamage(roll.formula);
    if (!parsed || isFlat(parsed)) return;

    const avg = averageDamage(parsed);
    if (avg > bestAverage) {
      bestAverage = avg;
      bestIndex = i;
    }
  });

  return bestIndex >= 0 ? bestIndex : 0;
}

export function readStatBlock(src: NPCSource): StatBlock {
  const sys = src.system ?? {};
  const attrs = sys["attributes"] ?? {};

  const saves = {} as Record<SaveKey, number>;
  for (const k of SAVE_KEYS) saves[k] = num(sys["saves"]?.[k]?.value);

  const abilities = {} as Record<AbilityKey, number>;
  for (const k of ABILITY_KEYS) abilities[k] = num(sys["abilities"]?.[k]?.mod);

  const skills: Record<string, number> = {};
  for (const [slug, entry] of Object.entries(sys["skills"] ?? {})) {
    const base = (entry as Record<string, unknown>)?.["base"];
    if (typeof base === "number") skills[slug] = base;
  }

  const strikes: Strike[] = (src.items ?? [])
    .filter((i) => i["type"] === "melee")
    .map((i) => {
      const isys = i["system"] ?? {};
      const rolls = isys["damageRolls"] ?? {};
      return {
        itemId: String(i["_id"] ?? ""),
        name: String(i["name"] ?? ""),
        attack: num(isys["bonus"]?.value),
        ranged: isys["range"] !== null && isys["range"] !== undefined,
        traits: Array.isArray(isys["traits"]?.value) ? [...isys["traits"].value] : [],
        damage: Object.entries(rolls).map(([id, r]) => {
          const roll = r as Record<string, unknown>;
          return {
            id,
            formula: String(roll["damage"] ?? ""),
            damageType: String(roll["damageType"] ?? "untyped"),
            category: (roll["category"] as string | null) ?? null,
          };
        }),
      };
    });

  const spellcasting: SpellcastingEntry[] = (src.items ?? [])
    .filter((i) => i["type"] === "spellcastingEntry")
    .map((i) => {
      const isys = i["system"] ?? {};
      return {
        itemId: String(i["_id"] ?? ""),
        name: String(i["name"] ?? ""),
        tradition: String(isys["tradition"]?.value ?? ""),
        prepared: String(isys["prepared"]?.value ?? ""),
        dc: num(isys["spelldc"]?.dc),
        attack: num(isys["spelldc"]?.value),
      };
    });

  const typedValues = (list: unknown): { type: string; value: number }[] =>
    Array.isArray(list)
      ? list
          .filter((w) => typeof w?.value === "number")
          .map((w) => ({ type: String(w.type), value: Number(w.value) }))
      : [];

  return {
    name: String(src.name ?? ""),
    level: num(sys["details"]?.level?.value),
    ac: num(attrs["ac"]?.value),
    hp: num(attrs["hp"]?.max, num(attrs["hp"]?.value)),
    perception: num(sys["perception"]?.mod),
    saves,
    abilities,
    skills,
    strikes,
    spellcasting,
    weaknesses: typedValues(attrs["weaknesses"]),
    resistances: typedValues(attrs["resistances"]),
  };
}

/**
 * Write a stat block back onto a copy of the actor source.
 *
 * Returns a new object; the input is not mutated. Only fields the stat block
 * owns are touched — everything else (rule elements, descriptions, images,
 * flags, non-Strike items) is carried through untouched, which is the whole
 * reason for cloning a compendium actor rather than building one from scratch.
 */
/**
 * Write weaknesses or resistances back, preserving anything else PF2e stores
 * on the entry.
 *
 * These are editable because GM Core explicitly trades them against Hit Points:
 * dropping a creature's numeric weakness is the same decision as lowering its
 * HP band, and the editor presents them together. Entries carry more than a
 * type and a value (`exceptions`, `doubleVs`), so a surviving entry is amended
 * in place rather than rebuilt — only removals actually drop anything.
 */
function writeTypedValues(
  attrs: Record<string, any> | undefined,
  key: "weaknesses" | "resistances",
  values: { type: string; value: number }[]
): void {
  if (!attrs) return;
  const existing: Record<string, any>[] = Array.isArray(attrs[key]) ? attrs[key] : [];
  const byType = new Map(existing.map((e) => [String(e["type"]), e]));

  attrs[key] = values.map((v) => {
    const prior = byType.get(v.type);
    return prior ? { ...prior, value: v.value } : { type: v.type, value: v.value };
  });
}

export function applyStatBlock(src: NPCSource, block: StatBlock): NPCSource {
  const out = structuredClone(src) as NPCSource;
  const sys = out.system;

  sys["details"] ??= {};
  sys["details"].level ??= {};
  sys["details"].level.value = block.level;

  sys["attributes"] ??= {};
  sys["attributes"].ac ??= {};
  sys["attributes"].ac.value = block.ac;

  sys["attributes"].hp ??= {};
  sys["attributes"].hp.value = block.hp;
  sys["attributes"].hp.max = block.hp;

  sys["perception"] ??= {};
  sys["perception"].mod = block.perception;

  sys["saves"] ??= {};
  for (const k of SAVE_KEYS) {
    sys["saves"][k] ??= {};
    sys["saves"][k].value = block.saves[k];
  }

  sys["abilities"] ??= {};
  for (const k of ABILITY_KEYS) {
    sys["abilities"][k] ??= {};
    sys["abilities"][k].mod = block.abilities[k];
  }

  for (const [slug, value] of Object.entries(block.skills)) {
    if (sys["skills"]?.[slug]) sys["skills"][slug].base = value;
  }

  writeTypedValues(sys["attributes"], "weaknesses", block.weaknesses);
  writeTypedValues(sys["attributes"], "resistances", block.resistances);

  const byId = new Map(block.strikes.map((s) => [s.itemId, s]));
  for (const item of out.items ?? []) {
    if (item["type"] !== "melee") continue;
    const strike = byId.get(String(item["_id"]));
    if (!strike) continue;

    item["system"] ??= {};
    item["system"].bonus ??= {};
    item["system"].bonus.value = strike.attack;

    // Preserve PF2e's random damage-roll keys; only the formula changes.
    for (const roll of strike.damage) {
      const target = item["system"].damageRolls?.[roll.id];
      if (target) target.damage = roll.formula;
    }
  }

  const castingById = new Map(block.spellcasting.map((s) => [s.itemId, s]));
  for (const item of out.items ?? []) {
    if (item["type"] !== "spellcastingEntry") continue;
    const entry = castingById.get(String(item["_id"]));
    if (!entry) continue;

    item["system"] ??= {};
    item["system"].spelldc ??= {};
    item["system"].spelldc.dc = entry.dc;
    item["system"].spelldc.value = entry.attack;
  }

  if (out.name !== block.name) out.name = block.name;
  return out;
}
