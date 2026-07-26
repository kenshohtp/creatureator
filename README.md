# Creatureator

A Foundry VTT module for building custom Pathfinder 2e creatures.

Pick a creature from your bestiary as a chassis, rescale it to any level against the
GM Core *Building Creatures* tables, and graft on abilities from your compendia or the
Archives of Nethys. The result is a real PF2e NPC actor — indistinguishable from a
hand-built one, and compatible with everything else in your world.

> **Status: pre-alpha.** The scaling engine and its data pipeline exist. The Foundry
> UI does not yet. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requirements

- Foundry VTT **v14+** (verified 14.365)
- Pathfinder 2e system **8.2.0+**

## Design principles

**No adjustment is ever silent.** Every derived number carries its band label and its
provenance. When the engine rescales a creature's AC from Moderate to Moderate, it
says so; if you want High instead, that is your decision to make and it is one click
away. The tool never quietly rewrites a creature.

**Deterministic first.** All scaling is pure table lookup against published Paizo
numbers. There is no LLM in the path that decides a statistic, and the module is fully
useful without an API key. Language models are a later addition for flavour text and
drafting novel abilities — never for maths.

**Offsets survive.** Published creatures are a mix of exact band hits and deliberate
designer offsets. A creature sitting one point above High stays one point above High
after rescaling, rather than being snapped to the nearest table row.

## Development

```bash
npm install
npm run fetch:tables   # regenerate src/data/creature-tables.ts from AoN
npm run fetch:corpus   # harvest the validation fixture (optional, large)
npm test
npm run typecheck
npm run build
```

`fetch:tables` output is committed, so a fresh clone builds without network access.
Re-run it only when Paizo publish errata.

## Data sources

Creature chassis come from the PF2e system's own compendia — copying a compendium
actor preserves its Strike items, rule elements, and automation, which parsing a text
stat block cannot.

Ability search queries the Archives of Nethys index at runtime, falling back to
compendium-only results when unreachable.

## Licence

Module code: MIT (see `LICENSE`).

Pathfinder game mechanics reproduced in `src/data/` are Open Game Content. Creature
descriptions and artwork remain in Paizo's premium modules and are never copied into
module output. See `NOTICE.md`.
