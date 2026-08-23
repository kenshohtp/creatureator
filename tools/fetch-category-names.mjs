#!/usr/bin/env node
/**
 * fetch-category-names.mjs
 *
 * Harvests *names* from the Archives of Nethys, by category, so a local Foundry
 * install can be diffed against AoN's coverage.
 *
 * Why names only. ARCHITECTURE §7.7 measured the creature category and found
 * 98.34% of AoN's creatures already present locally, which closed the case for
 * an AoN importer. That measurement covered creatures alone. This script exists
 * to extend it to feats, spells, equipment and hazards without hand-waving —
 * the structural argument is the same, but "expect to hold" is not a number.
 *
 * With no arguments it does not download anything: it asks AoN for a breakdown
 * of every category and how many documents each holds. Guessing category names
 * would be the wrong way to start a measurement whose whole point is not
 * guessing.
 *
 *   node tools/fetch-category-names.mjs                      # list categories
 *   node tools/fetch-category-names.mjs feat spell hazard    # harvest those
 *
 * Output: test/fixtures/aon-names.json (gitignored, regenerable)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/fixtures/aon-names.json");
const ENDPOINT = "https://elasticsearch.aonprd.com/aon/_search";
const PAGE_SIZE = 500;

/**
 * Elasticsearch refuses deep paging beyond this by default. A category larger
 * than the cap is reported as truncated rather than silently cut short — §8's
 * "no silent caps" rule, which exists because a truncated harvest looks exactly
 * like a complete one.
 */
const DEEP_PAGE_CAP = 10000;

async function search(query) {
  const url = `${ENDPOINT}?source_content_type=application/json&source=${encodeURIComponent(
    JSON.stringify(query)
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 600);
    try {
      const p = JSON.parse(body);
      detail = p.error?.root_cause?.[0]?.reason ?? p.error?.reason ?? detail;
    } catch { /* not JSON */ }
    throw new Error(`AoN responded ${res.status} ${res.statusText}\n  ${detail}`);
  }
  return res.json();
}

/** Every category AoN indexes, with document counts. */
async function categories() {
  const data = await search({
    size: 0,
    aggs: { categories: { terms: { field: "category", size: 200 } } },
  });
  return (data.aggregations?.categories?.buckets ?? []).map((b) => ({
    category: b.key,
    count: b.doc_count,
  }));
}

async function harvest(category) {
  const out = [];
  let from = 0;
  let total = Infinity;
  let truncated = false;

  while (from < total) {
    const data = await search({
      size: PAGE_SIZE,
      from,
      sort: ["_doc"],
      _source: ["name", "category", "source", "level", "type"],
      query: { bool: { filter: [{ term: { category } }] } },
    });
    total = data.hits?.total?.value ?? 0;
    const hits = data.hits?.hits ?? [];
    if (!hits.length) break;
    out.push(...hits.map((h) => h._source));
    from += hits.length;
    process.stdout.write(`\r  ${category}: ${out.length}/${total}`);
    if (from >= DEEP_PAGE_CAP) { truncated = true; break; }
  }
  process.stdout.write("\n");
  if (truncated) {
    console.log(`  ! ${category} TRUNCATED at ${DEEP_PAGE_CAP} of ${total} — the diff for this category is incomplete`);
  }
  return { category, total, retrieved: out.length, truncated, docs: out };
}

async function main(argv) {
  const wanted = argv.filter((a) => !a.startsWith("--"));

  if (!wanted.length) {
    console.log("AoN categories and document counts:\n");
    const cats = await categories();
    for (const c of cats) console.log(`  ${String(c.count).padStart(7)}  ${c.category}`);
    console.log(`\n${cats.length} categories, ${cats.reduce((n, c) => n + c.count, 0)} documents.`);
    console.log("\nRe-run with category names to harvest, e.g.:");
    console.log("  node tools/fetch-category-names.mjs feat spell equipment hazard");
    return;
  }

  const results = [];
  for (const c of wanted) results.push(await harvest(c));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ retrieved: new Date().toISOString(), results }, null, 1),
    "utf8"
  );
  console.log(`\nWrote ${OUT}`);
  for (const r of results) {
    console.log(`  ${r.category}: ${r.retrieved} of ${r.total}${r.truncated ? " (TRUNCATED)" : ""}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
