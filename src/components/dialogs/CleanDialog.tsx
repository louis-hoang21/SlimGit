import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";

interface Props {
  repo: string;
  onClose: () => void;
  notify: (msg: string, err?: boolean) => void;
  onChanged: () => void;
}

// Preview and remove untracked files (git clean), optionally including ignored.
export default function CleanDialog({ repo, onClose, notify, onChanged }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await api.cleanPreview(repo));
    } catch (e) {
      notify(String(e), true);
    } finally {
      setLoading(false);
    }
  }, [repo, notify]);

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

  async function doClean() {
    setCleaning(true);
    try {
      await api.clean(repo, includeIgnored);
      notify(`Cleaned ${files.length} item(s)`);
      onChanged();
      onClose();
    } catch (e) {
      notify(String(e), true);
    } finally {
      setCleaning(false);
    }
  }

  const empty = !loading && files.length === 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">Clean — remove untracked files</div>
        <div className="modal-bd">
          <div className="clean-warn">
            <AlertTriangle size={16} className="shrink-0" />
            <span>These files will be permanently deleted from disk and cannot be recovered.</span>
          </div>
          <div className="clean-list">
            {loading && <div className="rmt-empty">Loading…</div>}
            {empty && <div className="rmt-empty">Nothing to clean.</div>}
            {files.map((f) => (
              <div key={f} className="clean-row" title={f}>{f}</div>
            ))}
          </div>
          <label className="modal-ft" style={{ padding: 0, border: 0, background: "transparent" }}>
            <input
              type="checkbox"
              checked={includeIgnored}
              onChange={(e) => setIncludeIgnored(e.target.checked)}
            />
            <span>Also remove ignored files (-x)</span>
          </label>
        </div>
        <div className="modal-ft">
          <div style={{ flex: 1 }} />
          <button className="dlg-btn" onClick={onClose}>Cancel</button>
          <button
            className="dlg-btn dlg-btn-primary dlg-btn-danger"
            onClick={doClean}
            disabled={cleaning || empty}
          >
            Remove {files.length ? `(${files.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
