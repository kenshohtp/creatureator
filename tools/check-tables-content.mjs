/**
 * Assert that the generated tables carry mechanics and nothing else.
 *
 * `src/data/creature-tables.ts` is generated from GM Core's Building Creatures
 * tables and is the only Paizo-derived content this module redistributes.
 * NOTICE.md turns on that being *mechanics* — numeric benchmarks, band names,
 * column headers — with no creature names, descriptions or setting material.
 * That claim needs re-checking every time `npm run fetch:tables` regenerates
 * the file, and "read 4,104 lines carefully" is not a check anyone repeats.
 *
 * So: enumerate every string literal in the file, drop the ones that are purely
 * numeric, and print what remains. The residue is small enough to read in one
 * screen — 140 strings as of 23 Aug 2026, all of them band names, headers,
 * table captions, page citations, object keys, or item examples such as
 * `10 (_+2 striking weapon_)`.
 *
 * This prints rather than asserts. A creature name is obvious to a human
 * scanning the list and hard to characterise in a regex without either false
 * alarms on "Strike Attack Bonus" or false silence on a real leak. The tool's
 * job is to make the check cheap, not to pretend it can be automated away.
 *
 *   node tools/check-tables-content.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const FILE = fileURLToPath(new URL("../src/data/creature-tables.ts", import.meta.url));

/** Numbers, dice, signed ranges, dashes — anything with no words in it. */
const PURELY_NUMERIC = /^[-+\u2014\u2013]?[\d\s()+\-\u2013\u2014.,/dxX]*$/;

export function nonNumericStrings(source) {
  const found = new Set();
  for (const m of source.matchAll(/"([^"\\]{1,80})"/g)) {
    const v = m[1].trim();
    if (v && !PURELY_NUMERIC.test(v)) found.add(v);
  }
  return [...found].sort();
}

function main() {
  const strings = nonNumericStrings(readFileSync(FILE, "utf8"));
  console.log(`${strings.length} distinct non-numeric strings in src/data/creature-tables.ts\n`);
  for (const s of strings) console.log("  " + s);
  console.log(
    "\nRead the list. Every entry should be a band name, a column header, a table\n" +
    "caption, a GM Core page citation, an object key, or an item example. Anything\n" +
    "that reads like a creature name or a sentence of description does not belong\n" +
    "in a redistributed file — see NOTICE.md."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
