// Pure helper functions shared by App.tsx and the extracted UI components.
import type { BranchInfo } from "./types";
import type { FileEntry } from "./types";
import type { BNode } from "./ui-types";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lsNum(key: string, def: number): number {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) && v > 0 ? v : def;
}

// Build a hierarchical tree from branch names, splitting on "/".
// e.g. feature/EBILL-430 → folder "feature" containing leaf "EBILL-430".
export function buildBranchTree(
  items: { label: string; branch: BranchInfo }[]
): BNode[] {
  const root: BNode = { name: "", key: "", children: [] };
  for (const { label, branch } of items) {
    const parts = label.split("/");
    let cur = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      if (i === parts.length - 1) {
        cur.children.push({ name: part, key: acc, branch, children: [] });
      } else {
        let next = cur.children.find((c) => !c.branch && c.name === part);
        if (!next) {
          next = { name: part, key: acc, children: [] };
          cur.children.push(next);
        }
        cur = next;
      }
    });
  }
  return root.children;
}

export function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
export function baseOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

export function workingState(f: FileEntry): string {
  if (f.conflicted) return "Conflicted";
  if (f.untracked) return "Untracked";
  const code = f.unstaged ? f.worktree_status : f.index_status;
  const map: Record<string, string> = {
    M: "Modified",
    A: "Added",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    T: "Modified",
  };
  return map[code] ?? "Modified";
}
export function commitState(status: string): string {
  const map: Record<string, string> = {
    M: "Modified",
    A: "Added",
    D: "Deleted",
    R: "Renamed",
    C: "Copied",
    T: "Modified",
  };
  return map[status[0]] ?? "Modified";
}
