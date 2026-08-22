/**
 * Creatureator module entry point.
 *
 * Deliberately exposes a console-usable API before any UI exists, so each layer
 * can be checked against a live Foundry world rather than assumed to work.
 * Everything under `game.creatureator` is intended to be callable by hand.
 */

import {
  buildChassisIndex,
  filterChassis,
  sortChassis,
  groupByProvenance,
  type ChassisEntry,
  type ChassisFilter,
} from "./foundry/chassis.js";
import { rescaleCreature, summarise } from "./scaling/rescale-creature.js";
import { readStatBlock, type NPCSource } from "./pf2e/npc.js";

declare const game: any;
declare const Hooks: any;
declare const fromUuid: (uuid: string) => Promise<any>;

const MODULE_ID = "creatureator";

let cache: ChassisEntry[] | null = null;

async function chassisIndex(refresh = false): Promise<ChassisEntry[]> {
  if (!cache || refresh) {
    cache = await buildChassisIndex(game.packs.contents ?? [...game.packs]);
  }
  return cache;
}

/** Search for a chassis. `find("husk", { scalableOnly: true })` */
async function find(
  search: string,
  filter: Omit<ChassisFilter, "search"> = {}
): Promise<ChassisEntry[]> {
  const all = await chassisIndex();
  return sortChassis(filterChassis(all, { ...filter, search }));
}

/**
 * Rescale a compendium creature to a target level.
 *
 * Returns the result without writing anything. Pass `{ create: true }` to
 * actually make the actor — creating documents is a side effect and should be
 * asked for explicitly, not be the default of an exploratory call.
 */
async function rescale(
  uuid: string,
  toLevel: number,
  options: { create?: boolean; name?: string } = {}
) {
  const doc = await fromUuid(uuid);
  if (!doc) throw new Error(`No document at ${uuid}`);

  const source = doc.toObject() as NPCSource;
  const result = rescaleCreature(source, toLevel);

  if (options.name) {
    result.actor.name = options.name;
    result.block.name = options.name;
  }

  console.log(summarise(result));
  if (result.warnings.length) {
    console.warn(
      `${result.warnings.length} warning(s) - see result.warnings`,
      result.warnings
    );
  }

  if (options.create) {
    const created = await game.actors.documentClass.create(result.actor);
    console.log(`Created actor: ${created?.name} (${created?.uuid})`);
    return { ...result, created };
  }

  return result;
}

/** Read a creature's stat block without changing anything. */
async function inspect(uuid: string) {
  const doc = await fromUuid(uuid);
  if (!doc) throw new Error(`No document at ${uuid}`);
  return readStatBlock(doc.toObject() as NPCSource);
}

/** A quick census of what is available as a chassis, and from where. */
async function stats() {
  const all = await chassisIndex();
  const groups = groupByProvenance(all);
  const levels = all.map((e) => e.level).filter((l): l is number => l !== null);

  return {
    total: all.length,
    byProvenance: {
      system: groups.system.length,
      module: groups.module.length,
      world: groups.world.length,
    },
    withoutLevel: all.length - levels.length,
    levelRange: levels.length
      ? { min: Math.min(...levels), max: Math.max(...levels) }
      : null,
    outsideTables: levels.filter((l) => l < -1 || l > 24).length,
  };
}

/** Open the chassis picker, building the index first if needed. */
async function open(): Promise<void> {
  const { ChassisPicker } = await import("./foundry/picker.js");
  new ChassisPicker(await chassisIndex()).render(true);
}

/**
 * Add a button to the Actors sidebar footer, beside PF2e's Bestiary Browser.
 *
 * Matches that button's markup so it inherits the sidebar styling rather than
 * looking bolted on. Deliberately does NOT use `data-action`: ApplicationV2
 * dispatches those through its own action handler and an unrecognised value
 * logs warnings, so the click is wired directly instead.
 */
function injectSidebarButton(root: HTMLElement): void {
  if (!game.user?.isGM) return;

  const footer = root.querySelector<HTMLElement>("footer.directory-footer");
  if (!footer || footer.querySelector(".creatureator-open")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "creatureator-open";
  button.innerHTML =
    `<i class="fa-solid fa-dna" inert></i><span>Creature Builder</span>`;
  button.addEventListener("click", () => void open());

  // Below the Bestiary Browser: finding a monster comes before building one.
  footer.appendChild(button);
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | initialising`);
});

Hooks.on("renderActorDirectory", (_app: unknown, element: unknown) => {
  // v13+ passes an HTMLElement; older code paths pass a jQuery object.
  const root =
    element instanceof HTMLElement
      ? element
      : ((element as { [0]?: HTMLElement })?.[0] ?? null);
  if (root) injectSidebarButton(root);
});

Hooks.once("ready", () => {
  game.creatureator = {
    open,
    find,
    rescale,
    inspect,
    stats,
    chassisIndex,
    refresh: () => chassisIndex(true),
  };

  console.log(
    `${MODULE_ID} | ready. Try:\n` +
      `  await game.creatureator.stats()\n` +
      `  await game.creatureator.find("husk zombie")\n` +
      `  await game.creatureator.rescale("<uuid>", 5)`
  );
});
