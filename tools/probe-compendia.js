/**
 * probe-compendia.js
 *
 * Paste into the Foundry console (F12) on a PF2e world.
 *
 * Answers the questions the chassis picker needs, against a real install
 * rather than assumption:
 *
 *   1. What Actor compendia exist, how big, and from which package?
 *   2. Which provenance fields distinguish system / module / world content?
 *   3. Do the data paths in src/pf2e/npc.ts hold across many creatures, or
 *      only for the one we sampled?
 *   4. What shapes exist that the mapper does not yet handle (spellcasters,
 *      ranged Strikes, multi-roll damage, non-standard formulas)?
 *
 * Output is compact and safe to paste back. Full sample lands on
 * window.__probe for follow-up.
 */

(async () => {
  const SAMPLE_PER_PACK = 12;

  const out = {
    versions: {
      core: game.version,
      system: `${game.system.id} ${game.system.version}`,
    },
    packs: [],
    coverage: {},
    shapes: {
      spellcasters: 0,
      rangedStrikes: 0,
      multiRollStrikes: 0,
      oddDamageFormulas: [],
      noStrikes: 0,
    },
    anomalies: [],
  };

  // --- 1. Pack inventory ----------------------------------------------------
  const actorPacks = game.packs.filter((p) => p.metadata.type === "Actor");
  for (const p of actorPacks) {
    const idx = await p.getIndex();
    out.packs.push({
      collection: p.collection,
      label: p.metadata.label,
      packageType: p.metadata.packageType, // "system" | "module" | "world"
      packageName: p.metadata.packageName,
      count: idx.size,
    });
  }

  // --- 2. Sample creatures --------------------------------------------------
  const FIELDS = {
    level: (s) => s.system?.details?.level?.value,
    ac: (s) => s.system?.attributes?.ac?.value,
    hpMax: (s) => s.system?.attributes?.hp?.max,
    perception: (s) => s.system?.perception?.mod,
    fortitude: (s) => s.system?.saves?.fortitude?.value,
    strMod: (s) => s.system?.abilities?.str?.mod,
    skills: (s) => s.system?.skills,
  };
  for (const k of Object.keys(FIELDS)) out.coverage[k] = { ok: 0, missing: 0 };

  const sample = [];

  for (const p of actorPacks) {
    const idx = await p.getIndex();
    const npcs = idx.contents.filter((e) => e.type === "npc");
    // Spread the sample across the pack rather than taking the first N,
    // so we see a range of levels rather than a cluster of low ones.
    const stride = Math.max(1, Math.floor(npcs.length / SAMPLE_PER_PACK));
    const picks = npcs.filter((_, i) => i % stride === 0).slice(0, SAMPLE_PER_PACK);

    for (const entry of picks) {
      let src;
      try {
        src = (await p.getDocument(entry._id)).toObject();
      } catch (e) {
        out.anomalies.push(`${p.collection}/${entry.name}: ${e.message}`);
        continue;
      }

      for (const [name, get] of Object.entries(FIELDS)) {
        const v = get(src);
        if (v === undefined || v === null) {
          out.coverage[name].missing++;
          if (out.anomalies.length < 25) {
            out.anomalies.push(`${entry.name} (L${get === FIELDS.level ? "?" : src.system?.details?.level?.value}): missing ${name}`);
          }
        } else {
          out.coverage[name].ok++;
        }
      }

      const items = src.items ?? [];
      const strikes = items.filter((i) => i.type === "melee");
      if (!strikes.length) out.shapes.noStrikes++;
      if (items.some((i) => i.type === "spellcastingEntry")) out.shapes.spellcasters++;

      for (const s of strikes) {
        if (s.system?.range !== null && s.system?.range !== undefined) {
          out.shapes.rangedStrikes++;
        }
        const rolls = Object.values(s.system?.damageRolls ?? {});
        if (rolls.length > 1) out.shapes.multiRollStrikes++;
        for (const r of rolls) {
          // Our parser handles simple NdX+M only.
          if (r.damage && !/^\s*\d*d\d+\s*(?:[+-]\s*\d+)?\s*$/.test(r.damage)) {
            if (out.shapes.oddDamageFormulas.length < 20) {
              out.shapes.oddDamageFormulas.push(`${entry.name}: "${r.damage}"`);
            }
          }
        }
      }

      sample.push({
        name: entry.name,
        pack: p.collection,
        level: src.system?.details?.level?.value,
        compendiumSource: src._stats?.compendiumSource ?? null,
        systemVersion: src._stats?.systemVersion ?? null,
      });
    }
  }

  // --- 3. Report ------------------------------------------------------------
  console.log("=== versions ===", out.versions);

  console.log("\n=== Actor packs ===");
  console.table(out.packs);

  console.log(`\n=== field coverage (${sample.length} creatures sampled) ===`);
  console.table(out.coverage);

  console.log("\n=== shapes ===", out.shapes);

  if (out.anomalies.length) {
    console.log("\n=== anomalies ===");
    out.anomalies.forEach((a) => console.log("  " + a));
  }

  console.log("\n=== level spread ===");
  const levels = sample.map((s) => s.level).filter((n) => typeof n === "number");
  console.log(`  n=${levels.length} min=${Math.min(...levels)} max=${Math.max(...levels)}`);

  window.__probe = { ...out, sample };
  console.log("\nfull result on window.__probe");
})();
