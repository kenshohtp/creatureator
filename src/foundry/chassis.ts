/**
 * Chassis discovery: finding candidate base creatures across compendia.
 *
 * The provenance question matters. A world can mix Paizo's packs with premium
 * modules and the GM's own homebrew, and rescaling someone's homebrew carries
 * different assumptions than rescaling a Monster Core creature whose numbers
 * you can trust to sit on the published bands. So every candidate records where
 * it came from, and the UI surfaces it.
 *
 * Foundry's `pack.metadata.packageType` gives us this directly. Verified on a
 * clean PF2e 8.3.0 install: all 66 Actor packs report `"system"`.
 *
 * The pure functions here take plain data so they can be tested without Foundry.
 */

/** Where a compendium came from. */
export type Provenance = "system" | "module" | "world";

/**
 * Compendium metadata as we need it.
 *
 * Note `collection` is NOT part of Foundry's `pack.metadata` — it lives on the
 * CompendiumCollection itself (`pack.collection`). `metadata` carries `id` and
 * `packageName`, from which the collection can be rebuilt. `resolveCollection`
 * handles both so callers cannot get this wrong silently; passing metadata
 * alone previously produced uuids reading `Compendium.undefined.Actor.<id>`.
 */
export interface PackMeta {
  /** e.g. "pf2e.pathfinder-monster-core". May be absent on raw metadata. */
  collection?: string;
  /** e.g. "pathfinder-monster-core" */
  id?: string;
  label: string;
  type: string;
  packageType: Provenance | string;
  packageName: string;
}

/** Derive "package.pack-id", preferring an explicit collection when present. */
export function resolveCollection(pack: PackMeta): string | null {
  if (pack.collection) return pack.collection;
  if (pack.packageName && pack.id) return `${pack.packageName}.${pack.id}`;
  return null;
}

/** The subset of a compendium index entry we need. */
export interface IndexEntry {
  _id: string;
  name: string;
  type?: string;
  system?: { details?: { level?: { value?: number } } };
}

export interface ChassisEntry {
  uuid: string;
  name: string;
  level: number | null;
  pack: string;
  packLabel: string;
  provenance: Provenance;
  /** True for content shipped by the PF2e system itself. */
  official: boolean;
}

const PROVENANCES: readonly Provenance[] = ["system", "module", "world"];

export function normaliseProvenance(value: string): Provenance {
  return (PROVENANCES as readonly string[]).includes(value)
    ? (value as Provenance)
    : "module";
}

/**
 * Build a chassis entry from a pack's metadata and one index row.
 * Returns null for anything that is not a usable NPC.
 */
export function toChassisEntry(
  pack: PackMeta,
  entry: IndexEntry
): ChassisEntry | null {
  if (pack.type !== "Actor") return null;
  if (entry.type !== undefined && entry.type !== "npc") return null;
  if (!entry.name || !entry._id) return null;

  // Without a collection the uuid would be unusable, so refuse rather than
  // emit "Compendium.undefined.Actor.<id>" and fail later at lookup time.
  const collection = resolveCollection(pack);
  if (!collection) return null;

  const level = entry.system?.details?.level?.value;
  const provenance = normaliseProvenance(pack.packageType);

  return {
    uuid: `Compendium.${collection}.Actor.${entry._id}`,
    name: entry.name,
    level: typeof level === "number" ? level : null,
    pack: collection,
    packLabel: pack.label,
    provenance,
    official: provenance === "system" && pack.packageName === "pf2e",
  };
}

export interface ChassisFilter {
  /** Case-insensitive substring match on the creature name. */
  search?: string;
  minLevel?: number;
  maxLevel?: number;
  /** Restrict to these provenances. Omit for all. */
  provenance?: Provenance[];
  /** Exclude creatures whose level the scaling tables cannot handle. */
  scalableOnly?: boolean;
}

/** Levels outside this range have no Building Creatures table row. */
const TABLE_MIN = -1;
const TABLE_MAX = 24;

export function filterChassis(
  entries: readonly ChassisEntry[],
  filter: ChassisFilter = {}
): ChassisEntry[] {
  const needle = filter.search?.trim().toLowerCase();

  return entries.filter((e) => {
    if (needle && !e.name.toLowerCase().includes(needle)) return false;
    if (filter.provenance && !filter.provenance.includes(e.provenance)) return false;

    if (filter.scalableOnly) {
      if (e.level === null) return false;
      if (e.level < TABLE_MIN || e.level > TABLE_MAX) return false;
    }
    if (filter.minLevel !== undefined && (e.level === null || e.level < filter.minLevel)) {
      return false;
    }
    if (filter.maxLevel !== undefined && (e.level === null || e.level > filter.maxLevel)) {
      return false;
    }
    return true;
  });
}

/**
 * Sort for display: closest level match first when a target is given, then by
 * name. Homebrew is not pushed down — the GM's own creatures are often exactly
 * what they want as a base.
 */
export function sortChassis(
  entries: readonly ChassisEntry[],
  targetLevel?: number
): ChassisEntry[] {
  return [...entries].sort((a, b) => {
    if (targetLevel !== undefined) {
      const da = a.level === null ? Infinity : Math.abs(a.level - targetLevel);
      const db = b.level === null ? Infinity : Math.abs(b.level - targetLevel);
      if (da !== db) return da - db;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Group by provenance for a sectioned list. */
export function groupByProvenance(
  entries: readonly ChassisEntry[]
): Record<Provenance, ChassisEntry[]> {
  const out: Record<Provenance, ChassisEntry[]> = {
    system: [],
    module: [],
    world: [],
  };
  for (const e of entries) out[e.provenance].push(e);
  return out;
}

// ---------------------------------------------------------------------------
// Foundry-facing collector. Kept thin so the logic above stays testable.
// ---------------------------------------------------------------------------

interface FoundryPack {
  /** CompendiumCollection#collection, e.g. "pf2e.pathfinder-monster-core". */
  collection?: string;
  metadata: PackMeta;
  getIndex(options?: { fields?: string[] }): Promise<{ contents: IndexEntry[] }>;
}

/**
 * Read every Actor compendium into a chassis index.
 *
 * Level is not in the default index, so it is requested explicitly. Without
 * that, every entry comes back with `level: null` and level filtering silently
 * matches nothing.
 */
export async function buildChassisIndex(
  packs: readonly FoundryPack[]
): Promise<ChassisEntry[]> {
  const out: ChassisEntry[] = [];

  for (const pack of packs) {
    if (pack.metadata.type !== "Actor") continue;
    let index;
    try {
      index = await pack.getIndex({ fields: ["system.details.level.value"] });
    } catch {
      continue; // A broken pack should not take the whole index down.
    }
    // `collection` lives on the pack, not its metadata - merge it in.
    const meta: PackMeta = {
      ...pack.metadata,
      collection: pack.collection ?? pack.metadata.collection,
    };

    for (const entry of index.contents) {
      const chassis = toChassisEntry(meta, entry);
      if (chassis) out.push(chassis);
    }
  }

  return out;
}
