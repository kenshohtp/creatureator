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

  if (out.name !== block.name) out.name = block.name;
  return out;
}
