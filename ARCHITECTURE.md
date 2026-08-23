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
   as the best band whose threshold the value meets or exceeds, using the Building
   Creatures table row for the native level.
3. **Re-emit** at the target level as `targetThreshold + offset`.
4. Preserve deliberate outliers as offsets: if the chassis sits 2 above the High row,
   keep it 2 above High at the new level rather than snapping to the table.

#### Classification is threshold-based, and this is verified

An earlier implementation used nearest-match with a tie-break rule. It was wrong.

`npm run fetch:corpus` harvests 4,714 published creatures from AoN, each carrying
`*_scale_number` fields that decode to band labels (a single global scale:
`1=terrible … 5=extreme`, `0=unset`). That makes the entire bestiary an independent
oracle. Measured against it:

| Model | Overall agreement |
|---|---|
| Nearest match, ties to better band | 78.0% |
| Nearest match, ties to worse band | 86.4% |
| **Threshold (value ≥ band's floor)** | **97.6%** |

Threshold scores **exactly 100%** — 4709/4709, zero disagreements — for Perception,
all three saving throws, and Hit Points, and 99%+ for every attribute modifier. That
is not curve-fitting; it is the rule Paizo used.

The residual is one documented AoN quirk. The AC table's columns sit at constant
offsets from Low (`+0/+2/+3/+6` at every level), and AoN's boundaries land on
`row.low`, `row.high` and `row.extreme` — skipping the `moderate` column and labelling
everything from `row.low` upward as "moderate". A creature with AC exactly equal to
the table's Low is therefore reported by AoN as Moderate. All 622 disagreements have
that single shape and no other. On this boundary our reading is the faithful one, and
the test asserts the shape rather than the rate, so a genuinely new failure mode
cannot hide behind a percentage.

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

**A band can be absent at a given level.** GM Core writes an em-dash where one does
not exist — attribute modifiers have no Extreme column at levels −1 and 0. This is
distinct from a negative number: the generator normalises en-dash and minus sign to a
hyphen so `–1` parses as −1, and deliberately leaves the em-dash intact so it stays
recognisable as "no value". `reemit` refuses to place a statistic into a band that
does not exist at the target level rather than substituting a neighbouring one.

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

### Layer 2b — Editing (pure, testable, no Foundry dependency)

`src/editor/edit-session.ts`. Rescaling answers "what would this creature look like
at level 5?"; it does not answer "what do I actually want?" — and the reference
creature proves the two differ (§7.5).

An `EditSession` holds three things at once:

- the **baseline**: the creature exactly as the rescale produced it,
- the **working block**: the creature as the user has since edited it,
- for every statistic, the **band it currently sits in**, re-derived on every
  keystroke — so a hand-typed number is never a number without provenance.

It exposes the stat block as a list of `EditField`s (value, baseline, dirty flag,
band, offset, and the bands available at this level with the figure each would
produce), plus `set`, `setBand`, `reset`/`resetAll`, weakness and resistance
editing, live `warnings()`, and `toActorSource()`. Nothing is written to the world
until the user presses Create.

Three rules it enforces:

- **A band override drops the inherited offset.** An offset records that the
  *chassis* sat deliberately above its band; once the user picks a band by hand,
  that intent has been replaced by theirs.
- **Only a Strike's main dice damage is banded.** Riders and flat damage are
  editable but carry no band, because Table 2-10 does not describe them. Damage is
  addressed by explicit roll index (`strikes.Fist.damage.0`), and the *main* roll is
  found through `primaryDamageIndex()` — never by taking index 0 (§7.6).
- **Warnings are re-derived, never inherited.** The HP-versus-weakness warning
  disappears the moment the user actually addresses it. A warning that survives
  being addressed teaches people to ignore warnings.

Rendering lives in `src/foundry/editor-view.ts` — pure string building like
`statblock.ts`, so the markup rules ("every editable number has a band chip", "the
rescaled value is never thrown away") are asserted in unit tests rather than only
eyeballed in a running game.

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

#### Authoring a custom ability — all three routes

Decision (Dan): novel abilities can be created **any of three ways**, because they
suit different situations rather than competing.

- **Type it.** A form for name, action cost, traits, description. Always available,
  needs nothing configured.
- **Have an LLM draft it.** Describe the ability in plain language, get a draft, then
  edit. Requires the key setup deferred in §5. Note the standing rule still holds:
  an LLM may draft *text*, but every number it produces is validated against the
  Building Creatures tables before it lands, and the band is shown as with any other
  statistic.
- **Copy and modify.** Find something close in the compendia or on AoN, attach it,
  then change the text and numbers. Reuses the grafting flow with no new authoring UI.

All three converge on the same PF2e `action` item, so downstream handling is
identical regardless of origin.

### UI build order

The picker alone is a level-changer: it cannot preview a creature or edit one, which
is most of the actual product. Sequence:

1. **Stat block rendering + preview pane** — show the chassis as it is and as it would
   be at the target level, side by side with bands and warnings. Fixes picking blind,
   and the renderer is what the editor is built on.
2. **Editor** — DONE. Every number editable, band shown and re-derived live,
   one-click band override, HP and weaknesses presented together (see §7.5),
   rename, and creation only on confirmation. Screen two of the same window as the
   picker, so Back is a real option.
3. **Ability grafting** — search, attach, and the three authoring routes above.
   This is the next build, and the remaining bulk of the product.

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

**Implemented (22 Aug 2026).** A and C both shipped with the editor:

- The engine still rescales faithfully — AC 17 @ L2 becomes 21, not 22.
- Every statistic shows its band and offset, and a dropdown offers each band the
  table defines at that level *with the figure it would produce*. For the tables
  GM Core writes as ranges the whole span is shown ("Moderate 72 (72–78)"), because
  a user who can see the bracket can pick 75 on purpose instead of reading the
  threshold as the only correct answer.
- HP and weaknesses are rendered as one block, with the trade spelled out, and the
  HP warning names the current numbers and clears when the decision is made.

The `describe.todo` blocks are now real tests. `test/scaling.test.ts` asserts that
pure rescaling still lands on 21 AC and 110 HP; `test/edit-session.test.ts` asserts
that the editor reproduces Dan's hand-built creature exactly — AC 22, HP 75, both
weaknesses removed, name changed, everything else untouched — and that it can still
explain every number it produced afterwards.

### 7.6 Findings from the live bestiary

#### What governs a creature ability's numbers — RESOLVED by measurement

Grafting an ability onto a rescaled creature means rewriting the numbers inside
its text. Which table governs those numbers was an open guess; Table 2-11 (Spell
DC) was the obvious candidate, and this project's record with obvious candidates
is poor. So `tools/probe-ability-numbers.js` harvested 2,790 checks and 2,368
damage expressions from 2,131 published creatures (PF2e 8.4.0), and the answer
came back clean.

**Save DCs are Table 2-11 — the same table as spellcasting, not a separate one.**

| | exact | within ±1 | within ±2 |
|---|---|---|---|
| all saves (n=2,437) | **70.0%** | 95.9% | 98.6% |
| Fortitude (n=922) | 66.8% | 95.7% | 98.4% |
| Reflex (n=765) | 75.3% | 96.1% | 99.2% |
| Will (n=750) | 68.7% | 95.9% | 98.1% |

Distribution across the three columns is High 1,529 / Moderate 822 / Extreme 79:
High is the ordinary case. 48.5% of all save DCs sit exactly on the High column
alone. So a grafted save DC is classified and re-emitted exactly like a
spellcasting DC, carrying its offset, showing its band.

**Flat checks are not level-scaled, and the data proves it rather than
suggesting it.** Only 0.8% of the 125 sampled land on a table column, and the
DCs used are the familiar fixed values — DC 5 (35 uses), DC 15 (34), DC 11 (23).
The decisive evidence is the spread: DC 5 appears on creatures at 15 *different*
levels, DC 11 at 14, DC 15 at 15. A number that recurs unchanged across the
whole level range is not a function of level. Scaling one would change what the
ability does — Volluk Azrinae's Discorporate is a DC 15 flat check at level 7
and would still be DC 15 flat at level 20.

**Skill DCs do not fit well enough to touch.** `@Check[athletics|dc:24]` and
friends reach only 20.2% exact across 109 samples (Medicine 12.5%). Reported and
left for the user.

**Ability damage — Table 2-12 is the relevant one for area abilities, but there
is no clean rule.**

The first pass said "fits nothing" (13.8% against Table 2-10, 9.3% against 2-12)
and blamed the harvest for not separating area abilities out. Both figures were
wrong, and the harvest was fine: **the damage parser was dropping a third of the
data.** `@Damage[7d8[poison]|options:area-damage]` carries a parameter after the
terms, 801 of 2,368 damage elements have one, and the parser was treating the
whole inner as a single term — so those 801 parsed as no terms at all. The
measurement ran on 81 rows believing it had 799.

The marker also solved the separation problem for free: `options:area-damage` is
written into the element itself, so area abilities identify themselves and no
extra harvest was needed.

Re-measured on all 799:

| | exact | ±1 | ±2 |
|---|---|---|---|
| area abilities vs **Table 2-12** (nearest of its two columns) | **30.5%** | 42.2% | 50.3% |
| area abilities vs Table 2-10 | 10.5% | 32.5% | 45.9% |
| everything else vs Table 2-12 | 8.9% | 21.0% | 31.3% |
| everything else vs Table 2-10 | 13.8% | 33.8% | 46.3% |

So Table 2-12 governs area abilities — three times better than the Strike table —
but its two columns bracket the published values rather than matching them:
22.0% land exactly on "limited use" (mean 11 *below* it), 8.5% exactly on
"unlimited use" (mean 9 *above* it). Which column applies depends on the
ability's Frequency, which the harvest did not capture, and even knowing it,
only a fifth to a third land exactly.

**Decision: still no automatic scaling, but stop saying nothing.** For an
ability whose damage carries `options:area-damage`, the editor offers the two
Table 2-12 figures for the target level as explicit choices, labelled by column.
That is a real answer for a third of ability damage. Everything else stays as it
is: surfaced, explained, and left alone.

**Built.** `areaDamageAt()` in `rescale-ability.ts` reads Table 2-12;
`EditSession.abilityDamage()` lists every damage term in an ability with the
options that apply to it and, when none do, the reason; `setAbilityDamage()`
writes one term back through `withDamageTerm`, so the element's parameters,
label and sibling terms come through byte for byte.

Three things the design had to get right, each of them a lesson already paid
for elsewhere in the module:

- **The options advertise what they will deliver.** The ability keeps its own
  die size, so a d8 ability offered level 5's "6d6 (21)" is shown `4d8+3`, not
  `6d6`. This is the Strike-damage dropdown bug from 6.1, avoided by building
  the option through the same re-expression as the write rather than reading the
  table twice.
- **The columns are named, not banded.** Table 2-12's two columns are a
  frequency scale ("unlimited use" / "limited use"), not a quality one. Which
  applies depends on the ability's Frequency, and a PF2e `action` item does not
  record its frequency in any readable field — so both are offered and the user
  chooses. Rendering them as bands would invent a judgement the table does not
  make.
- **Every term that gets no option says why.** Not-area, flat amount,
  unreadable formula and out-of-range level each produce a distinct note. A
  number left alone deliberately and a number nobody looked at must not render
  identically.

The note attached to a non-area `@Damage` still reads "no published table
governs ability damage closely enough"; the note on an area one now names Table
2-12 and says the choice hinges on Frequency. Saying the general sentence about
an area ability would have been true in letter and misleading in substance.

Method note: this is the second time a measurement has been quietly running on a
fraction of its data (the first was the classifier's nearest-match at 86%). Both
were caught by looking at the counts rather than the percentages. Probes should
print what they actually counted, not only what they concluded.

Implemented in `src/scaling/rescale-ability.ts`. Every number left alone is
reported as a note with its reason; nothing is silent.

#### A save can have no DC at all — `against:` and DC 0

Found by copying Dragon Breath onto a husk zombie in a live world: the sheet
rendered **"DC 0 Basic Reflex"**. The ability's text is

```
@Check[reflex|basic|against:class-spell|options:area-effect]
```

There is no `dc:` parameter. `against:` names a statistic on whoever owns the
ability — here "the higher of class DC or spell DC" — and a creature has
neither, so PF2e resolves it to zero.

Two consequences, both now handled:

- **Refusing to rescale it is right; refusing silently is not.** A save nobody
  can fail is worse than a save at the wrong number, because nothing on the
  sheet says anything is wrong. The DC is surfaced as an editable field with a
  red "DC 0 on a creature" chip and the bands for the target level.
- **Repairing it means inserting, not replacing.** The first fix only replaced
  an existing `dc:` parameter, so on this ability it silently did nothing.
  Setting a DC now inserts `dc:N` *and* removes `against:`, because leaving the
  reference beside the number is ambiguous at best. A check carrying both a real
  `dc:` and an `against:` keeps its `against:` — that is a rescale, not a repair.

Adjacent finding: `@Damage[(@actor.level)d6[untyped]]` resolves correctly on any
actor, so level-scaling damage in a copied ability needs nothing done to it.
Verified on the sheet: 5d6 on a level 5 creature.

#### Legacy alignment traits break a graft

Loading actors from pre-remaster adventure paths makes PF2e log
`evil is not a valid choice` — those books still carry alignment traits that
PF2e 8.x rejects. This is cosmetic when reading, but not when grafting: an
ability copied off a Blood Lords creature carries `evil` in `system.traits.value`
and writing it onto a new actor can fail validation. The graft layer must strip
`good`, `evil`, `lawful` and `chaotic` from a copied ability and say that it
did.


#### AC classifies at 86.8% against AoN's labels — investigated, no change made

The corpus scoreboard has always shown AC well below every other statistic
(86.8%, against 100% for Perception, all three saves and HP). It became worth
chasing once the editor started putting a band chip next to AC: roughly one
creature in seven would show a chip that disagrees with Nethys.

What the corpus actually says (probed 22 Aug 2026, all 4,709 creatures):

- **Every one of the 622 mismatches runs the same way** — we say Low, AoN says
  Moderate. There is not a single case in the other direction, at any level.
- **All of them sit 1 or 2 below Moderate's figure** (431 at −1, 191 at −2).
- The same one-directional pattern appears in the other imperfect statistics:
  all 36 Strength misses are exactly 1 below Extreme; 285 of 299 attack misses
  are within 3 below.
- AC's bands are unusually tight — across every level the gaps are fixed at
  extreme→high 3, **high→moderate 1**, moderate→low 2 — so an AC two points
  under Moderate is simultaneously exactly Low.

The obvious hypothesis was that AoN's labels are *tolerant*: a value a point or
two under a band's figure still counts as that band. **Measured, and it is
wrong** — a tolerance of 1 drops AC agreement from 86.8% to 61.2%, Strength from
99.2% to 44.6%, and Perception from 100% to 71.8%, because it promotes every
value sitting just above its own floor as well. Nearest-match scores 93.6% on AC
but is known to be far worse overall (86% vs 97.6%), so it is not the answer
either.

**Decision: change nothing.** The threshold rule stays. This is a labelling
divergence at AC's tight band spacing, not a numeric one — no figure the module
writes to an actor is affected, and re-emission still round-trips exactly. What
it costs is chip wording on a minority of ACs, which is the cheapest possible
place for a disagreement to live. If it is ever worth another look, the open
question is what AoN's `ac_scale_number` is actually computed *from*; it does
not appear to be the GM Core table alone.


A 720-creature sample across 66 Actor packs (clean PF2e 8.3.0 install, no modules)
settled several things that assumption had got wrong or left open.

**All six mapper field paths held for 720/720 creatures.** No misses. Levels ranged
-1 to 25.

**Damage rolls have no meaningful order.** `system.damageRolls` is an object keyed by
random id, and in the bestiary the rider frequently enumerates *before* the main
damage — Fortune Dragon's Tail lists `"1d6"` force then `"4d10+15"` bludgeoning.
Taking index 0 as primary rescaled the rider and froze the real damage. Now selected
by largest die-based roll, excluding `persistent` and `splash`, which are riders by
definition. This bug was invisible to every test until real data exposed it, because
the Husk Zombie has one roll per Strike.

**Riders are mostly plain energy dice.** Of 71 secondary rolls: 59 uncategorised, 9
persistent, 3 splash; 68 dice, 3 flat. They are left unscaled and reported. Since they
are almost all pure dice with no modifier, scaling them later would be simple if
that decision changes.

**Flat damage is a real shape.** Bare values like `"1"` and `"4"` appear as riders.
They parse (as `count: 0`) but are never rescaled — Table 2-10 governs dice damage.

**43% of creatures cast spells.** DC lives at `system.spelldc.dc`, spell attack at
`system.spelldc.value`. Creatures may have several entries with different DCs, scaled
independently. Casting kinds observed: innate 54, prepared 17, focus 11, spontaneous 5.

**Table 2-11 is shaped unlike the others** — three bands only (no Low or Terrible),
with paired columns per band (`"high dc"`, `"high spell attack bonus"`). An adapter
projects one column into a standard band row before classification.

**Spell ranks are not rescaled**, only DCs and attack modifiers. Which spells a
creature knows is an authoring decision; the engine warns with the level-appropriate
rank cap instead of rewriting a spell list.

**Levels above 24 are refused.** GM Core's tables stop at 24 and the bestiary contains
exactly one sampled level 25 creature (Oliphaunt of Jandelay). Extrapolating would
invent numbers with no published basis.

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
