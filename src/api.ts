import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  BranchCompareDiff,
  BranchInfo,
  CommitInfo,
  DiffFile,
  StashInfo,
  StatusResult,
} from "./types";
import { isTauri, mockApi } from "./mock";

// Route through Tauri when available, otherwise the browser preview mock.
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) return tauriInvoke<T>(cmd, args);
  const fn = mockApi[cmd];
  return (fn ? fn(args) : Promise.resolve(null)) as Promise<T>;
}

export const api = {
  isRepo: (path: string) => invoke<boolean>("is_repo", { path }),
  toplevel: (path: string) => invoke<string>("toplevel", { path }),
  findReposInDir: (path: string) => invoke<string[]>("find_repos_in_dir", { path }),
  status: (repo: string) => invoke<StatusResult>("get_status", { repo }),
  diff: (repo: string, path: string, staged: boolean, untracked: boolean) =>
    invoke<string>("get_diff", { repo, path, staged, untracked }),

  stage: (repo: string, paths: string[]) => invoke("stage", { repo, paths }),
  stageAll: (repo: string) => invoke("stage_all", { repo }),
  unstage: (repo: string, paths: string[]) => invoke("unstage", { repo, paths }),
  unstageAll: (repo: string) => invoke("unstage_all", { repo }),
  discard: (repo: string, paths: string[], untracked: boolean) =>
    invoke("discard", { repo, paths, untracked }),
  removeFile: (repo: string, paths: string[], cached: boolean) =>
    invoke<string>("remove_file", { repo, paths, cached }),
  deleteFile: (repo: string, paths: string[]) =>
    invoke("delete_file", { repo, paths }),
  commit: (repo: string, message: string, amend: boolean) =>
    invoke<string>("commit", { repo, message, amend }),

  logGraph: (repo: string, limit: number, all: boolean, firstParent = false) =>
    invoke<CommitInfo[]>("log_graph", { repo, limit, all, firstParent }),
  logBranch: (repo: string, branch: string, limit: number) =>
    invoke<CommitInfo[]>("log_branch", { repo, branch, limit }),
  commitFiles: (repo: string, hash: string) =>
    invoke<DiffFile[]>("commit_files", { repo, hash }),
  commitFileDiff: (repo: string, hash: string, path: string) =>
    invoke<string>("commit_file_diff", { repo, hash, path }),
  branchCompareFileDiff: (repo: string, path: string) =>
    invoke<BranchCompareDiff>("branch_compare_file_diff", { repo, path }),

  branches: (repo: string) => invoke<BranchInfo[]>("branches", { repo }),
  checkout: (repo: string, branch: string, force = false) =>
    invoke<string>("checkout", { repo, branch, force }),
  checkoutRemote: (repo: string, remoteBranch: string, local: string) =>
    invoke<string>("checkout_remote", { repo, remoteBranch, local }),
  createBranch: (repo: string, name: string, checkout: boolean) =>
    invoke<string>("create_branch", { repo, name, checkout }),
  deleteBranch: (repo: string, name: string, force: boolean) =>
    invoke<string>("delete_branch", { repo, name, force }),
  remotes: (repo: string) => invoke<string[]>("remotes", { repo }),
  tags: (repo: string) => invoke<string[]>("tags", { repo }),

  fetch: (repo: string) => invoke<string>("fetch", { repo }),
  pull: (repo: string) => invoke<string>("pull", { repo }),
  push: (
    repo: string,
    remote: string,
    branch: string,
    force: boolean,
    setUpstream: boolean
  ) => invoke<string>("push", { repo, remote, branch, force, setUpstream }),

  merge: (repo: string, branch: string, noFf: boolean) =>
    invoke<string>("merge", { repo, branch, noFf }),
  mergeAbort: (repo: string) => invoke<string>("merge_abort", { repo }),
  cherryPick: (repo: string, hash: string) =>
    invoke<string>("cherry_pick", { repo, hash }),
  revert: (repo: string, hash: string) =>
    invoke<string>("revert", { repo, hash }),
  commitMessage: (repo: string, hash: string) =>
    invoke<string>("commit_message", { repo, hash }),
  cherryPickAbort: (repo: string) => invoke<string>("cherry_pick_abort", { repo }),
  cherryPickContinue: (repo: string) =>
    invoke<string>("cherry_pick_continue", { repo }),
  rebase: (repo: string, onto: string) => invoke<string>("rebase", { repo, onto }),
  rebaseAbort: (repo: string) => invoke<string>("rebase_abort", { repo }),
  rebaseContinue: (repo: string) => invoke<string>("rebase_continue", { repo }),

  stashList: (repo: string) => invoke<StashInfo[]>("stash_list", { repo }),
  stashSave: (repo: string, message: string, includeUntracked: boolean) =>
    invoke<string>("stash_save", { repo, message, includeUntracked }),
  stashSavePaths: (repo: string, message: string, paths: string[]) =>
    invoke<string>("stash_save_paths", { repo, message, paths }),
  stashPop: (repo: string, index: number) =>
    invoke<string>("stash_pop", { repo, index }),
  stashApply: (repo: string, index: number) =>
    invoke<string>("stash_apply", { repo, index }),
  stashDrop: (repo: string, index: number) =>
    invoke<string>("stash_drop", { repo, index }),
  stashFiles: (repo: string, index: number) =>
    invoke<DiffFile[]>("stash_files", { repo, index }),
  stashFileDiff: (repo: string, index: number, path: string) =>
    invoke<string>("stash_file_diff", { repo, index, path }),

  conflictContent: (repo: string, path: string) =>
    invoke<string>("conflict_content", { repo, path }),
  saveFile: (repo: string, path: string, content: string) =>
    invoke("save_file", { repo, path, content }),
  resolveConflict: (repo: string, path: string, side: "ours" | "theirs") =>
    invoke<string>("resolve_conflict", { repo, path, side }),
  markResolved: (repo: string, paths: string[]) =>
    invoke("mark_resolved", { repo, paths }),

  reset: (repo: string, hash: string, mode: "soft" | "mixed" | "hard") =>
    invoke<string>("reset", { repo, hash, mode }),
  renameBranch: (repo: string, oldName: string, newName: string) =>
    invoke<string>("rename_branch", { repo, old: oldName, new: newName }),
  createTag: (repo: string, name: string, hash: string, message: string) =>
    invoke<string>("create_tag", { repo, name, hash, message }),
  deleteTag: (repo: string, name: string) =>
    invoke<string>("delete_tag", { repo, name }),
  pushTag: (repo: string, remote: string, name: string) =>
    invoke<string>("push_tag", { repo, remote, name }),
  cloneRepo: (url: string, dest: string) =>
    invoke<string>("clone_repo", { url, dest }),

  // Remote management
  remotesVerbose: (repo: string) =>
    invoke<{ name: string; url: string }[]>("remotes_verbose", { repo }),
  remoteAdd: (repo: string, name: string, url: string) =>
    invoke<string>("remote_add", { repo, name, url }),
  remoteRemove: (repo: string, name: string) =>
    invoke<string>("remote_remove", { repo, name }),
  remoteRename: (repo: string, oldName: string, newName: string) =>
    invoke<string>("remote_rename", { repo, old: oldName, new: newName }),
  remoteSetUrl: (repo: string, name: string, url: string) =>
    invoke<string>("remote_set_url", { repo, name, url }),

  // Reflog / clean / config
  reflog: (repo: string, limit: number) =>
    invoke<{ selector: string; hash: string; short: string; subject: string }[]>(
      "reflog",
      { repo, limit }
    ),
  cleanPreview: (repo: string) => invoke<string[]>("clean_preview", { repo }),
  clean: (repo: string, includeIgnored: boolean) =>
    invoke<string>("clean", { repo, includeIgnored }),
  getConfig: (repo: string, key: string) =>
    invoke<string>("get_config", { repo, key }),
  getConfigEffective: (repo: string, key: string) =>
    invoke<string>("get_config_effective", { repo, key }),
  setConfig: (repo: string, key: string, value: string) =>
    invoke<string>("set_config", { repo, key, value }),

  // Reword / pull options / branch-from-stash
  rewordHead: (repo: string, message: string) =>
    invoke<string>("reword_head", { repo, message }),
  pullOpts: (repo: string, rebase: boolean) =>
    invoke<string>("pull_opts", { repo, rebase }),
  fetchRemote: (repo: string, remote: string) =>
    invoke<string>("fetch_remote", { repo, remote }),
  stashBranch: (repo: string, name: string, index: number) =>
    invoke<string>("stash_branch", { repo, name, index }),

  // File history / compare / search
  logFile: (repo: string, path: string, limit: number) =>
    invoke<CommitInfo[]>("log_file", { repo, path, limit }),
  compareFiles: (repo: string, from: string, to: string) =>
    invoke<DiffFile[]>("compare_files", { repo, from, to }),
  compareFileDiff: (repo: string, from: string, to: string, path: string) =>
    invoke<string>("compare_file_diff", { repo, from, to, path }),
  logSearch: (
    repo: string,
    author: string,
    grep: string,
    pickaxe: string,
    limit: number,
    all: boolean
  ) => invoke<CommitInfo[]>("log_search", { repo, author, grep, pickaxe, limit, all }),

  // Partial (hunk) staging
  stageHunk: (repo: string, patch: string) =>
    invoke<string>("stage_hunk", { repo, patch }),
  unstageHunk: (repo: string, patch: string) =>
    invoke<string>("unstage_hunk", { repo, patch }),
  discardHunk: (repo: string, patch: string) =>
    invoke<string>("discard_hunk", { repo, patch }),

  // Interactive rebase (scripted)
  rewordCommit: (repo: string, hash: string, message: string) =>
    invoke<string>("reword_commit", { repo, hash, message }),
  dropCommit: (repo: string, hash: string) =>
    invoke<string>("drop_commit", { repo, hash }),
  squashCommit: (repo: string, hash: string) =>
    invoke<string>("squash_commit", { repo, hash }),
};
