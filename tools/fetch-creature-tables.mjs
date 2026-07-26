#!/usr/bin/env node
/**
 * fetch-creature-tables.mjs
 *
 * Pulls the GM Core "Building Creatures" statistic tables from the Archives of
 * Nethys Elasticsearch index and emits them as a typed TypeScript module.
 *
 * Why a generator instead of a hand-written constant:
 *   - 12 tables x 26 level rows x up to 5 bands is ~1,500 numbers. Transcribing
 *     that by hand guarantees at least one silent error, and a silent error in
 *     this data means Creatureator quietly produces illegal creatures.
 *   - Re-runnable when Paizo errata a table.
 *   - The output is committed, so the module never calls AoN for scaling data at
 *     runtime. This script is a build-time tool only.
 *
 * Usage:  node tools/fetch-creature-tables.mjs
 * Output: src/data/creature-tables.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/data/creature-tables.ts");
const ENDPOINT = "https://elasticsearch.aonprd.com/aon/_search";

/**
 * The 12 Building Creatures pages that contain tables, confirmed by sweeping
 * rules-2874..rules-2930 against a live index on 2026-07-26.
 * `key` becomes the property name in the generated module.
 */
const PAGES = [
  { id: "rules-2881", key: "attributeModifiers" },
  { id: "rules-2882", key: "perception" },
  { id: "rules-2885", key: "skills" },
  // Table 2-4 is "Safe Items" — a creature-level -> max item-level lookup,
  // not a band table. Keyed rows are ranges ("3 or lower", "4-5"), so it
  // deliberately does not produce a byLevel map.
  { id: "rules-2887", key: "safeItems" },
  { id: "rules-2889", key: "armorClass" },
  { id: "rules-2890", key: "savingThrows" },
  { id: "rules-2891", key: "hitPoints" },
  { id: "rules-2893", key: "weaknessesResistances" },
  { id: "rules-2896", key: "strikeAttackBonus" },
  { id: "rules-2897", key: "strikeDamage" },
  { id: "rules-2899", key: "spellDC" },
  // Table 2-12 is "Area Damage", despite living on the
  // "Damage-Dealing Abilities" page.
  { id: "rules-2910", key: "areaDamage" },
];

/** AoN uses en-dashes for minus signs throughout. */
const normalise = (s) =>
  s
    .replace(/\*\*/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[–−]/g, "-") // en-dash, minus sign -> hyphen
    .trim();

/** "+13" -> 13, "-1" -> -1, "9" -> 9, "2d8+6" -> null (kept as string). */
function toNumber(raw) {
  const m = /^[+]?(-?\d+)$/.exec(raw);
  return m ? Number(m[1]) : null;
}

function parseTables(markdown) {
  const tables = [];
  // Section headings look like: "## Table 2-9: Strike Attack Bonus"
  const headings = [...markdown.matchAll(/##\s*(Table[^\n]*)/g)].map((m) =>
    normalise(m[1])
  );

  const blocks = [...markdown.matchAll(/<table>([\s\S]*?)<\/table>/g)];

  blocks.forEach((block, i) => {
    const rows = [...block[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
      [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
        normalise(c[1])
      )
    );
    if (!rows.length) return;

    const [header, ...body] = rows;
    tables.push({
      caption: headings[i] ?? `Table ${i + 1}`,
      columns: header,
      rows: body,
    });
  });

  return tables;
}

/**
 * Most tables are keyed by creature level in column 0, with band columns
 * (Extreme/High/Moderate/Low/Terrible) after. Shape those into a lookup;
 * leave anything that doesn't fit as raw rows so nothing is silently dropped.
 */
function shape(table) {
  const [first, ...bands] = table.columns;
  const levelKeyed = /level/i.test(first) && bands.length > 0;
  if (!levelKeyed) return { ...table, byLevel: null };

  const byLevel = {};
  for (const row of table.rows) {
    const level = toNumber(row[0]);
    if (level === null) continue;
    const entry = {};
    bands.forEach((band, i) => {
      const raw = row[i + 1];
      if (raw === undefined || raw === "") return;
      const n = toNumber(raw);
      entry[band.toLowerCase()] = n === null ? raw : n;
    });
    byLevel[level] = entry;
  }
  return { ...table, byLevel };
}

async function main() {
  const query = {
    size: 100,
    query: { ids: { values: PAGES.map((p) => p.id) } },
  };
  // GET with the `source` param avoids a CORS/preflight-style POST and works
  // identically against Elasticsearch.
  const url = `${ENDPOINT}?source_content_type=application/json&source=${encodeURIComponent(
    JSON.stringify(query)
  )}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`AoN responded ${res.status} ${res.statusText}`);
  const data = await res.json();
  const hits = data.hits?.hits ?? [];

  const byId = new Map(hits.map((h) => [h._id, h._source]));

  const missing = PAGES.filter((p) => !byId.has(p.id));
  if (missing.length) {
    throw new Error(
      `Missing pages from AoN: ${missing.map((m) => m.id).join(", ")}`
    );
  }

  const out = {};
  const report = [];
  for (const { id, key } of PAGES) {
    const src = byId.get(id);
    const tables = parseTables(src.markdown ?? "").map(shape);
    if (!tables.length) {
      report.push(`  ! ${key} (${id}) — no table parsed`);
      continue;
    }
    out[key] = {
      source: { id, name: src.name, page: src.source_markdown ?? null },
      tables,
    };
    const levels = tables[0].byLevel
      ? Object.keys(tables[0].byLevel).length
      : 0;
    report.push(
      `  ok ${key.padEnd(24)} ${tables.length} table(s), ${levels} level rows`
    );
  }

  const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node tools/fetch-creature-tables.mjs
//
// Source: Pathfinder GM Core, "Building Creatures" (pg. 112-124), retrieved via
// the Archives of Nethys index. Game mechanics are Open Game Content under the
// ORC licence; see NOTICE.md.
//
// Retrieved: ${new Date().toISOString()}
`;

  const body = `${banner}
export interface CreatureTable {
  caption: string;
  columns: string[];
  rows: string[][];
  byLevel: Record<string, Record<string, number | string>> | null;
}

export interface CreatureTableGroup {
  source: { id: string; name: string; page: string | null };
  tables: CreatureTable[];
}

export const CREATURE_TABLES = ${JSON.stringify(
    out,
    null,
    2
  )} as const satisfies Record<string, CreatureTableGroup>;

export type CreatureTableKey = keyof typeof CREATURE_TABLES;
`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, body, "utf8");

  console.log(report.join("\n"));
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exitCode = 1;
});
