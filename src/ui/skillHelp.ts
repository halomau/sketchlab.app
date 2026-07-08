import { h, toast } from "./dom";

/** Production-hosted skill file agents can install from. */
export const SKILL_URL = "https://sketchlab.webdevcody.com/skills/sketch-lab/SKILL.md";

function copyText(text: string, successToast: string): void {
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast(successToast))
      .catch(() => prompt("Copy this URL:", text));
  } else {
    prompt("Copy this URL:", text);
  }
}

/**
 * Informational modal for the Sketch Lab skill URL. Opened from the topbar;
 * closed by Escape, the backdrop, or the close button.
 */
export class SkillHelp {
  private backdrop: HTMLDivElement;
  private isOpen = false;

  constructor(host: HTMLElement) {
    const copyBtn = h(
      "button",
      {
        class: "btn btn--accent skill-help__copy",
        type: "button",
        onclick: () => copyText(SKILL_URL, "Skill URL copied to clipboard"),
      },
      "Copy",
    );

    const card = h(
      "div",
      { class: "skill-help__card", role: "dialog", "aria-modal": "true", "aria-label": "Skill" },
      h(
        "div",
        { class: "skill-help__head" },
        h("h2", null, "Skill"),
        h(
          "button",
          {
            class: "skill-help__close",
            type: "button",
            title: "Close",
            "aria-label": "Close",
            onclick: () => this.close(),
          },
          "✕",
        ),
      ),
      h(
        "div",
        { class: "skill-help__body" },
        h(
          "p",
          null,
          "Copy this link and drop it into your AI harness so it can generate Sketch Lab diagrams for you.",
        ),
        h(
          "div",
          { class: "skill-help__url-row" },
          h("code", { class: "skill-help__url" }, SKILL_URL),
          copyBtn,
        ),
      ),
    );

    this.backdrop = h(
      "div",
      {
        class: "skill-help",
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
    if (e.key === "Escape" && this.isOpen) this.close();
  };

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
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
