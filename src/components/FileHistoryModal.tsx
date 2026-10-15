import { useCallback, useEffect, useState } from "react";
import { X, RotateCw } from "lucide-react";
import { api } from "../api";
import DiffView from "./DiffView";
import type { CommitInfo } from "../types";

interface Props {
  repo: string;
  path: string;
  dark: boolean;
  onClose: () => void;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

// Log limited to a single file ("File History"): commits that touched it, with
// the per-commit diff of that file.
export default function FileHistoryModal({ repo, path, dark, onClose }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSel(null);
    setDiff("");
    try {
      const cs = await api.logFile(repo, path, 300);
      setCommits(cs);
      if (cs.length) selectCommit(cs[0].hash);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, path]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function selectCommit(hash: string) {
    setSel(hash);
    setDiff("");
    setLoadingDiff(true);
    try {
      setDiff(await api.commitFileDiff(repo, hash, path));
    } catch (e) {
      setDiff(String(e));
    } finally {
      setLoadingDiff(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="logs-panel"
        style={{ width: Math.min(window.innerWidth * 0.9, 1100), height: Math.min(window.innerHeight * 0.9, 800) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logs-hd">
          <div className="logs-traffic-lights">
            <button className="logs-tl logs-tl-close" title="Close" onClick={onClose}>
              <X size={9} strokeWidth={2.5} color="rgba(0,0,0,0.6)" />
            </button>
            <button
              className={`logs-tl logs-tl-green ${loading ? "logs-tl-spinning" : ""}`}
              title="Refresh"
              onClick={load}
              disabled={loading}
            >
              <RotateCw size={9} strokeWidth={2.5} color="rgba(0,0,0,0.6)" />
            </button>
          </div>
          <span className="logs-title">File History</span>
          <span className="rmt-hint" title={path}>— {path}</span>
        </div>

        <div className="logs-detail" style={{ flex: 1, height: "auto" }}>
          <div className="logs-files" style={{ width: 340 }}>
            <div className="logs-pane-hd">
              Commits{loading ? " …" : ` (${commits.length})`}
            </div>
            <div className="logs-files-scroll">
              {!loading && commits.length === 0 && (
                <div className="logs-empty" style={{ height: 40 }}>No history</div>
              )}
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className={`fh-row ${sel === c.hash ? "sel" : ""}`}
                  onClick={() => selectCommit(c.hash)}
                >
                  <div className="fh-subj" title={c.subject}>{c.subject}</div>
                  <div className="fh-meta">
                    <span className="fh-hash">{c.short}</span>
                    <span className="fh-author">{c.author}</span>
                    <span className="fh-date">{fmtDate(c.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="logs-diff" style={{ flex: 1, overflow: "hidden" }}>
            <div className="logs-pane-hd">{sel ? `Diff — ${path.split("/").pop()}` : "Diff"}</div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              {loadingDiff ? (
                <div className="logs-empty">Loading…</div>
              ) : (
                <DiffView diff={diff} theme={dark ? "dark" : "light"} empty="Select a commit" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
