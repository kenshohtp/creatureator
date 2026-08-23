# Handoff: continue Creatureator development

**Purpose.** Start a fresh conversation with this attached. It contains everything
needed to resolve the open issues and continue building, without re-deriving
decisions or re-discovering data.

Last updated: 23 Aug 2026, against commit `b65f6ee`.

**Read §8's note on drift first.** The 22 Aug revision of this file said two
built features were not built. Every "not built" claim below has been checked
against the repo as of `b65f6ee`; claims about what *works* have not been
re-verified beyond what §3 already records.

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
creature easy to produce. It now can: the re-levelling, the ability grafting and
the hand-written `Bound to Occam` have each been done end to end in a live world
(§3). The 22 Aug revision of this line said abilities were "most of the value"
and not yet possible; that stopped being true at `db4e916`. What is left is
coverage and polish, not the core — see §10.

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

**338 tests passing**, no `describe.todo` left. 14 test files.
(Sandbox count is 320; the 18 corpus tests in `scale-decode.test.ts` need
`npm run fetch:corpus`, which is gitignored. Dan's `npm run check` is the gate.)

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
| **Ability grafting** | Verified live: Dragon Breath copied onto a husk zombie, DC repaired, ability usable from the sheet. Two sources — 1,414 shared ability items, and any creature's own abilities. |
| **Ability editing** | Name, action cost, traits, description and the save DCs inside the text, all editable in place. Blank abilities can be written from scratch. |
| **Inline element parsing** | `@Check` / `@Damage` / `@Template`, including nested brackets, trailing `\|options:` parameters, and `against:` DC references. 31 tests, every fixture string real. |
| **Area damage figures** | Table 2-12 offered as two labelled choices on any `options:area-damage` term; die size preserved; flat and unreadable amounts refused with a reason. 10 tests. |
| **The reference creature** | **Built end to end in a live world.** Occam's Risen Kinetic Husk: AC 22, HP 75, weaknesses dropped, renamed, with a hand-written `Bound to Occam`. |

### What does NOT exist

- **AoN as an ability source.** Three of the four routes are built — copy from
  a compendium item, copy from another creature, and write one by hand (§7).
  Fetching an ability's text from Archives of Nethys is not, and measurement says
  it should not be: 98.3% of AoN's creatures already exist locally as real PF2e
  data (§7a, ARCHITECTURE §7.7).
- **Automatic ability damage scaling.** Still deliberately absent, and should
  stay absent — no table earns it. What now exists is the offer: damage marked
  `options:area-damage` carries Table 2-12's two figures for the target level as
  explicit choices (§9a, built). Everything else is surfaced with its reason.
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

The generated tables in `src/data/creature-tables.ts` are Open Game Content and the
ORC License requires two things: an **ORC Notice** in specific wording, and an
**Attribution Notice** crediting each upstream licensor.

**The ORC Notice is done** (23 Aug). Its wording was checked against Paizo's own
licence page and the PF2e system's `licenses/ORCLicense.md`, which agree — and the
draft in `NOTICE.md` did not match either. It read "held in the Library of Congress"
with a list of mirror URLs; both sources read "located at" with no mirrors. Corrected.
Worth noting the draft had *not* been flagged as uncertain, while the attribution line
beside it had — the flagged half was fine and the confident half was wrong.

**The attribution line is still open**, and it is the last thing blocking a release.
It must be copied verbatim from GM Core's own legal page. The PF2e system ships a
populated GM Core entry, but three of that file's fifty entries read `Authors: TBD.`,
so it is a community transcription — good for diffing against the book once the real
line is in hand, not good as the source. Dan owns the book; this is a copy job, not
research.

### 6.5 GitHub — Dan pushes; Claude still cannot

**The repo is current.** `main` is pushed through `b65f6ee` — verified 23 Aug,
local `HEAD` and `origin/main` are the same commit — including the rewritten
README with screenshots. Dan runs `git push origin main` himself and
it works.

Claude still has no path to GitHub from the sandbox:

- `api.github.com` answers *"GitHub access to this repository is not enabled for
  this session. Use `add_repo` to request access."* — but **no `add_repo` tool is
  exposed** in this Cowork session, and the MCP registry lists no GitHub
  connector reaching it. Connecting a GitHub connector on claude.ai did not
  surface tools here.
- `github.com` is not fetchable by the web tool either (robots.txt).

So the previous diagnosis ("cause unknown, try the MCP logs") is superseded:
there **is** a supported mechanism (`add_repo`, per the sandbox proxy's own error
message and the Claude Code GitHub-actions docs), it is simply not available in
this session type. If push access matters, that is the thread to pull — not the
local MCP binary, which was a dead end.

**A trap worth knowing.** Do not run `git status` through the device bridge
without `--no-optional-locks`: it writes `.git/index.lock`, the bridge cannot
delete it, and Dan's next commit fails with "Another git process seems to be
running". This happened once and cost a round trip. Read state with
`git --no-optional-locks status --porcelain` or read `.git/refs` directly.

Also: the bridge's view of the repo can lag Windows. A file written through the
bridge may not be visible to a `git add -A` running a second later, and a file
Windows has deleted may still appear in a bridge listing. Verify with a command
run on Windows when it matters.

### 6.6 Cosmetic

- `1d4+3 → 2d4+10` — preserving a d4 chassis means the flat modifier carries the
  growth. Documented trade in ARCHITECTURE.md §7.3 (creature identity over
  idiomatic dice), but a
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

**Superseded when a folder is connected (23 Aug).** With
`C:\Projects\creatureator` granted through the desktop app's folder access, the
bridge is read *and write*: Claude edits files in place with ordinary tools and
none of the tar dance below is needed. The `--no-optional-locks` rule still
applies, and the bridge's view of the repo can still lag Windows. The rest of
this section applies only when no folder is connected.

Claude cannot write to the repo directly and cannot push to GitHub (6.5). What
worked all session: Claude tars the changed files, sends the archive, it is
committed to `scripts\` (gitignored, and `npm run build` empties it), then
unpacked over the repo. The bridge blocks deletes, so `tar x` fails on existing
files — extract to a temp directory and `cat` each file into place instead.

Never run `git status` through the bridge without `--no-optional-locks`: it
writes `.git/index.lock` and cannot remove it, which blocks Dan's next commit.

### 6.9 Claude cannot run the real test suite

The sandbox's npm registry is blocked — `npm install` fails on every package —
so Claude cannot install vitest, vite or typescript in its own workspace.

What worked all session, and is set up in `~/work/creatureator` in a fresh
sandbox if recreated:

- A hand-written **vitest-compatible shim** (`describe`, `it`, `expect`,
  `it.each`, `describe.skipIf`, the matchers this suite uses) dropped in as
  `node_modules/vitest`, run through `tsx`, which is available globally.
- `tsc` 6.0.3 is available globally, so typechecking is real. `@types/node` is
  symlinked from `/opt/node-tools`.
- Ignore `TS7006` errors from the shim's `any` signatures; everything else is a
  real type error.

**Dan's `npm run check` is the authoritative gate.** The shim agrees with it in
every case seen, but it is a stand-in.

## 7. What comes next

### Ability grafting — three of four routes are BUILT

Four sources, resolution order:

1. **Foundry compendium item** — BUILT. `src/foundry/ability-index.ts` indexes
   every Item pack and keeps anything of type `action`: about 1,300 rows across
   the bestiary glossary (55), the family glossary (482), adventure-specific
   actions (208) and general actions (574), plus any module or homebrew pack.
   Read from compendium *indexes*; no documents load until something is attached.
2. **Another creature's own abilities** — BUILT, at `db4e916`.
   `#abilityMode` in `src/foundry/picker.ts` toggles the panel between the
   shared index and a donor creature; `#browseCreature()` loads one actor on
   demand and caches its source beside the chassis previews, so comparing
   several donors costs one read each. This reaches the ~30,000-ability pool
   without indexing it.
3. **Hand-authored** — BUILT. `addAbility()` in `src/editor/edit-session.ts`
   pushes a blank `action` item marked `authored: true`, which the editor then
   treats like any other row. This is how `Bound to Occam` gets written.
4. **AoN** — not built, and measured as not worth building (§7a). Search AoN and
   resolve the hit to the local item; do not reconstruct items that already exist.

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

That question is asked only of route 1. A donor *creature* has a level, so
`#copyFromCreature()` passes `fromLevel: from.level` and the DC rescale is exact
with nothing to ask.

**This section claimed until 23 Aug that copying off another creature was not
built.** It had been built nine commits earlier, at `db4e916`, and §3's
verification table said so on the same page. Do not act on a "not built" line in
this document without grepping for it first — see §8.

### 7a. AoN: probed, then measured — the importer is not worth building

**Measured 23 Aug against a live install: 98.34% of AoN's 4,748 creatures already
exist in the Foundry compendia, and 41 of the 79 that do not are pre-remaster names
the remaster replaced.** AoN also trails Foundry on the newest books rather than
leading it. Full numbers, method and the five normalisation tiers are in
ARCHITECTURE.md §7.7. AoN's role is search and corpus validation, not import.

The probe findings below predate that measurement. They are kept because they are
what anyone reopening the question would otherwise re-derive — and because the
prose→inline-element problem they describe is the reason the importer is expensive.

Four documents pulled from AoN's Elasticsearch and read in full: the `action`
Breath Weapon, the `creature-ability` Grab, Husk Zombie (`creature-1919`) and
Adult Bog Dragon (`creature-4116`). What they establish:

**There is an anchor for the parse.** Every creature document carries
`creature_ability`, an array of ability *names* — Husk Zombie's is
`["Slow","Sneak Attack","Sudden Surge"]`. An extractor does not have to discover
abilities, only locate names it was handed, which means it can *refuse* rather
than guess when it cannot find one. `trait` and `actions` ("Two Actions",
"Reaction") arrive as clean structured fields; neither needs parsing.

**The markdown is not reliably well-formed.** From the Bog Dragon's defences
block, verbatim:

    **[**Frightful Presence**](/MonsterAbilities.aspx?ID=64)** (...) 90 feet, DC 30<br />Tail Lash <actions string="Reaction" /> **Trigger** ...

Two abilities on one line separated by a literal `<br />`; the first has bold
nested inside a link inside bold; the second is not bolded at all. Any
`**Name**`-anchored parse loses Tail Lash silently — and would pass a test
written from the Husk Zombie, which is clean. Abilities also live in **two**
regions, not one: Frightful Presence and Tail Lash sit in the defences column
beside AC and Immunities, the other seven below Speed and the Strikes.

**The real work is not extraction.** AoN writes numbers as prose — `DC 27
Fortitude`, `(DC 30 basic Reflex save)`, `9d8 acid damage in a 40-foot cone`.
There are no `@Check` or `@Damage` inline elements anywhere. Everything the
module does to ability numbers — `rescale-ability.ts`, the §9a Table 2-12 offer,
DC band re-derivation — operates on those elements. So an AoN import needs a
**prose → inline-element converter** before it connects to any of it. Detecting
"40-foot cone" → `options:area-damage` would feed §9a directly, but it is a
second component with its own failure modes, and it is where the time will go.

**Two smaller traps.** AoN's markdown text is not always remastered even when its
structured fields are: Husk Zombie's text says "flat-footed" and "positive"
while its `weakness` field says `vitality`. And alignment appears as a trait
`"NE"`, which `LEGACY_TRAITS` in `src/pf2e/ability.ts` would not catch — it
strips `good`/`evil`/`lawful`/`chaotic`, not the two-letter forms. Links are all
relative (`/Conditions.aspx?ID=61`) and need rewriting or stripping.

**The probe instrument.** Dan's machine has an `aon__search` MCP that returns raw
`_source` documents — a thin wrapper over the Elasticsearch endpoint in §5, and
the fastest way to look at real AoN data from a session. It is a probe tool, not
the shipping path: the module fetches the endpoint directly from the Foundry
origin.

### Custom ability authoring — two of three routes built

Dan's decision, verbatim: *"it can be all 3, let the user type, pick an LLM to create
it for them OR copy and modify."*

- **Type it** — BUILT. Form for name, action cost, traits, description.
- **Copy and modify** — BUILT, from a compendium item or from another creature.
- **LLM drafts it** — not built. Plain-language description in, draft out, then
  edit.

All three converge on the same PF2e `action` item, which is why the third can be
added without disturbing the two that work.

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

**This document drifts from the repo; grep before you build.** On 23 Aug a
session was three probes into designing a feature that had been in `main` since
`db4e916`, because §7 said it was not built while §3's table — on the same page —
said it was. A handoff is a summary, and summaries rot. Check a claim against the
code before acting on it, especially a claim that something is *missing*: it
costs one grep and it is the cheapest verification in the project.

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
  probe-area-frequency.js     Table 2-12 column signals: frequency, prose recharge
  setup-github-mcp.ps1/.sh    see 6.5; do not expect them to work
  restore-mcp-servers.ps1     recovery for the BOM incident
docs/
  DEV-SETUP.md             cross-machine setup, GitHub MCP post-mortem
  HANDOFF-continue.md      this file
  HANDOFF-dev-server.md    Mac mini evaluation brief
```

`ARCHITECTURE.md` is the design record — decisions, evidence, and open questions with
their reasoning. Read §3 (layers), §7.5 (band drift), §7.6 (bestiary findings).

---

## 9a. BUILT — area damage figures (23 Aug 2026)

**Offer Table 2-12 figures for area damage.** Built as specified below, with
three deviations noted at the end. See ARCHITECTURE.md §7.6 for the record.

### Why

Ability damage is not rescaled automatically and should not be — see
ARCHITECTURE.md §7.6 for the measurement. But for the third of ability damage
that carries `options:area-damage`, Table 2-12 (Area Damage) is demonstrably the
relevant table: area abilities land on one of its two columns 30.5% of the time
against 10.5% for the Strike table. That is not good enough to move a number on
someone's behalf, and it is far too good to keep saying "no table governs this".

### What to build

In `src/editor/edit-session.ts`, mirroring `abilityDCs()`:

```ts
export interface AbilityDamageField {
  index: number;          // position among inline elements
  termIndex: number;      // position among that element's terms
  expr: string;           // "7d8"
  damageType: string | null;
  isArea: boolean;        // from damageParameters() containing "options:area-damage"
  average: number | null;
  options: { key: "unlimited use" | "limited use"; expr: string; average: number }[];
}

abilityDamage(rowId: string): AbilityDamageField[]
setAbilityDamage(rowId, inlineIndex, termIndex, expr): boolean
```

- `options` only for `isArea` fields. Build them from `rowFor("areaDamage", level)`
  — the cells are `"2d10 (12)"`, so `parseCellOrNull` gives both expression and
  average. Preserve the chassis die size the same way Strike damage does, via
  `rescaleDamageFormula(current, targetAverage, tableExpression)`.
- `damageParameters()` in `src/pf2e/inline.ts` already extracts the parameter
  list; `withDamageTerm()` already rewrites one term while preserving parameters
  and labels.
- Non-area damage gets **no options** — surfaced and explained, exactly as now.

In `src/foundry/editor-view.ts`, render these beside the existing DC fields in
`abilityForm()`: expression, damage type, and for area damage a select offering
"Unlimited use 5d6 (18)" / "Limited use 10d6 (35)" for the target level. Label
the two columns explicitly; which one applies depends on the ability's
**Frequency**, which the module does not know, so the user chooses.

In `src/foundry/picker.ts`, wire it in `#activateAbilityForm` alongside the
`ability-dc-input` / `ability-dc-band` handlers.

### Tests to write

- An area term offers two options; a non-area term offers none.
- Picking one rewrites only that term, keeping `|options:area-damage` and any
  `{label}`.
- The chassis die size survives: a d8 ability offered a d6 table figure comes
  back as a d8 expression.
- A flat area amount (`@Damage[20[force]|options:area-damage]`) is still left
  alone.

### Deviations from the spec above, and why

1. **`isArea` splits the `options:` list** rather than matching the parameter
   whole. `options:` is comma-separated in PF2e, so `options:area-damage,foo`
   is area damage and a whole-string compare would miss it. Lives in
   `src/pf2e/inline.ts` as `isAreaDamage()`, next to `damageParameters()`.
2. **Each field carries a `note`.** The spec has non-area damage getting no
   options "surfaced and explained"; the note is where the explanation lives.
   Four distinct reasons: not area, flat amount, unreadable formula, level
   outside the table.
3. **`options[].expr` is what will be written, not the table's expression.**
   The spec's example label reads "Unlimited use 5d6 (18)"; the rendered label
   reads "Unlimited use — 4d8+3 (18)" for a d8 ability, because that is what
   picking it produces. This is 6.1's dropdown bug, headed off.

### Frequency as a column signal (23 Aug) - measured and built

**`system.frequency` exists, and §9a assumed it did not.** The spec says which
Table 2-12 column applies "depends on the ability's **Frequency**, which the
module does not know, so the user chooses". Confirmed false on a live sheet:
Dragon Breath on a level 5 NPC carries
`system.frequency = {value: 0, max: 1, per: "PT1H"}`, and the three abilities
beside it carry `null`. So the module *can* read it.

**Measured twice, and the second run overturned the first's framing.** `tools/probe-area-frequency.js` ran over 875 area
terms on 2,131 creatures. One rule survived: **`per: "round"` means Unlimited
Use** (5.4% nearer Limited, 0% exact on it, n=129). The rule everyone would
have guessed - once per day means limited use - **is false**: n=32 at 37.5%
nearer Limited, *below* the 46.6% for abilities with no frequency at all.
Everything else is n<10.

Then a live black dragon showed the hole: its Breath Weapon recharges in
**prose** ("can't use Breath Weapon again for 1d4 rounds") with no frequency
field at all. Re-measured, prose recharge is a *stronger* signal than the
frequency field and points the **opposite** way - 283 terms, 77.0% nearer
Limited Use. The two groups are troop routines (`per: round`, Unlimited) and
breath weapons (prose, Limited); the marker is a proxy for what kind of ability
it is, not for frequency.

Both rules built, covering ~47% of area terms. Refused: `per: "day"` (n=32,
unsupported) and the 414-term no-marker group (leans Unlimited only weakly).
Built as a *suggestion*, not a selection: the dropdown shows
`Suggested: … ` as a disabled placeholder with the evidence under it, and the
damage is untouched until the user picks.

**The lesson worth keeping.** The first rule shipped with a comment explaining
*why* once-per-round means unlimited - "a recharge is at-will over an encounter".
Plausible, matched the numbers, and wrong: it predicts prose recharges are
unlimited, and they are the most Limited group in the data. A correlation with a
satisfying story attached is still just a correlation. Full numbers in
ARCHITECTURE.md 7.6.

Also corrected on the way past: the module docstring in `rescale-ability.ts`
still carried the pre-fix "13.8% exact" figure that ARCHITECTURE §7.6 had
already superseded, and the note on a `@Damage` element said no table governs
ability damage — now true only for non-area damage, and worded per case.

---

## 10. Suggested first move

§9a is done, and so are all three ability routes that do not need the network
(§7). The AoN gap has been measured and the importer is not worth building
(§7a, ARCHITECTURE §7.7). What is genuinely open, in rough order of value:

1. **ORC attribution** (§6.4, NOTICE.md) — blocks any public release. Dan owns
   the primary source; it is one copied line, not research. With the AoN question
   closed this is the only thing standing between the module and a release.
2. **AoN as search**, if it is wanted at all — and it is now optional rather than
   central. Not an importer: search AoN, then resolve the hit to the local Foundry
   item through the five normalisation tiers in ARCHITECTURE §7.7, which cover
   98.3% of AoN's creatures. Text import is the fallback that fires on 1.7% and
   can be deferred indefinitely.
3. **LLM drafting** — still last, and the rules engine ships useful without it.
4. **Cosmetic** (§6.6) — the `1d4+3 → 2d4+10` shape, if it ever bothers anyone.
