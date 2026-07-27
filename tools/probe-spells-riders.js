/**
 * probe-spells-riders.js
 *
 * Paste into the Foundry console (F12) on a PF2e world.
 *
 * Two open questions, both blocking:
 *
 *   1. SPELLCASTERS (43% of sampled creatures). What does a spellcastingEntry
 *      actually store? Where do the DC and spell attack modifier live, and how
 *      are spell ranks organised? The generated `spellDC` table pairs a DC with
 *      an attack bonus, so we need to know which fields those map onto.
 *
 *   2. DAMAGE RIDERS (256 sampled Strikes carry more than one damage roll).
 *      What are the secondary rolls actually made of - energy damage that
 *      should scale with level, or persistent/splash values that should not?
 *      The `category` and `damageType` fields should tell us.
 *
 * Samples from the big Remaster packs only, so it runs quickly.
 */

(async () => {
  const PACKS = [
    "pf2e.pathfinder-monster-core",
    "pf2e.pathfinder-monster-core-2",
    "pf2e.pathfinder-npc-core",
  ];
  const SAMPLE = 60;

  const riders = {
    total: 0,
    byCategory: {},
    byType: {},
    flatVsDice: { flat: 0, dice: 0, other: 0 },
    examples: [],
  };
  const casters = { total: 0, byTradition: {}, byPrepared: {}, examples: [] };
  let firstEntry = null;
  let firstSpell = null;

  for (const key of PACKS) {
    const pack = game.packs.get(key);
    if (!pack) continue;
    const idx = await pack.getIndex();
    const npcs = idx.contents.filter((e) => e.type === "npc");
    const stride = Math.max(1, Math.floor(npcs.length / SAMPLE));
    const picks = npcs.filter((_, i) => i % stride === 0).slice(0, SAMPLE);

    for (const entry of picks) {
      const src = (await pack.getDocument(entry._id)).toObject();
      const level = src.system?.details?.level?.value;
      const items = src.items ?? [];

      // --- spellcasting ---
      const sc = items.filter((i) => i.type === "spellcastingEntry");
      if (sc.length) {
        casters.total++;
        for (const e of sc) {
          const trad = e.system?.tradition?.value ?? "?";
          const prep = e.system?.prepared?.value ?? "?";
          casters.byTradition[trad] = (casters.byTradition[trad] ?? 0) + 1;
          casters.byPrepared[prep] = (casters.byPrepared[prep] ?? 0) + 1;
          if (casters.examples.length < 8) {
            casters.examples.push({
              name: entry.name,
              level,
              entry: e.name,
              tradition: trad,
              prepared: prep,
              dc: e.system?.spelldc?.dc,
              attack: e.system?.spelldc?.value,
              spellCount: items.filter((i) => i.type === "spell").length,
            });
          }
          if (!firstEntry) firstEntry = e;
        }
        if (!firstSpell) firstSpell = items.find((i) => i.type === "spell") ?? null;
      }

      // --- damage riders ---
      for (const s of items.filter((i) => i.type === "melee")) {
        const rolls = Object.values(s.system?.damageRolls ?? {});
        if (rolls.length < 2) continue;
        rolls.slice(1).forEach((r) => {
          riders.total++;
          const cat = r.category ?? "null";
          riders.byCategory[cat] = (riders.byCategory[cat] ?? 0) + 1;
          riders.byType[r.damageType] = (riders.byType[r.damageType] ?? 0) + 1;

          const d = String(r.damage ?? "");
          if (/^\s*\d+\s*$/.test(d)) riders.flatVsDice.flat++;
          else if (/^\s*\d*d\d+\s*(?:[+-]\s*\d+)?\s*$/.test(d)) riders.flatVsDice.dice++;
          else riders.flatVsDice.other++;

          if (riders.examples.length < 15) {
            riders.examples.push(
              `L${level} ${entry.name} / ${s.name}: primary "${rolls[0].damage}" ` +
              `+ "${d}" ${r.damageType}${r.category ? ` [${r.category}]` : ""}`
            );
          }
        });
      }
    }
  }

  console.log("=== spellcasters ===");
  console.log("  creatures with a spellcasting entry:", casters.total);
  console.log("  traditions:", casters.byTradition);
  console.log("  prepared field:", casters.byPrepared);
  console.table(casters.examples);

  console.log("\n=== a full spellcastingEntry ===");
  console.log(JSON.stringify(firstEntry, null, 1)?.slice(0, 1800));

  console.log("\n=== a full spell item (system only) ===");
  console.log(JSON.stringify(firstSpell?.system, null, 1)?.slice(0, 1800));

  console.log("\n=== damage riders ===");
  console.log("  secondary rolls seen:", riders.total);
  console.log("  by category:", riders.byCategory);
  console.log("  by damage type:", riders.byType);
  console.log("  formula shape:", riders.flatVsDice);
  console.log("\n  examples:");
  riders.examples.forEach((e) => console.log("    " + e));

  window.__probe2 = { casters, riders, firstEntry, firstSpell };
  console.log("\nfull result on window.__probe2");
})();
