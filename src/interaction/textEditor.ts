export interface TextEditOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  color: string;
  background: string;
  fontSize: number;
  /** match the rendered text weight (e.g. "500", "600") */
  fontWeight?: string;
  /** line height in px (already scaled for zoom), to match the rendered text */
  lineHeight?: number;
  align?: "left" | "center";
  /** grow with content instead of using a fixed width (text objects) */
  autoGrow?: boolean;
  padding?: number;
  /** strip the border/background/shadow so editing looks like the plain text itself */
  chromeless?: boolean;
  /** select all existing text on open (so typing overwrites) instead of placing the caret at the end */
  selectAll?: boolean;
  onInput: (v: string) => void;
  onCommit: (v: string) => void;
  onCancel: () => void;
}

/** A single contenteditable overlay used for shape text and edge labels. */
export class TextEditor {
  private el: HTMLDivElement | null = null;
  private opts: TextEditOptions | null = null;

  constructor(private root: HTMLElement) {}

  get active(): boolean {
    return !!this.el;
  }

  open(opts: TextEditOptions): void {
    this.remove();
    this.opts = opts;
    const el = document.createElement("div");
    el.className = "text-editor";
    el.contentEditable = "true";
    el.textContent = opts.value;
    Object.assign(el.style, {
      left: `${opts.x}px`,
      top: `${opts.y}px`,
      minHeight: `${opts.h}px`,
      color: opts.color,
      background: opts.background,
      fontSize: `${opts.fontSize}px`,
      textAlign: opts.align ?? "center",
    });
    if (opts.fontWeight != null) el.style.fontWeight = opts.fontWeight;
    if (opts.lineHeight != null) el.style.lineHeight = `${opts.lineHeight}px`;
    if (opts.padding != null) el.style.padding = `${opts.padding}px`;
    if (opts.chromeless) {
      el.style.border = "none";
      el.style.background = "transparent";
      el.style.boxShadow = "none";
      el.style.borderRadius = "0";
    }
    if (opts.autoGrow) {
      el.style.display = "block";
      el.style.whiteSpace = "pre";
      el.style.width = "auto";
      el.style.minWidth = "8px";
    } else {
      el.style.width = `${opts.w}px`;
    }
    el.addEventListener("input", () => this.opts?.onInput(el.textContent ?? ""));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Enter finishes editing, for keyboard users who don't want to
        // click away to commit.
        e.preventDefault();
        this.commit();
      } else if (e.key === "Enter") {
        // Plain Enter inserts a newline so multi-line labels are easy to type —
        // no Shift needed. The edit commits on blur (clicking away) or ⌘/Ctrl+↵.
        // insertText keeps the native undo stack and writes a literal "\n" that
        // round-trips through textContent under `white-space: pre-wrap`.
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
      e.stopPropagation();
    });
    el.addEventListener("blur", () => this.commit());
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    // Keep clicks inside the editor from reaching the canvas, which would
    // hit-test the shape and re-open editing — wiping the browser's native
    // double-click-to-select-word (and triple-click-to-select-all). We only
    // stop propagation, never preventDefault, so the native selection stands.
    el.addEventListener("click", (e) => e.stopPropagation());
    el.addEventListener("dblclick", (e) => e.stopPropagation());
    this.root.appendChild(el);
    this.el = el;
    requestAnimationFrame(() => {
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.selectNodeContents(el);
        if (!opts.selectAll) r.collapse(false); // caret at end unless we want everything selected
        sel.removeAllRanges();
        sel.addRange(r);
      }
    });
  }

  commit(): void {
    if (!this.el || !this.opts) return;
    const v = this.el.textContent ?? "";
    const cb = this.opts.onCommit;
    this.remove();
    cb(v);
  }

  private cancel(): void {
    if (!this.el || !this.opts) return;
    const cb = this.opts.onCancel;
    this.remove();
    cb();
  }

  private remove(): void {
    // Clear refs BEFORE detaching: removing a focused editor fires a synchronous
    // `blur`, whose handler re-enters commit()/remove(). Nulling first makes that
    // re-entrant call a no-op instead of trying to detach an already-removed node.
    const el = this.el;
    this.el = null;
    this.opts = null;
    el?.remove();
  }
}
