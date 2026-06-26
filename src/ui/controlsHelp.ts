import { getWheelZoom, setWheelZoom } from "../interaction/inputPrefs";
import { h } from "./dom";

/** [action, how-to] pairs shown in the controls reference, in order. */
const BINDINGS: Array<[string, string]> = [
  ["Pan", "Scroll · two-finger drag · Space + drag · middle-drag · Hand tool (M)"],
  ["Zoom to cursor", "⌘/Ctrl + scroll · trackpad pinch"],
  ["Orbit camera (rotate + tilt)", "Alt / Option + drag"],
  ["Tilt camera", "Alt / Option + scroll ↕"],
  ["Rotate (turntable)", "Alt / Option + scroll ↔"],
  ["Spread floors apart", "Layers panel “Floor spread” slider · ⌘/Ctrl + Alt + pinch"],
  ["Fit board to view", "Fit button (zoom bar)"],
];

/**
 * A modal overlay listing every camera/navigation gesture so the controls are
 * discoverable (none of them are otherwise visible in the UI). Also hosts the
 * "Scroll wheel zooms" preference for mouse users. Opened by the zoom-bar “?”
 * button or the `?` key; closed by Escape, the backdrop, or the close button.
 */
export class ControlsHelp {
  private backdrop: HTMLDivElement;
  private wheelToggle: HTMLInputElement;
  private isOpen = false;

  constructor(host: HTMLElement) {
    this.wheelToggle = h("input", {
      type: "checkbox",
      class: "controls-help__check",
      checked: getWheelZoom(),
      onchange: (e: Event) => setWheelZoom((e.target as HTMLInputElement).checked),
    }) as HTMLInputElement;

    const rows = BINDINGS.map(([action, how]) =>
      h(
        "div",
        { class: "controls-help__row" },
        h("div", { class: "controls-help__action" }, action),
        h("div", { class: "controls-help__how" }, how),
      ),
    );

    const card = h(
      "div",
      { class: "controls-help__card", role: "dialog", "aria-modal": "true", "aria-label": "Controls" },
      h(
        "div",
        { class: "controls-help__head" },
        h("h2", null, "Controls"),
        h(
          "button",
          {
            class: "controls-help__close",
            type: "button",
            title: "Close",
            "aria-label": "Close",
            onclick: () => this.close(),
          },
          "✕",
        ),
      ),
      h("div", { class: "controls-help__rows" }, ...rows),
      h(
        "label",
        { class: "controls-help__toggle" },
        this.wheelToggle,
        h(
          "span",
          null,
          h("strong", null, "Scroll wheel zooms"),
          h("span", { class: "controls-help__toggle-sub" }, "Best for a mouse — a wheel notch zooms instead of panning"),
        ),
      ),
    );

    this.backdrop = h(
      "div",
      {
        class: "controls-help",
        onclick: (e: Event) => {
          if (e.target === this.backdrop) this.close();
        },
      },
      card,
    ) as HTMLDivElement;

    host.appendChild(this.backdrop);
    window.addEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    const el = document.activeElement as HTMLElement | null;
    const typing =
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (e.key === "?" && !typing) {
      e.preventDefault();
      this.toggle();
    } else if (e.key === "Escape" && this.isOpen) {
      this.close();
    }
  };

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.wheelToggle.checked = getWheelZoom(); // reflect the current preference
    this.isOpen = true;
    this.backdrop.classList.add("is-open");
  }

  close(): void {
    this.isOpen = false;
    this.backdrop.classList.remove("is-open");
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKey);
    this.backdrop.remove();
  }
}
