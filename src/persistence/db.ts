import { del, get, set } from "idb-keyval";
import type { Board, BoardMeta, ID } from "../state/types";

const INDEX_KEY = "sketchlab:index";
const boardKey = (id: ID) => `sketchlab:board:${id}`;

export async function listBoards(): Promise<BoardMeta[]> {
  const index = (await get<BoardMeta[]>(INDEX_KEY)) ?? [];
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadBoardById(id: ID): Promise<Board | undefined> {
  return get<Board>(boardKey(id));
}

export async function saveBoard(board: Board, thumbnail?: string): Promise<void> {
  board.updatedAt = Date.now();
  await set(boardKey(board.id), board);
  const index = (await get<BoardMeta[]>(INDEX_KEY)) ?? [];
  const meta: BoardMeta = {
    id: board.id,
    name: board.name,
    updatedAt: board.updatedAt,
    shapeCount: Object.keys(board.shapes).length,
    thumbnail,
  };
  const i = index.findIndex((m) => m.id === board.id);
  if (i >= 0) {
    if (thumbnail === undefined) meta.thumbnail = index[i].thumbnail;
    index[i] = meta;
  } else {
    index.push(meta);
  }
  await set(INDEX_KEY, index);
}

export async function deleteBoard(id: ID): Promise<void> {
  await del(boardKey(id));
  const index = (await get<BoardMeta[]>(INDEX_KEY)) ?? [];
  await set(
    INDEX_KEY,
    index.filter((m) => m.id !== id),
  );
}
