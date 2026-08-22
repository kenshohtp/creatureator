/**
 * Chassis picker: choose a base creature and a target level.
 *
 * Built on ApplicationV2 with hand-rolled HTML rather than Handlebars parts.
 * That is deliberate: template files need registration and correct paths, and
 * both fail at render time in ways that are awkward to diagnose. A string of
 * markup has fewer moving parts, and this window is not complex enough to earn
 * a template.
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
import { rescaleCreature, type RescaleResult } from "../scaling/rescale-creature.js";
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

const PROVENANCE_LABEL: Record<Provenance, string> = {
  system: "Official",
  module: "Module",
  world: "Homebrew",
};

const escape = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

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
      let source = this.#sources.get(s.selected);
      if (!source) {
        const doc = await fromUuid(s.selected);
        if (!doc) throw new Error("Creature not found");
        source = doc.toObject() as NPCSource;
        this.#sources.set(s.selected, source);
      }
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

  async _renderHTML(): Promise<string> {
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
        <button type="button" class="create" ${selected ? "" : "disabled"}>
          <i class="fa-solid ${
            selected && selected.level === s.targetLevel
              ? "fa-copy"
              : "fa-wand-magic-sparkles"
          }" inert></i>
          <span>${
            selected && selected.level === s.targetLevel ? "Copy" : "Create"
          }</span>
        </button>
      </footer>`;
  }

  /**
   * Say plainly what the button will do.
   *
   * When the chassis is already at the target level nothing is rescaled, and
   * the result is a duplicate. Labelling that "Create" implies work that is not
   * happening - the same silent-adjustment problem in a different guise.
   */
  #footerText(selected: ChassisEntry | null): string {
    if (!selected) return `<span class="muted">Select a creature</span>`;

    const target = this.#state.targetLevel;
    if (selected.level === target) {
      return `<strong>${escape(selected.name)}</strong> is already level ${target}
              &mdash; this makes an unmodified copy`;
    }
    const direction = (selected.level ?? 0) < target ? "up" : "down";
    return `Rescaling <strong>${escape(selected.name)}</strong>
            ${direction} from level ${selected.level} to ${target}`;
  }

  #firstRender = true;

  _replaceHTML(result: string, content: HTMLElement): void {
    // Preserve focus and caret across re-renders; without this, typing in the
    // search box loses the cursor on every keystroke.
    const active = content.querySelector<HTMLInputElement>("input:focus");
    const activeClass = active?.className ?? null;
    const caret = active?.selectionStart ?? null;

    content.innerHTML = result;
    this.#activate(content);

    if (activeClass) {
      const restored = content.querySelector<HTMLInputElement>(`input.${activeClass}`);
      restored?.focus();
      if (caret !== null && restored?.type === "search") {
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
    const s = this.#state;

    root.querySelector<HTMLInputElement>("input.search")?.addEventListener("input", (ev) => {
      s.search = (ev.target as HTMLInputElement).value;
      this.#rerender();
    });

    const numeric = (
      selector: string,
      apply: (value: number | null) => void
    ) => {
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
        void this.#create();
      });
    });

    root.querySelector<HTMLButtonElement>("button.create")
      ?.addEventListener("click", () => void this.#create());
  }

  async #create(): Promise<void> {
    const s = this.#state;
    if (!s.selected) return;

    const api = game.creatureator;
    if (!api?.rescale) {
      ui.notifications?.error("Creatureator API unavailable.");
      return;
    }

    try {
      const result = await api.rescale(s.selected, s.targetLevel, { create: true });
      const name = result?.created?.name ?? "Creature";
      const warnings = result?.warnings?.length ?? 0;

      // Surface warnings rather than leaving them in a returned object. The
      // HP-versus-weakness case in particular produces a number that looks
      // wrong on the sheet, and the reason belongs in front of the user.
      if (warnings) {
        ui.notifications?.warn(
          `${name} created with ${warnings} thing${warnings === 1 ? "" : "s"} to review - see console.`
        );
      } else {
        ui.notifications?.info(`${name} created.`);
      }
      result?.created?.sheet?.render(true);
      await this.close();
    } catch (error) {
      console.error("creatureator | create failed", error);
      ui.notifications?.error(`Could not create creature: ${(error as Error).message}`);
    }
  }
}
