import { h } from "./dom";

export interface ConfirmOptions {
  /** Short heading, e.g. "Delete floor". */
  title: string;
  /** Body copy explaining what will happen. */
  message: string;
  /** Label for the affirmative button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Label for the dismissing button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button as destructive (red) rather than accent. Defaults to true. */
  danger?: boolean;
}

/**
 * A custom confirmation modal that replaces the native `window.confirm()` for
 * destructive actions (deleting a board/floor, replacing board content).
 * Returns a promise resolving `true` if the user confirms, `false` otherwise.
 *
 * Follows the same overlay conventions as {@link ControlsHelp}: a centered card
 * over a dimmed backdrop, with `role="alertdialog"`. Escape, a backdrop click,
 * and the cancel button all resolve `false`; Enter and the confirm button
 * resolve `true`. The keydown listener runs in the capture phase and stops
 * propagation so dismissing the dialog never reaches the underlying surface
 * (e.g. the board drawer's own Escape-to-close handler).
 */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    danger = true,
  } = opts;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      }
    };

    const cancelBtn = h(
      "button",
      {
        class: "confirm-dialog__btn confirm-dialog__btn--ghost",
        type: "button",
        onclick: () => finish(false),
      },
      cancelLabel,
    );

    const confirmBtn = h(
      "button",
      {
        class: danger
          ? "confirm-dialog__btn confirm-dialog__btn--danger"
          : "confirm-dialog__btn confirm-dialog__btn--primary",
        type: "button",
        onclick: () => finish(true),
      },
      confirmLabel,
    ) as HTMLButtonElement;

    const card = h(
      "div",
      {
        class: "confirm-dialog__card",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-label": title,
      },
      h("h2", { class: "confirm-dialog__title" }, title),
      h("p", { class: "confirm-dialog__message" }, message),
      h("div", { class: "confirm-dialog__actions" }, cancelBtn, confirmBtn),
    );

    const backdrop = h(
      "div",
      {
        class: "confirm-dialog is-open",
        onclick: (e: Event) => {
          if (e.target === backdrop) finish(false);
        },
      },
      card,
    ) as HTMLDivElement;

    document.body.appendChild(backdrop);
    window.addEventListener("keydown", onKey, true);
    confirmBtn.focus();
  });
}

export interface ChoiceOption {
  /** Value resolved when this button is chosen. */
  id: string;
  /** Button label. */
  label: string;
  /** Visual style. Defaults to "primary". */
  variant?: "primary" | "danger" | "ghost";
}

export interface ChoiceOptions {
  title: string;
  message: string;
  /** Buttons rendered left → right. */
  options: ChoiceOption[];
  /** Option id resolved on Escape / backdrop click. Defaults to "". */
  dismissId?: string;
}

/**
 * A modal like {@link confirmDialog} but with an arbitrary set of choices,
 * resolving the chosen option's `id` (or `dismissId` on Escape/backdrop). Used
 * where a destructive action has more than one outcome — e.g. deleting a floor
 * can either drop its shapes to the floor below or delete them along with it.
 */
export function choiceDialog(opts: ChoiceOptions): Promise<string> {
  const { title, message, options, dismissId = "" } = opts;

  return new Promise<string>((resolve) => {
    let settled = false;

    const finish = (result: string): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(dismissId);
      }
    };

    const variantClass = (v: ChoiceOption["variant"]): string =>
      v === "danger"
        ? "confirm-dialog__btn--danger"
        : v === "ghost"
          ? "confirm-dialog__btn--ghost"
          : "confirm-dialog__btn--primary";

    const buttons = options.map((opt) =>
      h(
        "button",
        {
          class: `confirm-dialog__btn ${variantClass(opt.variant)}`,
          type: "button",
          onclick: () => finish(opt.id),
        },
        opt.label,
      ),
    );

    const card = h(
      "div",
      {
        class: "confirm-dialog__card",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-label": title,
      },
      h("h2", { class: "confirm-dialog__title" }, title),
      h("p", { class: "confirm-dialog__message" }, message),
      h("div", { class: "confirm-dialog__actions" }, ...buttons),
    );

    const backdrop = h(
      "div",
      {
        class: "confirm-dialog is-open",
        onclick: (e: Event) => {
          if (e.target === backdrop) finish(dismissId);
        },
      },
      card,
    ) as HTMLDivElement;

    document.body.appendChild(backdrop);
    window.addEventListener("keydown", onKey, true);
    (buttons[0] as HTMLButtonElement | undefined)?.focus();
  });
}
