# Notices

## Module code

Creatureator's own source code is MIT licensed. See `LICENSE`.

## Pathfinder game mechanics

`src/data/creature-tables.ts` is generated from the *Building Creatures* statistic
tables in Pathfinder **GM Core**, retrieved via the Archives of Nethys index.

GM Core is Remaster-era Paizo content published under the **ORC License**. The tables
reproduced here are game mechanics — numeric benchmarks for creature construction —
and contain no creature names, descriptions, artwork, or setting material.

> **Action required before first public release.** The ORC License requires a
> specific, verbatim ATTRIBUTION NOTICE naming the Licensed Material and its
> originator, reproduced in full. The text below is a placeholder drafted from
> general understanding and **has not been checked against the official ORC License
> text or Paizo's published attribution requirements**. Verify it against
> <https://paizo.com/orclicense> and the ORC License itself before publishing, and
> correct as needed. This is the one part of the project where getting it
> approximately right is not good enough.

### Draft attribution notice — VERIFY BEFORE RELEASE

```
This product is based on the following Licensed Material:

Pathfinder GM Core, © 2023, Paizo Inc.; Authors: Logan Bonner, Jason Bulmahn,
James Jacobs, Luis Loza, Mark Seifter, and Michael Sayre.

ORC Notice: This product is licensed under the ORC License held in the Library of
Congress at TX 9-307-067 and available online at various locations including
paizo.com/orclicense, and other public repositories.

Attribution Notice: [complete per ORC License §5 before release]
```

## What is deliberately NOT included

- Creature names, stat blocks, descriptions, or lore
- Artwork or tokens of any kind
- Any content from Paizo's premium Foundry modules

Creature chassis are read at runtime from the user's own installed compendia. Nothing
Paizo-owned beyond the mechanical tables above is redistributed in this repository or
in any release artifact.

## Archives of Nethys

Ability search queries the Archives of Nethys index at runtime. AoN is a
community-run reference site and is not affiliated with this project. Queries are
rate-limited and cached; the module degrades to compendium-only search when the
service is unreachable.

## Foundry Virtual Tabletop

This module is an independent work and is not affiliated with or endorsed by Foundry
Gaming LLC or Paizo Inc.
