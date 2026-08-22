/**
 * probe-ability-numbers.js
 *
 * Paste into the Foundry console (F12) on a PF2e world. Takes a minute or two.
 *
 * Harvests every save DC and damage expression written into creature ability
 * text, paired with the level of the creature that carries it, and saves the
 * result as a JSON file.
 *
 * WHY: grafting an ability onto a rescaled creature means rewriting the numbers
 * inside it, and we do not yet know which Building Creatures table governs an
 * ability's save DC. Table 2-11 (Spell DC) is the obvious candidate, but that
 * is a guess, and this project's record with guesses about Paizo's numbers is
 * poor. Paizo has already published thousands of abilities at known levels;
 * that is an oracle, exactly like the AoN corpus was for the classifier.
 *
 * Nothing is written to your world. The output file is data only.
 *
 * WHERE IT LANDS: your browser's download folder, as
 * `creatureator-ability-numbers.json`. Move it to:
 *
 *     C:\Projects\creatureator\test\fixtures\ability-numbers.json
 *
 * It is gitignored alongside the creature corpus - several MB and regenerable.
 */

(async () => {
  const MAX_CREATURES = 2500;

  const CHECK_OPEN = "@Check[";
  const DAMAGE_OPEN = "@Damage[";

  /** Bracket-depth scan: @Damage[2d6[poison]] has nested brackets. */
  const matchBracket = (text, open) => {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]" && --depth === 0) return i;
    }
    return -1;
  };

  const inners = (text, token) => {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      if (!text.startsWith(token, i)) continue;
      const open = i + token.length - 1;
      const close = matchBracket(text, open);
      if (close < 0) continue;
      out.push(text.slice(open + 1, close));
      i = close;
    }
    return out;
  };

  /**
   * Quieten PF2e's own validation complaints for the duration of the harvest.
   *
   * Loading any actor from a pre-remaster adventure-path bestiary makes the
   * system log "evil is not a valid choice" - those books still carry the old
   * alignment traits, which PF2e 8.x no longer accepts. Nothing to do with this
   * probe, but a few hundred of them with stack traces bury the output.
   *
   * Restored when the harvest finishes, and on a timer as a safety net so a
   * crash mid-run cannot leave the console permanently muffled.
   */
  const silence = () => {
    const real = { warn: console.warn, error: console.error };
    let suppressed = 0;
    const noisy = (args) =>
      /element-validation failure|is not a valid choice/.test(String(args[0] ?? ""));
    console.warn = (...args) => { if (noisy(args)) { suppressed++; return; } real.warn(...args); };
    console.error = (...args) => { if (noisy(args)) { suppressed++; return; } real.error(...args); };

    let done = false;
    const restore = () => {
      if (done) return suppressed;
      done = true;
      console.warn = real.warn;
      console.error = real.error;
      return suppressed;
    };
    setTimeout(restore, 5 * 60 * 1000);
    return restore;
  };
  const restoreConsole = silence();

  const rows = { checks: [], damage: [], meta: {}, legacyTraits: [] };

  /** Alignment traits removed by the remaster; PF2e 8.x refuses them. */
  const LEGACY_TRAITS = new Set(["good", "evil", "lawful", "chaotic"]);
  const actorPacks = game.packs.filter((p) => p.metadata.type === "Actor");

  // Spread the sample across every pack rather than exhausting the first few,
  // so the level range matches the bestiary rather than one book's.
  const plans = [];
  for (const p of actorPacks) {
    const idx = await p.getIndex();
    const npcs = idx.contents.filter((e) => e.type === "npc");
    if (npcs.length) plans.push({ pack: p, npcs });
  }
  const totalNpcs = plans.reduce((n, x) => n + x.npcs.length, 0);
  const stride = Math.max(1, Math.ceil(totalNpcs / MAX_CREATURES));

  console.log(`creatureator | ${totalNpcs} NPCs across ${plans.length} packs; sampling every ${stride}`);

  let seen = 0;
  let sampled = 0;

  for (const { pack, npcs } of plans) {
    for (const entry of npcs) {
      if (seen++ % stride !== 0) continue;

      let src;
      try { src = (await pack.getDocument(entry._id)).toObject(); } catch { continue; }
      sampled++;
      if (sampled % 250 === 0) console.log(`  ...${sampled} creatures`);

      const level = src.system?.details?.level?.value;
      if (typeof level !== "number") continue;

      for (const item of src.items ?? []) {
        if (item.type !== "action") continue;
        const sys = item.system ?? {};
        const text = String(sys.description?.value ?? "");
        if (!text) continue;

        const traits = Array.isArray(sys.traits?.value) ? sys.traits.value : [];

        // Grafting-relevant: an ability copied out of an older adventure path
        // can carry a trait the current system rejects, and writing it onto a
        // new actor would fail validation. Count them now rather than discover
        // them at create time.
        const legacy = traits.filter((t) => LEGACY_TRAITS.has(t));
        if (legacy.length) {
          rows.legacyTraits.push({ actor: entry.name, item: item.name, traits: legacy });
        }

        const common = {
          actor: entry.name,
          pack: pack.collection,
          level,
          item: item.name,
          actionType: sys.actionType?.value ?? null,
          category: sys.category ?? null,
          traits,
        };

        for (const inner of inners(text, CHECK_OPEN)) {
          const params = inner.split("|").map((s) => s.trim());
          const typed = params.find((s) => s.startsWith("type:"));
          const checkType = (typed ? typed.slice(5) : params[0] || "").trim();
          const dcParam = params.find((s) => s.startsWith("dc:"));
          const dcRaw = dcParam ? dcParam.slice(3).trim() : null;
          rows.checks.push({
            ...common,
            checkType,
            dc: dcRaw !== null && /^\d+$/.test(dcRaw) ? Number(dcRaw) : null,
            dcRaw,
            basic: params.includes("basic"),
          });
        }

        for (const inner of inners(text, DAMAGE_OPEN)) {
          rows.damage.push({ ...common, inner });
        }
      }
    }
  }

  const suppressed = restoreConsole();

  rows.meta = {
    suppressedSystemWarnings: suppressed,
    legacyTraitItems: rows.legacyTraits.length,
    core: game.version,
    system: `${game.system.id} ${game.system.version}`,
    totalNpcs,
    sampled,
    stride,
    checks: rows.checks.length,
    damage: rows.damage.length,
    harvested: new Date().toISOString(),
  };

  console.log("=== meta ===", rows.meta);

  // A quick look before the file even moves, so an obviously empty or broken
  // harvest is visible immediately rather than after a round trip.
  const byType = {};
  for (const c of rows.checks) byType[c.checkType] = (byType[c.checkType] ?? 0) + 1;
  console.log("=== check types ===", byType);
  console.log("=== first five ===", rows.checks.slice(0, 5));

  const save = foundry.utils?.saveDataToFile ?? window.saveDataToFile;
  save(JSON.stringify(rows), "application/json", "creatureator-ability-numbers.json");

  window.__abilityNumbers = rows;
  console.log("\nsaved to your downloads folder; also on window.__abilityNumbers");
})();
