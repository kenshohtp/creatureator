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

## Before any public release

The ORC License requires two things in the product: an **ORC Notice** reproducing the
licence's own wording, and an **Attribution Notice** crediting each upstream licensor
of the Licensed Material used. **Both are now filled from GM Core's own legal page**,
photographed 23 Aug 2026. What remains in the checklist below is about packaging, not
wording.

**Provenance of the two notices below.** Both were copied from the ORC Notice printed
in Pathfinder GM Core, photographed 23 Aug 2026. Paizo's ORC web page publishes the
licence but no per-product attribution text, so the book was the only source for the
copyright line — as an earlier revision of this file correctly warned.

The attribution line was diffed against the hand-maintained transcription the PF2e
Foundry system ships at `Data/systems/pf2e/licenses/ORCLicense.md`. All twenty-seven
author names match exactly and in order; the transcription differs only in its
preamble, writing "© 2023, Paizo Inc.; Designers:" where the book reads
"© 2023 Paizo Inc., Designed by". The book's punctuation is what appears below. That
file is a reasonable cross-check and not an authority — three of its fifty entries
still read `Authors: TBD.`

An earlier draft of this file carried a *reconstructed* author list. It was deleted
rather than patched, on the grounds that a plausible-looking legal notice is more
dangerous than an obviously incomplete one. That judgement held up: the real list,
when it arrived, was not what a reconstruction would have produced.

### ORC Notice — ORC License §III.a

**Copied verbatim from Pathfinder GM Core's own legal page**, photographed 23 Aug
2026. Matching the licensor whose Licensed Material this product actually uses was
preferred over matching the licence's current abstract phrasing.

> This product is licensed under the ORC License to be held in the Library of
> Congress and available online at various locations including paizo.com/orclicense,
> azoralaw.com/orclicense, and others. All warranties are disclaimed as set forth
> therein.

**Do not "correct" this.** Three wordings exist, all defensible, and they genuinely
differ:

| source | wording |
|---|---|
| **GM Core, printed 2023 — used here** | "to be held in the Library of Congress", no registration number, two domains named |
| ORC License §III.a, and paizo.com/orclicense today | "located at the Library of Congress at TX 9-307-067", no domains |
| ORC License §III.e sample notice | as §III.a, plus "including [possible domain names may be inserted] and others" |

GM Core went to print before the licence was registered, which is why it reads "to be
held in" and carries no TX number. The assigned number is TX 9-307-067 and Paizo's
website uses it today. The domain list is expressly sanctioned by §III.e, and the two
domains above are the two GM Core itself names.

A previous revision of this file replaced the book's wording with the bare §III.a
form, on the strength of Paizo's website and the PF2e system agreeing with each other
— before anyone had looked at the book. Two independent secondary sources agreeing is
not the same as being right. The book is the licensor's own published notice for the
exact product whose material this uses, so the book wins.

This has not been reviewed by a lawyer.

### Attribution Notice — ORC License §III.b

The "based on the following Licensed Material" statement satisfies §III.b(i); the
credit request satisfies §III.b(ii). §III.c (Reserved Material) and §III.d (Expressly
Designated Licensed Material) are conditional — the licence says "if any" and "that
You agree to offer" — and Creatureator has neither, so their absence here is correct
rather than an omission.

```
This product is based on the following Licensed Material:

    Pathfinder GM Core © 2023 Paizo Inc., Designed by Logan Bonner and Mark Seifter. Authors: Amirali Attar Olyaee, Logan Bonner, Creighton Broadhurst, Jason Bulmahn, James Case, Jesse Decker, Eleanor Ferron, Fabby Garza Marroquín, Jaym Gates, Matthew Goetz, James Jacobs, Brian R. James, Jenny Jarzabski, Dustin Knight, Jason LeMaitre, Lyz Liddell, Luis Loza, Ron Lundeen, Stephen Radney-MacFarland, David N. Ross, Michael Sayre, Mark Seifter, Owen K.C. Stephens, Amber Stewart, Clark Valentine, Landon Winkler, and Linda Zayas-Palmer

If you use our Licensed Material in your own published works, please credit us as
follows:

    Creatureator, © 2026, kenshohtp.
```

### Checklist before release

- [x] ORC Notice copied verbatim from GM Core's legal page (23 Aug 2026)
- [x] GM Core attribution line copied verbatim from GM Core's own legal page
      (photographed by Dan, 23 Aug 2026 — the book, not a transcription)
- [x] ORC Notice reproduced in the distributed files, not only in this repo
      (enforced: `npm run package` aborts if `NOTICE.md` is absent)
- [x] No creature names, descriptions or artwork in `src/data/` — checked 23 Aug 2026.
      `node tools/check-tables-content.mjs` prints every non-numeric string in the
      generated tables; all 140 are band names, column headers, table captions, GM
      Core page citations, object keys, or item examples like
      `10 (_+2 striking weapon_)`. **Re-run it after `npm run fetch:tables`.**
- [x] Release artifact contains no Paizo premium module content
      (enforced: the allowlist in `tools/package-module.mjs` ships seven named
      paths and excludes everything else by default)

**What `module.zip` must contain — now enforced.** Build the archive with
`npm run package`, never by hand. `tools/package-module.mjs` ships a strict
allowlist: `module.json`, `scripts/`, `styles/`, `lang/`, `NOTICE.md`, `LICENSE` and
`README.md`, and nothing else. Any of those missing aborts the build rather than
producing a quietly incomplete release — which matters most for `NOTICE.md`, since
`module.json` points Foundry at it through the `license` field and that link is dead
if the file is absent.

The allowlist is deliberate rather than an ignore list. An ignore list fails open: add
a directory to the repo, forget to exclude it, and it ships. An allowlist fails
closed — anything new has to be added to `CONTENTS` on purpose, which is what lets
two of the checklist items above be enforced rather than re-read every release.

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
