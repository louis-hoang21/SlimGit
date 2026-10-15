import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { api } from "./api";
import { BranchInfo, CommitInfo, DiffFile, StashInfo, StatusResult } from "./types";
import Toolbar from "./components/Toolbar";
import Main from "./components/Main";
import StatusBar from "./components/StatusBar";
import ContextMenu from "./components/common/ContextMenu";
import CommitModal from "./components/CommitModal";
import CheckoutConfirmation from "./components/CheckoutConfirmation";
import LogsPanel from "./components/LogsPanel";
import WelcomeScreen from "./components/WelcomeScreen";
import Toast from "./components/common/Toast";
import { ConfirmDialog, InputDialog } from "./components/common/Dialog";
import RemotesDialog from "./components/dialogs/RemotesDialog";
import RepoSettingsDialog from "./components/dialogs/RepoSettingsDialog";
import CleanDialog from "./components/dialogs/CleanDialog";
import ReflogPanel from "./components/ReflogPanel";
import FileHistoryModal from "./components/FileHistoryModal";
import CompareModal from "./components/CompareModal";
import type { HunkAction } from "./components/DiffView";
import { isTauri } from "./mock";
import { Play, Cloud, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { BNode, Menu, MenuItem, RepoRef, Row } from "./ui-types";
import {
  baseOf,
  buildBranchTree,
  clamp,
  commitState,
  dirOf,
  lsNum,
  workingState,
} from "./utils";

export default function App() {
  // The repository list is persisted across app launches; the active repo is
  // restored only after we confirm it's still a valid git repo (see the
  // "Restore last session" effect below).
  const [repos, setRepos] = useState<RepoRef[]>(() => {
    try {
      const s = localStorage.getItem("slimgit-repos");
      if (s) return JSON.parse(s);
    } catch {
      /* ignore */
    }
    return [];
  });
  const [repoSort, setRepoSort] = useState<import("./ui-types").RepoSortKey>(
    () => (localStorage.getItem("slimgit-repo-sort") as import("./ui-types").RepoSortKey) ?? "name"
  );
  const [repo, setRepo] = useState<string | null>(null);
  // git user.email of the active repo, shown in the status bar as "email — path".
  const [repoEmail, setRepoEmail] = useState("");

  // Custom display labels for repository groups (folders), keyed by the
  // derived parent path. Persisted so renames survive relaunch.
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>(() => {
    try {
      const s = localStorage.getItem("slimgit-group-labels");
      if (s) return JSON.parse(s);
    } catch {
      /* ignore */
    }
    return {};
  });

  const [status, setStatus] = useState<StatusResult | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [remotes, setRemotes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Journal selection drives the Files panel: null = working tree.
  const [journalSel, setJournalSel] = useState<string | null>(null);
  const [stashSel, setStashSel] = useState<number | null>(null);

  // Files panel state
  const [commitDiffFiles, setCommitDiffFiles] = useState<DiffFile[]>([]);
  const [stashDiffFiles, setStashDiffFiles] = useState<DiffFile[]>([]);
  const [selPath, setSelPath] = useState<string | null>(null);
  const [selPaths, setSelPaths] = useState<string[]>([]);

  // Changes panel
  const [diffText, setDiffText] = useState("");
  const [conflictFile, setConflictFile] = useState<string | null>(null);
  // Right pane: current branch compared against the branch it was forked from.
  const [compareDiff, setCompareDiff] = useState("");
  const [compareBase, setCompareBase] = useState<string | null>(null);

  // Logs panel
  const [showLogs, setShowLogs] = useState(false);

  // SmartGit-style auxiliary dialogs / panels
  const [showRemotes, setShowRemotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClean, setShowClean] = useState(false);
  const [showReflog, setShowReflog] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);

  // Commit modal
  const [showCommit, setShowCommit] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [amend, setAmend] = useState(false);

  // Checkout confirmation
  const [checkoutTarget, setCheckoutTarget] = useState<BranchInfo | null>(null);

  // Search boxes
  const [fileQuery, setFileQuery] = useState("");
  const [journalQuery, setJournalQuery] = useState("");

  const [menu, setMenu] = useState<Menu | null>(null);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Generic dialog helpers
  type DialogState =
    | { type: "confirm"; message: string; danger?: boolean; confirmLabel?: string; onConfirm: () => void }
    | { type: "input"; title: string; placeholder?: string; defaultValue?: string; confirmLabel?: string; onConfirm: (v: string) => void }
    | null;
  const [dialog, setDialog] = useState<DialogState>(null);
  const closeDialog = () => setDialog(null);

  function confirm(message: string, danger: boolean, confirmLabel: string, onConfirm: () => void) {
    setDialog({ type: "confirm", message, danger, confirmLabel, onConfirm });
  }
  function prompt(title: string, placeholder: string, onConfirm: (v: string) => void, defaultValue = "") {
    setDialog({ type: "input", title, placeholder, defaultValue, onConfirm });
  }

  // Collapsible state for the branch tree folders and top-level groups
  // (Local Branches, each remote, Tags, Stashes). Persisted across launches.
  const loadStringSet = (key: string): Set<string> => {
    try {
      const s = localStorage.getItem(key);
      if (s) return new Set(JSON.parse(s));
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() =>
    loadStringSet("slimgit-collapsed-folders")
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    loadStringSet("slimgit-collapsed-groups")
  );
  const toggleFolder = (k: string) =>
    setCollapsedFolders((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const toggleGroup = (k: string) =>
    setCollapsedGroups((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  useEffect(() => {
    localStorage.setItem(
      "slimgit-collapsed-folders",
      JSON.stringify([...collapsedFolders])
    );
  }, [collapsedFolders]);
  useEffect(() => {
    localStorage.setItem(
      "slimgit-collapsed-groups",
      JSON.stringify([...collapsedGroups])
    );
  }, [collapsedGroups]);

  // Theme
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("slimgit-theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [themeIsManual, setThemeIsManual] = useState<boolean>(() =>
    Boolean(localStorage.getItem("slimgit-theme"))
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (themeIsManual) localStorage.setItem("slimgit-theme", dark ? "dark" : "light");
  }, [dark, themeIsManual]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const syncSystemTheme = (e: MediaQueryListEvent) => {
      if (!themeIsManual) setDark(e.matches);
    };
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [themeIsManual]);

  // Resizable panels & columns (persisted across sessions)
  const [filesH, setFilesH] = useState(() => lsNum("slimgit-filesH", 200));
  const [journalH, setJournalH] = useState(() => lsNum("slimgit-journalH", 260));
  const [colW, setColW] = useState<{ name: number; state: number }>(() => {
    try {
      const s = localStorage.getItem("slimgit-colW");
      if (s) return JSON.parse(s);
    } catch {
      /* ignore */
    }
    return { name: 360, state: 130 };
  });
  useEffect(() => {
    localStorage.setItem("slimgit-filesH", String(filesH));
  }, [filesH]);
  useEffect(() => {
    localStorage.setItem("slimgit-journalH", String(journalH));
  }, [journalH]);
  useEffect(() => {
    localStorage.setItem("slimgit-colW", JSON.stringify(colW));
  }, [colW]);
  const dragRef = useRef<
    | { type: "v"; kind: "files" | "journal"; startY: number; startH: number }
    | { type: "col"; col: "name" | "state"; startX: number; startW: number }
    | null
  >(null);
  const menuHandlerRef = useRef<(id: string) => void>(() => {});

  const onDrag = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.type === "v") {
      const delta = e.clientY - d.startY;
      if (d.kind === "files") setFilesH(clamp(d.startH + delta, 90, 520));
      else setJournalH(clamp(d.startH - delta, 90, 640));
    } else {
      const delta = e.clientX - d.startX;
      setColW((prev) => ({ ...prev, [d.col]: clamp(d.startW + delta, 70, 760) }));
    }
  }, []);
  const endDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
  }, [onDrag]);
  const startVDrag = useCallback(
    (e: React.MouseEvent, kind: "files" | "journal") => {
      e.preventDefault();
      dragRef.current = {
        type: "v",
        kind,
        startY: e.clientY,
        startH: kind === "files" ? filesH : journalH,
      };
      document.body.style.cursor = "row-resize";
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", endDrag);
    },
    [filesH, journalH, onDrag, endDrag]
  );
  const startColDrag = useCallback(
    (e: React.MouseEvent, col: "name" | "state") => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        type: "col",
        col,
        startX: e.clientX,
        startW: colW[col],
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onDrag);
      window.addEventListener("mouseup", endDrag);
    },
    [colW, onDrag, endDrag]
  );

  const notify = useCallback((msg: string, err = false) => {
    setToast({ msg: msg.trim() || (err ? "Error" : "Done"), err });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg?: string) => {
      setBusy(true);
      try {
        const out = (await fn()) as string | undefined;
        if (okMsg !== undefined)
          notify(okMsg || (typeof out === "string" ? out : ""));
        return true;
      } catch (e) {
        notify(String(e), true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [notify]
  );

  const refreshStatus = useCallback(async () => {
    if (!repo) return;
    try {
      const s = await api.status(repo);
      setStatus(s);
      // Keep the Repositories tree branch label fresh on light refreshes too.
      setRepos((prev) =>
        prev.map((p) => (p.path === repo && p.branch !== s.branch ? { ...p, branch: s.branch } : p))
      );
    } catch (e) {
      notify(String(e), true);
    }
  }, [repo, notify]);

  const refreshAll = useCallback(async () => {
    if (!repo) return;
    try {
      const [s, b, st, r, tg, log] = await Promise.all([
        api.status(repo),
        api.branches(repo),
        api.stashList(repo),
        api.remotes(repo),
        api.tags(repo),
        // Journal shows the current branch's own first-parent history (like the
        // SmartGit journal): just the commits on this branch, no ref expansion.
        api.logGraph(repo, 500, false, true),
      ]);
      setStatus(s);
      setBranches(b);
      setStashes(st);
      setRemotes(r);
      setTags(tg);
      setCommits(log);
      // Keep the Repositories tree branch label fresh.
      setRepos((prev) =>
        prev.map((p) => (p.path === repo ? { ...p, branch: s.branch } : p))
      );
    } catch (e) {
      notify(String(e), true);
    }
  }, [repo, notify]);

  useEffect(() => {
    if (repo) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  // Load the repo's git user.email (refreshed when the settings dialog closes).
  useEffect(() => {
    if (!repo) { setRepoEmail(""); return; }
    // Effective email: repo-local overrides global, so repos without a local
    // user.email still show the global identity they commit with.
    api.getConfigEffective(repo, "user.email").then(setRepoEmail).catch(() => setRepoEmail(""));
  }, [repo, showSettings]);

  // Pick up changes made outside the app (e.g. `git checkout` in a terminal):
  // refresh when the window regains focus or becomes visible, and poll lightly
  // while focused so branch/status stay close to live.
  useEffect(() => {
    if (!repo) return;
    const onFocus = () => refreshAll();
    const onVisible = () => { if (document.visibilityState === "visible") refreshAll(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) refreshStatus();
    }, 3000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
    };
  }, [repo, refreshAll, refreshStatus]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Native menu-bar clicks (Tauri) are forwarded here as "menu" events.
  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | undefined;
    listen<string>("menu", (e) => menuHandlerRef.current(e.payload)).then(
      (f) => (un = f)
    );
    return () => un?.();
  }, []);

  // Browser preview: seed a sample repo so the layout is visible without Tauri.
  useEffect(() => {
    if (isTauri || repos.length) return;
    (async () => {
      const top = await api.toplevel("");
      setRepos([{ path: top, name: baseOf(top), branch: "feature/EBILL-2358-dev" }]);
      setRepo(top);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore last session: drop any repos that no longer exist / aren't git
  // repos anymore, then jump straight back into the last active one (only if
  // it's still valid) instead of showing the Welcome screen.
  useEffect(() => {
    if (!repos.length) return;
    (async () => {
      const checks = await Promise.all(
        repos.map(async (r) => ((await api.isRepo(r.path).catch(() => false)) ? r : null))
      );
      const valid = checks.filter((r): r is RepoRef => r !== null);
      if (valid.length !== repos.length) setRepos(valid);
      // A window opened via "Open in New Window" carries ?repo=<path>.
      const paramRepo = new URLSearchParams(window.location.search).get("repo");
      const lastActive = localStorage.getItem("slimgit-active-repo");
      const target =
        (paramRepo && valid.find((r) => r.path === paramRepo)) ||
        valid.find((r) => r.path === lastActive) ||
        valid[0];
      if (target) setRepo(target.path);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the repo list and the active repo so the next launch can restore
  // this session (see the restore effect above).
  useEffect(() => {
    localStorage.setItem("slimgit-repos", JSON.stringify(repos));
  }, [repos]);
  useEffect(() => {
    if (repo) localStorage.setItem("slimgit-active-repo", repo);
  }, [repo]);
  useEffect(() => {
    localStorage.setItem("slimgit-repo-sort", repoSort);
  }, [repoSort]);

  useEffect(() => {
    localStorage.setItem("slimgit-group-labels", JSON.stringify(groupLabels));
  }, [groupLabels]);

  async function openRepo() {
    const selected = await open({ directory: true, multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    const addRepo = async (top: string) => {
      const s = await api.status(top).catch(() => null);
      const ref: RepoRef = {
        path: top,
        name: baseOf(top),
        branch: s?.branch ?? "",
        addedAt: Date.now(),
      };
      setRepos((prev) =>
        prev.some((p) => p.path === top) ? prev : [...prev, ref]
      );
      return top;
    };

    const added: string[] = [];
    for (const p of paths) {
      if (await api.isRepo(p)) {
        const top = await api.toplevel(p);
        const result = await addRepo(top);
        added.push(result);
      } else {
        // Scan direct children for git repos (parent folder case)
        const children = await api.findReposInDir(p);
        if (children.length === 0) {
          notify(`No git repositories found in ${baseOf(p)}`, true);
        } else {
          for (const child of children) {
            await addRepo(child);
            added.push(child);
          }
        }
      }
    }

    if (added.length > 0) switchRepo(added[added.length - 1]);
  }

  // Clone a remote repo: ask URL, pick a destination parent folder, then open it.
  function cloneRepo() {
    prompt("Clone — repository URL", "https://github.com/user/repo.git", async (url) => {
      closeDialog();
      const u = url.trim();
      if (!u) return;
      const parent = await open({ directory: true, multiple: false, title: "Destination folder" });
      if (!parent || Array.isArray(parent)) return;
      const name = (u.split("/").pop() ?? "repo").replace(/\.git$/, "");
      const dest = `${parent}/${name}`;
      const ok = await run(() => api.cloneRepo(u, dest), `Cloned ${name}`);
      if (!ok) return;
      const top = await api.toplevel(dest).catch(() => dest);
      const s = await api.status(top).catch(() => null);
      setRepos((prev) =>
        prev.some((p) => p.path === top)
          ? prev
          : [...prev, { path: top, name: baseOf(top), branch: s?.branch ?? "", addedAt: Date.now() }]
      );
      switchRepo(top);
    });
  }

  // Open a repo in a separate native window (falls back to a browser tab in preview).
  async function openRepoInNewWindow(path: string) {
    const url = `index.html?repo=${encodeURIComponent(path)}`;
    const title = baseOf(path);
    if (isTauri) {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        new WebviewWindow(`repo-${Date.now()}`, { url, title, width: 1200, height: 820 });
      } catch (e) {
        notify(String(e), true);
      }
    } else {
      window.open(url, "_blank");
    }
  }

  // Rename a repo's display label in the list (does not touch git).
  function renameRepoEntry(path: string) {
    const cur = repos.find((r) => r.path === path);
    prompt("Rename repository", cur?.name ?? "", async (name) => {
      closeDialog();
      const n = name.trim();
      if (!n) return;
      setRepos((prev) => prev.map((r) => (r.path === path ? { ...r, name: n } : r)));
    }, cur?.name ?? "");
  }

  // Rename a repository group's display label (folder header).
  function renameGroup(parent: string) {
    prompt("Rename group", groupLabels[parent] ?? parent, async (name) => {
      closeDialog();
      const n = name.trim();
      setGroupLabels((prev) => {
        const next = { ...prev };
        if (!n || n === parent) delete next[parent];
        else next[parent] = n;
        return next;
      });
    }, groupLabels[parent] ?? parent);
  }

  // Open the Log window for a repo (switches to it first if needed).
  function openRepoLog(path: string) {
    if (repo !== path) switchRepo(path);
    setShowLogs(true);
  }

  // Remove one or more repos in a single update. Removing them one by one
  // (e.g. "Remove All from List" on a folder) read a stale `repos`/`repo` and
  // could make another just-removed repo the active one, leaving its branches
  // and journal on screen.
  function removeRepos(paths: string[]) {
    const gone = new Set(paths);
    const remaining = repos.filter((r) => !gone.has(r.path));
    setRepos(remaining);
    if (repo && gone.has(repo)) {
      if (remaining.length > 0) {
        switchRepo(remaining[0].path);
      } else {
        resetSelection();
        setRepo(null);
        setStatus(null);
        setBranches([]);
        setStashes([]);
        setCommits([]);
        setRemotes([]);
        setTags([]);
      }
    }
  }

  function resetSelection() {
    setJournalSel(null);
    setStashSel(null);
    setSelPath(null);
    setSelPaths([]);
    setConflictFile(null);
    setDiffText("");
    setCompareDiff("");
    setCompareBase(null);
  }

  function switchRepo(path: string) {
    resetSelection();
    setRepos((prev) =>
      prev.map((r) => (r.path === path ? { ...r, lastActiveAt: Date.now() } : r))
    );
    setRepo(path);
  }

  // ---------- Files panel data ----------
  const workingRows: Row[] = useMemo(
    () =>
      (status?.files ?? []).map((f) => ({
        path: f.path,
        orig: f.orig_path,
        state: workingState(f),
        staged: f.staged,
        conflicted: f.conflicted,
        untracked: f.untracked,
      })),
    [status]
  );

  const rows: Row[] = useMemo(() => {
    if (stashSel !== null)
      return stashDiffFiles.map((f) => ({
        path: f.path,
        state: commitState(f.status),
        staged: false,
        conflicted: false,
        untracked: false,
      }));
    if (journalSel)
      return commitDiffFiles.map((f) => ({
        path: f.path,
        state: commitState(f.status),
        staged: false,
        conflicted: false,
        untracked: false,
      }));
    return workingRows;
  }, [stashSel, journalSel, stashDiffFiles, commitDiffFiles, workingRows]);

  const filesTitle =
    stashSel !== null
      ? "Files (stash)"
      : journalSel
      ? "Files (commit)"
      : "Files";

  const filteredRows = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.path.toLowerCase().includes(q));
  }, [rows, fileQuery]);

  function selectAllFilteredRows() {
    if (filteredRows.length === 0) return;
    setConflictFile(null);
    setSelPaths(filteredRows.map((r) => r.path));
    setSelPath(filteredRows[0].path);
  }

  function filesKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectAllFilteredRows();
    }
  }

  const filteredCommits = useMemo(() => {
    const q = journalQuery.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q) ||
        c.short.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q)
    );
  }, [commits, journalQuery]);

  // ---------- Selection & diff ----------
  async function selectRow(row: Row, e: React.MouseEvent) {
    setConflictFile(null);
    const multi = e.metaKey || e.ctrlKey;
    if (multi) {
      setSelPaths((prev) =>
        prev.includes(row.path)
          ? prev.filter((p) => p !== row.path)
          : [...prev, row.path]
      );
    } else {
      setSelPaths([row.path]);
    }
    setSelPath(row.path);

    // The branch-compare (right) pane only applies to the working tree.
    setCompareDiff("");
    setCompareBase(null);

    try {
      if (stashSel !== null) {
        setDiffText(await api.stashFileDiff(repo!, stashSel, row.path));
      } else if (journalSel) {
        setDiffText(await api.commitFileDiff(repo!, journalSel, row.path));
      } else if (row.conflicted) {
        setConflictFile(row.path);
      } else {
        setDiffText(await api.diff(repo!, row.path, row.staged, row.untracked));
        try {
          const cmp = await api.branchCompareFileDiff(repo!, row.path);
          setCompareDiff(cmp.diff);
          setCompareBase(cmp.base_branch);
        } catch {
          setCompareDiff("");
          setCompareBase(null);
        }
      }
    } catch (err) {
      setDiffText(String(err));
    }
  }

  async function selectCommit(hash: string) {
    setStashSel(null);
    setJournalSel(hash);
    setSelPath(null);
    setSelPaths([]);
    setDiffText("");
    setCompareDiff("");
    setCompareBase(null);
    setConflictFile(null);
    try {
      const files = await api.commitFiles(repo!, hash);
      setCommitDiffFiles(files);
      if (files.length) {
        setSelPath(files[0].path);
        setDiffText(await api.commitFileDiff(repo!, hash, files[0].path));
      }
    } catch (e) {
      notify(String(e), true);
    }
  }

  async function selectStash(index: number) {
    setJournalSel(null);
    setStashSel(index);
    setSelPath(null);
    setSelPaths([]);
    setDiffText("");
    setCompareDiff("");
    setCompareBase(null);
    setConflictFile(null);
    try {
      const files = await api.stashFiles(repo!, index);
      setStashDiffFiles(files);
      if (files.length) {
        setSelPath(files[0].path);
        setDiffText(await api.stashFileDiff(repo!, index, files[0].path));
      }
    } catch (e) {
      notify(String(e), true);
    }
  }

  function selectWorkingTree() {
    setJournalSel(null);
    setStashSel(null);
    setSelPath(null);
    setSelPaths([]);
    setDiffText("");
    setCompareDiff("");
    setCompareBase(null);
    setConflictFile(null);
  }

  // ---------- Actions ----------
  const targets = () =>
    selPaths.length ? selPaths : selPath ? [selPath] : [];

  const doStage = () =>
    run(() => api.stage(repo!, targets()), "Staged").then(refreshStatus);
  const doUnstage = () =>
    run(() => api.unstage(repo!, targets()), "Unstaged").then(refreshStatus);
  async function doDiscard() {
    const t = targets();
    if (!t.length) return;
    confirm(
      `Discard changes in ${t.length} file(s)?`,
      true,
      "Discard",
      async () => {
        closeDialog();
        const files = status?.files ?? [];
        const untracked = t.filter((p) => files.find((f) => f.path === p)?.untracked);
        const tracked = t.filter((p) => !untracked.includes(p));
        let ok = true;
        if (tracked.length) ok = (await run(() => api.discard(repo!, tracked, false))) && ok;
        if (untracked.length) ok = (await run(() => api.discard(repo!, untracked, true))) && ok;
        if (ok) notify(`Discarded ${t.length} file(s)`);
        await refreshStatus();
      }
    );
  }

  // Ask before switching branches. Route through a modal so we can warn about
  // uncommitted changes and offer keep / discard / stash.
  function requestCheckout(b: BranchInfo) {
    if (b.is_current) return;
    setCheckoutTarget(b);
  }
  async function performCheckout(
    b: BranchInfo,
    mode: "plain" | "discard" | "stash"
  ) {
    setCheckoutTarget(null);
    const target =
      b.is_remote && b.upstream === null
        ? b.name.split("/").slice(1).join("/")
        : b.name;
    if (mode === "stash") {
      const ok = await run(
        () => api.stashSave(repo!, `Auto stash before checkout ${target}`, true),
        "Stashed changes"
      );
      if (!ok) return;
    }
    if (b.is_remote) {
      const local = b.name.split("/").slice(1).join("/");
      await run(
        () => api.checkoutRemote(repo!, b.name, local),
        `Checked out ${local}`
      );
    } else {
      await run(
        () => api.checkout(repo!, b.name, mode === "discard"),
        `Checked out ${b.name}`
      );
    }
    await refreshAll();
  }

  async function fetchAndReport() {
    if (!repo) return;
    const before = new Set(branches.filter((b) => b.gone).map((b) => b.name));
    await run(() => api.fetch(repo), "Fetched");
    try {
      const b = await api.branches(repo);
      const nowGone = b.filter((x) => x.gone && !before.has(x.name));
      if (nowGone.length)
        notify(
          `Fetched. Upstream deleted for: ${nowGone
            .map((x) => x.name)
            .join(", ")}`,
          true
        );
    } catch {
      /* ignore */
    }
    await refreshAll();
  }

  const doFetch = () => run(() => api.fetch(repo!), "Fetched").then(refreshAll);
  const doPull = () => run(() => api.pull(repo!), "Pulled").then(refreshAll);
  async function doPush(force = false) {
    if (!status) return;
    const remote = remotes[0] ?? "origin";
    await run(
      () => api.push(repo!, remote, status.branch, force, !status.upstream),
      "Pushed"
    );
    await refreshAll();
  }

  // Sync = pull then push (SmartGit-style one-shot).
  async function doSync() {
    if (!status) return;
    const pulled = await run(() => api.pull(repo!), "Pulled");
    if (!pulled) { await refreshAll(); return; }
    const remote = remotes[0] ?? "origin";
    await run(
      () => api.push(repo!, remote, status.branch, false, !status.upstream),
      "Synced"
    );
    await refreshAll();
  }

  async function doCommit() {
    if (!commitMsg.trim()) {
      notify("Enter a commit message", true);
      return;
    }
    const ok = await run(() => api.commit(repo!, commitMsg, amend), "Committed");
    if (ok) {
      setCommitMsg("");
      setAmend(false);
      setShowCommit(false);
      await refreshAll();
    }
  }

  function newBranch() {
    prompt("New branch name", "feature/my-branch", async (name) => {
      closeDialog();
      await run(() => api.createBranch(repo!, name, true), `Created ${name}`);
      await refreshAll();
    });
  }
  function saveStash() {
    prompt("Stash message (optional)", "", async (msg) => {
      closeDialog();
      await run(() => api.stashSave(repo!, msg, true), "Stashed").then(refreshAll);
    });
  }
  async function applyStash() {
    if (!stashes.length) {
      notify("No stashes", true);
      return;
    }
    await run(() => api.stashApply(repo!, 0), "Applied latest stash").then(
      refreshAll
    );
  }

  // ---------- Reword / interactive-rebase subset ----------
  async function rewordCommitFlow(hash: string) {
    const cur = await api.commitMessage(repo!, hash).catch(() => "");
    const oid = status?.oid ?? "";
    const isHead = oid !== "" && (oid === hash || oid.startsWith(hash) || hash.startsWith(oid));
    prompt(
      "Reword commit message",
      "Commit message",
      async (msg) => {
        closeDialog();
        const m = msg.trim();
        if (!m) return;
        await run(
          () => (isHead ? api.rewordHead(repo!, m) : api.rewordCommit(repo!, hash, m)),
          "Reworded"
        ).then(refreshAll);
      },
      cur.split("\n")[0]
    );
  }
  function dropCommitFlow(hash: string) {
    const c = commits.find((k) => k.hash === hash);
    confirm(
      `Drop commit ${c?.short ?? hash}? This rewrites history.`,
      true,
      "Drop",
      async () => {
        closeDialog();
        await run(() => api.dropCommit(repo!, hash), "Commit dropped").then(refreshAll);
      }
    );
  }
  function squashCommitFlow(hash: string) {
    const c = commits.find((k) => k.hash === hash);
    confirm(
      `Squash ${c?.short ?? hash} into the previous commit? This rewrites history.`,
      true,
      "Squash",
      async () => {
        closeDialog();
        await run(() => api.squashCommit(repo!, hash), "Squashed").then(refreshAll);
      }
    );
  }

  // ---------- Partial (hunk) staging ----------
  async function onHunkAction(patch: string, action: HunkAction) {
    const path = selPath;
    const viewStaged = workingRows.find((r) => r.path === path)?.staged ?? false;
    const apply = async () => {
      const fn =
        action === "stage"
          ? () => api.stageHunk(repo!, patch)
          : action === "unstage"
          ? () => api.unstageHunk(repo!, patch)
          : () => api.discardHunk(repo!, patch);
      const label =
        action === "stage" ? "Staged hunk" : action === "unstage" ? "Unstaged hunk" : "Discarded hunk";
      const ok = await run(fn, label);
      if (!ok) return;
      await refreshStatus();
      if (path) {
        try {
          setDiffText(await api.diff(repo!, path, viewStaged, false));
        } catch {
          setDiffText("");
        }
      }
    };
    if (action === "discard") {
      confirm("Discard this hunk? The changes will be lost.", true, "Discard", async () => {
        closeDialog();
        await apply();
      });
    } else {
      await apply();
    }
  }

  // ---------- Toolbar auxiliary menus ----------
  function pullOptionsMenu(x: number, y: number) {
    const items: MenuItem[] = [
      {
        label: "Pull (rebase)",
        run: () => run(() => api.pullOpts(repo!, true), "Pulled (rebase)").then(refreshAll),
      },
      {
        label: "Pull (merge)",
        run: () => run(() => api.pullOpts(repo!, false), "Pulled").then(refreshAll),
      },
      { sep: true },
    ];
    if (remotes.length) {
      for (const rem of remotes)
        items.push({
          label: `Fetch ${rem}`,
          run: () => run(() => api.fetchRemote(repo!, rem), `Fetched ${rem}`).then(refreshAll),
        });
    } else {
      items.push({ label: "No remotes", disabled: true });
    }
    setMenu({ x, y, items });
  }
  function moreMenu(x: number, y: number) {
    setMenu({
      x,
      y,
      items: [
        { label: "Remotes…", run: () => setShowRemotes(true) },
        { label: "Reflog", run: () => setShowReflog(true) },
        { label: "Compare…", run: () => setShowCompare(true) },
        { sep: true },
        { label: "Clean…", danger: true, run: () => setShowClean(true) },
        { sep: true },
        { label: "Repository Settings…", run: () => setShowSettings(true) },
      ],
    });
  }

  // Merge / Rebase toolbar dropdowns list other branches.
  function branchPickMenu(
    kind: "merge" | "rebase",
    x: number,
    y: number
  ) {
    const items: MenuItem[] = branches
      .filter((b) => !b.is_current)
      .map((b) => ({
        label: `${kind === "merge" ? "Merge" : "Rebase onto"} ${b.name}`,
        run: () =>
          run(
            () =>
              kind === "merge"
                ? api.merge(repo!, b.name, false)
                : api.rebase(repo!, b.name),
            kind === "merge" ? "Merged" : "Rebased"
          ).then(refreshAll),
      }));
    if (!items.length) items.push({ label: "No other branches", disabled: true });
    setMenu({ x, y, items });
  }

  // ---------- Context menus ----------
  function fileMenu(row: Row, x: number, y: number) {
    // Ensure the right-clicked row is part of the selection.
    if (!selPaths.includes(row.path)) {
      setSelPaths([row.path]);
      setSelPath(row.path);
    }
    const working = stashSel === null && !journalSel;
    const items: MenuItem[] = [
      { label: "Show Changes", shortcut: "F4", run: () => selectRow(row, {} as React.MouseEvent) },
    ];
    if (working) {
      items.push({ sep: true });
      if (row.conflicted) {
        items.push({
          label: "Resolve using 'Ours'",
          run: () =>
            run(() => api.resolveConflict(repo!, row.path, "ours"), "Resolved").then(
              refreshStatus
            ),
        });
        items.push({
          label: "Resolve using 'Theirs'",
          run: () =>
            run(
              () => api.resolveConflict(repo!, row.path, "theirs"),
              "Resolved"
            ).then(refreshStatus),
        });
        items.push({ label: "Conflict Solver", run: () => setConflictFile(row.path) });
        items.push({ sep: true });
      }
      items.push({ label: "Stage", shortcut: "⌘T", run: doStage });
      items.push({ label: "Unstage", shortcut: "⇧⌘T", run: doUnstage });
      items.push({
        label: "Stash Selection…",
        run: () => {
          prompt("Stash message (optional)", "", async (msg) => {
            closeDialog();
            await run(
              () => api.stashSavePaths(repo!, msg, targets()),
              "Stashed selection"
            ).then(refreshAll);
          });
        },
      });
      items.push({ sep: true });
      items.push({ label: "Discard…", shortcut: "⌘Z", danger: true, run: doDiscard });
      items.push({
        label: "Remove…",
        shortcut: "⌘−",
        danger: true,
        run: () => {
          const t = targets();
          if (!t.length) return;
          confirm(
            `Remove ${t.length} file(s) from git and disk?`,
            true, "Remove",
            async () => { closeDialog(); await run(() => api.removeFile(repo!, t, false), "Removed").then(refreshStatus); }
          );
        },
      });
      items.push({
        label: "Delete…",
        shortcut: "⌦",
        danger: true,
        run: () => {
          const t = targets();
          if (!t.length) return;
          confirm(
            `Delete ${t.length} file(s) from disk?`,
            true, "Delete",
            async () => { closeDialog(); await run(() => api.deleteFile(repo!, t), "Deleted").then(refreshStatus); }
          );
        },
      });
    }
    items.push({ sep: true });
    items.push({
      label: "File History",
      run: () => setFileHistoryPath(row.path),
    });
    items.push({ sep: true });
    items.push({
      label: "Copy Name",
      run: () => navigator.clipboard.writeText(baseOf(row.path)),
    });
    items.push({
      label: "Copy Relative Path",
      run: () => navigator.clipboard.writeText(row.path),
    });
    items.push({
      label: "Copy Path",
      run: () => navigator.clipboard.writeText(`${repo}/${row.path}`),
    });
    setMenu({ x, y, items });
  }

  function commitMenu(hash: string, x: number, y: number) {
    const c = commits.find((k) => k.hash === hash);
    setMenu({
      x,
      y,
      items: [
        {
          label: "Cherry-Pick",
          run: () =>
            run(() => api.cherryPick(repo!, hash), "Cherry-picked").then(
              refreshAll
            ),
        },
        {
          label: "Revert Commit",
          run: () => {
            confirm(
              `Revert commit ${c?.short ?? hash}?`,
              true, "Revert",
              async () => { closeDialog(); await run(() => api.revert(repo!, hash), "Reverted").then(refreshAll); }
            );
          },
        },
        {
          label: "Create Branch here…",
          run: () => {
            prompt("Branch name at " + (c?.short ?? hash), "feature/my-branch", async (name) => {
              closeDialog();
              await run(() => api.createBranch(repo!, name, false), "Branch created").then(refreshAll);
            });
          },
        },
        {
          label: "Create Tag here…",
          run: () => {
            prompt("Tag name at " + (c?.short ?? hash), "v1.0.0", async (name) => {
              closeDialog();
              const n = name.trim();
              if (!n) return;
              await run(() => api.createTag(repo!, n, hash, ""), "Tag created").then(refreshAll);
            });
          },
        },
        { sep: true },
        {
          label: "Reword…",
          run: () => rewordCommitFlow(hash),
        },
        {
          label: "Squash into previous",
          run: () => squashCommitFlow(hash),
        },
        {
          label: "Drop commit",
          danger: true,
          run: () => dropCommitFlow(hash),
        },
        { sep: true },
        {
          label: `Reset ${status?.branch ?? "branch"} to here — Soft`,
          run: () =>
            run(() => api.reset(repo!, hash, "soft"), "Reset (soft)").then(refreshAll),
        },
        {
          label: "Reset to here — Mixed (keep working tree)",
          run: () =>
            run(() => api.reset(repo!, hash, "mixed"), "Reset (mixed)").then(refreshAll),
        },
        {
          label: "Reset to here — Hard (discard changes)",
          danger: true,
          run: () => {
            confirm(
              `Hard reset ${status?.branch ?? "branch"} to ${c?.short ?? hash}? Uncommitted changes will be lost.`,
              true, "Reset Hard",
              async () => { closeDialog(); await run(() => api.reset(repo!, hash, "hard"), "Reset (hard)").then(refreshAll); }
            );
          },
        },
        { sep: true },
        {
          label: "Copy Commit ID",
          run: () => navigator.clipboard.writeText(hash),
        },
        {
          label: "Copy Commit Message",
          run: async () => {
            try {
              const msg = await api.commitMessage(repo!, hash);
              await navigator.clipboard.writeText(msg);
            } catch {
              await navigator.clipboard.writeText(c?.subject ?? "");
            }
          },
        },
      ],
    });
  }

  function branchMenu(b: BranchInfo, x: number, y: number) {
    const items: MenuItem[] = [];
    if (!b.is_current) {
      items.push({
        label: `Check Out`,
        run: () => requestCheckout(b),
      });
      items.push({
        label: `Merge into current`,
        run: () =>
          run(() => api.merge(repo!, b.name, false), "Merged").then(refreshAll),
      });
      items.push({
        label: `Rebase current onto this`,
        run: () =>
          run(() => api.rebase(repo!, b.name), "Rebased").then(refreshAll),
      });
    }
    if (!b.is_remote) {
      items.push({ sep: true });
      items.push({
        label: `Rename…`,
        run: () => {
          prompt("Rename branch", b.name, async (name) => {
            closeDialog();
            const n = name.trim();
            if (!n || n === b.name) return;
            await run(() => api.renameBranch(repo!, b.name, n), "Branch renamed").then(refreshAll);
          }, b.name);
        },
      });
    }
    if (!b.is_remote && !b.is_current) {
      items.push({ sep: true });
      items.push({
        label: `Delete`,
        danger: true,
        run: () => {
          confirm(
            `Delete branch ${b.name}?`,
            true, "Delete",
            async () => { closeDialog(); await run(() => api.deleteBranch(repo!, b.name, false), "Deleted").then(refreshAll); }
          );
        },
      });
    }
    setMenu({ x, y, items });
  }

  function stashMenu(s: StashInfo, x: number, y: number) {
    setMenu({
      x,
      y,
      items: [
        {
          label: "Apply",
          run: () =>
            run(() => api.stashApply(repo!, s.index), "Applied").then(refreshAll),
        },
        {
          label: "Pop",
          run: () =>
            run(() => api.stashPop(repo!, s.index), "Popped").then(refreshAll),
        },
        {
          label: "Branch from stash…",
          run: () => {
            prompt("New branch from stash", "feature/from-stash", async (name) => {
              closeDialog();
              const n = name.trim();
              if (!n) return;
              await run(() => api.stashBranch(repo!, n, s.index), "Branch created from stash").then(refreshAll);
            });
          },
        },
        { sep: true },
        {
          label: "Drop",
          danger: true,
          run: () => {
            confirm(
              "Drop this stash?",
              true, "Drop",
              async () => { closeDialog(); await run(() => api.stashDrop(repo!, s.index), "Dropped").then(refreshAll); }
            );
          },
        },
      ],
    });
  }

  const localBranches = useMemo(
    () => branches.filter((b) => !b.is_remote),
    [branches]
  );
  const remoteBranches = useMemo(
    () => branches.filter((b) => b.is_remote),
    [branches]
  );
  // Group remote branches by their remote name (origin, upstream, …).
  const remoteGroups = useMemo(() => {
    const g: Record<string, BranchInfo[]> = {};
    for (const b of remoteBranches) {
      const remote = b.name.split("/")[0];
      (g[remote] ??= []).push(b);
    }
    return g;
  }, [remoteBranches]);

  const localTree = useMemo(
    () => buildBranchTree(localBranches.map((b) => ({ label: b.name, branch: b }))),
    [localBranches]
  );
  const remoteTrees = useMemo(() => {
    const out: Record<string, BNode[]> = {};
    for (const [remote, list] of Object.entries(remoteGroups)) {
      out[remote] = buildBranchTree(
        list.map((b) => ({
          label: b.name.split("/").slice(1).join("/"),
          branch: b,
        }))
      );
    }
    return out;
  }, [remoteGroups]);

  // Recursively render branch-tree nodes with indentation.
  function renderBranchNodes(nodes: BNode[], depth: number): ReactNode {
    return nodes.map((node) => {
      if (node.branch) {
        const b = node.branch;
        return (
          <div
            key={node.key}
            className={`br-item ${b.is_current ? "current" : ""}`}
            style={{ paddingLeft: 24 + depth * 14 }}
            onContextMenu={(e) => {
              e.preventDefault();
              branchMenu(b, e.clientX, e.clientY);
            }}
            onClick={() => requestCheckout(b)}
          >
            <span className="ico">
              {b.is_current ? <Play size={12} /> : b.is_remote ? <Cloud size={13} /> : <GitBranch size={13} />}
            </span>
            <span className="name">{node.name}</span>
            {b.gone && b.upstream ? (
              <span className="gone">? {b.upstream.split("/")[0]}</span>
            ) : (
              b.upstream && (
                <span className="eq">= {b.upstream.split("/")[0]}</span>
              )
            )}
            {(b.ahead > 0 || b.behind > 0) && (
              <span className="track">
                {b.ahead > 0 && `↑${b.ahead}`}
                {b.behind > 0 && `↓${b.behind}`}
              </span>
            )}
          </div>
        );
      }
      const collapsed = collapsedFolders.has(node.key);
      return (
        <div key={node.key}>
          <div
            className="br-folder"
            style={{ paddingLeft: 22 + depth * 14 }}
            onClick={() => toggleFolder(node.key)}
          >
            {collapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
            <span className="name">{node.name}</span>
          </div>
          {!collapsed && renderBranchNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  function tagMenu(tag: string, x: number, y: number) {
    setMenu({
      x,
      y,
      items: [
        {
          label: "Check Out",
          run: () =>
            run(() => api.checkout(repo!, tag), `Checked out ${tag}`).then(
              refreshAll
            ),
        },
        {
          label: "Push to remote",
          run: () => {
            const remote = remotes[0] ?? "origin";
            run(() => api.pushTag(repo!, remote, tag), `Pushed tag ${tag}`).then(refreshAll);
          },
        },
        { sep: true },
        { label: "Copy Name", run: () => navigator.clipboard.writeText(tag) },
        {
          label: "Delete",
          danger: true,
          run: () => {
            confirm(
              `Delete tag ${tag}?`,
              true, "Delete",
              async () => { closeDialog(); await run(() => api.deleteTag(repo!, tag), "Tag deleted").then(refreshAll); }
            );
          },
        },
      ],
    });
  }
  const conflicts = status?.files.filter((f) => f.conflicted) ?? [];
  const stagedCount = status?.files.filter((f) => f.staged && !f.conflicted).length ?? 0;
  const inProgress =
    status && (status.merging || status.rebasing || status.cherry_picking);

  // Per-hunk staging applies only to the working tree of a tracked, non-conflicted
  // file. Which action is offered depends on whether the shown diff is staged.
  const hunkWorking = stashSel === null && journalSel === null;
  const hunkSelRow = hunkWorking
    ? workingRows.find((r) => r.path === selPath)
    : undefined;
  const hunkMode: "staged" | "unstaged" | null =
    hunkWorking && hunkSelRow && !hunkSelRow.untracked && !hunkSelRow.conflicted && diffText
      ? hunkSelRow.staged
        ? "staged"
        : "unstaged"
      : null;

  // Group repositories by parent directory (SmartGit-style tree), applying the active sort.
  const repoGroups = useMemo(() => {
    const sorted = [...repos].sort((a, b) => {
      if (repoSort === "name") return a.name.localeCompare(b.name);
      if (repoSort === "recent") return (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0);
      // "added": newest added first
      return (b.addedAt ?? 0) - (a.addedAt ?? 0);
    });
    const g: Record<string, RepoRef[]> = {};
    for (const r of sorted) {
      const parent = dirOf(r.path).replace(/^\/Users\/[^/]+/, "~");
      (g[parent] ??= []).push(r);
    }
    return g;
  }, [repos, repoSort]);

  // Keep the native-menu dispatcher pointed at the latest handlers.
  menuHandlerRef.current = (id: string) => {
    switch (id) {
      case "open":
        openRepo();
        break;
      case "refresh":
        refreshAll();
        break;
      case "fetch":
        doFetch();
        break;
      case "pull":
        doPull();
        break;
      case "push":
        doPush(false);
        break;
      case "branch":
        newBranch();
        break;
      case "commit":
        setShowCommit(true);
        break;
      case "toggle-theme":
        setDark((d) => !d);
        break;
    }
  };

  if (!repo) {
    return (
      <>
        <WelcomeScreen
          onOpenRepository={openRepo}
          onCloneRepository={cloneRepo}
          recentRepos={[...repos].sort((a, b) => (b.lastActiveAt ?? b.addedAt ?? 0) - (a.lastActiveAt ?? a.addedAt ?? 0)).slice(0, 5)}
          onOpenRecent={switchRepo}
          dark={dark}
          onToggleTheme={() => { setThemeIsManual(true); setDark((d) => !d); }}
        />
        {dialog?.type === "input" && (
          <InputDialog
            title={dialog.title}
            placeholder={dialog.placeholder}
            defaultValue={dialog.defaultValue}
            confirmLabel={dialog.confirmLabel}
            onConfirm={dialog.onConfirm}
            onCancel={closeDialog}
          />
        )}
      </>
    );
  }

  return (
    <div className="sg-app">
      <Toolbar
        status={status}
        stagedCount={stagedCount}
        hasStashes={stashes.length > 0}
        noSelection={!targets().length}
        dark={dark}
        busy={busy}
        inProgress={Boolean(inProgress)}
        conflictsCount={conflicts.length}
        onPull={doPull}
        onFetch={fetchAndReport}
        onPullOptions={(e) => { e.stopPropagation(); pullOptionsMenu(e.clientX, e.clientY); }}
        onMore={(e) => { e.stopPropagation(); moreMenu(e.clientX, e.clientY); }}
        onPush={() => doPush(false)}
        onSync={doSync}
        onCommitClick={() => setShowCommit(true)}
        onStage={doStage}
        onUnstage={doUnstage}
        onDiscard={doDiscard}
        onSaveStash={saveStash}
        onApplyStash={applyStash}
        onLog={() => setShowLogs(true)}
        onNewBranch={newBranch}
        onMergeClick={(e) => { e.stopPropagation(); branchPickMenu("merge", e.clientX, e.clientY); }}
        onRebaseClick={(e) => { e.stopPropagation(); branchPickMenu("rebase", e.clientX, e.clientY); }}
        onToggleTheme={() => {
          setThemeIsManual(true);
          setDark((d) => !d);
        }}
        onContinueRebase={() => run(() => api.rebaseContinue(repo!), "Continued").then(refreshAll)}
        onContinueCherryPick={() => run(() => api.cherryPickContinue(repo!), "Continued").then(refreshAll)}
        onAbortMerge={() => run(() => api.mergeAbort(repo!), "Aborted").then(refreshAll)}
        onAbortRebase={() => run(() => api.rebaseAbort(repo!), "Aborted").then(refreshAll)}
        onAbortCherryPick={() => run(() => api.cherryPickAbort(repo!), "Aborted").then(refreshAll)}
      />

      <Main
        repoGroups={repoGroups}
        repo={repo}
        onSwitchRepo={switchRepo}
        onRemoveRepos={removeRepos}
        onOpenInNewWindow={openRepoInNewWindow}
        onRenameRepo={renameRepoEntry}
        onOpenRepoLog={openRepoLog}
        groupLabels={groupLabels}
        onRenameGroup={renameGroup}
        repoSort={repoSort}
        onRepoSortChange={setRepoSort}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        localBranchCount={localBranches.length}
        localTree={localTree}
        remoteTrees={remoteTrees}
        remoteGroups={remoteGroups}
        renderBranchNodes={renderBranchNodes}
        tags={tags}
        onTagCheckout={(t) => run(() => api.checkout(repo!, t), `Checked out ${t}`).then(refreshAll)}
        onTagContext={tagMenu}
        stashes={stashes}
        stashSel={stashSel}
        onSelectStash={selectStash}
        onStashContext={stashMenu}
        filesH={filesH}
        onStartVDrag={startVDrag}
        filesTitle={filesTitle}
        filteredRows={filteredRows}
        totalRowsCount={rows.length}
        colW={colW}
        onStartColDrag={startColDrag}
        fileQuery={fileQuery}
        onFileQueryChange={setFileQuery}
        onFilesKeyDown={filesKeyDown}
        selPath={selPath}
        selPaths={selPaths}
        onSelectRow={selectRow}
        onFileContext={fileMenu}
        conflictFile={conflictFile}
        onConflictResolved={() => {
          setConflictFile(null);
          refreshStatus();
        }}
        journalSel={journalSel}
        status={status}
        diffText={diffText}
        compareDiff={compareDiff}
        compareBase={compareBase}
        dark={dark}
        hunkMode={hunkMode}
        onHunkAction={onHunkAction}
        journalH={journalH}
        journalQuery={journalQuery}
        onJournalQueryChange={setJournalQuery}
        onSelectWorkingTree={selectWorkingTree}
        filteredCommits={filteredCommits}
        onSelectCommit={selectCommit}
        onCommitContext={commitMenu}
      />

      <StatusBar repo={repo} status={status} email={repoEmail} />

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}

      {showCommit && (
        <CommitModal
          status={status}
          stagedCount={stagedCount}
          commitMsg={commitMsg}
          amend={amend}
          busy={busy}
          onMsgChange={setCommitMsg}
          onAmendChange={setAmend}
          onClose={() => setShowCommit(false)}
          onCommit={doCommit}
        />
      )}

      {showLogs && repo && status && (
        <LogsPanel
          repo={repo}
          branches={branches}
          currentBranch={status.branch}
          dark={dark}
          status={status}
          onChanged={refreshAll}
          onRequestCommit={() => setShowCommit(true)}
          onClose={() => setShowLogs(false)}
          onCherryPick={(hash) =>
            run(() => api.cherryPick(repo, hash), "Cherry-picked").then(refreshAll)
          }
          onRevert={async (hash) => {
            const c = commits.find((k) => k.hash === hash);
            confirm(
              `Revert commit ${c?.short ?? hash}?`,
              true, "Revert",
              async () => { closeDialog(); await run(() => api.revert(repo, hash), "Reverted").then(refreshAll); }
            );
          }}
          onReset={(hash, mode) => {
            const c = commits.find((k) => k.hash === hash);
            if (mode === "hard") {
              confirm(
                `Hard reset ${status.branch} to ${c?.short ?? hash}? Uncommitted changes will be lost.`,
                true, "Reset Hard",
                async () => { closeDialog(); await run(() => api.reset(repo, hash, "hard"), "Reset (hard)").then(refreshAll); }
              );
            } else {
              run(() => api.reset(repo, hash, mode), `Reset (${mode})`).then(refreshAll);
            }
          }}
          onCreateTag={(hash) => {
            const c = commits.find((k) => k.hash === hash);
            prompt("Tag name at " + (c?.short ?? hash), "v1.0.0", async (name) => {
              closeDialog();
              const n = name.trim();
              if (!n) return;
              await run(() => api.createTag(repo, n, hash, ""), "Tag created").then(refreshAll);
            });
          }}
          onReword={rewordCommitFlow}
          onDrop={dropCommitFlow}
          onSquash={squashCommitFlow}
          onFileHistory={setFileHistoryPath}
        />
      )}

      {checkoutTarget && (
        <CheckoutConfirmation
          target={checkoutTarget}
          status={status}
          onClose={() => setCheckoutTarget(null)}
          onCheckout={(mode) => performCheckout(checkoutTarget, mode)}
        />
      )}

      {showRemotes && repo && (
        <RemotesDialog
          repo={repo}
          notify={notify}
          onChanged={refreshAll}
          onClose={() => setShowRemotes(false)}
        />
      )}

      {showSettings && repo && (
        <RepoSettingsDialog repo={repo} notify={notify} onClose={() => setShowSettings(false)} />
      )}

      {showClean && repo && (
        <CleanDialog
          repo={repo}
          notify={notify}
          onChanged={refreshStatus}
          onClose={() => setShowClean(false)}
        />
      )}

      {showReflog && repo && status && (
        <ReflogPanel
          repo={repo}
          currentBranch={status.branch}
          onClose={() => setShowReflog(false)}
          onCheckout={(hash) => {
            setShowReflog(false);
            run(() => api.checkout(repo, hash), "Checked out").then(refreshAll);
          }}
          onReset={(hash, mode) => {
            if (mode === "hard") {
              confirm(
                `Hard reset ${status.branch} to ${hash.slice(0, 7)}? Uncommitted changes will be lost.`,
                true, "Reset Hard",
                async () => { closeDialog(); setShowReflog(false); await run(() => api.reset(repo, hash, "hard"), "Reset (hard)").then(refreshAll); }
              );
            } else {
              setShowReflog(false);
              run(() => api.reset(repo, hash, mode), `Reset (${mode})`).then(refreshAll);
            }
          }}
        />
      )}

      {showCompare && repo && status && (
        <CompareModal
          repo={repo}
          branches={branches}
          tags={tags}
          currentBranch={status.branch}
          dark={dark}
          onClose={() => setShowCompare(false)}
        />
      )}

      {fileHistoryPath && repo && (
        <FileHistoryModal
          repo={repo}
          path={fileHistoryPath}
          dark={dark}
          onClose={() => setFileHistoryPath(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} err={toast.err} onClose={() => setToast(null)} />}

      {dialog?.type === "confirm" && (
        <ConfirmDialog
          message={dialog.message}
          danger={dialog.danger}
          confirmLabel={dialog.confirmLabel}
          onConfirm={dialog.onConfirm}
          onCancel={closeDialog}
        />
      )}
      {dialog?.type === "input" && (
        <InputDialog
          title={dialog.title}
          placeholder={dialog.placeholder}
          defaultValue={dialog.defaultValue}
          confirmLabel={dialog.confirmLabel}
          onConfirm={dialog.onConfirm}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
