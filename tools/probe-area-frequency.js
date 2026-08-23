/**
 * probe-area-frequency.js
 *
 * Paste into the Foundry console (F12) on a PF2e world. Takes a minute or two.
 *
 * QUESTION: does an ability's `system.frequency` predict which column of
 * Table 2-12 (Area Damage) its published damage lands on?
 *
 * WHY IT MATTERS: the editor offers both columns for area damage and makes the
 * user choose, on the stated grounds that "which one applies depends on the
 * ability's Frequency, which the module does not know". That second clause
 * turns out to be false - `system.frequency` is a real, structured field
 * ({value, max, per}), found live on a Dragon Breath with "once per hour".
 *
 * If frequency predicts the column, the dropdown can *default* to the right
 * one and stay overridable. If it does not, the honest thing is to keep asking.
 * Either answer is worth having; a guess is not. This project's record with
 * guesses about Paizo's numbers is poor.
 *
 * Nothing is written to your world, and nothing is downloaded - the answer is
 * printed. `window.__areaFrequency` holds the rows if you want to dig.
 */

(async () => {
  const MAX_CREATURES = 2500;

  /** Table 2-12 averages: level -> [unlimited use, limited use]. */
  const AREA = {
    "-1": [2, 4], 0: [4, 6], 1: [5, 7], 2: [7, 11], 3: [9, 14], 4: [11, 18],
    5: [12, 21], 6: [14, 25], 7: [15, 28], 8: [17, 32], 9: [18, 35],
    10: [20, 39], 11: [21, 42], 12: [23, 46], 13: [24, 49], 14: [26, 53],
    15: [27, 56], 16: [28, 60], 17: [29, 63], 18: [30, 67], 19: [32, 70],
    20: [33, 74], 21: [35, 77], 22: [36, 81], 23: [38, 84], 24: [39, 88],
  };

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

  /** Everything before the first depth-0 "|" is terms; the rest is parameters. */
  const splitInner = (inner) => {
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === "[" || c === "(") depth++;
      else if (c === "]" || c === ")") depth--;
      else if (c === "|" && depth === 0) {
        return { body: inner.slice(0, i), params: inner.slice(i + 1).split("|").map((s) => s.trim()) };
      }
    }
    return { body: inner, params: [] };
  };

  const isArea = (params) =>
    params.some((p) =>
      p.startsWith("options:") &&
      p.slice(8).split(",").some((o) => o.trim() === "area-damage")
    );

  /** Comma-separated at depth 0: "1d6[mental],1d6[fire]". */
  const terms = (body) => {
    const out = [];
    let depth = 0, start = 0;
    for (let i = 0; i <= body.length; i++) {
      const c = body[i];
      if (c === "[" || c === "(") depth++;
      else if (c === "]" || c === ")") depth--;
      if (i === body.length || (c === "," && depth === 0)) {
        out.push(body.slice(start, i));
        start = i + 1;
      }
    }
    return out.filter((t) => t.trim());
  };

  /** "2d6+4" -> 11. Null for anything that is not plain NdX+M. */
  const average = (piece) => {
    const typeOpen = piece.lastIndexOf("[");
    const expr = (typeOpen >= 0 && piece.trim().endsWith("]") ? piece.slice(0, typeOpen) : piece).trim();
    const m = /^\(?\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*\)?$/i.exec(expr);
    if (!m) return null;
    const count = m[1] === "" ? 1 : Number(m[1]);
    const faces = Number(m[2]);
    if (!Number.isFinite(count) || !Number.isFinite(faces) || faces < 2) return null;
    const mod = m[3] && m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0;
    return (count * (faces + 1)) / 2 + mod;
  };

  /** See tools/probe-ability-numbers.js: pre-remaster books flood the console. */
  const silence = () => {
    const real = { warn: console.warn, error: console.error };
    let suppressed = 0;
    const noisy = (args) =>
      /element-validation failure|is not a valid choice/.test(String(args[0] ?? ""));
    console.warn = (...a) => { if (noisy(a)) { suppressed++; return; } real.warn(...a); };
    console.error = (...a) => { if (noisy(a)) { suppressed++; return; } real.error(...a); };
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

  const rows = [];
  const actorPacks = game.packs.filter((p) => p.metadata.type === "Actor");

  const plans = [];
  for (const p of actorPacks) {
    const idx = await p.getIndex();
    const npcs = idx.contents.filter((e) => e.type === "npc");
    if (npcs.length) plans.push({ pack: p, npcs });
  }
  const totalNpcs = plans.reduce((n, x) => n + x.npcs.length, 0);
  const stride = Math.max(1, Math.ceil(totalNpcs / MAX_CREATURES));
  console.log(`creatureator | ${totalNpcs} NPCs across ${plans.length} packs; sampling every ${stride}`);

  let seen = 0, sampled = 0, areaItems = 0;

  for (const { pack, npcs } of plans) {
    for (const entry of npcs) {
      if (seen++ % stride !== 0) continue;

      let src;
      try { src = (await pack.getDocument(entry._id)).toObject(); } catch { continue; }
      sampled++;
      if (sampled % 250 === 0) console.log(`  ...${sampled} creatures`);

      const level = src.system?.details?.level?.value;
      if (typeof level !== "number" || AREA[level] === undefined) continue;

      for (const item of src.items ?? []) {
        if (item.type !== "action") continue;
        const sys = item.system ?? {};
        const text = String(sys.description?.value ?? "");
        if (!text) continue;

        const freq = sys.frequency ?? null;
        let itemHadArea = false;

        for (const inner of inners(text, "@Damage[")) {
          const { body, params } = splitInner(inner);
          if (!isArea(params)) continue;
          itemHadArea = true;

          for (const piece of terms(body)) {
            const avg = average(piece);
            if (avg === null) continue;
            const [unlimited, limited] = AREA[level];
            rows.push({
              actor: entry.name, item: item.name, level, piece: piece.trim(), avg,
              hasFrequency: freq !== null,
              per: freq?.per ?? null,
              max: freq?.max ?? null,
              dUnlimited: avg - unlimited,
              dLimited: avg - limited,
            });
          }
        }
        if (itemHadArea) areaItems++;
      }
    }
  }

  const suppressed = restoreConsole();

  const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "   - ");
  const pad = (s, n) => String(s).padEnd(n);

  const summarise = (label, set) => {
    const n = set.length;
    const exactU = set.filter((r) => r.dUnlimited === 0).length;
    const exactL = set.filter((r) => r.dLimited === 0).length;
    const nearU = set.filter((r) => Math.abs(r.dUnlimited) < Math.abs(r.dLimited)).length;
    const nearL = set.filter((r) => Math.abs(r.dLimited) < Math.abs(r.dUnlimited)).length;
    const mean = (k) => (n ? (set.reduce((s, r) => s + r[k], 0) / n).toFixed(1) : "-");
    console.log(
      `${pad(label, 22)} n=${pad(n, 6)} exact-unl ${pad(pct(exactU, n), 8)} exact-lim ${pad(pct(exactL, n), 8)}` +
      ` nearer-unl ${pad(pct(nearU, n), 8)} nearer-lim ${pad(pct(nearL, n), 8)} mean off-unl ${pad(mean("dUnlimited"), 8)} mean off-lim ${mean("dLimited")}`
    );
  };

  const withFreq = rows.filter((r) => r.hasFrequency);
  const without = rows.filter((r) => !r.hasFrequency);

  console.log(`\n=== area damage terms: ${rows.length} from ${areaItems} abilities on ${sampled} creatures ===`);
  console.log(`(system warnings suppressed: ${suppressed})\n`);
  summarise("ALL", rows);
  summarise("frequency SET", withFreq);
  summarise("frequency ABSENT", without);

  /**
   * The decisive comparison. If frequency means anything, the abilities that
   * have one should sit nearer "limited use" than the ones that do not - and
   * the gap should be large enough to act on, not merely present.
   */
  console.log(
    `\nfrequency SET    -> nearer limited: ${pct(withFreq.filter((r) => Math.abs(r.dLimited) < Math.abs(r.dUnlimited)).length, withFreq.length)}`
  );
  console.log(
    `frequency ABSENT -> nearer limited: ${pct(without.filter((r) => Math.abs(r.dLimited) < Math.abs(r.dUnlimited)).length, without.length)}`
  );

  const perCounts = {};
  for (const r of withFreq) perCounts[r.per] = (perCounts[r.per] ?? 0) + 1;
  console.log("\n=== frequency 'per' values seen ===", perCounts);
  console.log("=== a few rows ===", rows.slice(0, 5));

  window.__areaFrequency = rows;
  console.log("\nrows on window.__areaFrequency");
})();
