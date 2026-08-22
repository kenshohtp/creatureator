# Handoff: continue Creatureator development

**Purpose.** Start a fresh conversation with this attached. It contains everything
needed to resolve the open issues and continue building, without re-deriving
decisions or re-discovering data.

Last updated: 26 Jul 2026, at commit `dbb5a10`.

---

## 1. The project

**Creatureator** — a FoundryVTT module for building custom Pathfinder 2e creatures.
Repo: <https://github.com/kenshohtp/creatureator>

**The goal, in Dan's words:** import creatures from Archives of Nethys and the Foundry
bestiary, then *customise* them — "almost always I want to start from a pre-filled
template and edit", with LLM assistance for generating abilities.

**The reference creature** is the acceptance test. Dan hand-built "Occam's Risen
Kinetic Husk" (Creature 5) from the Husk Zombie (Creature 2, Book of the Dead):
re-levelled, given three kineticist-flavoured impulse actions, and a custom
`Bound to Occam` leash ability that exists in no book. The module should make that
creature easy to produce. Today it can do the re-levelling; it cannot yet do the
abilities, which is most of the value.

**Dan is a non-software-engineer project lead.** He co-builds rather than writing code
solo, reviews decisions before commits, and runs all terminal and Foundry commands
himself. Explain reasoning; do not assume sysadmin knowledge. He is direct and will
tell you when something is wrong — listen, he has been right every time.

---

## 2. Environment

| | |
|---|---|
| Repo (local) | `C:\Projects\creatureator` — **not** in OneDrive |
| Foundry data path | `G:\FVTT13test2` (despite the name, this is v14) |
| Module symlink | `G:\FVTT13test2\Data\modules\creatureator` → the repo |
| Foundry | v14.365 |
| PF2e system | 8.3.0 |
| Shell | **Windows PowerShell 5.1** |

**Dan hates OneDrive** ("I NEVER want to use OneDrive - its awful") and is right that
a `.git` directory synced across machines corrupts. Never suggest it.

He also develops from a **Mac**, and this Windows PC is off during the day. See
`docs/HANDOFF-dev-server.md` for a separate Mac-mini-as-dev-server evaluation.

### Commands

```powershell
cd C:\Projects\creatureator
npm run check        # typecheck + test + build, stops on first failure
npm test
npm run build        # emits scripts/ (gitignored)
npm run fetch:tables # regenerate GM Core tables from AoN (output IS committed)
npm run fetch:corpus # 4,714-creature validation fixture (gitignored, ~5MB)
```

**PowerShell 5.1 does not support `&&`.** Use separate lines, `;`, or `npm run check`
(npm runs scripts through cmd.exe, where `&&` works).

After `npm run build`, press **F5** in Foundry — the symlink means no server restart
is needed. A *server* restart is only needed when adding a new module.

---

## 3. Current state

**141 tests passing**, 2 `describe.todo`. 8 test files.

### What works, and how it was verified

| Piece | Verification |
|---|---|
| Band classification | Exact agreement with 4,714 published creatures on Perception, all 3 saves, HP (4709/4709 each). 99%+ on attributes. |
| GM Core tables | Generated from AoN by document ID, committed. All 12 tables. |
| NPC data mapping | 720 creatures across 66 packs, zero field misses. |
| Whole-creature rescaling | Husk Zombie 2→5 matches Dan's hand-built version within a point. |
| Spellcasting | DC and spell attack, multiple entries per creature. |
| Chassis discovery | 6,393 creatures indexed live, with provenance. |
| Actor creation | Verified in Foundry: rule elements, MAP progression, immunities, actions all survive. |

### What does NOT exist

- **Editing.** You cannot change anything. Pick a chassis, pick a level, create.
- **Ability grafting.** Nothing. This is the biggest gap and the actual product.
- **LLM anything.** Deliberately deferred; see §6.

---

## 4. Architecture — the parts that matter

Full detail in `ARCHITECTURE.md`. The essentials:

### Chassis, not generation

Creatures come from Foundry's PF2e compendia by cloning a compendium actor. That
preserves Strike items, rule elements and automation for free. **Never parse an AoN
stat block into an actor** — the result is strictly worse than what already ships.

AoN's role is the *ability library* and search, not the creature source.

### Classification is threshold-based

A statistic belongs to the best band whose floor it meets or exceeds, plus an offset.
`classify()` → `{ band, offset }`; `reemit()` → `targetThreshold + offset`.

An earlier nearest-match implementation scored 86% against real creatures. Threshold
scores 97.6% overall and **exactly 100%** on five statistics. This is not a heuristic,
it is the rule Paizo used. Do not "improve" it without measuring against the corpus.

### No adjustment is ever silent

Dan's explicit decision. Every derived number carries its band and offset. The engine
never changes a band on its own; where it cannot do something correctly it *warns*
rather than guessing. This is the project's spine — HP, spell ranks, riders and
out-of-range levels are all handled this way.

### Layers

1. **Chassis selection** — `src/foundry/chassis.ts`
2. **Scaling engine** — `src/scaling/bands.ts`, `rescale-creature.ts` (no Foundry deps)
3. **Ability grafting** — not built

---

## 5. Hard-won data facts

These came from probing live Foundry and cost real time to discover. Do not re-derive.

- **`system.perception.mod`** — Perception is top-level on `system`, not under
  `attributes` where every other defence lives.
- **`system.damageRolls` is an object keyed by random id, and enumeration order means
  nothing.** In the bestiary the rider frequently comes first: Fortune Dragon's Tail
  lists `"1d6"` force before `"4d10+15"` bludgeoning. Use `primaryDamageIndex()`.
- **`pack.collection` lives on the pack, not `pack.metadata`.** Building a uuid from
  metadata alone yields `Compendium.undefined.Actor.<id>`.
- **Compendium index does not include level by default** — request it:
  `getIndex({ fields: ["system.details.level.value"] })`.
- **Table 2-11 (Spell DC) is shaped unlike the others**: three bands only (no Low or
  Terrible), paired columns `"high dc"` / `"high spell attack bonus"`. Needs the
  `spellRow()` adapter before `classify()` can read it.
- **Attribute modifiers have no Extreme band at levels -1 and 0** — GM Core writes an
  em-dash. Distinct from a negative number; `isAbsentCell()` handles it.
- **Flat damage riders exist** (`"1"`, `"4"`) and must not be scaled.
- **Levels run -1 to 25 but the tables stop at 24.** Five creatures bestiary-wide are
  out of range; they are filtered from the picker and refused by the engine.
- **AoN `*_scale_number` fields are band labels** on a single global scale:
  `1=terrible … 5=extreme`, `0=unset`. This is what makes corpus validation possible.
- **AoN Elasticsearch allows CORS** from a Foundry origin. Confirmed live.
  Endpoint: `https://elasticsearch.aonprd.com/aon/_search`, GET with a `source` param
  (a POST would trigger a preflight).
- **PF2e sidebar footer**: `<footer class="directory-footer action-buttons flexcol">`.
  PF2e's button uses `data-action="openCompendiumBrowser"`; do **not** add unknown
  `data-action` values, ApplicationV2 dispatches them and warns.

---

## 6. Open issues

### 6.1 Editor — the next build

Specified but not written. Dan's complaint, verbatim: *"i cannot preview the creatures
i want to customize OR actually customize it with abilities etc - it just rescales."*
Preview is now done; customising is not.

Requirements:

- Land on an editable stat block instead of creating immediately.
- Every number editable; band recalculated live as the user types.
- One-click band override (a dropdown per statistic). Overriding sets the value to that
  band's figure; the offset resets to zero.
- **HP and weaknesses shown together** — this is §7.5 option C and the reason the
  reference creature's HP looks wrong (see 6.2).
- Rename before creating. Create only on confirmation.

Groundwork already in place:
- `src/pf2e/paths.ts` — read/write any statistic by the dotted path the engine reports.
  A test asserts every emitted path is addressable.
- `src/foundry/statblock.ts` — rendering, band chips, section grouping. Reuse it.
- `classifyAt()` and `bandValueAt()` in `rescale-creature.ts` — for live re-derivation
  and band overrides respectively.

### 6.2 HP versus weaknesses — a real design problem

The Husk Zombie has 55 HP at level 2, far above its band, because it carries
`vitality 5, slashing 5`. GM Core explicitly trades weaknesses against HP. Rescaling
to level 5 preserves that +19 offset and yields **110 HP**. Dan's hand-built version
used **75** — he dropped the numeric weakness and let HP fall to Moderate.

The engine warns and does not adjust. The editor must present HP and weaknesses as one
decision. Encoded as a `describe.todo` in `test/scaling.test.ts`.

### 6.3 Band drift — the second `describe.todo`

Dan's creature also moved AC from Moderate (17 @ L2) to High (22 @ L5). Pure rescaling
gives 21. Decision was **option A**: rescale faithfully, show the band, offer a
one-click change. The editor implements this.

### 6.4 ORC attribution — blocking any public release

`NOTICE.md` contains a **drafted, unverified** ORC attribution notice. The generated
tables in `src/data/creature-tables.ts` are Open Game Content and the ORC License
requires a specific verbatim notice. **Verify against <https://paizo.com/orclicense>
before publishing anything.** Not urgent at pre-alpha; do not let it ship unchecked.

### 6.5 GitHub push access — abandoned, cause unknown

Claude cannot push. The sandbox proxy blocks git to github.com (403 on CONNECT), there
is no GitHub connector in the Anthropic registry, and GitHub's remote MCP endpoint
needs OAuth that Claude Desktop does not support.

A local MCP binary was installed and never became visible in Cowork. **The MCP server
logs at `%APPDATA%\Claude\logs\mcp-server-*.log` were never read** — start there if
revisiting. Along the way a UTF-8 BOM bug destroyed Dan's `aon` MCP server entry; it
was restored from backup. See the status banner in `docs/DEV-SETUP.md`.

**Current workflow: Dan runs git himself.** It works. Give him exact commands.

### 6.6 Cosmetic

- `1d4+3 → 2d4+10` — preserving a d4 chassis means the flat modifier carries the
  growth. Documented trade in §7.3 (creature identity over idiomatic dice), but a
  level-10 dagger NPC looks odd. Published equivalents sit near `2d4+8`.
- Riders are never scaled. 59 of 71 sampled are uncategorised energy dice, so scaling
  them later would be easy if the decision changes.

---

## 7. What comes after the editor

### Ability grafting — the actual product

Three sources, resolution order:

1. **Foundry compendium item** — free automation, correct action cost, working rules.
2. **AoN** — fetch text, generate a PF2e `action` item with `actionType`,
   `actions.value` and traits.
3. **Hand-authored** — for novel content like `Bound to Occam`.

Any grafted ability carrying a level-scaled number (save DC, damage) passes through the
scaling engine so it lands correctly for the target level.

### Custom ability authoring — all three routes

Dan's decision, verbatim: *"it can be all 3, let the user type, pick an LLM to create
it for them OR copy and modify."*

- **Type it** — form for name, action cost, traits, description.
- **LLM drafts it** — plain-language description in, draft out, then edit.
- **Copy and modify** — find something close, attach, edit.

All three converge on the same PF2e `action` item.

### LLM integration

Deferred deliberately; the rules engine ships first and is useful with no API key.
When added: **an LLM may draft text, but never decides a number.** Anything numeric it
produces is validated against the Building Creatures tables and shown with its band
like any other statistic. Approach chosen was bring-your-own-key, browser-direct.

---

## 8. Working practices that actually worked

This is the most transferable part.

**Probe before building.** Every piece verified against real data held up. Every piece
built from assumption was wrong — the classifier (86% vs 100%), the damage-roll
ordering (would have broken every dragon), `pack.collection` (broke all uuids), and
twice-stated wrong conclusions about MCP config. The pattern is reliable enough to
treat as a rule: **write a console probe, look at real output, then write the code.**

Existing probes in `tools/`: `probe-compendia.js`, `probe-spells-riders.js`. Write more.

**Unit tests confirm your model, not reality.** Three separate bugs passed a full green
suite because the fixture and the code came from the same wrong assumption. The corpus
validation (`test/scale-decode.test.ts`) caught the classifier precisely because the
data was authored by Paizo, not by us.

**Read the output, not just the assertions.** Two bugs were spotted by looking at
printed summaries — `1d6+9` and `Compendium.undefined` — that assertions passed over.
Keep `summarise()` noisy in test runs.

**Dan runs everything.** Give exact copy-pasteable commands, correct paths, and say what
the expected output looks like so a failure is recognisable.

---

## 9. File map

```
src/
  creatureator.ts          module entry, game.creatureator API, sidebar button
  data/creature-tables.ts  GENERATED - 12 GM Core tables (committed)
  scaling/
    bands.ts               classify / reemit / threshold. The core.
    rescale-creature.ts    whole-creature rescaling, warnings, classifyAt, bandValueAt
  pf2e/
    npc.ts                 actor <-> StatBlock, primaryDamageIndex
    damage.ts              formula parsing, flat riders, re-expression
    paths.ts               read/write statistics by dotted path
  foundry/
    chassis.ts             discovery, provenance, filtering
    picker.ts              ApplicationV2 chassis picker with preview
    statblock.ts           rendering, band chips, sections
tools/
  fetch-creature-tables.mjs   regenerates the tables from AoN
  fetch-validation-corpus.mjs 4,714-creature fixture
  probe-*.js                  live Foundry probes
  setup-github-mcp.ps1/.sh    see 6.5; do not expect them to work
  restore-mcp-servers.ps1     recovery for the BOM incident
docs/
  DEV-SETUP.md             cross-machine setup, GitHub MCP post-mortem
  HANDOFF-dev-server.md    Mac mini evaluation brief
```

`ARCHITECTURE.md` is the design record — decisions, evidence, and open questions with
their reasoning. Read §3 (layers), §7.5 (band drift), §7.6 (bestiary findings).

---

## 10. Suggested first move

Build the editor, but not all at once. Render one section — Defences, with AC, HP,
saves — get a screenshot from Dan, confirm the field/band/override interaction reads
well, then expand to the rest. The UI is the one layer that cannot be verified without
his eyes, so short loops beat a big blind build.
