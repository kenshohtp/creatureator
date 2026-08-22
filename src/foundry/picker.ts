/**
 * The builder window: pick a chassis, then edit what it produced.
 *
 * Two screens in one ApplicationV2. Screen one chooses a base creature and a
 * target level; screen two is the editor, and nothing is written to the world
 * until Create is pressed there. Keeping both in one window means Back is a
 * real option — a chassis that turns out wrong once you see its numbers is a
 * click away from being reconsidered, not a lost session.
 *
 * Built with hand-rolled HTML rather than Handlebars parts. That is deliberate:
 * template files need registration and correct paths, and both fail at render
 * time in ways that are awkward to diagnose. A string of markup has fewer
 * moving parts.
 *
 * Provenance is shown on every row. A world's compendia can mix Paizo content
 * with premium modules and the GM's own homebrew, and rescaling homebrew
 * carries different assumptions than rescaling a Monster Core creature whose
 * numbers sit on the published bands.
 */

import {
  filterChassis,
  sortChassis,
  type ChassisEntry,
  type Provenance,
} from "./chassis.js";
import { renderRescalePreview, renderStatBlock } from "./statblock.js";
import {
  bandSelect,
  fieldChip,
  renderEditor,
  renderWarnings,
  revertButton,
  type AbilityPanel,
} from "./editor-view.js";
import {
  buildAbilityIndex,
  filterAbilities,
  sortAbilities,
  type AbilityEntry,
} from "./ability-index.js";
import { EditSession, type DefenceKind } from "../editor/edit-session.js";
import { rescaleCreature, type RescaleResult } from "../scaling/rescale-creature.js";
import type { Band } from "../scaling/bands.js";
import { readStatBlock, type NPCSource } from "../pf2e/npc.js";

declare const foundry: any;
declare const game: any;
declare const ui: any;
declare const fromUuid: (uuid: string) => Promise<any>;

const { ApplicationV2 } = foundry.applications.api;

/** Levels the Building Creatures tables cover. */
const TABLE_MIN = -1;
const TABLE_MAX = 24;
const MAX_ROWS = 200;
const MAX_ABILITY_ROWS = 50;

const PROVENANCE_LABEL: Record<Provenance, string> = {
  system: "Official",
  module: "Module",
  world: "Homebrew",
};

const escape = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

/** CSS.escape is not in every environment Foundry runs in. */
const attrSelector = (attr: string, value: string) =>
  `[${attr}="${value.replace(/["\\]/g, "\\$&")}"]`;

interface PickerState {
  search: string;
  targetLevel: number;
  minLevel: number | null;
  maxLevel: number | null;
  provenance: Set<Provenance>;
  selected: string | null;
}

export class ChassisPicker extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "creatureator-chassis-picker",
    tag: "div",
    classes: ["creatureator", "creatureator-picker"],
    window: {
      title: "Creatureator",
      icon: "fa-solid fa-dna",
      resizable: true,
    },
    position: { width: 1080, height: 700 },
  };

  /** Loaded chassis sources, keyed by uuid. Compendium reads are slow. */
  #sources = new Map<string, NPCSource>();
  #preview: RescaleResult | null = null;
  #previewFor: string | null = null;
  #loading = false;

  /** "pick" is the chassis list; "edit" is the editor over a live session. */
  #mode: "pick" | "edit" = "pick";
  #session: EditSession | null = null;

  /**
   * The ability index, built once and kept for the window's lifetime.
   *
   * Around 1,300 rows read from compendium indexes - no documents are loaded
   * until something is actually attached.
   */
  #abilities: AbilityEntry[] | null = null;
  #abilitiesLoading = false;
  #abilitySearch = "";
  #abilitySourceLevel: number | null = null;

  #all: ChassisEntry[] = [];
  #state: PickerState = {
    search: "",
    targetLevel: 5,
    minLevel: null,
    maxLevel: null,
    provenance: new Set<Provenance>(["system", "module", "world"]),
    selected: null,
  };

  constructor(all: ChassisEntry[], options = {}) {
    super(options);
    this.#all = all;
  }

  /** Entries matching the current filters, closest to target level first. */
  #results(): ChassisEntry[] {
    return sortChassis(
      filterChassis(this.#all, {
        search: this.#state.search,
        provenance: [...this.#state.provenance],
        minLevel: this.#state.minLevel ?? undefined,
        maxLevel: this.#state.maxLevel ?? undefined,
        scalableOnly: true,
      }),
      this.#state.targetLevel
    );
  }

  /**
   * Load the selected chassis and compute its preview.
   *
   * Cached per uuid because a compendium read is slow, and the preview is
   * recomputed whenever the target level changes - which happens on every
   * keystroke in the level box.
   */
  async #loadPreview(): Promise<void> {
    const s = this.#state;
    if (!s.selected) {
      this.#preview = null;
      this.#previewFor = null;
      return;
    }

    const key = `${s.selected}@${s.targetLevel}`;
    if (this.#previewFor === key) return;

    this.#loading = true;
    void this.render();

    try {
      const source = await this.#sourceFor(s.selected);
      this.#preview = rescaleCreature(source, s.targetLevel);
      this.#previewFor = key;
    } catch (error) {
      console.error("creatureator | preview failed", error);
      this.#preview = null;
      this.#previewFor = null;
    } finally {
      this.#loading = false;
      void this.render();
    }
  }

  async #sourceFor(uuid: string): Promise<NPCSource> {
    const cached = this.#sources.get(uuid);
    if (cached) return cached;

    const doc = await fromUuid(uuid);
    if (!doc) throw new Error("Creature not found");
    const source = doc.toObject() as NPCSource;
    this.#sources.set(uuid, source);
    return source;
  }

  // --- screen one: the chassis list ---------------------------------------

  #previewHtml(selected: ChassisEntry | null): string {
    if (!selected) {
      return `<p class="muted placeholder">Select a creature to preview it.</p>`;
    }
    if (this.#loading || !this.#preview) {
      return `<p class="muted placeholder">Loading ${escape(selected.name)}...</p>`;
    }
    // Same level: nothing is being changed, so show the creature as it stands.
    if (this.#preview.fromLevel === this.#preview.toLevel) {
      return renderStatBlock(readStatBlock(this.#sources.get(selected.uuid)!));
    }
    return renderRescalePreview(this.#preview);
  }

  #pickHtml(): string {
    const s = this.#state;
    const results = this.#results();
    const shown = results.slice(0, MAX_ROWS);
    const selected = results.find((r) => r.uuid === s.selected) ?? null;

    const rows = shown
      .map((e) => {
        const delta = e.level === null ? "" : e.level - s.targetLevel;
        const deltaText =
          delta === "" ? "" : delta === 0 ? "same" : delta > 0 ? `+${delta}` : `${delta}`;
        return `
        <li class="chassis-row${e.uuid === s.selected ? " selected" : ""}"
            data-uuid="${escape(e.uuid)}" role="option"
            aria-selected="${e.uuid === s.selected}">
          <span class="chassis-level">${e.level}</span>
          <span class="chassis-name" title="${escape(e.name)}">${escape(e.name)}</span>
          <span class="chassis-pack" title="${escape(e.packLabel)}">${escape(e.packLabel)}</span>
          <span class="provenance ${e.provenance}">${PROVENANCE_LABEL[e.provenance]}</span>
          <span class="chassis-delta">${deltaText}</span>
        </li>`;
      })
      .join("");

    const truncated =
      results.length > MAX_ROWS
        ? `<li class="chassis-note">Showing ${MAX_ROWS} of ${results.length} - narrow the search.</li>`
        : "";

    const empty = results.length
      ? ""
      : `<li class="chassis-note">No creatures match those filters.</li>`;

    const provBoxes = (["system", "module", "world"] as Provenance[])
      .map(
        (p) => `
        <label class="prov-toggle">
          <input type="checkbox" data-prov="${p}" ${s.provenance.has(p) ? "checked" : ""}>
          <span class="provenance ${p}">${PROVENANCE_LABEL[p]}</span>
        </label>`
      )
      .join("");

    return `
      <div class="picker-controls">
        <div class="row">
          <input type="search" class="search" placeholder="Search creatures"
                 value="${escape(s.search)}">
          <label class="target">
            Target level
            <input type="number" class="target-level" value="${s.targetLevel}"
                   min="${TABLE_MIN}" max="${TABLE_MAX}">
          </label>
        </div>
        <div class="row secondary">
          <div class="prov-toggles">${provBoxes}</div>
          <label class="level-range">
            Chassis level
            <input type="number" class="min-level" placeholder="min"
                   value="${s.minLevel ?? ""}" min="${TABLE_MIN}" max="${TABLE_MAX}">
            <span>to</span>
            <input type="number" class="max-level" placeholder="max"
                   value="${s.maxLevel ?? ""}" min="${TABLE_MIN}" max="${TABLE_MAX}">
          </label>
        </div>
      </div>

      <div class="picker-body">
        <ol class="chassis-list" role="listbox">${rows}${truncated}${empty}</ol>
        <aside class="preview">${this.#previewHtml(selected)}</aside>
      </div>

      <footer class="picker-footer">
        <div class="selection">${this.#footerText(selected)}</div>
        <button type="button" class="customise" ${selected && this.#preview ? "" : "disabled"}>
          <span>Customise</span>
          <i class="fa-solid fa-arrow-right" inert></i>
        </button>
      </footer>`;
  }

  /**
   * Say plainly what the button will do.
   *
   * When the chassis is already at the target level nothing is rescaled, and
   * the result is a duplicate. Labelling that as rescaling implies work that is
   * not happening - the same silent-adjustment problem in a different guise.
   */
  #footerText(selected: ChassisEntry | null): string {
    if (!selected) return `<span class="muted">Select a creature</span>`;

    const target = this.#state.targetLevel;
    if (selected.level === target) {
      return `<strong>${escape(selected.name)}</strong> is already level ${target}
              &mdash; you will be editing an unmodified copy`;
    }
    const direction = (selected.level ?? 0) < target ? "up" : "down";
    return `Rescaling <strong>${escape(selected.name)}</strong>
            ${direction} from level ${selected.level} to ${target}`;
  }

  // --- screen two: the editor ---------------------------------------------

  async #openEditor(): Promise<void> {
    const s = this.#state;
    if (!s.selected) return;

    await this.#loadPreview();
    if (!this.#preview) {
      ui.notifications?.error("Could not load that creature.");
      return;
    }

    this.#session = new EditSession(
      await this.#sourceFor(s.selected),
      this.#preview
    );
    this.#mode = "edit";
    this.#abilitySourceLevel = null;
    await this.render();
    void this.#loadAbilities();
  }

  /** What the attach panel should show right now. */
  #abilityPanel(): AbilityPanel {
    const all = this.#abilities ?? [];
    const search = this.#abilitySearch;
    const results = search.trim()
      ? sortAbilities(filterAbilities(all, { search }), search).slice(0, MAX_ABILITY_ROWS)
      : [];

    return {
      search,
      results,
      total: all.length,
      loading: this.#abilitiesLoading,
      sourceLevel: this.#abilitySourceLevel ?? this.#session?.level ?? 1,
    };
  }

  /**
   * Build the ability index in the background.
   *
   * Deliberately not awaited by the editor: the stat block should be usable
   * immediately, and the attach panel says it is still reading rather than
   * blocking the whole screen on a compendium sweep.
   */
  async #loadAbilities(): Promise<void> {
    if (this.#abilities || this.#abilitiesLoading) return;
    this.#abilitiesLoading = true;
    void this.render();
    try {
      this.#abilities = await buildAbilityIndex(game.packs.contents ?? [...game.packs]);
    } catch (error) {
      console.error("creatureator | ability index failed", error);
      this.#abilities = [];
    } finally {
      this.#abilitiesLoading = false;
      void this.render();
    }
  }

  #editHtml(): string {
    const session = this.#session!;
    return `
      <div class="editor-screen">
        ${renderEditor(session, this.#abilityPanel())}
      </div>
      <footer class="picker-footer">
        <button type="button" class="back">
          <i class="fa-solid fa-arrow-left" inert></i>
          <span>Back</span>
        </button>
        <div class="selection">${this.#editFooterText()}</div>
        <button type="button" class="create">
          <i class="fa-solid fa-wand-magic-sparkles" inert></i>
          <span>Create</span>
        </button>
      </footer>`;
  }

  #editFooterText(): string {
    const session = this.#session!;
    const edits = session.dirtyPaths.length
      + session.defenceRows().filter((d) => d.dirty).length;
    if (!edits) {
      return `<span class="muted">No edits yet &mdash; Create makes the rescaled creature as shown</span>`;
    }
    return `<button type="button" class="revert-all">Revert ${edits} edit${
      edits === 1 ? "" : "s"
    }</button>`;
  }

  async _renderHTML(): Promise<string> {
    return this.#mode === "edit" && this.#session ? this.#editHtml() : this.#pickHtml();
  }

  #firstRender = true;

  /**
   * Re-render, putting the caret back where it was.
   *
   * Fields are found again by `data-path` rather than by class: the editor has
   * dozens of inputs sharing a class, and restoring focus to "the first
   * .stat-input" would drop the user into AC every time they changed a band.
   */
  _replaceHTML(result: string, content: HTMLElement): void {
    const active = content.querySelector<HTMLInputElement | HTMLSelectElement>(
      "input:focus, select:focus"
    );
    const path = active?.getAttribute("data-path") ?? active?.getAttribute("data-defence");
    const attr = active?.hasAttribute("data-path") ? "data-path" : "data-defence";
    const cls = active?.className.split(/\s+/)[0] ?? null;
    const caret =
      active instanceof HTMLInputElement && active.type !== "number"
        ? active.selectionStart
        : null;

    content.innerHTML = result;
    this.#activate(content);

    const restored = path
      ? content.querySelector<HTMLInputElement>(
          `${cls ? `.${cls}` : ""}${attrSelector(attr, path)}`
        )
      : cls
        ? content.querySelector<HTMLInputElement>(`input.${cls}`)
        : null;

    if (restored) {
      restored.focus();
      if (caret !== null && restored.type !== "number") {
        restored.setSelectionRange(caret, caret);
      }
    } else if (this.#firstRender) {
      // Focus the search box on open. Done here rather than with the autofocus
      // attribute, which browsers ignore when the document already has a
      // focused element - and Foundry's sidebar usually does.
      this.#firstRender = false;
      content.querySelector<HTMLInputElement>("input.search")?.focus();
    }
  }

  #debounce: ReturnType<typeof setTimeout> | null = null;

  #rerender(): void {
    if (this.#debounce) clearTimeout(this.#debounce);
    this.#debounce = setTimeout(() => void this.render(), 120);
  }

  #activate(root: HTMLElement): void {
    if (this.#mode === "edit" && this.#session) this.#activateEditor(root);
    else this.#activatePicker(root);
  }

  #activatePicker(root: HTMLElement): void {
    const s = this.#state;

    root.querySelector<HTMLInputElement>("input.search")?.addEventListener("input", (ev) => {
      s.search = (ev.target as HTMLInputElement).value;
      this.#rerender();
    });

    const numeric = (selector: string, apply: (value: number | null) => void) => {
      root.querySelector<HTMLInputElement>(selector)?.addEventListener("change", (ev) => {
        const raw = (ev.target as HTMLInputElement).value;
        apply(raw === "" ? null : Number(raw));
        this.#rerender();
      });
    };

    numeric("input.target-level", (v) => {
      // Clamp rather than allow a target the tables cannot produce.
      const n = v ?? 1;
      s.targetLevel = Math.min(TABLE_MAX, Math.max(TABLE_MIN, n));
      void this.#loadPreview();
    });
    numeric("input.min-level", (v) => { s.minLevel = v; });
    numeric("input.max-level", (v) => { s.maxLevel = v; });

    root.querySelectorAll<HTMLInputElement>("input[data-prov]").forEach((box) => {
      box.addEventListener("change", () => {
        const p = box.dataset["prov"] as Provenance;
        if (box.checked) s.provenance.add(p);
        else s.provenance.delete(p);
        this.#rerender();
      });
    });

    root.querySelectorAll<HTMLElement>("li.chassis-row").forEach((li) => {
      li.addEventListener("click", () => {
        s.selected = li.dataset["uuid"] ?? null;
        void this.#loadPreview();
      });
      li.addEventListener("dblclick", () => {
        s.selected = li.dataset["uuid"] ?? null;
        void this.#openEditor();
      });
    });

    root.querySelector<HTMLButtonElement>("button.customise")
      ?.addEventListener("click", () => void this.#openEditor());
  }

  // --- editor wiring ------------------------------------------------------

  /**
   * Update one row without re-rendering it.
   *
   * The input the user is typing in is left alone; only the band chip, the band
   * dropdown and the revert control are replaced. Re-rendering the row would
   * take the caret with it, and a stat block where you cannot type "2" on the
   * way to "21" without losing your place is not editable in any real sense.
   */
  #patchField(root: HTMLElement, path: string): void {
    const session = this.#session;
    if (!session) return;

    const row = root.querySelector<HTMLElement>(
      `tr.edit-row${attrSelector("data-path", path)}`
    );
    const field = session.field(path);
    if (!row || !field) return;

    row.classList.toggle("dirty", field.dirty);

    const chip = row.querySelector<HTMLElement>(".band-cell");
    if (chip) chip.innerHTML = fieldChip(field);

    const pick = row.querySelector<HTMLElement>(".band-pick");
    if (pick && document.activeElement?.closest(".band-pick") !== pick) {
      pick.innerHTML = bandSelect(field);
      this.#bindBandSelect(pick);
    }

    const was = row.querySelector<HTMLElement>(".was");
    if (was) {
      was.innerHTML = revertButton(field);
      this.#bindRevert(was);
    }

    this.#patchWarnings(root);
    this.#patchFooter(root);
  }

  #patchWarnings(root: HTMLElement): void {
    const session = this.#session;
    const host = root.querySelector<HTMLElement>("section.warnings");
    if (!session || !host) return;

    const fresh = document.createElement("div");
    fresh.innerHTML = renderWarnings(session);
    const next = fresh.firstElementChild;
    if (next) host.replaceWith(next);
  }

  #patchFooter(root: HTMLElement): void {
    const footer = root.querySelector<HTMLElement>("footer.picker-footer .selection");
    if (!footer) return;
    footer.innerHTML = this.#editFooterText();
    footer
      .querySelector<HTMLButtonElement>("button.revert-all")
      ?.addEventListener("click", () => {
        this.#session?.resetAll();
        void this.render();
      });
  }

  #bindBandSelect(scope: ParentNode): void {
    scope.querySelectorAll<HTMLSelectElement>("select.band-select").forEach((select) => {
      select.addEventListener("change", () => {
        const path = select.dataset["path"];
        const band = select.value as Band;
        if (!path || !band) return;
        this.#session?.setBand(path, band);
        void this.render();
      });
    });
  }

  #bindRevert(scope: ParentNode): void {
    scope.querySelectorAll<HTMLButtonElement>("button.revert").forEach((button) => {
      button.addEventListener("click", () => {
        const path = button.dataset["path"];
        if (!path) return;
        this.#session?.reset(path);
        void this.render();
      });
    });
  }

  #activateEditor(root: HTMLElement): void {
    const session = this.#session!;

    root.querySelector<HTMLInputElement>("input.creature-name")
      ?.addEventListener("input", (ev) => {
        session.rename((ev.target as HTMLInputElement).value);
      });

    root.querySelectorAll<HTMLInputElement>("input.stat-input").forEach((input) => {
      const path = input.dataset["path"];
      if (!path) return;

      // Live band re-derivation on every keystroke, patched in place.
      input.addEventListener("input", () => {
        if (session.set(path, input.value)) this.#patchField(root, path);
      });
      // On commit, re-render so a rounded or rejected value shows what stuck.
      input.addEventListener("change", () => {
        session.set(path, input.value);
        void this.render();
      });
    });

    this.#bindBandSelect(root);
    this.#bindRevert(root);

    const parseDefence = (id: string): [DefenceKind, string] => {
      const at = id.indexOf(":");
      return [id.slice(0, at) as DefenceKind, id.slice(at + 1)];
    };

    root.querySelectorAll<HTMLInputElement>("input.defence-input").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.dataset["defence"];
        if (!id) return;
        const [kind, type] = parseDefence(id);
        session.setDefence(kind, type, Number(input.value));
        void this.render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>(
      "button.defence-remove, button.defence-restore"
    ).forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset["defence"];
        if (!id) return;
        const [kind, type] = parseDefence(id);
        const restoring = button.classList.contains("defence-restore");
        const row = session.defenceRows().find((d) => d.kind === kind && d.type === type);
        session.setDefence(kind, type, restoring ? (row?.baseline ?? 0) : null);
        void this.render();
      });
    });

    root.querySelector<HTMLButtonElement>("button.defence-add-button")
      ?.addEventListener("click", () => {
        const kind = root.querySelector<HTMLSelectElement>(".defence-add-kind")?.value;
        const type = root.querySelector<HTMLInputElement>(".defence-add-type")?.value.trim();
        const value = Number(root.querySelector<HTMLInputElement>(".defence-add-value")?.value);
        if (!kind || !type || !Number.isFinite(value)) {
          ui.notifications?.warn("Give the weakness a damage type and a value.");
          return;
        }
        session.setDefence(kind as DefenceKind, type.toLowerCase(), value);
        void this.render();
      });

    root.querySelector<HTMLButtonElement>("button.revert-all")
      ?.addEventListener("click", () => {
        session.resetAll();
        void this.render();
      });

    this.#activateAbilities(root, session);

    root.querySelector<HTMLButtonElement>("button.back")
      ?.addEventListener("click", () => void this.#back());

    root.querySelector<HTMLButtonElement>("button.create")
      ?.addEventListener("click", () => void this.#create());
  }

  #activateAbilities(root: HTMLElement, session: EditSession): void {
    root.querySelector<HTMLInputElement>("input.ability-search")
      ?.addEventListener("input", (ev) => {
        this.#abilitySearch = (ev.target as HTMLInputElement).value;
        this.#rerender();
      });

    root.querySelector<HTMLInputElement>("input.ability-level")
      ?.addEventListener("change", (ev) => {
        const raw = Number((ev.target as HTMLInputElement).value);
        this.#abilitySourceLevel = Number.isFinite(raw)
          ? Math.min(TABLE_MAX, Math.max(TABLE_MIN, raw))
          : null;
        this.#rerender();
      });

    root.querySelectorAll<HTMLButtonElement>("button.ability-attach").forEach((button) => {
      button.addEventListener("click", () => void this.#attach(button.dataset["uuid"], session));
    });

    const parseAbilityId = (id: string): { grafted: boolean; key: string } => {
      const at = id.indexOf(":");
      return { grafted: id.slice(0, at) === "graft", key: id.slice(at + 1) };
    };

    root.querySelectorAll<HTMLButtonElement>(
      "button.ability-remove, button.ability-restore"
    ).forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset["ability"];
        if (!id) return;
        const { grafted, key } = parseAbilityId(id);
        if (grafted) session.ungraft(Number(key));
        else session.setAbilityRemoved(key, button.classList.contains("ability-remove"));
        void this.render();
      });
    });
  }

  /**
   * Attach an ability to the creature being edited.
   *
   * Nothing is written to the world - the item joins the session and only
   * becomes real when Create is pressed. What the graft did to it is surfaced
   * immediately, because a DC that moved silently is the failure this whole
   * module is built to avoid.
   */
  async #attach(uuid: string | undefined, session: EditSession): Promise<void> {
    if (!uuid) return;
    try {
      const doc = await fromUuid(uuid);
      if (!doc) throw new Error("Ability not found");

      const report = session.graft(doc.toObject(), {
        fromLevel: this.#abilitySourceLevel ?? session.level,
        sourceUuid: uuid,
      });

      const moved = report.changes.length
        ? ` (${report.changes.map((c) => `${c.label} ${c.from}\u2192${c.to}`).join(", ")})`
        : "";
      ui.notifications?.info(`Attached ${report.name}${moved}.`);
      await this.render();
    } catch (error) {
      console.error("creatureator | attach failed", error);
      ui.notifications?.error(`Could not attach that ability: ${(error as Error).message}`);
    }
  }

  /**
   * Return to the chassis list.
   *
   * Edits are dropped, so ask first when there are any. The session is not kept
   * around: coming back from a different chassis and finding the old creature's
   * edits half-applied would be worse than losing them.
   */
  async #back(): Promise<void> {
    const session = this.#session;
    if (session?.isDirty) {
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Discard edits?" },
        content: `<p>Going back discards your edits to <strong>${escape(
          session.name
        )}</strong>.</p>`,
      });
      if (!ok) return;
    }
    this.#session = null;
    this.#mode = "pick";
    await this.render();
  }

  async #create(): Promise<void> {
    const session = this.#session;
    if (!session) return;

    try {
      console.log(session.summarise());
      const warnings = session.warnings();
      if (warnings.length) {
        console.warn(
          `creatureator | ${warnings.length} thing(s) to review`,
          warnings
        );
      }

      const created = await game.actors.documentClass.create(session.toActorSource());
      if (warnings.length) {
        ui.notifications?.warn(
          `${created?.name} created with ${warnings.length} thing${
            warnings.length === 1 ? "" : "s"
          } to review - see console.`
        );
      } else {
        ui.notifications?.info(`${created?.name} created.`);
      }
      created?.sheet?.render(true);
      await this.close();
    } catch (error) {
      console.error("creatureator | create failed", error);
      ui.notifications?.error(`Could not create creature: ${(error as Error).message}`);
    }
  }
}
