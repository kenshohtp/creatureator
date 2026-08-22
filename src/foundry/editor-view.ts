/**
 * Editor rendering.
 *
 * Pure string building, like `statblock.ts`, so the markup can be asserted in
 * unit tests rather than only eyeballed in a running game.
 *
 * Two rules shape every row:
 *
 *   1. A number is never shown without its band. The chip is not decoration —
 *      it is the only thing that tells a GM whether 21 is a defensible AC for a
 *      level 5 creature, and it re-derives as they type.
 *   2. An edit is never destructive. The rescaled value stays on screen as
 *      "was 110" with a one-click revert, so experimenting costs nothing.
 *
 * Hit Points and weaknesses are rendered as one block for the reason set out in
 * ARCHITECTURE.md §7.5: GM Core trades them against each other, so presenting
 * them as separate decisions produces the 110 HP husk zombie that started this.
 */

import { escapeHtml } from "./statblock.js";
import type { EditField, EditSection, EditSession, DefenceRow } from "../editor/edit-session.js";
import type { Band } from "../scaling/bands.js";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Moderate", "Low +2", "High -1" — the offset is part of the truth. */
export function fieldBandLabel(field: EditField): string {
  if (!field.band) return "—";
  const name = capitalise(field.band);
  const offset = field.offset ?? 0;
  if (offset === 0) return name;
  const rounded = Math.round(offset * 10) / 10;
  return `${name} ${rounded > 0 ? "+" : ""}${rounded}`;
}

export function fieldChip(field: EditField): string {
  if (!field.band) return `<span class="band none" title="${escapeHtml(field.note ?? "")}">—</span>`;
  return `<span class="band ${field.band}">${escapeHtml(fieldBandLabel(field))}</span>`;
}

/**
 * The band dropdown.
 *
 * Each option carries the figure it would produce, and for the tables written
 * as ranges, the whole span. A user who can see that Moderate HP runs 72 to 78
 * can pick 75 on purpose; one who is only offered "Moderate" reads the 72 they
 * get as the only correct answer.
 */
export function bandSelect(field: EditField): string {
  if (!field.options.length) return "";
  const options = field.options
    .map((o) => {
      const span = o.range && o.range.min !== o.range.max
        ? ` (${o.range.min}–${o.range.max})`
        : "";
      // Matched on the value, not on the band: a statistic can sit in a band
      // without sitting *on* it, and only an exact match means "this is what
      // you already have".
      const selected = String(o.value) === String(field.value) ? " selected" : "";
      return `<option value="${o.band}"${selected}>${capitalise(o.band)} ${escapeHtml(o.value)}${span}</option>`;
    })
    .join("");
  /**
   * When the value sits off-band, nothing in the list is selected and the
   * placeholder shows. It deliberately does not repeat the chip: the chip
   * already says "Low +2", and a dropdown that displays the same string reads
   * as though "Low +2" were an option you could pick.
   */
  const offBand = !field.options.some((o) => String(o.value) === String(field.value));
  const unset = `<option value="" disabled${offBand ? " selected" : ""}>Set band…</option>`;
  return `<select class="band-select" data-path="${escapeHtml(field.path)}"
                  aria-label="Set band for ${escapeHtml(field.label)}">${unset}${options}</select>`;
}

/**
 * The "was 110 ↺" control.
 *
 * Exported because the editor patches a row in place while the user is typing
 * in it - re-rendering the whole row would take the caret with it.
 */
export function revertButton(field: EditField): string {
  if (!field.dirty) return "";
  return `<button type="button" class="revert" data-path="${escapeHtml(field.path)}"
             title="Back to the rescaled value">was ${escapeHtml(field.baseline)} ↺</button>`;
}

function fieldRow(field: EditField): string {
  const input =
    field.kind === "formula"
      ? `<input type="text" class="stat-input formula" data-path="${escapeHtml(field.path)}"
                value="${escapeHtml(field.value)}" size="8"
                aria-label="${escapeHtml(field.label)}">`
      : `<input type="number" class="stat-input" data-path="${escapeHtml(field.path)}"
                value="${escapeHtml(field.value)}" step="1"
                aria-label="${escapeHtml(field.label)}">`;

  const type = field.damageType
    ? `<span class="damage-type">${escapeHtml(field.damageType)}</span>`
    : "";

  const was = revertButton(field);

  const note = field.note
    ? `<p class="field-note muted">${escapeHtml(field.note)}</p>`
    : "";

  return `
    <tr class="edit-row${field.dirty ? " dirty" : ""}" data-path="${escapeHtml(field.path)}">
      <th scope="row">${escapeHtml(field.label)}</th>
      <td class="value">${input}${type}${note}</td>
      <td class="band-cell">${fieldChip(field)}</td>
      <td class="band-pick">${bandSelect(field)}</td>
      <td class="was">${was}</td>
    </tr>`;
}

const DEFENCE_BLURB =
  "GM Core trades weaknesses and resistances against Hit Points, so these are " +
  "one decision, not two. Removing a numeric weakness usually means dropping " +
  "HP a band; keeping it means HP sits above its band on purpose.";

function defenceRow(row: DefenceRow): string {
  const removed = row.value === null;
  const id = `${row.kind}:${row.type}`;
  const control = removed
    ? `<button type="button" class="defence-restore" data-defence="${escapeHtml(id)}">
         Restore ${escapeHtml(row.baseline ?? 0)}
       </button>`
    : `<input type="number" class="defence-input" data-defence="${escapeHtml(id)}"
              value="${row.value}" step="1" aria-label="${escapeHtml(row.type)} ${row.kind}">
       <button type="button" class="defence-remove" data-defence="${escapeHtml(id)}"
               title="Remove this ${row.kind}">Remove</button>`;

  return `
    <tr class="defence-row${removed ? " removed" : ""}${row.dirty ? " dirty" : ""}"
        data-defence="${escapeHtml(id)}">
      <th scope="row">${capitalise(row.kind)} ${escapeHtml(row.type)}</th>
      <td class="value">${control}</td>
    </tr>`;
}

export function renderDefenceBlock(rows: DefenceRow[]): string {
  const body = rows.length
    ? `<table class="defence-table"><tbody>${rows.map(defenceRow).join("")}</tbody></table>`
    : `<p class="muted">This creature has no weaknesses or resistances.</p>`;

  return `
    <div class="defence-block">
      <h5>Weaknesses &amp; resistances</h5>
      <p class="muted blurb">${DEFENCE_BLURB}</p>
      ${body}
      <div class="defence-add">
        <select class="defence-add-kind" aria-label="Kind">
          <option value="weakness">Weakness</option>
          <option value="resistance">Resistance</option>
        </select>
        <input type="text" class="defence-add-type" placeholder="type, e.g. fire"
               aria-label="Damage type">
        <input type="number" class="defence-add-value" value="5" step="1"
               aria-label="Value">
        <button type="button" class="defence-add-button">Add</button>
      </div>
    </div>`;
}

function section(s: EditSection, session: EditSession): string {
  const defences =
    s.title === "Defences" ? renderDefenceBlock(session.defenceRows()) : "";
  return `
    <section class="stat-section" data-section="${escapeHtml(s.title)}">
      <h4>${escapeHtml(s.title)}</h4>
      <table class="edit-table"><tbody>${s.fields.map(fieldRow).join("")}</tbody></table>
      ${defences}
    </section>`;
}

/**
 * The warnings block, always rendered even when empty.
 *
 * It is patched in place as the user edits - addressing the HP-versus-weakness
 * warning has to make it disappear, and a container that only exists sometimes
 * is a container the patch cannot find.
 */
export function renderWarnings(session: EditSession): string {
  const warnings = session.warnings();
  return `<section class="warnings${warnings.length ? "" : " hidden"}">
    ${warnings
      .map(
        (w) =>
          `<p class="warning" data-warning-path="${escapeHtml(w.path)}">
             ${escapeHtml(w.message)}
           </p>`
      )
      .join("")}
  </section>`;
}

/**
 * The editor body.
 *
 * The name field comes first because renaming is what turns "a rescaled Husk
 * Zombie" into "Occam's Risen Kinetic Husk", and because nothing is written to
 * the world until the user presses Create — this screen is the confirmation
 * step, not a preview of one.
 */
export function renderEditor(session: EditSession): string {
  const levelLine =
    session.fromLevel === session.toLevel
      ? `Creature ${session.toLevel} — unmodified copy`
      : `Creature ${session.fromLevel} → ${session.toLevel}`;

  return `
    <header class="editor-header">
      <label class="name-field">
        <span>Name</span>
        <input type="text" class="creature-name" value="${escapeHtml(session.name)}"
               aria-label="Creature name">
      </label>
      <p class="level-change">${escapeHtml(levelLine)}</p>
    </header>
    ${renderWarnings(session)}
    <div class="editor-body">
      ${session.sections().map((s) => section(s, session)).join("")}
    </div>`;
}

/** Band names, for tests and for anything that needs the option list order. */
export function optionBands(field: EditField): Band[] {
  return field.options.map((o) => o.band);
}
