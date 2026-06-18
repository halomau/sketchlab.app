import { type IconDef, renderIconToContext, searchIcons } from "../render/icons";

const PREVIEW_SIZE = 26; // px, the little icon swatch on the left of each row
const PREVIEW_COLOR = "#e2e8f0";

/** The "/" command palette for dropping preset icons onto the canvas. */
export class IconPalette {
  private el: HTMLDivElement | null = null;
  private input!: HTMLInputElement;
  private listEl!: HTMLDivElement;
  private results: IconDef[] = [];
  private index = 0;

  /** dismiss when a pointer goes down anywhere outside the palette */
  private onDocPointerDown = (e: PointerEvent): void => {
    if (this.el && !this.el.contains(e.target as Node)) {
      e.stopPropagation();
      this.close();
    }
  };

  /** Esc closes the palette regardless of where focus currently is */
  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this.el) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  constructor(
    private root: HTMLElement,
    private onPick: (key: string) => void,
  ) {}

  get active(): boolean {
    return !!this.el;
  }

  open(prefill = ""): void {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "icon-palette";
    el.innerHTML = `
      <input class="icon-palette__input" placeholder="Search icons…" spellcheck="false" />
      <div class="icon-palette__list"></div>
      <div class="icon-palette__hint">↑↓ navigate &middot; Enter insert &middot; Esc cancel</div>`;
    this.root.appendChild(el);
    this.el = el;
    this.input = el.querySelector(".icon-palette__input") as HTMLInputElement;
    this.listEl = el.querySelector(".icon-palette__list") as HTMLDivElement;
    this.input.value = prefill;
    this.input.addEventListener("input", () => this.refresh());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    // keep wheel events inside the palette so the list scrolls instead of the
    // canvas handler (on the shared root) panning/zooming the board
    el.addEventListener("wheel", (e) => e.stopPropagation());
    // capture-phase so an outside click / Esc is caught before it reaches the canvas
    document.addEventListener("pointerdown", this.onDocPointerDown, true);
    document.addEventListener("keydown", this.onDocKeyDown, true);
    this.refresh();
    requestAnimationFrame(() => this.input.focus());
  }

  private refresh(): void {
    this.results = searchIcons(this.input.value);
    this.index = 0;
    this.render();
  }

  private render(): void {
    this.listEl.innerHTML = "";
    if (this.results.length === 0) {
      this.listEl.innerHTML = `<div class="icon-row icon-row--empty">No matches</div>`;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    this.results.forEach((icon, i) => {
      const row = document.createElement("div");
      row.className = "icon-row" + (i === this.index ? " is-active" : "");

      const preview = document.createElement("canvas");
      preview.className = "icon-row__preview";
      preview.width = PREVIEW_SIZE * dpr;
      preview.height = PREVIEW_SIZE * dpr;
      preview.style.width = `${PREVIEW_SIZE}px`;
      preview.style.height = `${PREVIEW_SIZE}px`;
      const ctx = preview.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        renderIconToContext(icon.key, ctx, 2, 2, PREVIEW_SIZE - 4, PREVIEW_COLOR);
      }

      const key = document.createElement("span");
      key.className = "icon-row__key";
      key.textContent = icon.key;

      const kw = document.createElement("span");
      kw.className = "icon-row__kw";
      kw.textContent = icon.keywords.slice(0, 3).join(", ");

      row.append(preview, key, kw);
      row.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        // stop the event reaching the canvas, which would otherwise clear the
        // selection we're about to set on the freshly inserted icon
        e.stopPropagation();
        this.pick(icon.key);
      });
      this.listEl.appendChild(row);
    });
    // keep the highlighted row visible while arrow-navigating the full list
    (this.listEl.children[this.index] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }

  private onKey(e: KeyboardEvent): void {
    const max = this.results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.index = Math.min(this.index + 1, max - 1);
      this.render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.index = Math.max(this.index - 1, 0);
      this.render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const icon = this.results[this.index];
      if (icon) this.pick(icon.key);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "/") {
      // "/" opened this palette; swallow it so a double-tap doesn't type into the search
      e.preventDefault();
    }
    e.stopPropagation();
  }

  private pick(key: string): void {
    this.close();
    this.onPick(key);
  }

  close(): void {
    if (this.el) {
      document.removeEventListener("pointerdown", this.onDocPointerDown, true);
      document.removeEventListener("keydown", this.onDocKeyDown, true);
      this.el.remove();
      this.el = null;
    }
  }
}
