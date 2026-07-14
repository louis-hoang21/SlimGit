import { CommitInfo } from "./types";

export interface GraphNode {
  commit: CommitInfo;
  row: number;
  col: number;
}

export interface GraphEdge {
  x1: number; // column of child
  y1: number; // row of child
  x2: number; // column of parent
  y2: number; // row of parent
  color: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  maxCol: number;
  rowMaxCol: number[]; // per-row: max lane index active at that row
}

/**
 * Assign each commit to a lane (column) and produce the edges connecting a
 * commit to each of its parents. Commits must arrive in --date-order.
 *
 * Lanes hold the hash they are currently "waiting for" (the next commit that
 * will occupy that lane). A commit takes the lane that was waiting for it, or a
 * new one if it is a tip; its first parent inherits that lane and extra parents
 * (merges) spawn new lanes.
 */
export function computeGraph(commits: CommitInfo[]): GraphLayout {
  const rowOf = new Map<string, number>();
  commits.forEach((c, i) => rowOf.set(c.hash, i));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const rowMaxCol: number[] = [];
  let lanes: (string | null)[] = [];
  let maxCol = 0;

  commits.forEach((c, i) => {
    // Locate (or open) this commit's lane.
    let col = lanes.indexOf(c.hash);
    if (col === -1) {
      col = lanes.indexOf(null);
      if (col === -1) {
        col = lanes.length;
        lanes.push(null);
      }
    }
    lanes[col] = c.hash;
    nodes.push({ commit: c, row: i, col });

    // Advance lanes for parents.
    const parents = c.parents;
    if (parents.length === 0) {
      lanes[col] = null;
    } else {
      const firstParentExisting = lanes.indexOf(parents[0]);
      if (firstParentExisting !== -1 && firstParentExisting !== col) {
        lanes[col] = null;
      } else {
        lanes[col] = parents[0];
      }
      for (let pi = 1; pi < parents.length; pi++) {
        const p = parents[pi];
        if (lanes.indexOf(p) === -1) {
          let free = lanes.indexOf(null);
          if (free === -1) {
            free = lanes.length;
            lanes.push(null);
          }
          lanes[free] = p;
        }
      }
    }

    // Emit edges to parents that are visible in the loaded range.
    for (const p of parents) {
      const parentRow = rowOf.get(p);
      if (parentRow === undefined) continue;
      const parentCol = lanes.indexOf(p);
      const edgeCol = parentCol === -1 ? col : parentCol;
      edges.push({
        x1: col,
        y1: i,
        x2: edgeCol,
        y2: parentRow,
        color: col % PALETTE_SIZE,
      });
    }

    // Record the rightmost active lane at this row.
    const activeMax = lanes.reduce(
      (m, v, idx) => (v !== null ? Math.max(m, idx) : m),
      col
    );
    rowMaxCol.push(activeMax);
    maxCol = Math.max(maxCol, activeMax);
  });

  return { nodes, edges, maxCol, rowMaxCol };
}

export const PALETTE_SIZE = 8;
export const GRAPH_COLORS = [
  "#4a90d9",
  "#e8710a",
  "#2e9e5b",
  "#d6455e",
  "#9b59b6",
  "#16a3a3",
  "#c9a227",
  "#7f8c8d",
];

export function laneColor(col: number): string {
  return GRAPH_COLORS[col % GRAPH_COLORS.length];
}
