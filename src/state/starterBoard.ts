import { generatedGraphToBoard } from "./generatedGraph";

/** Default diagram for first-time users with no saved boards. */
export function createStarterBoard() {
  return generatedGraphToBoard(
    {
      name: "Untitled board",
      nodes: [
        { id: "hello", label: "hello", kind: "rect" },
        { id: "world", label: "world", kind: "rect" },
      ],
      edges: [{ from: "hello", to: "world", directed: true }],
    },
    "Untitled board",
  );
}
