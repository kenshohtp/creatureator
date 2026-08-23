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

Below, the ORC Notice has been checked against Paizo's own ORC licence page
(23 Aug 2026). **The Paizo attribution line is still not verified.**
Paizo's ORC page does not publish per-product attribution text, so the correct
copyright line and author list for GM Core must be taken from a primary source rather
than reconstructed. Do not publish with a reconstructed one.

**Where to get the primary source.** The exact line is printed in GM Core's own legal
section, and is included in the Paizo premium Foundry module for GM Core. Copy it from
there verbatim — the book you already own is the authority, not a web search.

**A cross-check, not a source.** The PF2e Foundry system ships a hand-maintained
transcription at `Data/systems/pf2e/licenses/ORCLicense.md`, and its GM Core entry is
populated. Do not copy it in. Three of that file's fifty entries read `Authors: TBD.`,
which is proof it is a community transcription rather than an authority. It is useful
only for diffing against the book *after* the real line has been copied, so that
twenty-seven author names need not be checked by eye.

An earlier draft of this file carried a reconstructed author list. It has been removed
rather than corrected, because a plausible-looking legal notice is more dangerous than
an obviously incomplete one.

### ORC Notice — ORC License §III.a

Checked 23 Aug 2026 against three sources that agree: the ORC License text itself
(§III.a), Paizo's ORC licence page, and the PF2e Foundry system's
`licenses/ORCLicense.md`.

> This product is licensed under the ORC License located at the Library of Congress
> at TX 9-307-067 and available online at various locations. All warranties are
> disclaimed as set forth therein.

**Do not "correct" this back.** An earlier draft read "**held in** the Library of
Congress" and appended mirror URLs (azoralaw, gencon). Two separate things were going
on there and only one of them was a mistake:

- "held in" is wrong. Every source reads "located at". That was the real defect.
- The mirror list is **not** wrong in principle. §III.e's sample notice reads
  "available online at various locations including [possible domain names may be
  inserted] and others", so filling that bracket with domains follows the licence's
  own example.

§III.a states the requirement in its bare form; §III.e shows it expanded. Both trace
to the licence. The bare form is used here because it is also what Paizo publishes,
so this notice matches the licensor whose material is being used.

One trap for anyone re-checking: the copy hosted at `chaosium.com` is a
pre-registration draft and carries `TX00[number TBD]` where the registration number
belongs. TX 9-307-067 is the assigned number, and is what Paizo's page shows.

### Attribution Notice — ORC License §III.b — INCOMPLETE, fill from the primary source

The "based on the following Licensed Material" statement satisfies §III.b(i); the
credit request satisfies §III.b(ii). §III.c (Reserved Material) and §III.d (Expressly
Designated Licensed Material) are conditional — the licence says "if any" and "that
You agree to offer" — and Creatureator has neither, so their absence here is correct
rather than an omission.

```
This product is based on the following Licensed Material:

    [ GM Core copyright line, verbatim from the book's legal page or from the
      Paizo premium Foundry module for GM Core. It names the product, the year,
      Paizo Inc., and the authors. ]

If you use our Licensed Material in your own published works, please credit us as
follows:

    Creatureator, © 2026, kenshohtp.
```

### Checklist before release

- [x] ORC Notice wording checked against Paizo's licence page (23 Aug 2026)
- [ ] GM Core attribution line copied verbatim from a primary source
- [ ] ORC Notice reproduced in the module's distributed files, not only in this repo
- [ ] Confirm no creature names, descriptions or artwork have entered `src/data/`
- [ ] Confirm the release artifact contains no Paizo premium module content

**What `module.zip` must contain.** There is no release workflow — the zip is built by
hand — so nothing enforces this and it has to be checked each time. The archive must
carry `NOTICE.md` and `LICENSE` alongside `module.json`, `scripts/` and `styles/`.
`module.json` points Foundry at `NOTICE.md` through its `license` field, and that link
is dead if the file is not in the archive. Zipping the repo satisfies this; assembling
a slim artifact from `scripts/` and `styles/` alone does not.

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
