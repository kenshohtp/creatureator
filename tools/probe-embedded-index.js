/**
 * What does an embedded item look like in a compendium index, and what does a
 * full sweep cost?
 *
 * Round one (23 Aug) established that `getIndex({fields: ["items"]})` returns
 * embedded items at all — 492 actors in 116ms, against 3,733ms to load the same
 * pack's documents. That killed the claim in ability-index.ts that the ~33,000
 * embedded abilities need every actor loaded. Extrapolated, the index route is
 * ~8s across every Actor pack where the document route is ~60s.
 *
 * Round two asks what is actually *in* those index entries, because that decides
 * what a search can do:
 *
 *   - name + type          -> searchable by name
 *   - + system.traits      -> filterable by trait
 *   - + system.description -> rankable on text
 *
 * and whether asking for deeper fields costs anything.
 *
 * Read-only. Paste into the Foundry console, or:
 *   eval(await (await fetch("modules/creatureator/tools/probe-embedded-index.js")).text())
 */

(async () => {
  const PACK = "pf2e.pathfinder-monster-core";
  const pack = game.packs.get(PACK);
  if (!pack) return console.error(`probe | ${PACK} not found`);

  const shape = async (fields, label) => {
    const t = performance.now();
    let idx;
    try { idx = await pack.getIndex({ fields }); }
    catch (e) { return console.log(`probe | ${label}: FAILED — ${e.message}`); }
    const ms = performance.now() - t;
    const withItems = idx.contents.filter((e) => Array.isArray(e.items) && e.items.length);
    const item = withItems[0]?.items?.find((i) => i.type === "action") ?? withItems[0]?.items?.[0];
    console.log(`probe | ${label}: ${ms.toFixed(0)}ms, ${withItems.length}/${idx.size} entries carry items`);
    if (item) {
      console.log(`probe |   item keys: ${Object.keys(item).join(", ")}`);
      console.log(`probe |   sample:`, JSON.parse(JSON.stringify(item)));
    }
    return idx;
  };

  await shape(["items"], 'fields: ["items"]');
  await shape(["items.name", "items.type", "items.system.traits.value"],
              'fields: ["items.name","items.type","items.system.traits.value"]');

  // What would a whole-install sweep actually cost, and how much does it find?
  const actorPacks = game.packs.filter((p) => p.metadata.type === "Actor");
  const t0 = performance.now();
  let entries = 0, actions = 0;
  const names = new Set(), traits = new Set();
  for (const p of actorPacks) {
    const idx = await p.getIndex({ fields: ["items"] });
    entries += idx.size;
    for (const e of idx.contents) {
      for (const i of e.items ?? []) {
        if (i.type !== "action") continue;
        actions++;
        if (i.name) names.add(i.name);
        for (const t of i.system?.traits?.value ?? []) traits.add(t);
      }
    }
  }
  const ms = performance.now() - t0;
  console.log(`probe | FULL SWEEP via index: ${actorPacks.length} packs, ${entries} actors in ${(ms/1000).toFixed(1)}s`);
  console.log(`probe |   embedded actions: ${actions}, unique names: ${names.size}, distinct traits: ${traits.size}`);
  if (performance.memory) {
    console.log(`probe |   JS heap now: ${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB`);
  }
})();
