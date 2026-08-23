# Roadmap and open issues

The single place for what is open. Other documents point here instead of keeping
their own copy, because four parallel lists is exactly how the 22 August handoff
came to say two built features were not built.

**Last reviewed: 23 August 2026, at commit `c5dec79`.**

---

## How to read this

Status words, kept few on purpose:

| | |
|---|---|
| **Open** | not started |
| **Blocked** | waiting on something named here |
| **Done** | with the date and how it was checked |
| **Closed** | investigated, deliberately not doing it, reason given |
| **Accepted** | a known behaviour we have decided to live with |

Every open item carries a **Verify** line — the command or observation that
settles whether it is finished. An item nobody can check cheaply is an item that
will quietly rot, which is the failure mode this file exists to prevent.

---

## Shipped

**0.1.0 — 23 August 2026.**
<https://github.com/kenshohtp/creatureator/releases/tag/0.1.0>

The whole path works: pick a chassis from any installed compendium, rescale it to
any level against the GM Core tables with every band shown, edit any number,
attach abilities from three sources, reflavour them, and create the actor. Built
end to end in a live world — Occam's Risen Kinetic Husk, the reference creature.

Licensing is complete: both ORC notices are copied verbatim from GM Core's own
legal page, and two of the five release checks are enforced by code rather than
by remembering.

---

## Open — next

### 1. Install 0.1.0 from its manifest URL into a real Foundry
**Open.** The only part of the release chain nothing has exercised: manifest
fetch, zip extraction, the `esmodules` / `styles` / `languages` paths, and
whether Foundry surfaces the `license` field added on 23 Aug without anyone
watching it work.

Mind the collision: the dev symlink at `G:\FVTT13test2\Data\modules\creatureator`
points at the repo. Install into a different Foundry data path, or rename the
symlink and restore it afterwards.

**Verify:** module appears in Add-on Modules, enables without console errors, the
sidebar button opens the picker, and the module-list entry shows a licence link.

### 2. Decide whether sourcemaps ship
**Open.** They are 424 kB of the 665 kB archive. Dropping them means either
turning maps off in `vite.config.ts` for release builds, or leaving
`//# sourceMappingURL` comments pointing at files that are not there, which
gives every user 404s in the console. Currently they ship.

**Verify:** `npm run package` reports the new size; no sourcemap 404s in a
Foundry console after installing.

### 3. Re-read README against the redistribute-vs-use distinction
**Open.** `NOTICE.md` and `ARCHITECTURE.md` §7.4 were corrected on 23 Aug to
separate what the module *redistributes* from what it *uses at runtime from the
user's own licensed compendia*. README has not been checked against that, and its
Roadmap and Open-items sections are stale in several places.

**Verify:** `grep -in "premium\|redistribut\|no Paizo" README.md` returns nothing
that contradicts NOTICE.md.

### 4. Archives of Nethys as *search*
**Open, and optional.** Not an importer — see Closed below. Search AoN's
Elasticsearch, then resolve each hit to the local Foundry item through the five
normalisation tiers in ARCHITECTURE §7.7, which cover 98.3% of AoN's creatures.
Text import becomes a fallback firing on 1.7% and can be deferred indefinitely.

**Verify:** a resolver module with tests against `test/fixtures/creature-corpus.json`
reproducing the 98.3% figure, and a UI path in the ability panel.

### 5. Language model assistance
**Open, deliberately last.** The rules engine ships useful with no API key. When
added: **a model may draft prose, but never decides a number.** Anything numeric
it produces is validated against the Building Creatures tables and shown with its
band like any other statistic. Approach chosen: bring-your-own-key,
browser-direct.

### 6. A rich text editor for ability descriptions
**Open, low priority.** The field is deliberately raw today so inline elements
like `@Check[fortitude|dc:22]` stay visible and editable. Revisit only if raw
text proves too rough in practice.

---

## Open — issues and unknowns

### Live-in-Foundry claims are older than the rest
**Open.** HANDOFF §3's table has rows verified by screenshot or by building a
creature in a real world. Every *negative* claim in that document was re-checked
on 23 Aug and the test-suite rows were reconciled against a real `npm run check`,
but the live rows still rest on an earlier session having looked at a screen.

**Verify:** repeat the reference-creature build in a live world and confirm the
screenshots still match.

### Token art paths point into premium modules
**Open, low priority.** A deep-cloned actor carries
`prototypeToken.texture.src` pointing at the source module's image. That is a
path, not the image: it resolves for anyone who owns the module and shows a broken
token for anyone who does not. Fine for personal use; it matters only if a built
creature is shared with someone lacking the source.

**Verify:** decide whether to warn on create, or do nothing.

### Manifest `license` and `readme` fields unverified
**Open.** Added to `module.json` on 23 Aug because Foundry documents them.
Unknown fields are ignored harmlessly, so the downside is nil — but nobody has
watched Foundry render them. Folded into item 1 above.

---

## Accepted — known behaviour, not defects

| Behaviour | Why it stays | Detail |
|---|---|---|
| AC classifies at 86.7% against AoN's labels, where six other statistics hit 100% | Investigated; it is a property of how AC is authored, not a fitting error | ARCHITECTURE §7.6 |
| Non-area ability damage is never rescaled | No published table earns it. Area damage *is* offered Table 2-12's figures as an explicit choice | ARCHITECTURE §7.6, §9a |
| Damage riders are never scaled | 59 of 71 sampled are uncategorised energy dice; easy to change if the decision does | ARCHITECTURE §7.6 |
| Levels above 24 are refused | GM Core's tables stop at 24; extrapolating would invent numbers with no published basis | ARCHITECTURE §7.6 |
| Strike damage keeps the chassis's die size | Creature identity over idiomatic dice — and the output shapes are in print | ARCHITECTURE §7.3 |

---

## Closed — investigated, deliberately not doing

### AoN as a creature or ability *importer*
**Closed 23 Aug, measured.** 98.34% of AoN's 4,748 creatures already exist in a
normal Foundry install, and 41 of the 79 that do not are pre-remaster names the
remaster replaced — text you would least want to import. AoN also trails Foundry
on the newest books rather than leading. An importer would need a
prose-to-inline-element converter to reconstruct, worse, items that already exist
locally with rule elements and remastered wording. Full numbers: ARCHITECTURE §7.7.

### The `1d4+3 → 2d4+10` "cosmetic defect"
**Closed 23 Aug, measured.** `2d4+10` occurs ten times in published creatures at
levels 8–12, and 116 of 326 d4 Strikes in that band carry a modifier of +10 or
more. The engine's dice count matches the published median. It was never a defect.
ARCHITECTURE §7.3; reproduce with
`node tools/probe-strike-shapes.mjs <packs-root> --faces 4 --levels 8-12`.

### Automatic ability damage scaling
**Closed.** Deliberately absent and should stay absent — no table earns it. What
exists instead is the offer: damage marked `options:area-damage` carries Table
2-12's two figures for the target level as explicit choices, with the column
suggested from frequency or prose-recharge markers where the data supports one.

---

## Constraints, not tasks

These shape how work gets done and are not things to fix.

- **Claude cannot push to GitHub** from this session, and `add_repo` is not
  exposed here. Dan pushes. HANDOFF §6.5.
- **Claude cannot install packages** — npm and PyPI are both blocked in the
  sandbox and on the device bridge. Anything needed gets written from scratch;
  `tools/read-pack.mjs` is what that looks like. HANDOFF §6.9.
- **Three environments** — cloud sandbox, the device bridge's Linux VM, and Dan's
  Windows shell — with different toolchains. Only Windows counts for
  `npm run check`. HANDOFF §6.9.
- **Foundry runs as the desktop app**, so `saveDataToFile` and blob downloads do
  not work; probes return data through the clipboard. HANDOFF §6.7.

---

## Working rule this file exists to serve

From HANDOFF §8, learned the hard way on 23 August: **the wrong claim is usually
the one nobody flagged as uncertain.** The 22 Aug handoff correctly flagged its
attribution line as unverified and was wrong about the ORC notice beside it; it
flagged nothing about §7 and said two built features were not built.

So: check a claim against the code or the data before acting on it, especially a
claim that something is *missing* — and prefer one source closer to the thing
itself over two secondary sources that agree with each other.
