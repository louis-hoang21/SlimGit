import { useCallback, useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { api } from "../api";
import DiffView from "./DiffView";
import type { BranchInfo, DiffFile } from "../types";

interface Props {
  repo: string;
  branches: BranchInfo[];
  tags: string[];
  currentBranch: string;
  dark: boolean;
  onClose: () => void;
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    M: "Modified", A: "Added", D: "Deleted", R: "Renamed",
    C: "Copied", U: "Conflicted", "?": "Untracked",
  };
  return m[s] ?? s;
}

// Compare any two refs (branches / tags): list changed files, show split diff.
export default function CompareModal({ repo, branches, tags, currentBranch, dark, onClose }: Props) {
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);

  const [from, setFrom] = useState(currentBranch);
  const [to, setTo] = useState("HEAD");
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);

  const compare = useCallback(async () => {
    if (!from || !to || from === to) {
      setFiles([]);
      setErr(from === to ? "Pick two different refs" : "");
      return;
    }
    setLoading(true);
    setErr("");
    setSel(null);
    setDiff("");
    try {
      const fs = await api.compareFiles(repo, from, to);
      setFiles(fs);
      if (fs.length) selectFile(fs[0].path);
    } catch (e) {
      setErr(String(e));
      setFiles([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, from, to]);

  useEffect(() => {
    compare();
  }, [compare]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function selectFile(path: string) {
    setSel(path);
    setDiff("");
    setLoadingDiff(true);
    try {
      setDiff(await api.compareFileDiff(repo, from, to, path));
    } catch (e) {
      setDiff(String(e));
    } finally {
      setLoadingDiff(false);
    }
  }

  const refSelect = (value: string, onChange: (v: string) => void) => (
    <select className="logs-branch-sel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="HEAD">HEAD</option>
      {local.length > 0 && (
        <optgroup label="Local">
          {local.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </optgroup>
      )}
      {remote.length > 0 && (
        <optgroup label="Remote">
          {remote.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </optgroup>
      )}
      {tags.length > 0 && (
        <optgroup label="Tags">
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
    </select>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="logs-panel"
        style={{ width: Math.min(window.innerWidth * 0.92, 1200), height: Math.min(window.innerHeight * 0.92, 820) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logs-hd">
          <div className="logs-traffic-lights">
            <button className="logs-tl logs-tl-close" title="Close" onClick={onClose}>
              <X size={9} strokeWidth={2.5} color="rgba(0,0,0,0.6)" />
            </button>
          </div>
          <span className="logs-title">Compare</span>
          <div className="cmp-refs">
            {refSelect(from, setFrom)}
            <ArrowRight size={14} className="cmp-arrow" />
            {refSelect(to, setTo)}
          </div>
        </div>

        <div className="logs-detail" style={{ flex: 1, height: "auto" }}>
          <div className="logs-files" style={{ width: 320 }}>
            <div className="logs-pane-hd">
              Changed Files{loading ? " …" : ` (${files.length})`}
            </div>
            <div className="logs-files-scroll">
              {err && <div className="logs-empty" style={{ height: 60, padding: 8, textAlign: "center" }}>{err}</div>}
              {!loading && !err && files.length === 0 && (
                <div className="logs-empty" style={{ height: 40 }}>No differences</div>
              )}
              {files.map((f) => {
                const label = statusLabel(f.status);
                return (
                  <div
                    key={f.path}
                    className={`logs-file-row ${sel === f.path ? "sel" : ""}`}
                    onClick={() => selectFile(f.path)}
                  >
                    <span className={`fdot dot-${label}`} />
                    <span className={`logs-file-name state-${label}`} title={f.path}>
                      {f.path.split("/").pop()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="logs-diff" style={{ flex: 1, overflow: "hidden" }}>
            <div className="logs-pane-hd">{sel ?? "Diff"}</div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              {loadingDiff ? (
                <div className="logs-empty">Loading…</div>
              ) : (
                <DiffView
                  diff={diff}
                  theme={dark ? "dark" : "light"}
                  layout="split"
                  oldLabel={from}
                  newLabel={to}
                  empty="Select a file to view its changes"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
