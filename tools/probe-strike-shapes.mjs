/**
 * How do published creatures actually shape Strike damage?
 *
 * Written to settle the residual question in ARCHITECTURE §7.3 / handoff §6.6:
 * preserving a chassis's die size pushes growth into the flat modifier, so
 * `1d4+3` at level 3 rescales to `2d4+10` at level 10. That was recorded as a
 * cosmetic wart on the assumption that published d4 creatures sit near `2d4+8`.
 *
 * They do — and `2d4+10` is also in print ten times over. See §7.3 for the
 * numbers this produces and the conclusion drawn from them.
 *
 * Reads the packs off disk via read-pack.mjs; Foundry need not be running.
 *
 *   node tools/probe-strike-shapes.mjs <packs-root>
 *   node tools/probe-strike-shapes.mjs <packs-root> --faces 4 --levels 8-12
 */

import { readPack } from "./read-pack.mjs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const FORMULA = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

const isPack = (d) => {
  try { return statSync(d).isDirectory() && readdirSync(d).some((f) => f.endsWith(".ldb")); }
  catch { return false; }
};

/**
 * Every NPC Strike in every pack, with its creature's level.
 *
 * Persistent and splash rolls are skipped and the largest remaining average is
 * taken as the primary — the same rule as `primaryDamageIndex` in
 * src/pf2e/npc.ts, because bestiary damage rolls are keyed by random id and
 * enumeration order means nothing (§5).
 */
function harvest(root) {
  const strikes = [];
  for (const dir of readdirSync(root).map((d) => join(root, d)).filter(isPack)) {
    const docs = readPack(dir);
    const level = new Map();
    for (const [key, doc] of docs) {
      const m = /^!actors!(.+)$/.exec(key);
      if (m && doc.type === "npc") level.set(m[1], doc.system?.details?.level?.value);
    }
    for (const [key, doc] of docs) {
      const m = /^!actors\.items!([^.]+)\./.exec(key);
      if (!m || doc.type !== "melee") continue;
      const lv = level.get(m[1]);
      if (typeof lv !== "number") continue;

      let best = null;
      for (const roll of Object.values(doc.system?.damageRolls ?? {})) {
        if (roll.category === "persistent" || roll.category === "splash") continue;
        const p = FORMULA.exec(String(roll.damage ?? ""));
        if (!p) continue;
        const count = p[1] === "" ? 1 : Number(p[1]);
        const faces = Number(p[2]);
        const modifier = p[3] ? Number(p[4]) * (p[3] === "-" ? -1 : 1) : 0;
        const average = (count * (faces + 1)) / 2 + modifier;
        if (!best || average > best.average) best = { count, faces, modifier, average };
      }
      if (best) strikes.push({ level: lv, ...best });
    }
  }
  return strikes;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const bandOf = (l) => (l <= 3 ? "0-3" : l <= 7 ? "4-7" : l <= 11 ? "8-11" : l <= 15 ? "12-15" : "16+");

function main(argv) {
  const root = argv.find((a) => !a.startsWith("--"));
  if (!root) { console.error("usage: node tools/probe-strike-shapes.mjs <packs-root> [--faces N] [--levels A-B]"); process.exit(2); }
  const faces = argv.includes("--faces") ? Number(argv[argv.indexOf("--faces") + 1]) : null;
  const range = argv.includes("--levels") ? argv[argv.indexOf("--levels") + 1].split("-").map(Number) : null;

  const all = harvest(root);
  console.log(`strikes harvested: ${all.length}`);

  if (faces) {
    const [lo, hi] = range ?? [-1, 25];
    const sel = all.filter((s) => s.faces === faces && s.level >= lo && s.level <= hi);
    console.log(`\nd${faces}, levels ${lo}-${hi}: ${sel.length} strikes`);
    const tally = new Map();
    for (const s of sel) {
      const k = `${s.count}d${faces}${s.modifier >= 0 ? "+" : ""}${s.modifier}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    console.log("\n  n   shape      average");
    for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) {
      const p = FORMULA.exec(k);
      const avg = Number(p[1]) * (faces + 1) / 2 + (p[3] === "-" ? -1 : 1) * Number(p[4] ?? 0);
      console.log(`  ${String(n).padStart(3)}  ${k.padEnd(9)}  ${avg}`);
    }
    return;
  }

  // The question behind §7.3: is the share of damage coming from dice constant
  // across die sizes, or do small dice lean on the flat modifier in print too?
  const groups = new Map();
  for (const s of all) {
    const key = `${bandOf(s.level)}|d${s.faces}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  console.log("\nlevels   die     n   median count   median mod   dice share");
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key);
    if (g.length < 15) continue;
    const [lv, die] = key.split("|");
    const share = median(g.map((s) => (s.count * (s.faces + 1) / 2) / s.average));
    console.log(
      `${lv.padEnd(8)} ${die.padEnd(5)} ${String(g.length).padStart(5)}` +
      `   ${String(median(g.map((s) => s.count))).padStart(12)}` +
      `   ${String(median(g.map((s) => s.modifier))).padStart(10)}` +
      `   ${(share * 100).toFixed(0).padStart(8)}%`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
