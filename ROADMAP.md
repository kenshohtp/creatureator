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

## Where work is tracked

**`ROADMAP.md` owns this module's work.** GitHub issues are for ideas that are *out of
scope* for Creatureator — other modules, other projects. Issue #1, the treasure
generator, is the model: a separate module, so it was never roadmap material.

The split exists so the two trackers cannot describe the same thing differently.
Nothing in scope goes in an issue; nothing out of scope goes here.

---

## Open

Genuinely open, nothing else. Items are moved out when they close — leaving them here
marked Done is how a list stops being read.

### Tidy the damage-type string in previews
**Open, cosmetic.** A preview reads "2d8 persistent,fire damage" because that is how
PF2e stores the type. "persistent fire" would read better. One `replace` in
`inlineToText`, whenever it irritates someone enough.

### Cut 0.1.1
**Open, small.** The released artifact predates today's fixes and declares
`verified: "14.366"` while Foundry is now on 14.367 — which shows an amber badge and
loads fine, so this is tidiness rather than repair. Bump `verified` only after loading
the module on 367.

**Verify:** `npm run package`, `gh release create`, then the manifest URL check in
HANDOFF §6.10.

### Language model assistance
**Open, deliberately last.** The rules engine ships useful with no API key. When
added: **a model may draft prose, but never decides a number.** Anything numeric
it produces is validated against the Building Creatures tables and shown with its
band like any other statistic. Approach chosen: bring-your-own-key,
browser-direct.

### A rich text editor for ability descriptions
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

---

## Done

Completed work, kept for the reasoning rather than the tick.

### Search every creature's abilities
**Done 23 Aug.** The ability panel's "From another creature" tab now searches all
**11,470** distinct abilities embedded across your creatures, not just the 1,414
standalone compendium items — an eight-fold increase, and the largest ability
collection available anywhere (§7.9).

The premise it was blocked on turned out to be false. `ability-index.ts` had claimed
for months that reaching the embedded pool meant loading every actor, "which takes
minutes". It does — about sixty seconds — but `getIndex({fields: [...]})` returns
embedded items outright in **2.0 seconds**, and constructs no documents, so it raises
none of PF2e's pre-remaster warnings either. Nobody had measured it.

How it behaves: the index builds lazily on the first keystroke, so opening the picker
still costs nothing. `Grab` collapses from 785 instances to one row, showing the
creature **nearest your target level** — the copy whose DCs need least rescaling —
with "on 785 creatures" as a footnote. Each row previews what the ability does, with
`@Template`/`@Damage`/`@Check` spoken as English and `@Localize` keys resolved.

Four bugs found by looking at it rather than by tests: six children in a five-column
grid; `fields: ["items"]` returning a `system` object without `actionType` or
`traits`, so everything read as passive; note grouping fixed in one of two renderers;
and inline elements leaking raw into the previews.

### Install 0.1.0 from its manifest URL into a real Foundry
**Done, 23 Aug.** Installed from the manifest URL and loaded cleanly: the
`languages` path resolved, the esmodule initialised, the sidebar button opened the
picker, 1,414 abilities indexed, no console errors. Procedure and the symlink
hazard are in HANDOFF §6.10 — read it before repeating this.

**Fully closed 23 Aug.** Foundry v14's module tile renders four badges — project
`url`, author, languages, version — and **no licence badge**. The ⓘ icon is the
`url` field, not `license`. The `license` field stays in `module.json` because it is
correct metadata and harmless (of 147 installed modules, 128 omit it entirely and two
put a licence *name* in it, so Foundry validates nothing), but nobody should expect it
to appear in the UI. The notice reaches users two other ways regardless: inside
`module.zip`, and through the ⓘ link to the repository.

### Re-read README against the redistribute-vs-use distinction
**Done 23 Aug, at `8f5e2d8`.** README's Licence section carried the same false claim
ARCHITECTURE §7.4 did — that descriptions and artwork "are never copied into module
output" — plus a stale "attribution notice is not yet verified" release blocker. Both
corrected, and the redistribute-vs-use split stated explicitly. Also refreshed: the
baked-in 4,714 corpus figure, the missing `npm run package`, and the claim that all
probes are pasted into the Foundry console, which stopped being true when
`read-pack.mjs` landed.

---

## Closed — investigated, deliberately not doing

Things we decided against, and why. Reopening one means arguing with the evidence,
which is the point.

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

### Archives of Nethys as *search*
**Closed 23 Aug — measured, and not worth building.** §7.7 showed 98.34% of AoN's
creatures already exist locally; §7.9 extends that to abilities and finds Foundry
holds ~19,886 unique ability names against AoN's 4,281 documents, of which 679 are
item activation strings rather than abilities at all.

AoN is a smaller and dirtier source than the install it would sit beside. Its
indispensable role — the `*_scale_number` band labels behind the validation corpus,
and the GM Core tables — is offline and already built. If search is ever the pain
point, improving the module's own search is cheaper, works offline, and can see the
homebrew and module content AoN cannot.

### Sourcemaps
**Closed 23 Aug — they ship.** They are 424 kB of the 665 kB archive, which looked
like waste until the install test showed the console reporting frames as
`creatureator.ts:144` rather than a minified `.js` offset. They buy real stack
traces against TypeScript source in a user's install, for 130 kB compressed. The
alternative — dropping the maps while the emitted JS still carries
`//# sourceMappingURL` — would give every user 404s instead.

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

---

## Working rule this file exists to serve

From HANDOFF §8, learned the hard way on 23 August: **the wrong claim is usually
the one nobody flagged as uncertain.** The 22 Aug handoff correctly flagged its
attribution line as unverified and was wrong about the ORC notice beside it; it
flagged nothing about §7 and said two built features were not built.

So: check a claim against the code or the data before acting on it, especially a
claim that something is *missing* — and prefer one source closer to the thing
itself over two secondary sources that agree with each other.
