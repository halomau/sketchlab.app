import { deleteBoard, listBoards, saveBoard } from "../persistence/db";
import { emptyBoard } from "../state/store";
import type { BoardMeta } from "../state/types";
import type { MountedView } from "./editor";
import { clear, h } from "./dom";
import { navigate } from "./nav";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const min = 60_000;
  if (diff < min) return "just now";
  if (diff < 60 * min) return `${Math.round(diff / min)}m ago`;
  if (diff < 24 * 60 * min) return `${Math.round(diff / (60 * min))}h ago`;
  return d.toLocaleDateString();
}

export async function mountDashboard(appRoot: HTMLElement): Promise<MountedView> {
  clear(appRoot);

  const newBtn = h(
    "button",
    { class: "btn btn--accent", onclick: () => createBoard() },
    "+ New board",
  );

  const header = h(
    "header",
    { class: "dash__header" },
    h(
      "div",
      { class: "dash__brand" },
      h("span", { class: "dash__logo" }),
      h("h1", null, "Sketch Lab"),
    ),
    newBtn,
  );

  const grid = h("div", { class: "dash__grid" });
  const root = h("div", { class: "dash" }, header, grid);
  appRoot.appendChild(root);

  async function createBoard(): Promise<void> {
    const board = emptyBoard("Untitled board");
    await saveBoard(board);
    navigate(`#/board/${board.id}`);
  }

  async function refresh(): Promise<void> {
    const boards = await listBoards();
    clear(grid);
    if (boards.length === 0) {
      grid.appendChild(
        h(
          "div",
          { class: "dash__empty" },
          h("p", null, "No boards yet."),
          h(
            "button",
            { class: "btn btn--accent", onclick: () => createBoard() },
            "Create your first board",
          ),
        ),
      );
      return;
    }
    for (const meta of boards) grid.appendChild(card(meta));
  }

  function card(meta: BoardMeta): HTMLElement {
    const thumb = meta.thumbnail
      ? h("img", { class: "card__thumb", src: meta.thumbnail, alt: "" })
      : h("div", { class: "card__thumb card__thumb--empty" }, "✎");

    const del = h(
      "button",
      {
        class: "card__delete",
        title: "Delete board",
        onclick: async (e: Event) => {
          e.stopPropagation();
          if (confirm(`Delete "${meta.name}"? This cannot be undone.`)) {
            await deleteBoard(meta.id);
            await refresh();
          }
        },
      },
      "🗑",
    );

    return h(
      "div",
      { class: "card", onclick: () => navigate(`#/board/${meta.id}`) },
      thumb,
      del,
      h(
        "div",
        { class: "card__meta" },
        h("div", { class: "card__name" }, meta.name),
        h(
          "div",
          { class: "card__sub" },
          `${meta.shapeCount} shape${meta.shapeCount === 1 ? "" : "s"} · ${formatDate(meta.updatedAt)}`,
        ),
      ),
    );
  }

  void refresh();

  return {
    destroy() {
      clear(appRoot);
    },
  };
}
