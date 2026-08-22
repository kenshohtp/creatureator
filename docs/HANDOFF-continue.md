# Handoff: continue Creatureator development

**Purpose.** Start a fresh conversation with this attached. It contains everything
needed to resolve the open issues and continue building, without re-deriving
decisions or re-discovering data.

Last updated: 22 Aug 2026, at commit `c12bfb1`.

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
| Foundry | v14.366 (desktop app, **not** a browser — see 6.7) |
| PF2e system | 8.4.0 |
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

**279 tests passing**, no `describe.todo` left. 14 test files.

### What works, and how it was verified

| Piece | Verification |
|---|---|
| Band classification | Exact agreement with 4,714 published creatures on Perception, all 3 saves, HP (4709/4709 each). 99%+ on attributes. AC is 86.8% — investigated and left alone, see ARCHITECTURE 7.6. |
| GM Core tables | Generated from AoN by document ID, committed. All 12 tables. |
| NPC data mapping | 720 creatures across 66 packs, zero field misses. |
| Whole-creature rescaling | Husk Zombie 2→5 matches Dan's hand-built version within a point. |
| Spellcasting | DC and spell attack, multiple entries per creature. |
| Chassis discovery | 6,393 creatures indexed live, with provenance. |
| Actor creation | Verified in Foundry: rule elements, MAP progression, immunities, actions all survive. |
| **Editor** | Verified in Foundry by screenshot. Every number editable, band re-derived live, one-click band override, HP and weaknesses as one block, rename, create on confirmation. |
| **Ability DCs** | 2,437 save DCs from 2,131 creatures: 70.0% land exactly on a Table 2-11 column, 98.6% within 2. Flat checks proven level-independent. |
| **Ability grafting** | Search 1,300 shared ability items, attach, rescale the DCs inside, strip legacy alignment traits. UI verified by render; **not yet verified in a live Foundry session.** |

### What does NOT exist

- **The other two authoring routes.** Grafting covers "copy from a compendium".
  Typing an ability by hand and having an LLM draft one are both unbuilt (7).
- **Copy from another creature.** The ~30,000 abilities embedded in bestiary
  creatures are not reachable from the attach panel; only the ~1,300 in shared
  Item packs are. Indexing the rest means loading every actor.
- **Ability damage scaling.** Measured against both candidate tables and neither
  fits (13.8% / 9.3%). Surfaced and left alone deliberately.
- **LLM anything.** Still deliberately deferred; see 7.

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
2. **Scaling engine** — `src/scaling/bands.ts`, `rescale-creature.ts`,
   `rescale-ability.ts` (no Foundry deps)
3. **Editing** — `src/editor/edit-session.ts` (no Foundry deps)
4. **Ability grafting** — `src/pf2e/ability.ts`, `src/foundry/ability-index.ts`

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

### 6.1 Editor — DONE

Screen two of the builder window. Land on an editable stat block, every number
editable, band re-derived on each keystroke, one-click band override per
statistic, HP and weaknesses in one block, rename, create only on confirmation.

`src/editor/edit-session.ts` is the model (Foundry-free, fully tested),
`src/foundry/editor-view.ts` renders it, `src/foundry/picker.ts` wires it.

Two things the live render caught that the sandbox could not:

- The damage band dropdown advertised Table 2-10's own dice ("Low 2d4+6") while
  the override preserves the chassis's die size and actually produces 2d6+4. It
  now builds its options through the same re-expression the override uses.
- "Source and target level are the same" was rendering as a red warning on an
  unmodified copy. That is a fact, not a problem, and the header already says it.

### 6.2 HP versus weaknesses — RESOLVED

The editor presents them as one block with the trade spelled out, and the HP
warning names the current numbers and clears when the decision is made.
`test/edit-session.test.ts` asserts the editor reproduces Occam's Risen Kinetic
Husk exactly: AC 22, HP 75, both weaknesses removed.

### 6.3 Band drift — RESOLVED

Option A as decided: the engine rescales faithfully (AC 17 @ L2 → 21, not 22),
shows the band, and offers a one-click change. Both `describe.todo` blocks are
now real tests.

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

### 6.7 Getting data out of Foundry — Dan runs the DESKTOP APP

This cost a round of confusion and is worth knowing up front. Dan runs the
Foundry **desktop app** (Electron), not Foundry in a browser. Consequences:

- `saveDataToFile` returns without producing a file.
- A `blob:` download link is handed to Windows, which offers to find an app for
  it in the Microsoft Store.
- There is no downloads machinery to fall back on.

**What works:** `copy(...)` in the DevTools console puts text on the clipboard,
and PowerShell reads it back. Beware the ordering trap — copying the PowerShell
command out of the chat *overwrites* what `copy()` just put there. Have
PowerShell poll for it instead:

```powershell
$d="C:\path\out.tsv"; for($i=0;$i -lt 90;$i++){ $c=Get-Clipboard -Raw; if($c -match "^[CD]\t"){ $c|Set-Content -Encoding utf8 $d; break }; Start-Sleep 2 }
```

Also: PF2e logs hundreds of `evil is not a valid choice` warnings whenever
anything loads a pre-remaster adventure-path actor. Probes that sweep the
bestiary should silence `console.warn`/`console.error` for the duration and
report how many they swallowed — `tools/probe-ability-numbers.js` shows the
pattern.

### 6.8 Moving files INTO the repo from a sandboxed session

Claude cannot write to the repo directly and cannot push to GitHub (6.5). What
worked all session: Claude tars the changed files, sends the archive, it is
committed to `scripts\` (gitignored, and `npm run build` empties it), then
unpacked over the repo. The bridge blocks deletes, so `tar x` fails on existing
files — extract to a temp directory and `cat` each file into place instead.

Never run `git status` through the bridge without `--no-optional-locks`: it
writes `.git/index.lock` and cannot remove it, which blocks Dan's next commit.

## 7. What comes next

### Ability grafting — route 1 of 3 is BUILT

Three sources, resolution order:

1. **Foundry compendium item** — BUILT. `src/foundry/ability-index.ts` indexes
   every Item pack and keeps anything of type `action`: about 1,300 rows across
   the bestiary glossary (55), the family glossary (482), adventure-specific
   actions (208) and general actions (574), plus any module or homebrew pack.
   Read from compendium *indexes*; no documents load until something is attached.
2. **AoN** — not built. Fetch text, generate a PF2e `action` item.
3. **Hand-authored** — not built. For novel content like `Bound to Occam`.

What a graft does, all of it reported rather than assumed
(`src/pf2e/ability.ts`):

- Rescales save DCs inside the description against Table 2-11.
- Strips `good` / `evil` / `lawful` / `chaotic`. Without this the item cannot be
  created — PF2e 8.x refuses those traits and the AP bestiaries are full of them.
- Drops the item's `_id` so it cannot collide, and records where it came from in
  `_stats.compendiumSource`.

The panel asks **"written for level"** rather than assuming: a compendium ability
carries no level of its own, so there is no way to know what a DC inside it was
balanced against. It defaults to the creature's level, so the default action
changes nothing.

**Not built:** copying an ability off another *creature*. That is where the real
mass is — roughly 30,000 embedded abilities, five per creature — and it needs the
chassis picker rather than the ability index, because indexing it means loading
every actor.

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
    rescale-ability.ts     DCs inside ability text; what must never move
  editor/
    edit-session.ts        the editing model: baseline, working block, live bands
  pf2e/
    npc.ts                 actor <-> StatBlock, primaryDamageIndex
    damage.ts              formula parsing, flat riders, re-expression
    paths.ts               read/write statistics by dotted path, prettyPath
    inline.ts              @Check / @Damage / @Template parsing and rewriting
    ability.ts             ability items: read, sanitise traits, graft
  foundry/
    chassis.ts             discovery, provenance, filtering
    ability-index.ts       ability discovery across Item packs
    picker.ts              two screens: chassis picker, then the editor
    statblock.ts           rendering, band chips, sections
    editor-view.ts         editor markup: fields, bands, defences, abilities
tools/
  fetch-creature-tables.mjs   regenerates the tables from AoN
  fetch-validation-corpus.mjs 4,714-creature fixture
  probe-*.js                  live Foundry probes
  probe-abilities.js          where abilities live, and how their numbers are written
  probe-ability-numbers.js    harvests DCs and damage with creature levels
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

Grafting works but has never been exercised in a live session. Before building
anything else: open the builder, pick a chassis, search the Abilities panel,
attach something, and create the creature. Two specific unknowns:

1. **Index build time** on an install with all the premium modules. It runs in
   the background and the panel says "Reading your compendia…", but nobody has
   watched it against 25 Item packs including a 6,283-entry feat compendium.
2. **Whether the detail lines read as useful or as clutter** at real width. Each
   ability shows what moved and everything deliberately left alone, which is
   correct by the project's rules and might still be too much on screen at once.

After that, the remaining product is the other two authoring routes — type it by
hand, and have an LLM draft it — plus "copy an ability from another creature",
which reuses the chassis picker rather than the ability index.
