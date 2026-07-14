import {
  BranchInfo,
  CommitInfo,
  DiffFile,
  StashInfo,
  StatusResult,
} from "./types";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const now = Math.floor(Date.now() / 1000);

const status: StatusResult = {
  branch: "feature/PROJ-2358-dev",
  upstream: "origin/feature/PROJ-2358-dev",
  ahead: 2,
  behind: 1,
  oid: "a1b2c3d4",
  merging: false,
  rebasing: false,
  cherry_picking: false,
  files: [
    { path: "src/public/admin/index.js", orig_path: null, index_status: ".", worktree_status: "M", staged: false, unstaged: true, conflicted: false, untracked: false },
    { path: "src/public/portal/index.js", orig_path: null, index_status: "M", worktree_status: ".", staged: true, unstaged: false, conflicted: false, untracked: false },
    { path: "src/services/invoice.service.js", orig_path: null, index_status: ".", worktree_status: "M", staged: false, unstaged: true, conflicted: false, untracked: false },
    { path: "src/config/routes.js", orig_path: null, index_status: "A", worktree_status: ".", staged: true, unstaged: false, conflicted: false, untracked: false },
    { path: "docs/CHANGELOG.md", orig_path: null, index_status: ".", worktree_status: "?", staged: false, unstaged: true, conflicted: false, untracked: true },
    { path: "src/legacy/old.js", orig_path: null, index_status: "D", worktree_status: ".", staged: true, unstaged: false, conflicted: false, untracked: false },
  ],
};

const L = (
  name: string,
  upstream: string | null = "origin",
  current = false,
  gone = false
): BranchInfo => ({
  name,
  is_current: current,
  is_remote: false,
  upstream: upstream ? `${upstream}/${name}` : null,
  ahead: current ? 2 : 0,
  behind: current ? 1 : 0,
  gone,
  tip: "0000000",
});
const R = (name: string): BranchInfo => ({
  name,
  is_current: false,
  is_remote: true,
  upstream: null,
  ahead: 0,
  behind: 0,
  gone: false,
  tip: "0000000",
});

const branches: BranchInfo[] = [
  L("feature/PROJ-430"),
  L("feature/PROJ-1113"),
  L("feature/PROJ-1175"),
  L("feature/PROJ-1214"),
  L("feature/PROJ-1428"),
  L("feature/PROJ-1729"),
  L("feature/PROJ-2100"),
  L("feature/PROJ-2330"),
  L("feature/PROJ-2344"),
  L("feature/PROJ-2358-dev", "origin", true, true),
  L("feature/PROJ-2359", "origin", false, true),
  L("develop"),
  L("docker"),
  L("hotfix-update-tax-code-v2"),
  L("hotfix-update-time-sleep", null),
  L("master"),
  R("origin/feature/PROJ-2358-dev"),
  R("origin/develop"),
  R("origin/master"),
];

const stashes: StashInfo[] = [
  { index: 0, message: "WIP on feature/PROJ-2358-dev: adjust invoice validation", branch: "feature/PROJ-2358-dev" },
  { index: 1, message: "On develop: temp debug logs", branch: "develop" },
];

const commits: CommitInfo[] = [
  { hash: "a1b2c3d0000000000000000000000000000000a1", short: "a1b2c3d", parents: ["b2c3d40000000000000000000000000000000002"], author: "hunghd", email: "h@a.com", timestamp: now - 3600, subject: "feature/PROJ-2358: Update logic create invoice", refs: ["HEAD -> feature/PROJ-2358-dev", "origin/feature/PROJ-2358-dev"] },
  { hash: "b2c3d40000000000000000000000000000000002", short: "b2c3d4e", parents: ["c3d4e50000000000000000000000000000000003", "e5f6a70000000000000000000000000000000005"], author: "Hoang Duy Hung", email: "hung@a.com", timestamp: now - 7200, subject: "Merge branch 'feature/PROJ-2358-dev' into 'develop'", refs: ["develop"] },
  { hash: "c3d4e50000000000000000000000000000000003", short: "c3d4e5f", parents: ["d4e5f60000000000000000000000000000000004"], author: "hunghd", email: "h@a.com", timestamp: now - 9000, subject: "Add invoice routes and controller", refs: [] },
  { hash: "e5f6a70000000000000000000000000000000005", short: "e5f6a7b", parents: ["d4e5f60000000000000000000000000000000004"], author: "hunghd", email: "h@a.com", timestamp: now - 9600, subject: "Refactor tax code helper", refs: [] },
  { hash: "d4e5f60000000000000000000000000000000004", short: "d4e5f6a", parents: ["f6a7b80000000000000000000000000000000006"], author: "Hoang Duy Hung", email: "hung@a.com", timestamp: now - 12000, subject: "hotfix: update tax code v2", refs: ["master", "origin/master"] },
  { hash: "f6a7b80000000000000000000000000000000006", short: "f6a7b8c", parents: [], author: "hunghd", email: "h@a.com", timestamp: now - 886400, subject: "Initial commit", refs: [] },
];

const sampleDiff = `diff --git a/src/services/invoice.service.js b/src/services/invoice.service.js
index 83db48f..a1c2f3d 100644
--- a/src/services/invoice.service.js
+++ b/src/services/invoice.service.js
@@ -172,9 +172,12 @@ class InvoiceService {
   async createInvoice(payload) {
     const { amount, customerId } = payload;
-    if (!amount) {
-      throw new Error('amount required');
+    if (!amount || amount <= 0) {
+      throw new BadRequestError('amount must be positive');
     }
+    if (!customerId) {
+      throw new BadRequestError('customerId required');
+    }
     const invoice = await this.repo.create(payload);
     return invoice;
   }`;

const sampleCommitDiff = `diff --git a/src/config/routes.js b/src/config/routes.js
@@ -1,3 +1,7 @@
 const router = require('express').Router();
+const invoice = require('../controllers/invoice');
+
+router.post('/invoices', invoice.create);
+router.get('/invoices/:id', invoice.show);
 module.exports = router;`;

function wrap<T>(v: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), 60));
}

export const mockApi: Record<string, (...a: any[]) => Promise<any>> = {
  is_repo: () => wrap(true),
  toplevel: () => wrap("/Users/hunghd/Documents/topup-gateway"),
  get_status: () => wrap(status),
  get_diff: () => wrap(sampleDiff),
  log_graph: () => wrap(commits),
  log_branch: () => wrap(commits),
  commit_files: () =>
    wrap<DiffFile[]>([
      { path: "src/config/routes.js", status: "A" },
      { path: "src/controllers/invoice.js", status: "M" },
    ]),
  commit_file_diff: () => wrap(sampleCommitDiff),
  branch_compare_file_diff: () =>
    wrap({
      base_branch: "master",
      diff: sampleCommitDiff,
    }),
  branches: () => wrap(branches),
  remotes: () => wrap(["origin"]),
  tags: () => wrap(["v1.4.0", "v1.3.2", "v1.3.1", "v1.0.0"]),
  revert: () => wrap("mock revert"),
  commit_message: () =>
    wrap("feature/PROJ-2358: Update logic create invoice\n\nDetailed body of the commit message."),
  remove_file: () => wrap("mock rm"),
  delete_file: () => wrap(null),
  stash_list: () => wrap(stashes),
  stash_files: () =>
    wrap<DiffFile[]>([{ path: "src/public/admin/index.js", status: "M" }]),
  stash_file_diff: () => wrap(sampleDiff),
  conflict_content: () => wrap("line A\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nline B\n"),
  // Write ops are no-ops in the browser preview.
  stage: () => wrap(null),
  unstage: () => wrap(null),
  discard: () => wrap(null),
  commit: () => wrap("mock commit"),
  fetch: () => wrap("mock fetch"),
  pull: () => wrap("mock pull"),
  push: () => wrap("mock push"),
};
