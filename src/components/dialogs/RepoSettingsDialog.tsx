import { useEffect, useState } from "react";
import { api } from "../../api";

interface Props {
  repo: string;
  onClose: () => void;
  notify: (msg: string, err?: boolean) => void;
}

// Minimal repo settings: the committer identity (user.name / user.email).
export default function RepoSettingsDialog({ repo, onClose, notify }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [n, e] = await Promise.all([
          api.getConfig(repo, "user.name").catch(() => ""),
          api.getConfig(repo, "user.email").catch(() => ""),
        ]);
        setName((n ?? "").trim());
        setEmail((e ?? "").trim());
      } finally {
        setLoading(false);
      }
    })();
  }, [repo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      await api.setConfig(repo, "user.name", name.trim());
      await api.setConfig(repo, "user.email", email.trim());
      notify("Settings saved");
      onClose();
    } catch (e) {
      notify(String(e), true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="dlg" onClick={(e) => e.stopPropagation()} style={{ minWidth: 420 }}>
        <div className="dlg-hd dlg-hd-input">
          <span className="dlg-title">Repository Settings</span>
        </div>
        <div className="dlg-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="set-field">
            <span className="set-label">User Name</span>
            <input
              className="dlg-input"
              value={name}
              placeholder={loading ? "Loading…" : "Your Name"}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="set-field">
            <span className="set-label">User Email</span>
            <input
              className="dlg-input"
              value={email}
              placeholder={loading ? "Loading…" : "you@example.com"}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            />
          </label>
        </div>
        <div className="dlg-ft">
          <button className="dlg-btn" onClick={onClose}>Cancel</button>
          <button className="dlg-btn dlg-btn-primary" onClick={save} disabled={saving || loading}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
