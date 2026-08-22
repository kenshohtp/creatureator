/**
 * probe-abilities.js
 *
 * Paste into the Foundry console (F12) on a PF2e world.
 *
 * Answers the questions ability grafting needs, against a real install rather
 * than assumption. Grafting is the part of this module that touches the most
 * unknown data, so everything below is a question we would otherwise guess at:
 *
 *   1. Where do creature abilities actually live? Embedded in each actor, in a
 *      shared glossary compendium, or both?
 *   2. What item types carry them, and in what proportion?
 *   3. What does an `action` item look like - action cost, category, traits,
 *      publication - and which of those fields are reliably present?
 *   4. How are level-scaled numbers written inside ability text? PF2e uses
 *      inline @Check / @Damage / @Template syntax, and if a grafted ability
 *      carries a DC or a damage expression, THAT is the thing the scaling
 *      engine has to rewrite. This is the single most important answer here.
 *   5. How common are rule elements on ability items, and which types?
 *
 * Output is compact and safe to paste back. Full sample lands on
 * window.__abilities for follow-up.
 */

(async () => {
  const SAMPLE_ACTORS = 120;
  const SAMPLE_ITEMS = 400;

  const out = {
    versions: { core: game.version, system: `${game.system.id} ${game.system.version}` },
    itemPacks: [],
    glossary: null,
    embedded: { itemTypes: {}, actorsSampled: 0, abilitiesSeen: 0 },
    actionShape: { actionType: {}, actionsValue: {}, category: {}, hasTraits: 0, hasPublication: 0, hasRules: 0 },
    inlines: { check: 0, damage: 0, template: 0, legacyRoll: 0, bareDC: 0, bareDice: 0, none: 0 },
    inlineExamples: [],
    ruleTypes: {},
    anomalies: [],
  };

  const bump = (bag, key) => { const k = String(key); bag[k] = (bag[k] ?? 0) + 1; };

  // --- 1. Item compendia ----------------------------------------------------
  const itemPacks = game.packs.filter((p) => p.metadata.type === "Item");
  for (const p of itemPacks) {
    let size = null;
    try { size = (await p.getIndex()).size; } catch (e) { out.anomalies.push(`${p.collection}: ${e.message}`); }
    out.itemPacks.push({
      collection: p.collection,
      label: p.metadata.label,
      packageType: p.metadata.packageType,
      count: size,
    });
  }

  // --- 2. The bestiary ability glossary, if it is installed -----------------
  // PF2e ships shared creature abilities (Grab, Constrict, Attack of Opportunity)
  // as real items. If they are here, grafting can reuse them with their
  // automation intact rather than authoring text.
  const glossary = game.packs.find((p) => /ability-glossary/.test(p.collection));
  if (glossary) {
    const idx = await glossary.getIndex({ fields: ["type", "system.actionType.value", "system.actions.value"] });
    const types = {};
    for (const e of idx) bump(types, e.type);
    out.glossary = {
      collection: glossary.collection,
      count: idx.size,
      types,
      firstTen: idx.contents.slice(0, 10).map((e) => e.name),
    };
  }

  // --- 3. What creatures actually carry -------------------------------------
  const actorPacks = game.packs.filter((p) => p.metadata.type === "Actor");
  const abilityItems = [];

  for (const p of actorPacks) {
    const idx = await p.getIndex();
    const npcs = idx.contents.filter((e) => e.type === "npc");
    if (!npcs.length) continue;
    const stride = Math.max(1, Math.floor(npcs.length / Math.ceil(SAMPLE_ACTORS / actorPacks.length)));
    const picks = npcs.filter((_, i) => i % stride === 0);

    for (const entry of picks) {
      if (out.embedded.actorsSampled >= SAMPLE_ACTORS) break;
      let src;
      try { src = (await p.getDocument(entry._id)).toObject(); }
      catch (e) { out.anomalies.push(`${entry.name}: ${e.message}`); continue; }

      out.embedded.actorsSampled++;
      const level = src.system?.details?.level?.value;

      for (const item of src.items ?? []) {
        bump(out.embedded.itemTypes, item.type);
        if (item.type !== "action") continue;
        out.embedded.abilitiesSeen++;
        if (abilityItems.length < SAMPLE_ITEMS) {
          abilityItems.push({ item, actor: entry.name, level, pack: p.collection });
        }
      }
    }
  }

  // --- 4. The shape of an `action` item, and how numbers are written --------
  const CHECK = /@Check\[[^\]]+\]/g;
  const DAMAGE = /@Damage\[[^\]]+\]/g;
  const TEMPLATE = /@Template\[[^\]]+\]/g;
  const LEGACY = /\[\[\/[rbg][^\]]*\]\]/g;
  const BARE_DC = /\bDC\s*\d+/g;
  const BARE_DICE = /\b\d+d\d+(?:[+-]\d+)?\b/g;

  for (const { item, actor, level } of abilityItems) {
    const sys = item.system ?? {};
    bump(out.actionShape.actionType, sys.actionType?.value);
    bump(out.actionShape.actionsValue, sys.actions?.value);
    bump(out.actionShape.category, sys.category);
    if (Array.isArray(sys.traits?.value) && sys.traits.value.length) out.actionShape.hasTraits++;
    if (sys.publication || sys.source) out.actionShape.hasPublication++;
    if (Array.isArray(item.system?.rules) && item.system.rules.length) {
      out.actionShape.hasRules++;
      for (const r of item.system.rules) bump(out.ruleTypes, r.key);
    }

    const text = String(sys.description?.value ?? "");
    const found = {
      check: (text.match(CHECK) ?? []).length,
      damage: (text.match(DAMAGE) ?? []).length,
      template: (text.match(TEMPLATE) ?? []).length,
      legacyRoll: (text.match(LEGACY) ?? []).length,
    };
    // Only count "bare" numbers that are NOT already inside inline syntax -
    // a DC written as plain text is one the engine would have to find itself.
    const stripped = text.replace(CHECK, "").replace(DAMAGE, "").replace(LEGACY, "");
    found.bareDC = (stripped.match(BARE_DC) ?? []).length;
    found.bareDice = (stripped.match(BARE_DICE) ?? []).length;

    let any = false;
    for (const k of Object.keys(found)) {
      if (found[k]) { out.inlines[k] += found[k]; any = true; }
    }
    if (!any) out.inlines.none++;

    if (any && out.inlineExamples.length < 15) {
      const sample = (text.match(CHECK) ?? [])[0] ?? (text.match(DAMAGE) ?? [])[0]
        ?? (text.match(LEGACY) ?? [])[0] ?? (stripped.match(BARE_DC) ?? [])[0]
        ?? (stripped.match(BARE_DICE) ?? [])[0];
      out.inlineExamples.push(`L${level} ${actor} / ${item.name}: ${sample}`);
    }
  }

  // --- 5. Report ------------------------------------------------------------
  console.log("=== versions ===", out.versions);

  console.log("\n=== Item packs ===");
  console.table(out.itemPacks);

  console.log("\n=== bestiary ability glossary ===");
  console.log(out.glossary ?? "  NOT INSTALLED - grafting cannot reuse shared ability items");

  console.log(`\n=== items embedded in ${out.embedded.actorsSampled} sampled creatures ===`);
  console.table(out.embedded.itemTypes);
  console.log(`  action items seen: ${out.embedded.abilitiesSeen}, inspected: ${Math.min(out.embedded.abilitiesSeen, SAMPLE_ITEMS)}`);

  console.log("\n=== action item shape ===");
  console.log("  actionType:", out.actionShape.actionType);
  console.log("  actions.value:", out.actionShape.actionsValue);
  console.log("  category:", out.actionShape.category);
  console.log(`  with traits: ${out.actionShape.hasTraits}, with publication: ${out.actionShape.hasPublication}, with rule elements: ${out.actionShape.hasRules}`);

  console.log("\n=== how numbers are written in ability text ===");
  console.log("  (this decides how a grafted ability gets rescaled)");
  console.table(out.inlines);
  console.log("\n=== examples ===");
  out.inlineExamples.forEach((e) => console.log("  " + e));

  if (Object.keys(out.ruleTypes).length) {
    console.log("\n=== rule element keys ===", out.ruleTypes);
  }
  if (out.anomalies.length) {
    console.log("\n=== anomalies ===");
    out.anomalies.slice(0, 20).forEach((a) => console.log("  " + a));
  }

  window.__abilities = { ...out, sample: abilityItems.slice(0, 40) };
  console.log("\nfull result on window.__abilities");
})();
