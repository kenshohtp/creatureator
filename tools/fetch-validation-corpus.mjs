#!/usr/bin/env node
/**
 * fetch-validation-corpus.mjs
 *
 * Harvests published creature statistics from the Archives of Nethys into a
 * test fixture, so the scaling engine can be validated against a few thousand
 * real Paizo creatures rather than a single hand-checked example.
 *
 * The interesting part: every AoN creature document carries `*_scale_number`
 * fields alongside its raw statistics (`ac` / `ac_scale_number`,
 * `perception` / `perception_scale_number`, and so on). These appear to be
 * band labels — which, if true, is a ready-made oracle for `classify()`.
 *
 * The encoding is NOT yet decoded, and deliberately not guessed at here. Spot
 * checks are contradictory: Husk Zombie's Perception +5 is exactly Low at L2 and
 * carries scale_number 2, while its Str +4 is exactly High and carries
 * scale_number 4. Those do not fit a single consistent ordering, likely because
 * tables have different band counts (Hit Points has no Extreme; AC has no
 * Terrible) and the scale may be per-table rather than global.
 *
 * So this script only *collects*. Decoding happens in a test, where the
 * generated tables are importable and the mapping can be derived empirically
 * and asserted rather than assumed.
 *
 * Usage:  node tools/fetch-validation-corpus.mjs
 * Output: test/fixtures/creature-corpus.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/fixtures/creature-corpus.json");
const ENDPOINT = "https://elasticsearch.aonprd.com/aon/_search";
const PAGE_SIZE = 500;

/** Raw statistic paired with its suspected band label. */
const STAT_FIELDS = [
  "ac", "ac_scale_number",
  "hp_raw", "hp_scale_number",
  "fortitude_save", "fortitude_save_scale_number",
  "reflex_save", "reflex_save_scale_number",
  "will_save", "will_save_scale_number",
  "perception", "perception_scale_number",
  "attack_bonus", "attack_bonus_scale_number",
  "strike_damage_average", "strike_damage_scale_number",
  "strength", "strength_scale_number",
  "dexterity", "dexterity_scale_number",
  "constitution", "constitution_scale_number",
  "intelligence", "intelligence_scale_number",
  "wisdom", "wisdom_scale_number",
  "charisma", "charisma_scale_number",
];

const META_FIELDS = [
  "name", "level", "url", "rarity", "source", "trait",
  "weakness", "resistance",
];

async function fetchPage(from) {
  const query = {
    size: PAGE_SIZE,
    from,
    sort: [{ level: "asc" }, { name: "asc" }],
    _source: [...META_FIELDS, ...STAT_FIELDS],
    query: {
      bool: {
        filter: [{ term: { category: "creature" } }],
        // Only creatures with a level and an AC are usable as fixtures.
        must: [{ exists: { field: "level" } }, { exists: { field: "ac" } }],
      },
    },
  };

  const url = `${ENDPOINT}?source_content_type=application/json&source=${encodeURIComponent(
    JSON.stringify(query)
  )}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`AoN responded ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  const creatures = [];
  let from = 0;
  let total = Infinity;

  while (from < total) {
    const data = await fetchPage(from);
    total = data.hits?.total?.value ?? 0;
    const hits = data.hits?.hits ?? [];
    if (!hits.length) break;
    creatures.push(...hits.map((h) => h._source));
    from += hits.length;
    process.stdout.write(`\r  fetched ${creatures.length}/${total}`);
    // Elasticsearch caps deep paging at 10k by default.
    if (from >= 10000) break;
  }
  process.stdout.write("\n");

  // A quick census so it is obvious whether the scale fields are worth trusting.
  const census = {};
  for (const c of creatures) {
    for (const f of STAT_FIELDS.filter((f) => f.endsWith("_scale_number"))) {
      const v = c[f];
      if (v === undefined) continue;
      const vals = Array.isArray(v) ? v : [v];
      census[f] ??= {};
      for (const n of vals) census[f][n] = (census[f][n] ?? 0) + 1;
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        retrieved: new Date().toISOString(),
        count: creatures.length,
        note: "Game mechanics are Open Game Content. Test fixture only.",
        creatures,
      },
      null,
      1
    ),
    "utf8"
  );

  console.log("\n  scale_number value distribution:");
  for (const [field, counts] of Object.entries(census)) {
    const seen = Object.keys(counts).sort((a, b) => a - b);
    console.log(`    ${field.padEnd(38)} values: ${seen.join(", ")}`);
  }
  console.log(`\nWrote ${creatures.length} creatures to ${OUT}`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exitCode = 1;
});
