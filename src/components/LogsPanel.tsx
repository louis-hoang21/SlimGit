import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, X, RotateCw } from "lucide-react";
import { CommitInfo, BranchInfo, DiffFile } from "../types";
import { computeGraph, GRAPH_COLORS, laneColor } from "../graph";
import DiffView from "./DiffView";
import ContextMenu from "./common/ContextMenu";
import type { Menu } from "../ui-types";
import { api } from "../api";

interface Props {
  repo: string;
  branches: BranchInfo[];
  currentBranch: string;
  dark: boolean;
  onClose: () => void;
  onCherryPick: (hash: string) => Promise<void>;
  onRevert: (hash: string) => Promise<void>;
}

const ROW_H = 28;
const COL_W = 18;
const PAD = 12;

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
  repo, branches, currentBranch, dark, onClose, onCherryPick, onRevert,
}: Props) {
  const [selectedBranch, setSelectedBranch] = useState(currentBranch);
  const [allBranches, setAllBranches] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Selection
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Context menu
  const [menu, setMenu] = useState<Menu | null>(null);

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

  // --- Data loading ---
  const loadCommits = useCallback(async () => {
    setLoading(true);
    setSelectedHash(null);
    setFiles([]);
    setDiffText("");
    try {
      const result = allBranches
        ? await api.logGraph(repo, 500, true)
        : await api.logBranch(repo, selectedBranch, 500);
      setCommits(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [repo, selectedBranch, allBranches]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

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
    setSelectedHash(hash);
    setFiles([]);
    setDiffText("");
    setSelectedFile(null);
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

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  // Body height = panel height - header(42) - col-header(28)
  const HEADER_H = 42;
  const COL_HDR_H = 28;
  const bodyH = panelH - HEADER_H - COL_HDR_H;
  const graphH = Math.round(bodyH * graphFrac);
  const detailH = bodyH - graphH - 4; // 4 = splitter

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

        </div>

        {/* ── Column headers ── */}
        <div className="logs-cols-hd">
          <span style={{ flex: 1 }}>Graph / Message</span>
          <span style={{ width: 130 }}>Author</span>
          <span style={{ width: 58 }}>Hash</span>
          <span style={{ width: 150, textAlign: "right" }}>Date</span>
        </div>

        {/* ── Graph (top) ── */}
        <div className="logs-graph-wrap" style={{ height: graphH }}>
          {loading && commits.length === 0 ? (
            <div className="logs-empty">Loading…</div>
          ) : filteredCommits.length === 0 ? (
            <div className="logs-empty">No commits found.</div>
          ) : (
            <div className="graph" style={{ height: totalH }}>
              <svg
                className="graph-svg"
                width={graphW}
                height={totalH}
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                {layout.edges.map((e, i) => {
                  const x1 = e.x1 * COL_W + COL_W / 2 + PAD / 2;
                  const y1 = e.y1 * ROW_H + ROW_H / 2;
                  const x2 = e.x2 * COL_W + COL_W / 2 + PAD / 2;
                  const y2 = e.y2 * ROW_H + ROW_H / 2;
                  const d = x1 === x2
                    ? `M ${x1} ${y1} L ${x2} ${y2}`
                    : `M ${x1} ${y1} C ${x1} ${y1 + ROW_H * 0.6}, ${x2} ${y1 + ROW_H * 0.4}, ${x2} ${y1 + ROW_H} L ${x2} ${y2}`;
                  return <path key={i} d={d} fill="none" stroke={GRAPH_COLORS[e.color]} strokeWidth={2} />;
                })}
                {layout.nodes.map((n) => (
                  <circle
                    key={n.commit.hash}
                    cx={n.col * COL_W + COL_W / 2 + PAD / 2}
                    cy={n.row * ROW_H + ROW_H / 2}
                    r={5}
                    fill={laneColor(n.col)}
                    stroke="var(--graph-stroke)"
                    strokeWidth={1.5}
                  />
                ))}
              </svg>

              <div className="graph-rows">
                {filteredCommits.map((c) => {
                  const badges = refBadges(c.refs);
                  const col = nodeCol.get(c.hash) ?? 0;
                  return (
                    <div
                      key={c.hash}
                      className={`grow ${selectedHash === c.hash ? "sel" : ""}`}
                      style={{ height: ROW_H, paddingLeft: graphW }}
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
                      <span className="c-author">{c.author}</span>
                      <span className="c-hash">{c.short}</span>
                      <span className="c-date">{fmtDate(c.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Vertical splitter ── */}
        <div
          className="logs-vsplit"
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { type: "v-split", startY: e.clientY, startFrac: graphFrac, bodyH };
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
          }}
        />

        {/* ── Detail row: files + diff ── */}
        {selectedHash && (
          <div className="logs-detail" style={{ height: detailH }}>
            {/* Files panel */}
            <div className="logs-files" style={{ width: filesW }}>
              <div className="logs-pane-hd">Changed Files{loadingFiles ? " …" : ` (${files.length})`}</div>
              <div className="logs-files-scroll">
                {files.map((f) => {
                  const label = statusLabel(f.status);
                  return (
                    <div
                      key={f.path}
                      className={`logs-file-row ${selectedFile === f.path ? "sel" : ""}`}
                      onClick={() => selectFile(f.path)}
                    >
                      <span className={`fdot dot-${label}`} />
                      <span className={`logs-file-name state-${label}`} title={f.path}>
                        {f.path.split("/").pop()}
                      </span>
                    </div>
                  );
                })}
                {!loadingFiles && files.length === 0 && (
                  <div className="logs-empty" style={{ height: 40 }}>No files</div>
                )}
              </div>
            </div>

            {/* Horizontal splitter */}
            <div
              className="logs-hsplit"
              onMouseDown={(e) => {
                e.preventDefault();
                dragRef.current = { type: "h-split", startX: e.clientX, startFilesW: filesW };
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />

            {/* Diff panel */}
            <div className="logs-diff" style={{ flex: 1, overflow: "hidden" }}>
              <div className="logs-pane-hd">{selectedFile ?? "Diff"}</div>
              <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                {loadingDiff ? (
                  <div className="logs-empty">Loading…</div>
                ) : (
                  <DiffView diff={diffText} theme={dark ? "dark" : "light"} />
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedHash && (
          <div className="logs-detail logs-detail-empty" style={{ height: detailH }}>
            <span>Select a commit to view changed files</span>
          </div>
        )}

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
