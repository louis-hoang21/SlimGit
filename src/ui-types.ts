// Shared UI-only types (not part of the Rust/Tauri command contracts in
// ./types.ts). Kept separate so components can import just the shapes they
// render without pulling in App's state.
import type { BranchInfo } from "./types";

export type BadgeColor = "yellow" | "red" | "purple" | "green" | "blue";

export interface RepoRef {
  path: string;
  name: string;
  branch: string;
}

export interface MenuItem {
  label?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  sep?: boolean;
  run?: () => void;
}

export interface Menu {
  x: number;
  y: number;
  items: MenuItem[];
}

// A unified row for the Files table (works for both working copy and commits).
export interface Row {
  path: string;
  orig?: string | null;
  state: string;
  staged: boolean;
  conflicted: boolean;
  untracked: boolean;
}

// A node in the branch tree: either a folder (children, no branch) or a leaf.
export interface BNode {
  name: string;
  key: string;
  branch?: BranchInfo;
  children: BNode[];
}
