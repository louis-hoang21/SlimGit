import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, X, RotateCw, SlidersHorizontal } from "lucide-react";
import { CommitInfo, BranchInfo, DiffFile, StatusResult } from "../types";
import { computeGraph, GRAPH_COLORS, laneColor, rowTextOffset } from "../graph";
import DiffView from "./DiffView";
import ContextMenu from "./common/ContextMenu";
import type { Menu } from "../ui-types";
import { api } from "../api";

interface Props {
  repo: string;
  branches: BranchInfo[];
  currentBranch: string;
  dark: boolean;
  status: StatusResult | null;
  onClose: () => void;
  onCherryPick: (hash: string) => Promise<void>;
  onRevert: (hash: string) => Promise<void>;
  onReset: (hash: string, mode: "soft" | "mixed" | "hard") => void;
  onCreateTag: (hash: string) => void;
  onReword: (hash: string) => void;
  onDrop: (hash: string) => void;
  onSquash: (hash: string) => void;
  onFileHistory: (path: string) => void;
  // Working Tree row: refresh after staging actions, and open the commit modal.
  onChanged: () => void;
  onRequestCommit: () => void;
}

const ROW_H = 24;
const COL_W = 14;
const PAD = 8;

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  const time = d.toLocaleTimeString();
  if (t >= today && t < today + 86400000) return `Today ${time}`;
  if (t >= today - 86400000 && t < today) return `Yesterday ${time}`;
  return d.toLocaleString();
}

function refBadges(refs: string[]) {
  return refs
    .filter((r) => r && r !== "HEAD")
    .map((r) => {
      let cls = "ref";
      if (r.startsWith("HEAD -> ")) { r = r.replace("HEAD -> ", ""); cls = "ref ref-head"; }
      else if (r.startsWith("tag: ")) { r = r.replace("tag: ", ""); cls = "ref ref-tag"; }
      else if (r.includes("/")) cls = "ref ref-remote";
      return { label: r, cls };
    });
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    M: "Modified", A: "Added", D: "Deleted", R: "Renamed",
    C: "Copied", U: "Conflicted", "?": "Untracked",
  };
  return m[s] ?? s;
}

// Clamp helper
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function LogsPanel({
  repo, branches, currentBranch, dark, status, onClose, onCherryPick, onRevert, onReset, onCreateTag,
  onReword, onDrop, onSquash, onFileHistory, onChanged, onRequestCommit,
}: Props) {
  const [selectedBranch, setSelectedBranch] = useState(currentBranch);
  // SmartGit's Log defaults to HEAD only (Branches panel: just HEAD checked) —
  // the current branch's full graph with its merged-in branches as side lanes.
  const [allBranches, setAllBranches] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Advanced history search (git log --author / --grep / -S pickaxe).
  const [showSearch, setShowSearch] = useState(false);
  const [author, setAuthor] = useState("");
  const [grep, setGrep] = useState("");
  const [pickaxe, setPickaxe] = useState("");
  const hasSearch = Boolean(author.trim() || grep.trim() || pickaxe.trim());

  // Selection
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [wtSelected, setWtSelected] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Context menu
  const [menu, setMenu] = useState<Menu | null>(null);

  // Virtual scroll + incremental load for deep histories.
  const [limit, setLimit] = useState(1000);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const graphScrollRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  // --- Resize state ---
  // Panel (modal) size
  const [panelW, setPanelW] = useState(() => Math.min(window.innerWidth * 0.92, 1200));
  const [panelH, setPanelH] = useState(() => Math.min(window.innerHeight * 0.96, 980));
  // Vertical split: graph top / detail bottom (as fraction of panel body height)
  const [graphFrac, setGraphFrac] = useState(0.45);
  // Horizontal split in detail: files left / diff right (in px)
  const [filesW, setFilesW] = useState(280);

  const dragRef = useRef<
    | { type: "panel-se"; startX: number; startY: number; startW: number; startH: number }
    | { type: "v-split"; startY: number; startFrac: number; bodyH: number }
    | { type: "h-split"; startX: number; startFilesW: number }
    | null
  >(null);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.type === "panel-se") {
      setPanelW(clamp(d.startW + e.clientX - d.startX, 500, window.innerWidth - 40));
      setPanelH(clamp(d.startH + e.clientY - d.startY, 340, window.innerHeight - 40));
    } else if (d.type === "v-split") {
      const newFrac = clamp((e.clientY - (window.innerHeight / 2 - d.bodyH / 2)) / d.bodyH, 0.2, 0.75);
      setGraphFrac(newFrac);
    } else if (d.type === "h-split") {
      setFilesW(clamp(d.startFilesW + e.clientX - d.startX, 140, 560));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [onMouseMove, stopDrag]);

  // --- Data loading --- (keeps selection; load-more just raises `limit`)
  const loadCommits = useCallback(async () => {
    setLoading(true);
    try {
      const result = hasSearch
        ? await api.logSearch(repo, author.trim(), grep.trim(), pickaxe.trim(), limit, allBranches)
        : allBranches
        ? await api.logGraph(repo, limit, true)
        : await api.logBranch(repo, selectedBranch, limit);
      setCommits(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); loadingMoreRef.current = false; }
  }, [repo, selectedBranch, allBranches, hasSearch, author, grep, pickaxe, limit]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

  // Changing branch / search resets the view (selection + scroll), but a
  // load-more (limit bump) must not — so clear only on those changes.
  useEffect(() => {
    setSelectedHash(null);
    setWtSelected(false);
    setFiles([]);
    setDiffText("");
    setLimit(1000);
    if (graphScrollRef.current) graphScrollRef.current.scrollTop = 0;
    setScrollTop(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, allBranches, hasSearch]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Close context menu
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const filteredCommits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter((c) =>
      c.subject.toLowerCase().includes(q) ||
      c.hash.toLowerCase().includes(q) ||
      c.short.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q)
    );
  }, [commits, query]);

  async function selectCommit(hash: string) {
    setWtSelected(false);
    setSelectedHash(hash);
    setFiles([]);
    setDiffText("");
    setSelectedFile(null);
    setMessage("");
    api.commitMessage(repo, hash).then(setMessage).catch(() => setMessage(""));
    setLoadingFiles(true);
    try {
      const fs = await api.commitFiles(repo, hash);
      setFiles(fs);
      if (fs.length) {
        setSelectedFile(fs[0].path);
        setLoadingDiff(true);
        try {
          setDiffText(await api.commitFileDiff(repo, hash, fs[0].path));
        } finally { setLoadingDiff(false); }
      }
    } catch (e) { console.error(e); }
    finally { setLoadingFiles(false); }
  }

  async function selectFile(path: string) {
    if (!selectedHash) return;
    setSelectedFile(path);
    setDiffText("");
    setLoadingDiff(true);
    try {
      setDiffText(await api.commitFileDiff(repo, selectedHash, path));
    } catch (e) { console.error(e); }
    finally { setLoadingDiff(false); }
  }

  // ----- Working Tree (uncommitted changes) -----
  function selectWorkingTree() {
    setSelectedHash(null);
    setWtSelected(true);
    setMessage("");
    setSelectedFile(null);
    setDiffText("");
  }

  // Files of the working tree, taken from the live status prop.
  const wtFiles: DiffFile[] = useMemo(
    () =>
      (status?.files ?? []).map((f) => ({
        path: f.path,
        status: (f.staged ? f.index_status : f.worktree_status) || "M",
      })),
    [status]
  );

  async function selectWtFile(f: { path: string; staged: boolean; untracked: boolean }) {
    setSelectedFile(f.path);
    setDiffText("");
    setLoadingDiff(true);
    try {
      setDiffText(await api.diff(repo, f.path, f.staged, f.untracked));
    } catch (e) { console.error(e); }
    finally { setLoadingDiff(false); }
  }

  function wtFileMenu(path: string, staged: boolean, x: number, y: number) {
    setMenu({
      x, y,
      items: [
        staged
          ? { label: "Unstage", run: () => api.unstage(repo, [path]).then(onChanged) }
          : { label: "Stage", run: () => api.stage(repo, [path]).then(onChanged) },
        { label: "Discard", danger: true, run: () => api.discard(repo, [path], false).then(onChanged) },
        { sep: true },
        { label: "File History", run: () => onFileHistory(path) },
      ],
    });
  }

  function openMenu(hash: string, x: number, y: number) {
    const c = filteredCommits.find((k) => k.hash === hash);
    setMenu({
      x, y,
      items: [
        { label: "Cherry-Pick", run: () => onCherryPick(hash) },
        {
          label: "Revert Commit", danger: true,
          run: () => onRevert(hash),
        },
        { label: "Create Tag here…", run: () => onCreateTag(hash) },
        { sep: true },
        { label: "Reword…", run: () => onReword(hash) },
        { label: "Squash into previous", run: () => onSquash(hash) },
        { label: "Drop commit", danger: true, run: () => onDrop(hash) },
        { sep: true },
        { label: `Reset ${currentBranch} to here — Soft`, run: () => onReset(hash, "soft") },
        { label: "Reset to here — Mixed", run: () => onReset(hash, "mixed") },
        { label: "Reset to here — Hard (discard)", danger: true, run: () => onReset(hash, "hard") },
        { sep: true },
        { label: "Copy Commit ID", run: () => navigator.clipboard.writeText(hash) },
        { label: "Copy Message", run: () => navigator.clipboard.writeText(c?.subject ?? "") },
      ],
    });
  }

  // Graph layout
  const layout = useMemo(() => computeGraph(filteredCommits), [filteredCommits]);
  const graphW = (layout.maxCol + 1) * COL_W + PAD;
  const totalH = filteredCommits.length * ROW_H;
  const nodeCol = new Map(layout.nodes.map((n) => [n.commit.hash, n.col]));

  // Virtual window: only render rows/edges/nodes near the viewport.
  const BUFFER = 12;
  const visFirst = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER);
  const visLast = Math.min(filteredCommits.length, Math.ceil((scrollTop + viewH) / ROW_H) + BUFFER);

  function onGraphScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    if (el.clientHeight !== viewH) setViewH(el.clientHeight);
    // Load more when near the bottom and the current page is full.
    if (
      !loading &&
      !loadingMoreRef.current &&
      commits.length >= limit &&
      el.scrollTop + el.clientHeight > el.scrollHeight - 600
    ) {
      loadingMoreRef.current = true;
      setLimit((l) => l + 2000);
    }
  }

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  // Body = panel height - header(42) - advanced-search bar (when shown).
  const HEADER_H = 42;
  const ADV_H = showSearch ? 44 : 0;
  const bodyH = panelH - HEADER_H - ADV_H;
  // Top area (graph + detail/files) vs bottom diff, split by graphFrac.
  const topH = Math.round((bodyH - 4) * graphFrac);
  const bottomH = bodyH - topH - 4; // 4 = splitter

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="logs-panel"
        style={{ width: panelW, height: panelH }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="logs-hd">
          <div className="logs-traffic-lights">
            <button className="logs-tl logs-tl-close" title="Close" onClick={onClose}>
              <X size={9} strokeWidth={2.5} color="rgba(0,0,0,0.6)" />
            </button>
            <button
              className={`logs-tl logs-tl-green ${loading ? "logs-tl-spinning" : ""}`}
              title="Refresh"
              onClick={loadCommits}
              disabled={loading}
            >
              <RotateCw size={9} strokeWidth={2.5} color="rgba(0,0,0,0.6)" />
            </button>
          </div>

          <span className="logs-title">Logs</span>

          <select
            className="logs-branch-sel"
            value={allBranches ? "__all__" : selectedBranch}
            onChange={(e) => {
              if (e.target.value === "__all__") { setAllBranches(true); }
              else { setAllBranches(false); setSelectedBranch(e.target.value); }
            }}
          >
            <option value="__all__">All Branches</option>
            {localBranches.length > 0 && (
              <optgroup label="Local">
                {localBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </optgroup>
            )}
            {remoteBranches.length > 0 && (
              <optgroup label="Remote">
                {remoteBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </optgroup>
            )}
          </select>

          <div className="logs-search">
            <Search size={13} className="logs-search-ico" />
            <input
              className="logs-search-inp"
              placeholder="Filter commits…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            className={`logs-search-toggle ${showSearch || hasSearch ? "active" : ""}`}
            title="Advanced history search"
            onClick={() => setShowSearch((s) => !s)}
          >
            <SlidersHorizontal size={14} />
          </button>

        </div>

        {showSearch && (
          <div className="logs-adv">
            <input
              className="logs-adv-inp"
              placeholder="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            <input
              className="logs-adv-inp"
              placeholder="Message (grep)"
              value={grep}
              onChange={(e) => setGrep(e.target.value)}
            />
            <input
              className="logs-adv-inp"
              placeholder="Content changes (pickaxe -S)"
              value={pickaxe}
              onChange={(e) => setPickaxe(e.target.value)}
            />
            {hasSearch && (
              <button
                className="logs-adv-clear"
                onClick={() => { setAuthor(""); setGrep(""); setPickaxe(""); }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* ── Body: top (graph | detail+files) over bottom (diff) ── */}
        <div className="logs-body">
        <div className="logs-top" style={{ height: topH }}>
        <div className="logs-graph-pane">
        {/* Column headers */}
        <div className="logs-cols-hd">
          <span style={{ flex: 1 }}>Graph / Message</span>
          <span style={{ width: 150 }}>Author</span>
          <span style={{ width: 140, textAlign: "right" }}>Date</span>
        </div>

        {/* Working Tree row (fixed above the scrollable graph) */}
        <div
          className={`logs-wt-row ${wtSelected ? "sel" : ""}`}
          onClick={selectWorkingTree}
        >
          <span className="logs-wt-ico">◍</span>
          <b>Working Tree</b>
          <span className="logs-wt-note">{status ? `${status.files.length} change(s)` : ""}</span>
        </div>

        {/* ── Graph (virtualized) ── */}
        <div className="logs-graph-scroll" ref={graphScrollRef} onScroll={onGraphScroll}>
          {loading && commits.length === 0 ? (
            <div className="logs-empty">Loading…</div>
          ) : filteredCommits.length === 0 ? (
            <div className="logs-empty">No commits found.</div>
          ) : (
            <div className="graph" style={{ height: totalH, position: "relative" }}>
              <svg
                className="graph-svg"
                width={graphW}
                height={totalH}
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                {layout.edges
                  .filter((e) => e.y1 <= visLast && e.y2 >= visFirst)
                  .map((e, i) => {
                    const x1 = e.x1 * COL_W + COL_W / 2 + PAD / 2;
                    const y1 = e.y1 * ROW_H + ROW_H / 2;
                    const x2 = e.x2 * COL_W + COL_W / 2 + PAD / 2;
                    const y2 = e.y2 * ROW_H + ROW_H / 2;
                    const d = x1 === x2
                      ? `M ${x1} ${y1} L ${x2} ${y2}`
                      : `M ${x1} ${y1} C ${x1} ${y1 + ROW_H * 0.5}, ${x2} ${y1 + ROW_H * 0.5}, ${x2} ${y1 + ROW_H} L ${x2} ${y2}`;
                    return <path key={i} d={d} fill="none" stroke={GRAPH_COLORS[e.color]} strokeWidth={1.6} />;
                  })}
                {layout.nodes
                  .filter((n) => n.row >= visFirst && n.row <= visLast)
                  .map((n) => (
                    <circle
                      key={n.commit.hash}
                      cx={n.col * COL_W + COL_W / 2 + PAD / 2}
                      cy={n.row * ROW_H + ROW_H / 2}
                      r={4}
                      fill="var(--graph-stroke)"
                      stroke={laneColor(n.col)}
                      strokeWidth={2}
                    />
                  ))}
              </svg>

              {filteredCommits.slice(visFirst, visLast).map((c, idx) => {
                const row = visFirst + idx;
                const badges = refBadges(c.refs);
                const col = nodeCol.get(c.hash) ?? 0;
                const isMerge = c.parents.length > 1;
                return (
                  <div
                    key={c.hash}
                    className={`grow ${selectedHash === c.hash ? "sel" : ""} ${isMerge ? "merge" : ""}`}
                    style={{ position: "absolute", top: row * ROW_H, left: 0, right: 0, height: ROW_H, paddingLeft: rowTextOffset(layout, row, COL_W, PAD) }}
                    onClick={() => selectCommit(c.hash)}
                    onContextMenu={(e) => { e.preventDefault(); openMenu(c.hash, e.clientX, e.clientY); }}
                  >
                    <span className="c-subject">
                      {badges.map((b, k) => (
                        <span key={k} className={b.cls} style={b.cls === "ref ref-head" ? { borderColor: laneColor(col) } : undefined}>
                          {b.label}
                        </span>
                      ))}
                      {c.subject}
                    </span>
                    <span className="c-author" style={{ width: 150 }}>{c.author}</span>
                    <span className="c-date" style={{ width: 140 }}>{fmtDate(c.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>{/* logs-graph-scroll */}
        </div>{/* logs-graph-pane */}

        {/* vertical divider: graph | right */}
        <div
          className="logs-hsplit"
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { type: "h-split", startX: e.clientX, startFilesW: filesW };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />

        {/* RIGHT: commit detail + files */}
        <div className="logs-right" style={{ width: filesW }}>
          {wtSelected ? (
            <div className="logs-commit-detail">
              <div className="lcd-line">
                <b>Working Tree</b>
                <span className="lcd-meta">{status ? `${status.files.length} change(s)` : ""}</span>
              </div>
              <div className="lcd-actions">
                <button className="primary" onClick={onRequestCommit}>Commit…</button>
                <button onClick={() => api.stageAll(repo).then(onChanged)}>Stage All</button>
              </div>
            </div>
          ) : selectedHash ? (() => {
            const selC = filteredCommits.find((k) => k.hash === selectedHash);
            return (
              <div className="logs-commit-detail">
                <div className="lcd-line">
                  <span className="lcd-hash">{selC?.short ?? selectedHash.slice(0, 8)}</span>
                  {selC && (
                    <span className="lcd-meta">
                      {selC.author} · {fmtDate(selC.timestamp)}
                      {selC.parents.length > 0 && (
                        <> · parent {selC.parents.map((p) => p.slice(0, 7)).join(", ")}</>
                      )}
                    </span>
                  )}
                </div>
                <pre className="lcd-msg">{message || selC?.subject || ""}</pre>
              </div>
            );
          })() : (
            <div className="logs-commit-detail logs-detail-empty-box">Select a commit or Working Tree</div>
          )}

          <div className="logs-files-pane">
            <div className="logs-pane-hd">
              Files {wtSelected ? `(${wtFiles.length})` : loadingFiles ? "…" : `(${files.length})`}
            </div>
            <div className="logs-files-scroll">
              {wtSelected ? (
                wtFiles.length ? (
                  wtFiles.map((f) => {
                    const src = status?.files.find((x) => x.path === f.path);
                    const label = statusLabel(f.status);
                    return (
                      <div
                        key={f.path}
                        className={`logs-file-row ${selectedFile === f.path ? "sel" : ""}`}
                        onClick={() => selectWtFile({ path: f.path, staged: Boolean(src?.staged), untracked: Boolean(src?.untracked) })}
                        onContextMenu={(e) => { e.preventDefault(); wtFileMenu(f.path, Boolean(src?.staged), e.clientX, e.clientY); }}
                      >
                        <span className={`fdot dot-${label}`} />
                        <span className={`logs-file-name state-${label}`} title={f.path}>{f.path.split("/").pop()}</span>
                        {src?.staged && <span className="staged-flag">●</span>}
                      </div>
                    );
                  })
                ) : (
                  <div className="logs-empty" style={{ height: 40 }}>No changes</div>
                )
              ) : files.length ? (
                files.map((f) => {
                  const label = statusLabel(f.status);
                  return (
                    <div
                      key={f.path}
                      className={`logs-file-row ${selectedFile === f.path ? "sel" : ""}`}
                      onClick={() => selectFile(f.path)}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [{ label: "File History", run: () => onFileHistory(f.path) }] }); }}
                    >
                      <span className={`fdot dot-${label}`} />
                      <span className={`logs-file-name state-${label}`} title={f.path}>{f.path.split("/").pop()}</span>
                    </div>
                  );
                })
              ) : (
                <div className="logs-empty" style={{ height: 40 }}>{loadingFiles ? "…" : selectedHash ? "No files" : ""}</div>
              )}
            </div>
          </div>
        </div>{/* logs-right */}
        </div>{/* logs-top */}

        {/* horizontal divider: top | bottom */}
        <div
          className="logs-vsplit"
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { type: "v-split", startY: e.clientY, startFrac: graphFrac, bodyH };
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
          }}
        />

        {/* BOTTOM: diff */}
        <div className="logs-bottom" style={{ height: bottomH }}>
          <div className="logs-pane-hd">{selectedFile ? `Changes of ${selectedFile.split("/").pop()}` : "Changes"}</div>
          <div className="logs-bottom-diff">
            {loadingDiff ? (
              <div className="logs-empty">Loading…</div>
            ) : (
              <DiffView diff={diffText} theme={dark ? "dark" : "light"} layout="split" />
            )}
          </div>
        </div>
        </div>{/* logs-body */}

        {/* ── SE resize handle ── */}
        <div
          className="logs-resize-se"
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { type: "panel-se", startX: e.clientX, startY: e.clientY, startW: panelW, startH: panelH };
            document.body.style.cursor = "se-resize";
            document.body.style.userSelect = "none";
          }}
        />
      </div>

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
