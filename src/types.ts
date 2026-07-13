export interface FileEntry {
  path: string;
  orig_path: string | null;
  index_status: string;
  worktree_status: string;
  staged: boolean;
  unstaged: boolean;
  conflicted: boolean;
  untracked: boolean;
}

export interface StatusResult {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  oid: string;
  files: FileEntry[];
  merging: boolean;
  rebasing: boolean;
  cherry_picking: boolean;
}

export interface CommitInfo {
  hash: string;
  short: string;
  parents: string[];
  author: string;
  email: string;
  timestamp: number;
  subject: string;
  refs: string[];
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  gone: boolean;
  tip: string;
}

export interface StashInfo {
  index: number;
  message: string;
  branch: string;
}

export interface DiffFile {
  path: string;
  status: string;
}

export interface BranchCompareDiff {
  base_branch: string;
  diff: string;
}
