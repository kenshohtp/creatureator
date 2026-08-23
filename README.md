# Creatureator

A Foundry VTT module for building custom Pathfinder 2e creatures.

Take a creature from your bestiary as a chassis, rescale it to any level against the
GM Core *Building Creatures* tables, edit every number with its band shown, and graft
on abilities from your compendia or from any other creature. The result is a real PF2e
NPC actor — indistinguishable from a hand-built one, and compatible with everything
else in your world.

> **Status: pre-alpha, and useful.** The full path works end to end: pick a chassis,
> rescale, edit, attach abilities, create. It has not been released, packaged, or used
> by anyone but its authors. See [open items](#open-items) before relying on it.

![The editor, showing every statistic with its band](docs/images/editor.png)

## What it does today

- **Pick a chassis** from every Actor compendium you have — 6,393 creatures on a
  typical install — with provenance shown, because rescaling someone's homebrew
  carries different assumptions than rescaling a Monster Core creature.
- **Rescale to any level** from -1 to 24 against the published tables. Every
  statistic, every Strike, spellcasting DCs and attack modifiers, and the save DCs
  written inside the creature's own ability text.
- **Edit anything**, with the band re-derived as you type and a one-click override per
  statistic. Hit Points and weaknesses are presented as the single decision GM Core
  says they are.
- **Attach abilities** from about 1,400 shared compendium items, or from any other
  creature in your bestiary — where the source level is known, so the save DCs are
  rescaled exactly rather than guessed at.
- **Write abilities from scratch**, or reflavour any ability: name, action cost,
  traits, description, and the DCs inside the text.
- **Create the actor** only when you say so. Nothing is written to your world before
  that.

![Attaching and editing an ability](docs/images/abilities.png)

## Requirements

- Foundry VTT **v14+** (verified 14.366)
- Pathfinder 2e system **8.2.0+** (verified 8.4.0)

## Design principles

**No adjustment is ever silent.** Every derived number carries its band and any
deliberate offset. When the engine leaves something alone — a flat check, a damage
expression, a DC it cannot resolve — it says which, and why. A warning that fires and
then clears when you address it is worth more than a warning that is always on.

**Deterministic first.** All scaling is table lookup against published Paizo numbers,
validated against 4,714 published creatures. There is no language model anywhere in
the path that decides a statistic, and the module is fully useful without an API key.

**Measured, not assumed.** Where the rules are ambiguous, the bestiary is the oracle.
The classifier, the table that governs ability DCs, and the decision to leave ability
damage alone were each settled by measuring thousands of published creatures rather
than by reasoning about what Paizo probably meant. Details and figures live in
[ARCHITECTURE.md](./ARCHITECTURE.md).

**Offsets survive.** A creature sitting one point above High stays one point above
High after rescaling, rather than being snapped to the nearest table row.

## Roadmap

### Done

- [x] Band classification, validated against 4,714 creatures
- [x] GM Core tables generated from Archives of Nethys, committed
- [x] Whole-creature rescaling with per-statistic band reporting
- [x] Chassis picker with live preview and provenance
- [x] Editor: every number editable, live bands, one-click override, rename
- [x] Hit Points and weaknesses presented as one decision
- [x] Save DCs inside ability text rescaled against Table 2-11
- [x] Ability grafting from compendium items
- [x] Copying abilities from another creature
- [x] Writing and reflavouring abilities in place

### Next

- [ ] **Archives of Nethys as an ability source** — fetch an ability's text and build a
      PF2e item from it. Widest coverage; the most parsing risk.
- [ ] **Ability damage** — no published table fits it well enough to scale
      automatically. Needs a finer measurement that separates area abilities from
      riders before anything is decided. Currently surfaced and left alone.
- [ ] **A rich text editor** for ability descriptions, if the raw-text field proves
      too rough. It is deliberately raw today so that inline elements like
      `@Check[fortitude|dc:22]` stay visible and editable.
- [ ] **Packaging and release** — blocked on the licensing item below.

### Deliberately later

- [ ] **Language model assistance** for drafting novel abilities and flavour text.
      The rule remains: a model may draft prose, but never decides a number. Anything
      numeric it produces is validated against the tables and shown with its band like
      any other statistic.

## Open items

| Item | Where |
|---|---|
| **ORC attribution is unverified** and blocks any public release | [NOTICE.md](./NOTICE.md) |
| AC classifies at 86.8% against AoN's labels — investigated, no change made | ARCHITECTURE.md §7.6 |
| Ability damage fits no published table (13.8% best case) | ARCHITECTURE.md §7.6 |
| Strike damage keeps the chassis's die size, so `1d4+3` becomes `2d4+10` | ARCHITECTURE.md §7.3 |
| Damage riders are never scaled | ARCHITECTURE.md §7.6 |

## Development

```bash
npm install
npm run check          # typecheck, test, build — stops at the first failure
npm run build          # emits scripts/ (gitignored)
npm run fetch:tables   # regenerate src/data/creature-tables.ts from AoN
npm run fetch:corpus   # harvest the 4,714-creature validation fixture (optional, ~5MB)
```

`fetch:tables` output is committed, so a fresh clone builds without network access.
Re-run it only when Paizo publish errata.

Foundry loads the module from a symlink to this repository, so `npm run build`
followed by F5 in the browser is the whole edit-test loop. A server restart is only
needed when adding a new module.

### Probes

`tools/probe-*.js` are pasted into the Foundry console and read your world without
writing to it. They exist because every part of this module built from assumption was
wrong, and every part built from a probe held up. Write more of them.

## Data sources

Creature chassis and abilities come from the PF2e system's own compendia. Copying a
compendium actor preserves its Strike items, rule elements and automation, which
parsing a text stat block cannot — so the module never parses a stat block.

Archives of Nethys is used offline to generate the tables and the validation corpus.

## Licence

Module code: MIT (see [LICENSE](./LICENSE)).

Pathfinder game mechanics reproduced in `src/data/` are Open Game Content published
under the ORC License. Creature names, descriptions and artwork are never copied into
this repository or into module output. **The attribution notice is not yet verified —
see [NOTICE.md](./NOTICE.md) before publishing anything.**
