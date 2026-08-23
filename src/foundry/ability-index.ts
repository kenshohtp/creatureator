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
 * That is roughly 1,400 items, all reachable from a compendium *index* without
 * loading a single document.
 *
 * **The far larger pool is reachable too, and this file used to say otherwise.**
 * It claimed the ~33,000 abilities embedded in bestiary creatures needed every
 * actor loaded, "which takes minutes". Measured 23 Aug (tools/probe-embedded-
 * index.js): loading the documents does cost about a minute, but
 * `getIndex({fields: ["items"]})` returns the embedded items outright —
 * 7,894 actors across 67 packs in **2.0 seconds**, yielding 33,268 abilities
 * under 11,470 unique names. Dotted field paths work too, so
 * `items.system.traits.value` fetches just what a filter needs.
 *
 * The index route also constructs no documents, so it produces none of the
 * "evil is not a valid choice" warnings a bestiary sweep normally throws (§6.7).
 *
 * The claim was never measured. It shaped the design of this module for months.
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
  type IndexEntry,
  type PackMeta,
  type Provenance,
} from "./chassis.js";
import type { ActionType } from "../pf2e/ability.js";
import { mapInlines, type Inline } from "../pf2e/inline.js";

export interface AbilityIndexEntry {
  _id: string;
  name: string;
  type?: string;
  system?: {
    actionType?: { value?: string };
    actions?: { value?: number | null };
    category?: string;
    traits?: { value?: string[] };
    description?: { value?: string };
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
// Abilities embedded in creatures
//
// The pool the docstring above used to call unreachable: 33,268 abilities on
// 7,894 creatures, under 11,470 distinct names, all of it available from
// compendium indexes in about two seconds.
//
// Instances are collapsed by name before display. `Grab` sits on hundreds of
// creatures and hundreds of identical rows is not a search result. Which
// instance survives matters, though — every one carries its creature's level,
// and grafting rescales save DCs from that level to the target. So the
// collapse keeps the instance from the creature *closest in level* to the
// creature being built, which is the copy that needs the least adjustment.
// ---------------------------------------------------------------------------

/** An ability found on a creature, rather than in an item pack. */
export interface EmbeddedAbilityEntry extends AbilityEntry {
  creature: { uuid: string; name: string; level: number | null };
  /** How many creatures carry an ability of this name. 1 until collapsed. */
  sources: number;
  /** One line of what it does. Empty when the description resolves to nothing. */
  summary: string;
}

/**
 * Index fields needed to reach embedded abilities.
 *
 * Every field is named explicitly. Asking for bare `items` does return item
 * objects, and they *look* complete — `_id, name, type, system, img, sort,
 * flags` — but the `system` inside is not the document's. It lacks
 * `actionType`, `actions`, `category` and `traits`, so every ability read that
 * way came back as a passive with no traits, which is what shipped for about
 * ten minutes on 23 Aug.
 *
 * A collapsed `system: {…}` in a console log is not evidence that the fields
 * you need are in it.
 *
 * Dotted paths are honoured (probe, 23 Aug), so this asks for precisely what
 * `toEmbeddedAbilityEntry` reads and nothing else. The creature's level comes
 * along because a graft rescales from it.
 */
export const EMBEDDED_INDEX_FIELDS = [
  "system.details.level.value",
  "items.name",
  "items.type",
  "items.system.actionType.value",
  "items.system.actions.value",
  "items.system.category",
  "items.system.traits.value",
  "items.system.description.value",
];

/**
 * An inline element as a reader would say it aloud.
 *
 * A preview that leaves `@Template[cone|distance:30]` in the text is worse than
 * no preview - it is the raw storage format leaking into a sentence. The
 * parser in `pf2e/inline.ts` is reused rather than a fresh regex written,
 * because `@Damage[7d6[fire]]` nests brackets and the parser already knows.
 *
 * A `{label}` always wins: PF2e writes it precisely so the element has a
 * human reading.
 */
function inlineToText(inline: Inline): string {
  if (inline.label) return inline.label;

  if (inline.kind === "damage") {
    return inline.terms
      .map((t) => (t.damageType ? `${t.expr} ${t.damageType}` : t.expr))
      .join(" plus ");
  }

  if (inline.kind === "check") {
    // No trailing "save": PF2e's own prose supplies it - "(@Check[reflex|dc:22]
    // save)" - and adding one produces "DC 22 reflex save save".
    return inline.dc === null ? inline.checkType : `DC ${inline.dc} ${inline.checkType}`;
  }

  // "cone|distance:30" and "type:cone|distance:30" both occur.
  const parts = inline.inner.split("|");
  const shape =
    parts.find((p) => !p.includes(":")) ??
    parts.find((p) => p.startsWith("type:"))?.slice(5) ??
    "area";
  const distance = parts.find((p) => p.startsWith("distance:"))?.slice(9);
  return distance ? `${distance}-foot ${shape}` : shape;
}

/**
 * A one-line preview of what an ability does.
 *
 * Two things stand between the stored description and something readable.
 *
 * It is HTML, so tags come out. And PF2e stores shared abilities as a
 * localisation key rather than prose - Grab's whole description is
 * `<p>@Localize[PF2E.NPC.Abilities.Glossary.Grab]</p>` - so a preview that
 * skipped resolution would show the key, which is worse than showing nothing.
 *
 * `localize` is injected rather than reached for, because `game.i18n` does not
 * exist in a test. Unresolved keys fall back to empty rather than to the key
 * itself: a row with no preview reads as "no preview", where a row showing
 * `PF2E.NPC.Abilities.Glossary.Grab` reads as a bug.
 */
export function summariseAbility(
  html: string,
  localize: (key: string) => string = () => "",
  limit = 140
): string {
  const resolved = html.replace(/@Localize\[([^\]]+)\]/g, (_, key: string) => {
    const text = localize(key);
    return text && text !== key ? text : "";
  });

  // @Check, @Damage and @Template through the real parser; anything else
  // bracketed - @UUID and friends - keeps its label or goes entirely.
  const spoken = mapInlines(resolved, inlineToText)
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/@\w+\[[^\]]*\]/g, "");

  const plain = spoken
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > limit ? `${plain.slice(0, limit - 1).trimEnd()}\u2026` : plain;
}

/** One embedded `action` item, as an ability entry. Null if unusable. */
export function toEmbeddedAbilityEntry(
  pack: PackMeta,
  actor: IndexEntry & { items?: AbilityIndexEntry[] },
  item: AbilityIndexEntry,
  localize?: (key: string) => string
): EmbeddedAbilityEntry | null {
  if (pack.type !== "Actor") return null;
  if (item.type !== "action") return null;
  if (!item.name || !item._id || !actor._id) return null;

  const collection = resolveCollection(pack);
  if (!collection) return null;

  const sys = item.system ?? {};
  const level = actor.system?.details?.level?.value;

  return {
    uuid: `Compendium.${collection}.Actor.${actor._id}.Item.${item._id}`,
    name: item.name,
    pack: collection,
    packLabel: pack.label,
    provenance: normaliseProvenance(pack.packageType),
    actionType: toActionType(sys.actionType?.value),
    actions: typeof sys.actions?.value === "number" ? sys.actions.value : null,
    category: typeof sys.category === "string" ? sys.category : null,
    traits: Array.isArray(sys.traits?.value) ? [...sys.traits.value] : [],
    creature: {
      uuid: `Compendium.${collection}.Actor.${actor._id}`,
      name: actor.name,
      level: typeof level === "number" ? level : null,
    },
    sources: 1,
    summary: summariseAbility(String(sys.description?.value ?? ""), localize),
  };
}

/**
 * Collapse repeated ability names, keeping the instance nearest `targetLevel`.
 *
 * `sources` records how many were folded together, so the UI can say "on 412
 * creatures" rather than pretending the one shown is the only one. Entries with
 * no level lose to any entry that has one: an unknown level makes the DC
 * rescale a guess, which is exactly what this module refuses to do silently.
 */
export function collapseByName(
  entries: readonly EmbeddedAbilityEntry[],
  targetLevel: number
): EmbeddedAbilityEntry[] {
  const best = new Map<string, EmbeddedAbilityEntry>();

  for (const e of entries) {
    const key = e.name.toLowerCase();
    const seen = best.get(key);
    if (!seen) {
      best.set(key, { ...e });
      continue;
    }
    seen.sources += 1;
    const dSeen = seen.creature.level === null
      ? Infinity
      : Math.abs(seen.creature.level - targetLevel);
    const dNew = e.creature.level === null
      ? Infinity
      : Math.abs(e.creature.level - targetLevel);
    if (dNew < dSeen) {
      const sources = seen.sources;
      best.set(key, { ...e, sources });
    }
  }

  return [...best.values()];
}

interface FoundryActorPack {
  collection?: string;
  metadata: PackMeta;
  getIndex(options?: { fields?: string[] }): Promise<{
    contents: (IndexEntry & { items?: AbilityIndexEntry[] })[];
  }>;
}

/**
 * Sweep every Actor pack for abilities embedded in its creatures.
 *
 * Measured at 2.0s across 67 packs and 7,894 creatures on a full install
 * (tools/probe-embedded-index.js). Nothing is constructed as a document, so
 * unlike a `getDocuments()` sweep this produces none of PF2e's pre-remaster
 * validation warnings.
 */
export async function buildEmbeddedAbilityIndex(
  packs: readonly FoundryActorPack[],
  localize?: (key: string) => string
): Promise<EmbeddedAbilityEntry[]> {
  const out: EmbeddedAbilityEntry[] = [];

  for (const pack of packs) {
    if (pack.metadata.type !== "Actor") continue;
    let index;
    try {
      index = await pack.getIndex({ fields: EMBEDDED_INDEX_FIELDS });
    } catch {
      continue; // A broken pack should not take the whole sweep down.
    }
    const meta: PackMeta = {
      ...pack.metadata,
      collection: pack.collection ?? pack.metadata.collection,
    };

    for (const actor of index.contents) {
      for (const item of actor.items ?? []) {
        const entry = toEmbeddedAbilityEntry(meta, actor, item, localize);
        if (entry) out.push(entry);
      }
    }
  }

  return out;
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
