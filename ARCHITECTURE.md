# Creatureator — Architecture

A FoundryVTT module for building custom Pathfinder 2e creatures by taking an existing
bestiary creature as a chassis, rescaling it to a target level, and grafting on abilities.

**Status:** pre-implementation. This document records decisions made and open questions.
Nothing here is committed to GitHub yet.

---

## 1. Target platform

| | |
|---|---|
| Foundry VTT | v14 only (`minimumCoreVersion: 14`, verified 14.365) |
| PF2e system | `^8.2.0` (8.1.2 was the first v14-only PF2e release, 9 May 2026) |
| UI framework | ApplicationV2 + HandlebarsApplicationMixin |
| Effects | Active Effects V2 |
| Language | TypeScript, bundled with Vite |

**Why v14-only:** the legacy `Application` class is deprecated and the v12 UI path would
roughly double the interface work for an audience that is already migrating. PF2e 8.x
dropped v13 support entirely, so there is no meaningful cross-version window to serve.

---

## 2. The core insight

The PF2e system ships the entire bestiary as **fully-built NPC Actor documents** —
complete with `melee` Strike items, `action` items with correct action costs, rule
elements, and working automation.

This means importing a canon monster should be a **compendium copy**, never a text parse.
Parsing an AoN stat block into Foundry's data model would produce something strictly
worse than what already sits in `pf2e.pathfinder-bestiary` and the Monster Core module.

So AoN is *not* the creature source. AoN is the **ability library and search layer**.

---

## 3. The three layers

### Layer 1 — Chassis selection

Browse and pick a base creature from the PF2e compendia the user has installed.
Dan owns the premium modules, so Monster Core / GM Core / Player Core content is
available locally with full art and descriptions.

Output: a deep-cloned NPC actor source object, detached from its compendium.

### Layer 2 — Scaling engine (pure, testable, no Foundry dependency)

The heart of the module, and the part that must be right.

```
scale(chassis: NPCSource, fromLevel: number, toLevel: number) -> NPCSource
```

Algorithm:

1. For each core statistic (AC, HP, Fort/Ref/Will, Perception, each skill, attack
   bonus per Strike, damage per Strike, spell DC), read the chassis's value at its
   native level.
2. **Classify** that value into a band — Extreme / High / Moderate / Low / Terrible —
   by comparing against the Building Creatures table row for the native level.
3. **Re-emit** the same band at the target level.
4. Preserve deliberate outliers as offsets: if the chassis sits 2 above the High row,
   keep it 2 above High at the new level rather than snapping to the table.

Damage is the fiddly case — the tables give an *average* damage number, so re-emitting
means solving for a dice expression (`NdX+M`) whose mean matches the target while
keeping the chassis's die size and damage type. Deterministic, but needs care.

This layer is plain functions over plain objects, so it is fully unit-testable in CI
without a Foundry install. That is the main reason for putting the boundary here.

#### Table shapes

The 12 tables are *not* uniformly shaped. The scaling engine needs a discriminated
union, not one generic `byLevel` lookup:

| Shape | Bands | Tables |
|---|---|---|
| 5-band | Extreme/High/Moderate/Low/Terrible | Perception (2–2), Saving Throws (2–6) |
| 4-band | Extreme/High/Moderate/Low | Attribute Mods (2–1), Skills (2–3), AC (2–5), Strike Attack (2–9), Strike Damage (2–10) |
| 3-band | High/Moderate/Low — **no Extreme** | Hit Points (2–7) |
| Paired | DC + attack bonus per band | Spell DC (2–11) |
| Min/max | Maximum/Minimum | Resistances & Weaknesses (2–8) |
| Use-class | Unlimited/Limited | Area Damage (2–12) |
| Range map | creature level range → item level | Safe Items (2–4) |

Several cells are **strings, not numbers**, and must not be coerced:

- Hit Points are ranges — L5 high is `"97-91"`, not a scalar.
- Skills low is `"+10 to +8"` at L5.
- Strike Damage is `"2d8+7 (16)"` — expression plus average.
- Safe Items keys are ranges — `"3 or lower"`, `"4-5"`.

Classification against a range means "does the value fall inside the band", not
equality. HP in particular can never be an exact band match.

#### Worked example — validation set

The creature in Dan's screenshot: Husk Zombie (Creature 2) → Occam's Risen Kinetic
Husk (Creature 5), plus grafted impulse actions and a custom `Bound to Occam` leash.

Checking the real chassis against the real tables:

| Stat | Husk Zombie @ L2 | Band | Verdict |
|---|---|---|---|
| Perception | +5 | low = 5 | exact |
| Attack (fist) | +11 | high = 11 | exact |
| Damage | 1d8+4 | moderate = `1d8+4 (8)` | exact |
| AC | 17 | moderate = 17 | exact |
| Fort | +7 | moderate 8 / low 5 | **between** |
| Ref | +9 | high 11 / moderate 8 | **between** |
| HP | 55 | high = 40–36 | **far above** |

So a published Paizo creature is a *mix* of exact band hits and deliberate offsets —
and the HP outlier is explained by its `positive 5, slashing 5` weakness, which GM Core
explicitly trades for extra HP.

This settles the design question in step 4. A naive classify-and-re-emit would snap
Fort/Ref to a band and flatten HP by ~15, quietly rewriting the creature. Offset
preservation is load-bearing, not polish.

The target statblock gives the regression assertions: AC 22 (= L5 high), Grave Blast
+15 (= L5 high), slam +16 (L5 high +1 — the offset that must survive the round trip).

### Layer 3 — Ability grafting

Search for an ability, then attach it. Resolution order:

1. **Foundry compendium item** — if the ability exists as a real item, use it. Free
   automation, correct action cost, working rule elements.
2. **AoN result** — if not in a compendium, pull the text from AoN and generate an
   `action` item with the right `actionType`, `actions.value`, and traits.
3. **Hand-authored** — a blank ability form for genuinely novel content
   (e.g. `Bound to Occam`, which exists in no book).

Any grafted ability carrying a level-scaled number (a save DC, a damage expression)
gets passed through Layer 2 so it lands correctly for the target level.

---

## 4. AoN integration

Live calls from the browser to AoN's public Elasticsearch endpoint
(`elasticsearch.aonprd.com`). No bundled data, so nothing goes stale and no
Paizo-derived text is redistributed in the module.

The response shape is rich and already structured — a single creature document returns
`ac`, `hp_raw`, `attack_bonus[]`, `strike_damage_average[]`, per-ability modifiers,
`trait[]`, `speed{}`, `weakness{}`, `immunity_markdown`, plus a full statblock in a
tagged markdown dialect with `<actions string="Two Actions" />` markers. That last
field is what Layer 3 parses for non-compendium abilities.

**CORS: confirmed open.** Verified 26 Jul 2026 from a live Foundry v14 console —
a plain `fetch` against `elasticsearch.aonprd.com/aon/_search` resolved successfully
(`{value: 70, relation: "eq"}` for `name:goblin`). No proxy or bundled index required.

---

## 5. LLM

**Not in v1.** The rules engine ships first and must be useful with zero API key.

Everything above is deterministic and mathematically legal by construction. An LLM
layer lands in v2 for the two jobs it is actually good at: writing flavour text, and
drafting genuinely novel abilities from a prompt. It will never be in the path that
decides a number.

---

## 6. Output

A real PF2e NPC actor written to a world folder or a user compendium. Not a custom
document type, not a JSON blob — the point is that the result is indistinguishable
from a hand-built NPC and works with every other PF2e module.

---

## 7. Open questions

### 7.1 Source for the Building Creatures tables — RESOLVED

Layer 2 needs the numeric rows from GM Core (AC, HP, saves, Perception, skills,
attack bonus, average damage, spell DC — each at Extreme/High/Moderate/Low/Terrible
for levels −1 through 24).

Investigated three options:

- **Read from the GM Core Foundry module — ruled out.** A sweep of every installed
  JournalEntry compendium for pages containing both "Extreme" and "Terrible"
  alongside a `<table>` returned only two false positives (GM Screen → Chases,
  Classes → Oracle). Paizo shipped the rules text without the creature tables.
- **Derive empirically from the bestiary — rejected.** Would yield *descriptive*
  percentile bands, not Paizo's *prescriptive* ones. Wrong tool for a module whose
  value proposition is producing legal numbers.
- **AoN by document ID — adopted.** Keyword search never surfaced these pages, but
  they resolve cleanly when requested by ID. A sweep of `rules-2874`–`rules-2930`
  mapped the whole section; 12 pages carry tables:

  | ID | Page | ID | Page |
  |---|---|---|---|
  | 2881 | Attribute Modifiers | 2893 | Weaknesses & Resistances |
  | 2882 | Perception | 2896 | Strike Attack Bonus |
  | 2885 | Skills | 2897 | Strike Damage |
  | 2887 | Items | 2899 | Spell DC & Attack Mod |
  | 2889 | Armor Class | 2910 | Damage-Dealing Abilities |
  | 2890 | Saving Throws | | |
  | 2891 | Hit Points | | |

**Implementation:** `tools/fetch-creature-tables.mjs` fetches all 12 by ID, parses the
`<table>` markup, and generates `src/data/creature-tables.ts`. The output is committed,
so the module never calls AoN for scaling data at runtime — this is a build-time tool
only, re-run when Paizo issue errata.

Spot-checked against Table 2–9 (Strike Attack Bonus), retrieved complete with all 26
level rows: L5 gives Extreme +17 / High +15 / Moderate +13 / Low +11.

Note this also validates the §3 Layer 2 outlier rule. The reference creature's
slam is +16 at level 5 — between High and Extreme, matching no band exactly. Snapping
it to High would silently nerf the creature by 1. Preserving it as "High +1" is the
correct behaviour and confirms step 4 is load-bearing, not a nicety.

### 7.5 Band drift — DECIDED: option A

Comparing the two real statblocks shows the author did **not** apply pure rescaling.
Two statistics changed band:

- **AC** went moderate (17 @ L2) → high (22 @ L5). Pure rescaling gives 21.
- **HP** went far-above-high (55 @ L2, inflated by `positive 5, slashing 5`) →
  moderate (75 @ L5), after the numeric weakness was dropped.

The HP case is the important one: **HP cannot be rescaled independently of
weaknesses and resistances**. GM Core explicitly trades one for the other, so an
engine that rescales HP in isolation will produce a creature that is wrong in a way
the numbers alone won't reveal.

Options:

- **A. Rescale faithfully, surface the band.** Engine outputs 21 AC and shows
  "Moderate" next to it with a dropdown. The author re-picks the band if they want
  something else. Honest, and keeps authoring decisions with the author.
- **B. Detect weakness changes and re-solve HP.** When the user edits weaknesses, HP
  recomputes. Powerful but couples two fields in a way that may feel surprising.
- **C. Both** — A as the default, with a warning when weaknesses change and HP
  doesn't.

**Decision (Dan, 26 Jul 2026): A — no adjustment is ever silent.**

The engine rescales faithfully, displays the band it derived next to every statistic,
and offers a one-click band change. Authoring decisions stay with the author. C
follows once the UI exists: warn when weaknesses change but HP does not.

This becomes a general principle, not just an HP rule — every derived number in the
UI carries its band label and a visible provenance ("Moderate, from chassis" vs.
"High, set by you").

Encoded as `describe.todo` blocks in `test/scaling.test.ts` so the divergence stays
visible in test output instead of rotting in a doc.

### 7.4 Licensing

Generated table data is Open Game Content under the ORC licence. Needs a `NOTICE.md`
before first publish. Creature *descriptions* and art stay in Paizo's premium modules
and are never copied into module output.

### 7.2 AoN CORS — RESOLVED

Confirmed open, 26 Jul 2026. See §4. Live fetch is the committed approach.

Remaining follow-ups, neither blocking:

- No documented rate limit. The module should debounce search input (~300 ms) and
  cache results per session to stay a good citizen.
- AoN is volunteer-run infrastructure with no uptime guarantee. Ability search should
  degrade gracefully to compendium-only results when the endpoint is unreachable,
  rather than erroring the whole builder.

### 7.3 Damage re-expression — LARGELY RESOLVED

Original concern: rescaling `2d8+6` would mean solving for a dice expression whose
mean hits a target average.

Turns out unnecessary. Table 2–10 publishes the dice expression *and* its average for
every band at every level — e.g. L2 moderate is `1d8+4 (8)`, L5 high is `2d8+7 (16)`.
So re-emission is a table lookup, not a solve. Same for Table 2–12 (Area Damage):
`2d6 (7)` at L2, `2d10 (12)` at L5.

Residual question, now cosmetic: when a chassis Strike uses a die size the table
doesn't (say `1d12` where the band says `2d8`), do we adopt the table's expression or
preserve the chassis's die size and adjust count/modifier to match the average?
Proposal: preserve chassis die size — a creature whose identity is "big d12 club"
should stay that, and matching the published average keeps it legal either way.

---

## 8. Workflow note

The dev sandbox cannot reach github.com (proxy blocks CONNECT), and no GitHub MCP
connector is available in the registry. Files are written directly into this folder;
git operations run on Dan's machine with commands supplied per change. Every commit
gets reviewed before push, per project convention.
