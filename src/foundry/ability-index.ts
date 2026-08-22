/**
 * Ability discovery: finding abilities to graft onto a creature.
 *
 * Where creature abilities actually live, probed against a real install:
 *
 *   - `pf2e.bestiary-ability-glossary-srd` — 55 shared abilities (Grab,
 *     Constrict, Attack of Opportunity).
 *   - `pf2e.bestiary-family-ability-glossary` — 482 family abilities.
 *   - `pf2e.adventure-specific-actions` — 208.
 *   - `pf2e.actionspf2e` — 574 general actions.
 *
 * That is roughly 1,300 items, all reachable from a compendium *index* without
 * loading a single document. The far larger pool — around 30,000 abilities
 * embedded in bestiary creatures, five per creature — is deliberately not
 * indexed here: reaching it means loading every actor, which takes minutes.
 * That pool is served by copying from one creature at a time instead.
 *
 * Item packs are not filtered by name. A world can carry ability packs from
 * modules or the GM's own homebrew, and hard-coding Paizo's four would make
 * those invisible. Anything of item type `action` is a candidate, wherever it
 * came from, with its provenance shown.
 *
 * The pure functions take plain data so they can be tested without Foundry.
 */

import {
  normaliseProvenance,
  resolveCollection,
  type PackMeta,
  type Provenance,
} from "./chassis.js";
import type { ActionType } from "../pf2e/ability.js";

export interface AbilityIndexEntry {
  _id: string;
  name: string;
  type?: string;
  system?: {
    actionType?: { value?: string };
    actions?: { value?: number | null };
    category?: string;
    traits?: { value?: string[] };
  };
}

export interface AbilityEntry {
  uuid: string;
  name: string;
  pack: string;
  packLabel: string;
  provenance: Provenance;
  actionType: ActionType;
  /** 1-3 for actions; null for passives, reactions and free actions. */
  actions: number | null;
  category: string | null;
  traits: string[];
}

/** The index fields worth asking for; without these every row reads "passive". */
export const ABILITY_INDEX_FIELDS = [
  "system.actionType.value",
  "system.actions.value",
  "system.category",
  "system.traits.value",
];

function toActionType(raw: unknown): ActionType {
  return raw === "action" || raw === "reaction" || raw === "free"
    ? raw
    : "passive";
}

export function toAbilityEntry(
  pack: PackMeta,
  entry: AbilityIndexEntry
): AbilityEntry | null {
  if (pack.type !== "Item") return null;
  if (entry.type !== "action") return null;
  if (!entry.name || !entry._id) return null;

  const collection = resolveCollection(pack);
  if (!collection) return null;

  const sys = entry.system ?? {};
  return {
    uuid: `Compendium.${collection}.Item.${entry._id}`,
    name: entry.name,
    pack: collection,
    packLabel: pack.label,
    provenance: normaliseProvenance(pack.packageType),
    actionType: toActionType(sys.actionType?.value),
    actions: typeof sys.actions?.value === "number" ? sys.actions.value : null,
    category: typeof sys.category === "string" ? sys.category : null,
    traits: Array.isArray(sys.traits?.value) ? [...sys.traits.value] : [],
  };
}

export interface AbilityFilter {
  /** Matched against the name and the traits, case-insensitively. */
  search?: string;
  actionType?: ActionType[];
  category?: string[];
  provenance?: Provenance[];
  /** Restrict to abilities carrying all of these traits. */
  traits?: string[];
}

export function filterAbilities(
  entries: readonly AbilityEntry[],
  filter: AbilityFilter = {}
): AbilityEntry[] {
  const needle = filter.search?.trim().toLowerCase();

  return entries.filter((e) => {
    if (needle) {
      const inName = e.name.toLowerCase().includes(needle);
      const inTraits = e.traits.some((t) => t.toLowerCase().includes(needle));
      if (!inName && !inTraits) return false;
    }
    if (filter.actionType?.length && !filter.actionType.includes(e.actionType)) return false;
    if (filter.category?.length && !filter.category.includes(e.category ?? "")) return false;
    if (filter.provenance?.length && !filter.provenance.includes(e.provenance)) return false;
    if (filter.traits?.length && !filter.traits.every((t) => e.traits.includes(t))) {
      return false;
    }
    return true;
  });
}

/**
 * Sort for display.
 *
 * A search for "grab" should put Grab first, not "Improved Grab" — so exact
 * matches lead, then prefix matches, then everything else alphabetically.
 * Without this the glossary's compound names bury the plain one.
 */
export function sortAbilities(
  entries: readonly AbilityEntry[],
  search?: string
): AbilityEntry[] {
  const needle = search?.trim().toLowerCase();

  const rank = (name: string): number => {
    if (!needle) return 0;
    const lower = name.toLowerCase();
    if (lower === needle) return 0;
    if (lower.startsWith(needle)) return 1;
    return 2;
  };

  return [...entries].sort((a, b) => {
    const ra = rank(a.name);
    const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

/** Every trait in a set of abilities, for a filter list. */
export function traitsIn(entries: readonly AbilityEntry[]): string[] {
  const all = new Set<string>();
  for (const e of entries) for (const t of e.traits) all.add(t);
  return [...all].sort();
}

// ---------------------------------------------------------------------------
// Foundry-facing collector. Kept thin so the logic above stays testable.
// ---------------------------------------------------------------------------

interface FoundryPack {
  collection?: string;
  metadata: PackMeta;
  getIndex(options?: { fields?: string[] }): Promise<{ contents: AbilityIndexEntry[] }>;
}

/**
 * Read every Item compendium into an ability index.
 *
 * Action cost, category and traits are not in the default index, so they are
 * requested explicitly — the same trap that made every chassis report a null
 * level until the level field was asked for.
 */
export async function buildAbilityIndex(
  packs: readonly FoundryPack[]
): Promise<AbilityEntry[]> {
  const out: AbilityEntry[] = [];

  for (const pack of packs) {
    if (pack.metadata.type !== "Item") continue;
    let index;
    try {
      index = await pack.getIndex({ fields: ABILITY_INDEX_FIELDS });
    } catch {
      continue; // A broken pack should not take the whole index down.
    }
    const meta: PackMeta = {
      ...pack.metadata,
      collection: pack.collection ?? pack.metadata.collection,
    };

    for (const entry of index.contents) {
      const ability = toAbilityEntry(meta, entry);
      if (ability) out.push(ability);
    }
  }

  return out;
}
