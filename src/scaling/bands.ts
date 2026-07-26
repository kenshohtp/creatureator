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

export function parseCell(raw: string | number): Cell {
  if (typeof raw === "number") return { kind: "scalar", value: raw };

  const s = raw.replace(/[–−]/g, "-").trim();

  // "2d8+7 (16)"
  const dmg = /^(\d*d\d+(?:[+-]\d+)?)\s*\((\d+)\)$/.exec(s);
  if (dmg) {
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

/** A single comparable number standing in for a cell. */
export function representative(cell: Cell): number {
  switch (cell.kind) {
    case "scalar":
      return cell.value;
    case "damage":
      return cell.average;
    case "range":
      // Midpoint. Only used when a value sits outside the range entirely;
      // inside-range values are handled by `classify` without it.
      return (cell.min + cell.max) / 2;
  }
}

export interface Classification {
  band: Band;
  /**
   * How far the observed value sits from the band. Zero for an exact hit, or
   * for any value falling inside a range cell.
   */
  offset: number;
  /** True when the value fell inside a range rather than matching a scalar. */
  withinRange: boolean;
}

type Row = Record<string, number | string>;

function bandsIn(row: Row): Band[] {
  return BAND_ORDER.filter((b) => row[b] !== undefined);
}

/**
 * Recover which band a value belongs to, plus any deliberate offset.
 *
 * Ties break toward the *worse* band, so a creature sitting exactly between
 * High and Extreme is read as "High, +n" rather than "Extreme, -n". Homebrew
 * more often buffs a solid creature than nerfs a monstrous one.
 */
export function classify(value: number, row: Row): Classification {
  const candidates = bandsIn(row);
  if (!candidates.length) throw new Error("Row exposes no known bands");

  let best: Classification | null = null;

  for (const band of candidates) {
    const cell = parseCell(row[band]);

    if (cell.kind === "range" && value >= cell.min && value <= cell.max) {
      return { band, offset: 0, withinRange: true };
    }

    const rep =
      cell.kind === "range"
        ? value > cell.max
          ? cell.max
          : cell.min
        : representative(cell);

    const offset = value - rep;
    if (best === null || Math.abs(offset) < Math.abs(best.offset)) {
      best = { band, offset, withinRange: false };
    }
  }

  return best!;
}

/** Re-emit a classified statistic at a different level's row. */
export function reemit(c: Classification, targetRow: Row): number {
  const raw = targetRow[c.band];
  if (raw === undefined) {
    throw new Error(`Target row has no "${c.band}" band`);
  }
  const cell = parseCell(raw);

  if (cell.kind === "range") {
    // A value that sat inside the source range lands at the target midpoint,
    // rounded toward the generous end. Offsets are applied from the near edge.
    if (c.withinRange) return Math.round((cell.min + cell.max) / 2);
    return (c.offset > 0 ? cell.max : cell.min) + c.offset;
  }

  return representative(cell) + c.offset;
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
