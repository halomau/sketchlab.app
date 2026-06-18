import { scene } from "../render/scene";
import { $revision, doc } from "../state/store";
import { debounce } from "../util";
import { saveBoard } from "./db";

let unsub: (() => void) | null = null;

const flush = debounce(() => {
  void saveBoard(doc.board, scene.exportThumbnail());
}, 600);

/** Persist the active board ~600ms after the last edit. */
export function startAutosave(): void {
  if (unsub) return;
  let first = true;
  unsub = $revision.subscribe(() => {
    if (first) {
      first = false;
      return; // skip the immediate fire on subscribe
    }
    flush();
  });
}

export function stopAutosave(): void {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

export async function saveNow(): Promise<void> {
  await saveBoard(doc.board, scene.exportThumbnail());
}
