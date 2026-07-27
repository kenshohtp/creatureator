/**
 * Band classification and re-emission.
 *
 * This is the core of the scaling engine and the only place creature numbers are
 * decided. It is deliberately free of any Foundry dependency so it can be unit
 * tested without a running game.
 *
 * The premise: a creature statistic is not really a number, it is a *band*
 * ("this creature has High AC") plus an optional deliberate offset. Rescaling
 * means recovering the band at the source level and re-emitting it at the target
 * level, carrying the offset across.
 */

import { CREATURE_TABLES } from "../data/creature-tables.js";

export type Band = "extreme" | "high" | "moderate" | "low" | "terrible";

/** Best-to-worst. Used to pick a winner when two bands tie on distance. */
export const BAND_ORDER: readonly Band[] = [
  "extreme",
  "high",
  "moderate",
  "low",
  "terrible",
] as const;

/**
 * Archives of Nethys tags every creature statistic with a `*_scale_number`.
 * Decoded empirically across 4,714 published creatures: it is a single global
 * worst-to-best scale, not a per-table one.
 *
 * The proof is in which values never appear. Saves and Perception have five
 * bands and use 1-5. AC, attack, damage and attribute modifiers have four
 * bands (no Terrible) and use 2-5, never 1. Hit Points has three bands (no
 * Terrible, no Extreme) and uses 2-4, never 1 or 5. Each table simply omits
 * the values for bands it does not define.
 *
 * 0 appears throughout and means "not applicable / not computed".
 */
export const BAND_BY_SCALE_NUMBER: Readonly<Record<number, Band>> = {
  1: "terrible",
  2: "low",
  3: "moderate",
  4: "high",
  5: "extreme",
};

/** Decode an AoN scale number, or null when unset (0) or unrecognised. */
export function bandFromScaleNumber(n: number): Band | null {
  return BAND_BY_SCALE_NUMBER[n] ?? null;
}

/**
 * Table cells are not uniform. GM Core publishes three different cell formats
 * and coercing them all to numbers loses information we need.
 */
export type Cell =
  /** "17", "+11" */
  | { kind: "scalar"; value: number }
  /** "97-91", "+10 to +8" — note GM Core writes these high-to-low. */
  | { kind: "range"; min: number; max: number }
  /** "2d8+7 (16)" — dice expression plus its published average. */
  | { kind: "damage"; expr: string; average: number };

const NUM = /[+]?(-?\d+)/;

/**
 * GM Core writes an em-dash where a band does not exist at a given level —
 * e.g. there is no Extreme attribute modifier for level -1 or 0 creatures.
 *
 * This is distinct from a negative number: the table generator normalises
 * en-dash and minus sign to a hyphen (so "–1" parses as -1) but deliberately
 * leaves the em-dash alone, precisely so it stays recognisable as "no value".
 */
export function isAbsentCell(raw: string | number): boolean {
  if (typeof raw === "number") return false;
  return /^[—\s]*$/.test(raw);
}

/** Parse a cell, or return null when the band does not exist at this level. */
export function parseCellOrNull(raw: string | number): Cell | null {
  return isAbsentCell(raw) ? null : parseCell(raw);
}

export function parseCell(raw: string | number): Cell {
  if (typeof raw === "number") return { kind: "scalar", value: raw };

  const s = raw.replace(/[–−]/g, "-").trim();

  // "2d8+7 (16)"
  const dmg = /^(\d*d\d+(?:[+-]\d+)?)\s*\((\d+)\)$/.exec(s);
  if (dmg?.[1] !== undefined && dmg[2] !== undefined) {
    return { kind: "damage", expr: dmg[1], average: Number(dmg[2]) };
  }

  // "97-91" or "+10 to +8"
  const range =
    /^[+]?(-?\d+)\s*(?:-|to)\s*[+]?(-?\d+)$/.exec(s) ?? null;
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { kind: "range", min: Math.min(a, b), max: Math.max(a, b) };
  }

  const scalar = NUM.exec(s);
  if (scalar) return { kind: "scalar", value: Number(scalar[1]) };

  throw new Error(`Unparseable table cell: ${JSON.stringify(raw)}`);
}

/**
 * The number a value must meet or exceed to qualify for a band.
 *
 * For range cells GM Core writes the bound high-to-low ("97-91"), so the
 * entry threshold is the range minimum.
 */
export function threshold(cell: Cell): number {
  switch (cell.kind) {
    case "scalar":
      return cell.value;
    case "damage":
      return cell.average;
    case "range":
      return cell.min;
  }
}

export interface Classification {
  band: Band;
  /** How far above the band's threshold the observed value sits. */
  offset: number;
}

type Row = Record<string, number | string>;

function bandsIn(row: Row): Band[] {
  return BAND_ORDER.filter((b) => {
    const raw = row[b];
    return raw !== undefined && !isAbsentCell(raw);
  });
}

/**
 * Recover which band a value belongs to, plus any deliberate offset.
 *
 * A value belongs to the best band whose threshold it meets or exceeds. This
 * is not a guess: validated against 4,714 published creatures via AoN's own
 * band labels, it reproduces them exactly (4709/4709) for Perception, all
 * three saving throws, and Hit Points, and at 99%+ for attribute modifiers.
 *
 * An earlier nearest-match implementation scored 86% and was simply wrong.
 *
 * Values below every threshold fall to the worst band with a negative offset,
 * rather than being clamped — a creature can legitimately be worse than
 * Terrible, and flattening that would silently buff it.
 */
export function classify(value: number, row: Row): Classification {
  const candidates = bandsIn(row);
  if (!candidates.length) throw new Error("Row exposes no known bands");

  let worst: Classification | null = null;

  // BAND_ORDER runs best to worst, so the first threshold met wins.
  for (const band of candidates) {
    const raw = row[band];
    // `bandsIn` already filtered these, but the index signature doesn't know.
    if (raw === undefined) continue;
    const cell = parseCellOrNull(raw);
    if (cell === null) continue;
    const t = threshold(cell);
    if (value >= t) return { band, offset: value - t };
    worst = { band, offset: value - t };
  }

  return worst!;
}

/** Re-emit a classified statistic at a different level's row. */
export function reemit(c: Classification, targetRow: Row): number {
  const raw = targetRow[c.band];
  if (raw === undefined) {
    throw new Error(`Target row has no "${c.band}" band`);
  }
  const cell = parseCellOrNull(raw);
  if (cell === null) {
    // e.g. re-emitting an Extreme attribute modifier at level 0, where the
    // band does not exist. Refuse rather than silently picking another band —
    // the caller (and ultimately the user) should decide what to do.
    throw new Error(
      `Band "${c.band}" does not exist at the target level for this statistic`
    );
  }
  return threshold(cell) + c.offset;
}

/** Convenience: look up a level row from a generated table by key. */
export function rowFor(
  table: keyof typeof CREATURE_TABLES,
  level: number
): Row {
  const group = CREATURE_TABLES[table] as {
    tables: { byLevel: Record<string, Row> | null }[];
  };
  const byLevel = group.tables[0]?.byLevel;
  if (!byLevel) throw new Error(`Table "${String(table)}" is not level-keyed`);
  const row = byLevel[String(level)];
  if (!row) throw new Error(`Table "${String(table)}" has no level ${level}`);
  return row;
}

/** Classify at one level, re-emit at another. The whole engine in one call. */
export function rescale(
  table: keyof typeof CREATURE_TABLES,
  value: number,
  fromLevel: number,
  toLevel: number
): number {
  return reemit(classify(value, rowFor(table, fromLevel)), rowFor(table, toLevel));
}
