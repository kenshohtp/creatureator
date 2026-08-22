/**
 * PF2e ability items: reading them, and preparing one to be grafted.
 *
 * A creature ability is an item of type `action`. Probed across 400 of them on
 * 120 published creatures (PF2e 8.4.0):
 *
 *   - 226 are **passive** — no action cost at all. Reactions (33), single
 *     actions (134) and free actions (7) make up the rest, so a UI that treats
 *     "no action cost" as the exception has it backwards.
 *   - `actions.value` is null on 266 of them, for exactly that reason.
 *   - 130 carry traits, 96 carry rule elements, and all 400 carry publication
 *     data.
 *
 * Grafting deliberately does not build an item from scratch. Cloning a real one
 * keeps its rule elements, its automation and its publication credit intact —
 * the same argument that makes the whole module clone a chassis rather than
 * generate a creature.
 *
 * No Foundry dependency; operates on plain item source objects.
 */

import {
  rescaleAbilityText,
  type AbilityChange,
  type AbilityNote,
} from "../scaling/rescale-ability.js";

export type ActionType = "action" | "reaction" | "free" | "passive";

export interface AbilityItem {
  id: string;
  name: string;
  actionType: ActionType;
  /** 1-3 for actions, null for passives, reactions and free actions. */
  actions: number | null;
  /** offensive | defensive | interaction, or null. */
  category: string | null;
  traits: string[];
  description: string;
  ruleCount: number;
}

/**
 * Alignment traits the remaster removed. PF2e 8.x rejects them outright:
 * loading a pre-remaster adventure-path creature logs "evil is not a valid
 * choice", and an ability copied from one will fail validation when written
 * onto a new actor. They are stripped on graft, and the removal is reported.
 */
export const LEGACY_TRAITS: readonly string[] = ["good", "evil", "lawful", "chaotic"];

const isLegacy = (trait: string) => LEGACY_TRAITS.includes(trait);

export function readAbility(item: Record<string, any>): AbilityItem {
  const sys = item["system"] ?? {};
  const raw = String(sys.actionType?.value ?? "passive");
  const actionType: ActionType =
    raw === "action" || raw === "reaction" || raw === "free" ? raw : "passive";

  return {
    id: String(item["_id"] ?? ""),
    name: String(item["name"] ?? ""),
    actionType,
    actions: typeof sys.actions?.value === "number" ? sys.actions.value : null,
    category: typeof sys.category === "string" ? sys.category : null,
    traits: Array.isArray(sys.traits?.value) ? [...sys.traits.value] : [],
    description: String(sys.description?.value ?? ""),
    ruleCount: Array.isArray(sys.rules) ? sys.rules.length : 0,
  };
}

/** "⬻⬻", "reaction", "free action", "passive" — how the cost reads on a sheet. */
export function actionCostLabel(ability: AbilityItem): string {
  switch (ability.actionType) {
    case "action":
      return `${ability.actions ?? 1} action${(ability.actions ?? 1) === 1 ? "" : "s"}`;
    case "reaction":
      return "reaction";
    case "free":
      return "free action";
    case "passive":
      return "passive";
  }
}

export interface GraftReport {
  name: string;
  /** DCs that moved, with the band each came from. */
  changes: AbilityChange[];
  /** Numbers left exactly as they were, each with its reason. */
  notes: AbilityNote[];
  /** Traits dropped because the current system refuses them. */
  removedTraits: string[];
}

export interface GraftResult {
  /** A new item source, ready to be pushed onto an actor's `items`. */
  item: Record<string, any>;
  report: GraftReport;
}

export interface GraftOptions {
  /** The level of the creature the ability came from. */
  fromLevel: number;
  /** The level of the creature it is going onto. */
  toLevel: number;
  /** Where it came from, recorded so provenance survives. */
  sourceUuid?: string;
  /** Rename on the way in, for a reflavoured copy. */
  name?: string;
}

/**
 * Prepare an ability for a creature at a different level.
 *
 * Returns a *new* item; the input is never mutated. Three things happen, and
 * all three are reported rather than assumed:
 *
 *   1. Save DCs in the description are rescaled (Table 2-11).
 *   2. Legacy alignment traits are stripped, because the item cannot be created
 *      with them.
 *   3. The item's id is dropped so it cannot collide with something already on
 *      the target, and its origin is recorded in `_stats.compendiumSource`.
 */
export function graftAbility(
  source: Record<string, any>,
  options: GraftOptions
): GraftResult {
  const item = structuredClone(source);
  item["system"] ??= {};

  const description = String(item["system"].description?.value ?? "");
  const rescaled = rescaleAbilityText(description, options.fromLevel, options.toLevel);
  if (description) {
    item["system"].description ??= {};
    item["system"].description.value = rescaled.html;
  }

  const traits: string[] = Array.isArray(item["system"].traits?.value)
    ? item["system"].traits.value
    : [];
  const removedTraits = traits.filter(isLegacy);
  if (removedTraits.length) {
    item["system"].traits.value = traits.filter((t) => !isLegacy(t));
  }

  if (options.name) item["name"] = options.name;

  // A fresh id: the target creature may already carry an item with this one's,
  // and two items sharing an id is a corrupt actor rather than a duplicate.
  delete item["_id"];

  if (options.sourceUuid) {
    item["_stats"] ??= {};
    item["_stats"].compendiumSource = options.sourceUuid;
  }

  return {
    item,
    report: {
      name: String(item["name"] ?? ""),
      changes: rescaled.changes,
      notes: rescaled.notes,
      removedTraits,
    },
  };
}
