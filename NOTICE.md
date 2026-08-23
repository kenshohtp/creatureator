# Notices

## Module code

Creatureator's own source code is MIT licensed. See `LICENSE`.

## Pathfinder game mechanics

`src/data/creature-tables.ts` is generated from the *Building Creatures* statistic
tables in Pathfinder **GM Core**, retrieved via the Archives of Nethys index.

GM Core is Remaster-era Paizo content published under the **ORC License**. The tables
reproduced here are game mechanics — numeric benchmarks for creature construction —
and contain no creature names, descriptions, artwork, or setting material.

---

## ⚠ Before any public release

The ORC License requires two things in the product: an **ORC Notice** reproducing the
licence's own wording, and an **Attribution Notice** crediting each upstream licensor
of the Licensed Material used.

Below, the ORC Notice is quoted from published ORC-licensed products and matches the
wording used by other publishers. **The Paizo attribution line is not verified.**
Paizo's ORC page does not publish per-product attribution text, so the correct
copyright line and author list for GM Core must be taken from a primary source rather
than reconstructed. Do not publish with a reconstructed one.

**Where to get the primary source.** The exact line is printed in GM Core's own legal
section, and is included in the Paizo premium Foundry module for GM Core. Copy it from
there verbatim — the book you already own is the authority, not a web search.

An earlier draft of this file carried a reconstructed author list. It has been removed
rather than corrected, because a plausible-looking legal notice is more dangerous than
an obviously incomplete one.

### ORC Notice

> This product is licensed under the ORC License held in the Library of Congress at
> TX 9-307-067 and available online at various locations including
> www.azoralaw.com/orclicense, www.gencon.com/orclicense, and others. All warranties
> are disclaimed as set forth therein.

### Attribution Notice — INCOMPLETE, fill from the primary source

```
This product is based on the following Licensed Material:

    [ GM Core copyright line, verbatim from the book's legal page or from the
      Paizo premium Foundry module for GM Core. It names the product, the year,
      Paizo Inc., and the authors. ]

If you use our Licensed Material in your own published work, please credit us as
follows:

    Creatureator, © 2026, kenshohtp.
```

### Checklist before release

- [ ] GM Core attribution line copied verbatim from a primary source
- [ ] ORC Notice reproduced in the module's distributed files, not only in this repo
- [ ] Confirm no creature names, descriptions or artwork have entered `src/data/`
- [ ] Confirm the release artifact contains no Paizo premium module content

---

## What is deliberately NOT included

- Creature names, stat blocks, descriptions, or lore
- Artwork or tokens of any kind
- Any content from Paizo's premium Foundry modules

Creature chassis and abilities are read at runtime from the user's own installed
compendia. Nothing Paizo-owned beyond the mechanical tables above is redistributed in
this repository or in any release artifact.

## Archives of Nethys

Archives of Nethys is used offline, by `tools/fetch-creature-tables.mjs` and
`tools/fetch-validation-corpus.mjs`, to generate the tables and the validation corpus.
The module itself does not query AoN at runtime today. AoN is a community-run reference
site and is not affiliated with this project.

## Foundry Virtual Tabletop

This module is an independent work and is not affiliated with or endorsed by Foundry
Gaming LLC or Paizo Inc.
