import { useCallback, useEffect, useState } from "react";
import { X, RotateCw } from "lucide-react";
import { api } from "../api";
import ContextMenu from "./common/ContextMenu";
import type { Menu } from "../ui-types";

interface ReflogEntry {
  selector: string;
  hash: string;
  short: string;
  subject: string;
}

interface Props {
  repo: string;
  currentBranch: string;
  onClose: () => void;
  onCheckout: (hash: string) => void;
  onReset: (hash: string, mode: "soft" | "mixed" | "hard") => void;
}

// SmartGit-style reflog browser: every HEAD movement, with recovery actions.
export default function ReflogPanel({ repo, currentBranch, onClose, onCheckout, onReset }: Props) {
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.reflog(repo, 200));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [repo]);

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

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  function openMenu(e: ReflogEntry, x: number, y: number) {
    setMenu({
      x,
      y,
      items: [
        { label: `Check Out ${e.short}`, run: () => onCheckout(e.hash) },
        { sep: true },
        { label: `Reset ${currentBranch} to here — Soft`, run: () => onReset(e.hash, "soft") },
        { label: "Reset to here — Mixed", run: () => onReset(e.hash, "mixed") },
        { label: "Reset to here — Hard (discard)", danger: true, run: () => onReset(e.hash, "hard") },
        { sep: true },
        { label: "Copy Commit ID", run: () => navigator.clipboard.writeText(e.hash) },
      ],
    });
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="logs-panel"
        style={{ width: Math.min(window.innerWidth * 0.8, 860), height: Math.min(window.innerHeight * 0.85, 720) }}
        onClick={(ev) => ev.stopPropagation()}
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
          <span className="logs-title">Reflog</span>
          <div style={{ flex: 1 }} />
          <span className="rmt-hint">Right-click an entry to recover</span>
        </div>

        <div className="logs-cols-hd">
          <span style={{ width: 150 }}>Selector</span>
          <span style={{ width: 70 }}>Hash</span>
          <span style={{ flex: 1 }}>Subject</span>
        </div>

        <div className="reflog-scroll">
          {loading && entries.length === 0 ? (
            <div className="logs-empty">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="logs-empty">No reflog entries.</div>
          ) : (
            entries.map((e, i) => (
              <div
                key={`${e.selector}-${i}`}
                className="reflog-row"
                onContextMenu={(ev) => { ev.preventDefault(); openMenu(e, ev.clientX, ev.clientY); }}
                onClick={(ev) => openMenu(e, ev.clientX, ev.clientY)}
              >
                <span className="reflog-sel" title={e.selector}>{e.selector}</span>
                <span className="reflog-hash">{e.short}</span>
                <span className="reflog-subj" title={e.subject}>{e.subject}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
