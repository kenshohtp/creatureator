/**
 * Damage formula parsing and re-expression.
 *
 * PF2e stores NPC Strike damage as a formula string like "1d6+4". Rescaling a
 * creature means producing a new formula whose average matches the Building
 * Creatures table for the target level, while keeping the creature recognisable.
 *
 * No Foundry dependency — pure string and arithmetic work.
 */

export interface DamageExpression {
  count: number;
  faces: number;
  modifier: number;
}

const FORMULA = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

/** "1d6+4" -> { count: 1, faces: 6, modifier: 4 }. Null if not a simple NdX+M. */
export function parseDamage(formula: string): DamageExpression | null {
  const m = FORMULA.exec(formula);
  if (!m) return null;
  const count = m[1] === "" || m[1] === undefined ? 1 : Number(m[1]);
  const faces = Number(m[2]);
  if (!Number.isFinite(count) || !Number.isFinite(faces) || faces < 2) return null;

  let modifier = 0;
  if (m[3] !== undefined && m[4] !== undefined) {
    modifier = Number(m[4]) * (m[3] === "-" ? -1 : 1);
  }
  return { count, faces, modifier };
}

/** Mean of NdX+M. A dX averages (X+1)/2. */
export function averageDamage(e: DamageExpression): number {
  return (e.count * (e.faces + 1)) / 2 + e.modifier;
}

export function formatDamage(e: DamageExpression): string {
  const dice = `${e.count}d${e.faces}`;
  if (e.modifier === 0) return dice;
  return e.modifier > 0 ? `${dice}+${e.modifier}` : `${dice}${e.modifier}`;
}

/**
 * Build an expression with a given die size whose average is as close as
 * possible to `target`.
 *
 * `preferredCount` comes from the Building Creatures table for the target
 * level — GM Core publishes both the expression and its average, so we adopt
 * its dice count and solve for the flat modifier. Keeping the chassis's die
 * size preserves creature identity: a monster whose thing is a big d12 club
 * should still swing a d12 after rescaling.
 *
 * The count is reduced if the dice alone would overshoot the target, so the
 * modifier never has to go negative to compensate.
 *
 * Exact matches are not always possible. A dX averages (X+1)/2, so even-faced
 * dice give half-integer averages and an integer target can be unreachable —
 * with a d12 (6.5 average), a target of 8 admits only 7.5 or 8.5. Half a point
 * is the floor on error in those cases, not a slack tolerance.
 */
export function expressForAverage(
  faces: number,
  target: number,
  preferredCount: number
): DamageExpression {
  const perDie = (faces + 1) / 2;
  let count = Math.max(1, Math.round(preferredCount));

  // Shrink the dice pool until a non-negative modifier can reach the target.
  while (count > 1 && count * perDie > target) count--;

  const modifier = Math.round(target - count * perDie);
  return { count, faces, modifier: Math.max(0, modifier) };
}

/**
 * Rescale one damage formula to a new target average, preserving die size.
 * Returns the original string unchanged if it is not a simple NdX+M — some
 * NPC damage entries are non-standard and should not be silently rewritten.
 */
export function rescaleDamageFormula(
  formula: string,
  targetAverage: number,
  targetTableExpression: string | null
): string {
  const current = parseDamage(formula);
  if (!current) return formula;

  const fromTable = targetTableExpression ? parseDamage(targetTableExpression) : null;
  const preferredCount = fromTable?.count ?? current.count;

  return formatDamage(expressForAverage(current.faces, targetAverage, preferredCount));
}
