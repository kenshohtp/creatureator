/**
 * Stat block rendering.
 *
 * Shared between the picker's preview pane and (later) the editor, so a
 * statistic looks and reads the same wherever it appears.
 *
 * The governing rule: no derived number is shown without its band and, where
 * one exists, its offset. A GM reading "AC 21" learns nothing about whether
 * that is defensible; "AC 21 [Moderate]" tells them where it sits, and
 * "Fort +11 [Low +2]" tells them the chassis was deliberately above its band
 * and that intent survived.
 *
 * Pure string building - no Foundry dependency, so it can be unit tested.
 */

import type { RescaleResult, StatChange } from "../scaling/rescale-creature.js";
import type { StatBlock } from "../pf2e/npc.js";

export const escapeHtml = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

/** "Low +2", "Moderate", "High -1" */
export function bandLabel(change: StatChange): string {
  const name = change.band.charAt(0).toUpperCase() + change.band.slice(1);
  if (change.offset === 0) return name;
  const rounded = Math.round(change.offset * 10) / 10;
  return `${name} ${rounded > 0 ? "+" : ""}${rounded}`;
}

export function bandChip(change: StatChange): string {
  return `<span class="band ${change.band}">${escapeHtml(bandLabel(change))}</span>`;
}

/** Human-friendly name for a change path. */
export function prettyPath(path: string): string {
  const parts = path.split(".");
  const head = parts[0];

  if (head === "saves") return `${capitalise(parts[1] ?? "")} save`;
  if (head === "abilities") return (parts[1] ?? "").toUpperCase();
  if (head === "skills") return capitalise(parts[1] ?? "");
  if (head === "strikes") {
    const what = parts[2] === "attack" ? "attack" : "damage";
    return `${parts[1]} ${what}`;
  }
  if (head === "spellcasting") {
    const what = parts[parts.length - 1] === "dc" ? "DC" : "spell attack";
    return `${parts.slice(1, -1).join(".")} ${what}`;
  }
  if (head === "ac") return "AC";
  if (head === "hp") return "HP";
  if (head === "perception") return "Perception";
  return path;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Groups changes into the sections a GM reads a stat block in. */
export function groupChanges(changes: readonly StatChange[]) {
  const section = (test: (c: StatChange) => boolean) => changes.filter(test);
  return [
    { title: "Defences", rows: section((c) => ["ac", "hp"].includes(c.path) || c.path.startsWith("saves.")) },
    { title: "Perception & Skills", rows: section((c) => c.path === "perception" || c.path.startsWith("skills.")) },
    { title: "Attributes", rows: section((c) => c.path.startsWith("abilities.")) },
    { title: "Strikes", rows: section((c) => c.path.startsWith("strikes.")) },
    { title: "Spellcasting", rows: section((c) => c.path.startsWith("spellcasting.")) },
  ].filter((s) => s.rows.length > 0);
}

function changeRow(c: StatChange): string {
  const changed = String(c.from) !== String(c.to);
  return `
    <tr class="${changed ? "changed" : "unchanged"}">
      <th scope="row">${escapeHtml(prettyPath(c.path))}</th>
      <td class="from">${escapeHtml(c.from)}</td>
      <td class="arrow" aria-label="becomes">&rarr;</td>
      <td class="to">${escapeHtml(c.to)}</td>
      <td class="band-cell">${bandChip(c)}</td>
    </tr>`;
}

/**
 * Render a rescale as a before/after stat block.
 *
 * Warnings are placed at the top rather than the bottom. The HP-versus-weakness
 * case produces a number that looks plainly wrong on the sheet, and burying the
 * explanation below the fold is how it gets missed.
 */
export function renderRescalePreview(result: RescaleResult): string {
  const { block, fromLevel, toLevel, changes, warnings } = result;

  const warningHtml = warnings.length
    ? `<section class="warnings">
         ${warnings
           .map(
             (w) => `<p class="warning">
                       <strong>${escapeHtml(prettyPath(w.path))}</strong>
                       ${escapeHtml(w.message)}
                     </p>`
           )
           .join("")}
       </section>`
    : "";

  const sections = groupChanges(changes)
    .map(
      (s) => `
      <section class="stat-section">
        <h4>${escapeHtml(s.title)}</h4>
        <table class="stat-table">
          <tbody>${s.rows.map(changeRow).join("")}</tbody>
        </table>
      </section>`
    )
    .join("");

  const unchangedNote = changes.length
    ? ""
    : `<p class="muted">Nothing to rescale - source and target level match.</p>`;

  return `
    <header class="preview-header">
      <h3>${escapeHtml(block.name)}</h3>
      <p class="level-change">
        Creature <span class="from">${fromLevel}</span>
        &rarr; <span class="to">${toLevel}</span>
      </p>
    </header>
    ${warningHtml}
    ${sections}
    ${unchangedNote}`;
}

/**
 * A compact read-only view of a creature as it stands, for when no target
 * level is chosen yet.
 */
export function renderStatBlock(block: StatBlock): string {
  const abilities = (["str", "dex", "con", "int", "wis", "cha"] as const)
    .map(
      (k) =>
        `<span class="ability"><b>${k.toUpperCase()}</b> ${
          block.abilities[k] >= 0 ? "+" : ""
        }${block.abilities[k]}</span>`
    )
    .join("");

  const strikes = block.strikes
    .map(
      (s) => `
      <li>
        <span class="strike-name">${escapeHtml(s.name)}</span>
        <span class="strike-attack">+${s.attack}</span>
        <span class="strike-damage">${escapeHtml(
          s.damage.map((d) => `${d.formula} ${d.damageType}`).join(" plus ")
        )}</span>
      </li>`
    )
    .join("");

  const casting = block.spellcasting.length
    ? `<section class="stat-section">
         <h4>Spellcasting</h4>
         <ul class="plain">
           ${block.spellcasting
             .map(
               (s) =>
                 `<li>${escapeHtml(s.name)} - DC ${s.dc}, attack +${s.attack}</li>`
             )
             .join("")}
         </ul>
       </section>`
    : "";

  const weaknesses = block.weaknesses.length
    ? `<p class="weaknesses">Weaknesses ${escapeHtml(
        block.weaknesses.map((w) => `${w.type} ${w.value}`).join(", ")
      )}</p>`
    : "";

  return `
    <header class="preview-header">
      <h3>${escapeHtml(block.name)}</h3>
      <p class="level-change">Creature ${block.level}</p>
    </header>
    <section class="stat-section">
      <p class="defences">
        <b>AC</b> ${block.ac} &nbsp;
        <b>HP</b> ${block.hp} &nbsp;
        <b>Fort</b> +${block.saves.fortitude} &nbsp;
        <b>Ref</b> +${block.saves.reflex} &nbsp;
        <b>Will</b> +${block.saves.will} &nbsp;
        <b>Perception</b> +${block.perception}
      </p>
      ${weaknesses}
      <p class="abilities">${abilities}</p>
    </section>
    ${strikes ? `<section class="stat-section"><h4>Strikes</h4><ul class="strikes">${strikes}</ul></section>` : ""}
    ${casting}`;
}
