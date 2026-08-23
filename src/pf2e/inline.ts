/**
 * PF2e inline elements: finding and rewriting the numbers inside ability text.
 *
 * This is what makes ability grafting possible. A creature ability does not
 * store its save DC or its damage as fields on the item - it writes them into
 * the description as inline elements:
 *
 *   @Check[fortitude|dc:28]
 *   @Check[reflex|dc:22|basic|options:area-effect]
 *   @Damage[2d6[poison]]
 *   @Damage[(4d6+8)[slashing]]{Sneak Attack}
 *
 * Probed against 400 abilities embedded in 120 published creatures: 124 carried
 * an @Check, 130 an @Damage, 46 an @Template, 24 a legacy [[/r]] roll, and 245
 * carried no numbers at all. Nine carried a DC as plain prose. So the numbers
 * that matter are overwhelmingly *structured*, which means they can be rewritten
 * exactly rather than pattern-matched out of English.
 *
 * Two findings from that sample shape the whole module:
 *
 *   - **Nested brackets are normal.** `@Damage[2d6[poison]]` cannot be matched
 *     with `\[[^\]]+\]`; the scan below counts depth instead.
 *   - **Not every number is level-scaled.** `@Check[flat|dc:15]` is a flat
 *     check - a fixed probability, not a difficulty - and scaling it would
 *     quietly change what the ability does. Same for `@Damage[20[force]]` and
 *     `@Damage[1[healing]]`, which are flat by design. They are parsed, marked,
 *     and left alone.
 *
 * No Foundry dependency: pure string work, unit tested against real text.
 */

export type InlineKind = "check" | "damage" | "template";

interface Located {
  /** Index of the "@" in the source string. */
  start: number;
  /** Index one past the closing bracket (or past the {label}). */
  end: number;
  /** The full original text of the element, including any {label}. */
  raw: string;
  /** The text between the outermost brackets. */
  inner: string;
  /** The {label} suffix, without braces, when present. */
  label: string | null;
}

export interface InlineCheck extends Located {
  kind: "check";
  /** "fortitude", "reflex", "will", "perception", "flat", a skill slug... */
  checkType: string;
  dc: number | null;
  /**
   * The `against:` parameter, naming a statistic on the owner to use as the DC
   * instead of a number — "class-spell" means "the higher of class DC or spell
   * DC". Player-facing actions are written this way, and a creature has neither
   * statistic, so PF2e renders the save as **DC 0**.
   *
   * Found on Dragon Breath: `@Check[reflex|basic|against:class-spell|...]`.
   * Note there is no `dc:` parameter at all, which is why a rewriter that only
   * replaces one has nothing to replace.
   */
  against: string | null;
  /**
   * A flat check is a fixed probability, not a difficulty. It never scales
   * with level, and rescaling one changes the ability's behaviour outright.
   */
  isFlat: boolean;
}

export interface DamageTerm {
  /** "2d6", "(4d6+8)", "20" - exactly as written, brackets included. */
  expr: string;
  /** "poison", "healing", "untyped"... null when the term carries no type. */
  damageType: string | null;
  /** True when the term has no dice: a fixed amount, not a scaled one. */
  isFlat: boolean;
  /** Offset of `expr` within the element's `inner`, for exact replacement. */
  offset: number;
}

export interface InlineDamage extends Located {
  kind: "damage";
  terms: DamageTerm[];
}

/** The trailing `|parameter` list on a damage element, if it has one. */
export function damageParameters(damage: InlineDamage): string[] {
  let depth = 0;
  for (let i = 0; i < damage.inner.length; i++) {
    const c = damage.inner[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === "|" && depth === 0) {
      return damage.inner
        .slice(i + 1)
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * True when a damage element is marked as area damage.
 *
 * PF2e writes the marker into the element itself —
 * `@Damage[7d8[poison]|options:area-damage]` — which is what makes area
 * abilities identifiable without a separate harvest. That matters because
 * Table 2-12 (Area Damage) governs them three times better than the Strike
 * table does (30.5% exact against 10.5%; see ARCHITECTURE 7.6), and nothing
 * else in the item says which abilities it applies to.
 *
 * `options:` carries a comma-separated list, so the value is split rather than
 * compared whole: `options:area-damage,damaging-effect` counts.
 */
export function isAreaDamage(damage: InlineDamage): boolean {
  return damageParameters(damage).some((p) => {
    if (!p.startsWith("options:")) return false;
    return p
      .slice("options:".length)
      .split(",")
      .some((o) => o.trim() === "area-damage");
  });
}

export interface InlineTemplate extends Located {
  kind: "template";
}

export type Inline = InlineCheck | InlineDamage | InlineTemplate;

const OPENERS: { token: string; kind: InlineKind }[] = [
  { token: "@Check[", kind: "check" },
  { token: "@Damage[", kind: "damage" },
  { token: "@Template[", kind: "template" },
];

/**
 * Find the index of the bracket matching the one at `open`.
 * Returns -1 when the text is malformed - in which case we leave it alone
 * rather than guessing where it was supposed to end.
 */
function matchBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Consume a `{label}` immediately following `at`, if there is one. */
function readLabel(text: string, at: number): { label: string | null; end: number } {
  if (text[at] !== "{") return { label: null, end: at };
  const close = text.indexOf("}", at);
  if (close < 0) return { label: null, end: at };
  return { label: text.slice(at + 1, close), end: close + 1 };
}

const DICE = /\d+d\d+/;

function parseDamageTerms(inner: string): DamageTerm[] {
  const terms: DamageTerm[] = [];

  /**
   * A damage element is `terms | parameter | parameter …`, and the parameters
   * are not damage.
   *
   * `@Damage[7d8[poison]|options:area-damage]` is normal — 801 of 2,368 damage
   * elements sampled from the bestiary carry a trailing parameter. Parsing the
   * whole inner as one term produced "7d8[poison]|options:area-damage", which
   * is not a formula, so a third of all ability damage silently parsed as
   * nothing at all. The measurement that was supposed to answer which table
   * governs ability damage was quietly running on 81 rows instead of 801.
   */
  let end = inner.length;
  let scanDepth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "[" || c === "(") scanDepth++;
    else if (c === "]" || c === ")") scanDepth--;
    else if (c === "|" && scanDepth === 0) {
      end = i;
      break;
    }
  }
  const body = inner.slice(0, end);

  // Terms are comma-separated at depth 0: "1d6[mental],1d6[fire]".
  let depth = 0;
  let termStart = 0;
  const pieces: { text: string; offset: number }[] = [];
  for (let i = 0; i <= body.length; i++) {
    const c = body[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    if (i === body.length || (c === "," && depth === 0)) {
      pieces.push({ text: body.slice(termStart, i), offset: termStart });
      termStart = i + 1;
    }
  }

  for (const piece of pieces) {
    if (!piece.text.trim()) continue;
    // "2d6[poison]" -> expr "2d6", type "poison". The type is the last
    // bracketed group; the expression is everything before it.
    const typeOpen = piece.text.lastIndexOf("[");
    const hasType = typeOpen >= 0 && piece.text.endsWith("]");
    const exprRaw = hasType ? piece.text.slice(0, typeOpen) : piece.text;
    const damageType = hasType ? piece.text.slice(typeOpen + 1, -1) : null;

    const leading = exprRaw.length - exprRaw.trimStart().length;
    const expr = exprRaw.trim();
    if (!expr) continue;

    terms.push({
      expr,
      damageType,
      isFlat: !DICE.test(expr),
      offset: piece.offset + leading,
    });
  }
  return terms;
}

function parseCheck(located: Located): InlineCheck {
  const params = located.inner.split("|").map((p) => p.trim());

  // Both spellings occur in the wild: "@Check[fortitude|dc:28]" and the older
  // "@Check[type:fortitude|dc:28]".
  const typed = params.find((p) => p.startsWith("type:"));
  const checkType = (typed ? typed.slice(5) : (params[0] ?? "")).trim();

  const dcParam = params.find((p) => p.startsWith("dc:"));
  const dcRaw = dcParam?.slice(3).trim();
  // A DC can be a formula ("@Check[fortitude|dc:resolve(...)]"); only take it
  // when it is a plain number, so nothing else is ever overwritten.
  const dc = dcRaw !== undefined && /^\d+$/.test(dcRaw) ? Number(dcRaw) : null;

  const againstParam = params.find((p) => p.startsWith("against:"));
  const against = againstParam ? againstParam.slice(8).trim() : null;

  return {
    ...located,
    kind: "check",
    checkType,
    dc,
    against,
    isFlat: checkType === "flat",
  };
}

/** Every inline element in a piece of text, in the order they appear. */
export function findInlines(text: string): Inline[] {
  const out: Inline[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "@") continue;
    const opener = OPENERS.find((o) => text.startsWith(o.token, i));
    if (!opener) continue;

    const open = i + opener.token.length - 1;
    const close = matchBracket(text, open);
    if (close < 0) continue;

    const { label, end } = readLabel(text, close + 1);
    const located: Located = {
      start: i,
      end,
      raw: text.slice(i, end),
      inner: text.slice(open + 1, close),
      label,
    };

    if (opener.kind === "check") out.push(parseCheck(located));
    else if (opener.kind === "damage") {
      out.push({ ...located, kind: "damage", terms: parseDamageTerms(located.inner) });
    } else out.push({ ...located, kind: "template" });

    i = end - 1;
  }

  return out;
}

/**
 * Rewrite a check's DC in place, leaving every other parameter untouched.
 *
 * The rest of the element - basic, options, traits, the label - is carried
 * through byte for byte. A grafted ability should come out of this module
 * differing from the original in exactly the numbers that were rescaled and
 * nothing else.
 */
export function withDC(
  check: InlineCheck,
  dc: number,
  options: { force?: boolean } = {}
): string {
  // A DC that is not a plain number is a formula - "dc:resolve(@actor...)" -
  // and rescaling one automatically would be arithmetic on something that is
  // not a quantity. It is only ever replaced when a user says so explicitly,
  // which is what `force` means.
  if (check.dc === null && !options.force) return check.raw;

  const params = check.inner.split("|");

  let replaced = false;
  let kept = params.map((p) => {
    if (!p.trim().startsWith("dc:")) return p;
    replaced = true;
    return `dc:${dc}`;
  });

  /**
   * Two cases the naive version got wrong, both real:
   *
   *   1. There may be no `dc:` parameter to replace. Dragon Breath is written
   *      `@Check[reflex|basic|against:class-spell|...]` and takes its DC from
   *      `against:`. Mapping over the parameters finds nothing and silently
   *      changes nothing, so the DC has to be *inserted*.
   *   2. `against:` has to go with it. Leaving it in place keeps the reference
   *      to a statistic the creature does not have alongside the number that
   *      was just set, which is at best ambiguous and at worst still 0.
   *
   * `against:` is only dropped when the check had no usable DC of its own -
   * that is, when this call is repairing one rather than rescaling one.
   */
  if (check.dc === null) kept = kept.filter((p) => !p.trim().startsWith("against:"));
  if (!replaced) kept.splice(1, 0, `dc:${dc}`);

  return `@Check[${kept.join("|")}]${check.label === null ? "" : `{${check.label}}`}`;
}

/** Rewrite one damage term's expression, leaving its type and siblings alone. */
export function withDamageTerm(
  damage: InlineDamage,
  termIndex: number,
  expr: string
): string {
  const term = damage.terms[termIndex];
  if (!term) return damage.raw;

  const inner =
    damage.inner.slice(0, term.offset) +
    expr +
    damage.inner.slice(term.offset + term.expr.length);

  return `@Damage[${inner}]${damage.label === null ? "" : `{${damage.label}}`}`;
}

/**
 * Apply a transformation to every inline element in a body of text.
 *
 * Replacements run back to front so that earlier offsets stay valid, and any
 * element the callback declines to change is left exactly as it was.
 */
export function mapInlines(text: string, fn: (inline: Inline) => string | null): string {
  const inlines = findInlines(text);
  let out = text;
  for (let i = inlines.length - 1; i >= 0; i--) {
    const inline = inlines[i]!;
    const replacement = fn(inline);
    if (replacement === null || replacement === inline.raw) continue;
    out = out.slice(0, inline.start) + replacement + out.slice(inline.end);
  }
  return out;
}

/**
 * Legacy roll expressions: `[[/r 2d6]]`, `[[/br 2d4 #days]]`.
 *
 * Twenty-four of the 400 sampled abilities carry one, and they are not all
 * damage - the Saggorak Poltergeist's is `2d4 #days` of rejuvenation time.
 * We detect them so the UI can say "this ability has a roll we did not touch"
 * rather than either scaling a duration or pretending nothing is there.
 */
export function hasLegacyRoll(text: string): boolean {
  return /\[\[\/[a-z]+\s[^\]]*\]\]/i.test(text);
}
