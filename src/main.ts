import "./styles.css";
import { loadBoardById } from "./persistence/db";
import { decodeBoard } from "./persistence/share";
import { mountDashboard } from "./ui/dashboard";
import { mountEditor, type MountedView } from "./ui/editor";

const app = document.getElementById("app") as HTMLElement;

let current: MountedView | null = null;
let rendering = false;
let pendingRerender = false;

async function render(): Promise<void> {
  if (rendering) {
    pendingRerender = true;
    return;
  }
  rendering = true;

  if (current) {
    current.destroy();
    current = null;
  }

  try {
    const url = new URL(location.href);
    const sharedCode = url.searchParams.get("b");
    if (sharedCode) {
      const board = decodeBoard(sharedCode);
      // strip the (huge) query string but keep the route
      history.replaceState(null, "", location.pathname + (location.hash || "#/"));
      if (board) {
        current = await mountEditor(app, board, { shared: true });
        return;
      }
    }

    const hash = location.hash.replace(/^#/, "");
    const match = hash.match(/^\/board\/(.+)$/);
    if (match) {
      const board = await loadBoardById(decodeURIComponent(match[1]));
      if (board) {
        current = await mountEditor(app, board, {});
        return;
      }
      location.hash = "#/";
      return;
    }

    current = await mountDashboard(app);
  } finally {
    rendering = false;
    if (pendingRerender) {
      pendingRerender = false;
      void render();
    }
  }
}

window.addEventListener("hashchange", () => void render());
void render();
