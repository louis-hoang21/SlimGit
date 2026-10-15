import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { api } from "../../api";

interface Props {
  repo: string;
  onClose: () => void;
  notify: (msg: string, err?: boolean) => void;
  onChanged: () => void;
}

interface Remote {
  name: string;
  url: string;
}

// SmartGit-style remotes manager: list, add, rename, change URL, remove.
export default function RemotesDialog({ repo, onClose, notify, onChanged }: Props) {
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  // Inline edit of an existing remote's URL / name.
  const [editName, setEditName] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [renameName, setRenameName] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRemotes(await api.remotesVerbose(repo));
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

  async function commit(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn();
      notify(okMsg);
      await load();
      onChanged();
    } catch (e) {
      notify(String(e), true);
    }
  }

  async function addRemote() {
    const n = newName.trim();
    const u = newUrl.trim();
    if (!n || !u) return;
    await commit(() => api.remoteAdd(repo, n, u), `Added remote ${n}`);
    setAdding(false);
    setNewName("");
    setNewUrl("");
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">Remotes</div>
        <div className="modal-bd">
          <div className="rmt-list">
            {loading && remotes.length === 0 && (
              <div className="rmt-empty">Loading…</div>
            )}
            {!loading && remotes.length === 0 && (
              <div className="rmt-empty">No remotes configured.</div>
            )}
            {remotes.map((r) => (
              <div key={r.name} className="rmt-row">
                {renameName === r.name ? (
                  <>
                    <input
                      className="dlg-input rmt-inp"
                      value={renameVal}
                      autoFocus
                      onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameVal.trim() && renameVal.trim() !== r.name) {
                          commit(() => api.remoteRename(repo, r.name, renameVal.trim()), "Remote renamed");
                          setRenameName(null);
                        }
                        if (e.key === "Escape") setRenameName(null);
                      }}
                    />
                    <button
                      className="rmt-ibtn"
                      title="Save"
                      onClick={() => {
                        if (renameVal.trim() && renameVal.trim() !== r.name) {
                          commit(() => api.remoteRename(repo, r.name, renameVal.trim()), "Remote renamed");
                        }
                        setRenameName(null);
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button className="rmt-ibtn" title="Cancel" onClick={() => setRenameName(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : editName === r.name ? (
                  <>
                    <span className="rmt-name">{r.name}</span>
                    <input
                      className="dlg-input rmt-inp"
                      value={editUrl}
                      autoFocus
                      onChange={(e) => setEditUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editUrl.trim()) {
                          commit(() => api.remoteSetUrl(repo, r.name, editUrl.trim()), "Remote URL updated");
                          setEditName(null);
                        }
                        if (e.key === "Escape") setEditName(null);
                      }}
                    />
                    <button
                      className="rmt-ibtn"
                      title="Save"
                      onClick={() => {
                        if (editUrl.trim()) {
                          commit(() => api.remoteSetUrl(repo, r.name, editUrl.trim()), "Remote URL updated");
                        }
                        setEditName(null);
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button className="rmt-ibtn" title="Cancel" onClick={() => setEditName(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rmt-name">{r.name}</span>
                    <span className="rmt-url" title={r.url}>{r.url}</span>
                    <button
                      className="rmt-ibtn"
                      title="Rename"
                      onClick={() => { setRenameName(r.name); setRenameVal(r.name); }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="rmt-ibtn"
                      title="Change URL"
                      onClick={() => { setEditName(r.name); setEditUrl(r.url); }}
                    >
                      <span className="rmt-ibtn-txt">URL</span>
                    </button>
                    <button
                      className="rmt-ibtn rmt-ibtn-danger"
                      title="Remove"
                      onClick={() => commit(() => api.remoteRemove(repo, r.name), `Removed ${r.name}`)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {adding ? (
            <div className="rmt-add">
              <input
                className="dlg-input"
                placeholder="name (e.g. origin)"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="dlg-input"
                placeholder="https://github.com/user/repo.git"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addRemote(); }}
              />
              <div className="rmt-add-ft">
                <button className="dlg-btn" onClick={() => setAdding(false)}>Cancel</button>
                <button
                  className="dlg-btn dlg-btn-primary"
                  disabled={!newName.trim() || !newUrl.trim()}
                  onClick={addRemote}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button className="rmt-addbtn" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add Remote
            </button>
          )}
        </div>
        <div className="modal-ft">
          <div className="spacer" style={{ flex: 1 }} />
          <button className="dlg-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
