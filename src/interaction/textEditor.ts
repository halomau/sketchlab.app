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
  /** letter spacing in px, when the rendered label uses tracking */
  letterSpacing?: number;
  /** line height in px (already scaled for zoom), to match the rendered text */
  lineHeight?: number;
  align?: "left" | "center";
  /** grow with content instead of using a fixed width (text objects) */
  autoGrow?: boolean;
  /** keep text on its committed lines instead of browser-wrapping long labels */
  noWrap?: boolean;
  /** treat x as the horizontal center of the editor instead of its left edge */
  centerX?: boolean;
  padding?: number;
  /** strip the border/background/shadow so editing looks like the plain text itself */
  chromeless?: boolean;
  /** select all existing text on open (so typing overwrites) instead of placing the caret at the end */
  selectAll?: boolean;
  /** extra CSS class (e.g. "text-editor--code" for monospace terminal editing) */
  className?: string;
  /** monospace font stack for code panels */
  fontFamily?: string;
  onInput: (v: string) => void;
  onCommit: (v: string) => void;
  onCancel: () => void;
}

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6"]);

/**
 * Serialize a contenteditable's DOM to plain text with real "\n"s.
 * Strips ZWSP caret anchors used by insertNewline(). Handles Chromium's
 * <div>/<br> line-break markup that textContent would otherwise collapse.
 */
export function readEditableText(root: HTMLElement): string {
  let out = "";

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.nodeValue ?? "").replace(/\u200B/g, "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") {
      out += "\n";
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      // Empty Chromium line placeholder (<div><br></div> or <div></div>) is one
      // newline — don't also walk the <br> or we'd double-count.
      const onlyBr =
        el.childNodes.length === 1 &&
        el.firstChild?.nodeType === Node.ELEMENT_NODE &&
        (el.firstChild as HTMLElement).tagName === "BR";
      if (el.childNodes.length === 0 || onlyBr) {
        out += "\n";
        return;
      }
      // Non-empty block: separate from prior content, then walk children.
      if (out.length > 0 && !out.endsWith("\n")) out += "\n";
      for (const child of el.childNodes) walk(child);
      return;
    }

    for (const child of el.childNodes) walk(child);
  };

  for (const child of root.childNodes) walk(child);
  return out;
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
    el.className = opts.className ? `text-editor ${opts.className}` : "text-editor";
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
    if (opts.centerX) el.style.transform = "translateX(-50%)";
    if (opts.fontWeight != null) el.style.fontWeight = opts.fontWeight;
    if (opts.letterSpacing != null) el.style.letterSpacing = `${opts.letterSpacing}px`;
    if (opts.lineHeight != null) el.style.lineHeight = `${opts.lineHeight}px`;
    if (opts.padding != null) el.style.padding = `${opts.padding}px`;
    if (opts.fontFamily != null) el.style.fontFamily = opts.fontFamily;
    if (opts.chromeless) {
      el.style.border = "none";
      el.style.background = "transparent";
      el.style.boxShadow = "none";
      el.style.borderRadius = "0";
    }
    if (opts.autoGrow) {
      el.style.display = "block";
      el.style.whiteSpace = "pre";
      el.style.wordBreak = "normal";
      el.style.overflow = "visible";
      el.style.width = "max-content";
      el.style.minWidth = `${Math.max(8, opts.w)}px`;
    } else {
      el.style.width = `${opts.w}px`;
      if (opts.noWrap) {
        el.style.whiteSpace = "pre";
        el.style.wordBreak = "normal";
        el.style.overflow = "visible";
      }
    }
    el.addEventListener("input", () => this.opts?.onInput(this.readValue()));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl+Enter finishes editing, for keyboard users who don't want to
        // click away to commit.
        e.preventDefault();
        this.commit();
      } else if (e.key === "Enter") {
        // Plain Enter inserts a newline so multi-line labels are easy to type —
        // no Shift needed. The edit commits on blur (clicking away) or ⌘/Ctrl+↵.
        e.preventDefault();
        this.insertNewline();
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
    const v = this.readValue();
    const cb = this.opts.onCommit;
    this.remove();
    cb(v);
  }

  /**
   * Insert a literal "\n" text node. Chromium's insertText("\n") / default Enter
   * create block <div>s, and textContent then drops the break — so labels never
   * stored a newline. A following ZWSP gives the caret somewhere to land after
   * the break (otherwise the next keystroke inserts before the "\n").
   */
  private insertNewline(): void {
    const el = this.el;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const nl = document.createTextNode("\n");
    const caret = document.createTextNode("\u200B");
    range.insertNode(caret);
    range.insertNode(nl);
    range.setStart(caret, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    // Manual DOM edits don't fire `input` on their own.
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertLineBreak" }));
  }

  /**
   * Read editable text as plain string with real "\n"s. textContent collapses
   * Chromium's <div>/<br> line breaks; innerText double-counts empty trailing
   * blocks — so walk the DOM and treat empty <div><br></div> as a single break.
   */
  private readValue(): string {
    if (!this.el) return "";
    return readEditableText(this.el);
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
