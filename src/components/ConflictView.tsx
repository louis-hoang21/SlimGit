import { useEffect, useState } from "react";
import { api } from "../api";

interface Props {
  repo: string;
  path: string;
  onResolved: () => void;
}

export default function ConflictView({ repo, path, onResolved }: Props) {
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDirty(false);
    api.conflictContent(repo, path).then(setContent).catch(() => setContent(""));
  }, [repo, path]);

  const hasMarkers = /^<<<<<<< |^=======$|^>>>>>>> /m.test(content);

  async function take(side: "ours" | "theirs") {
    setBusy(true);
    try {
      await api.resolveConflict(repo, path, side);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function saveAndResolve() {
    setBusy(true);
    try {
      await api.saveFile(repo, path, content);
      await api.markResolved(repo, [path]);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="conflict">
      <div className="conflict-bar">
        <span className="conflict-file">⚠ Conflict: {path}</span>
        <div className="spacer" />
        <button disabled={busy} onClick={() => take("ours")}>
          Take Ours
        </button>
        <button disabled={busy} onClick={() => take("theirs")}>
          Take Theirs
        </button>
        <button
          disabled={busy || hasMarkers}
          title={hasMarkers ? "Remove all conflict markers first" : ""}
          onClick={saveAndResolve}
        >
          Save & Mark Resolved
        </button>
      </div>
      <textarea
        className="conflict-editor"
        spellCheck={false}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
      />
      {hasMarkers && (
        <div className="conflict-hint">
          Conflict markers still present{dirty ? " (unsaved edits)" : ""}. Edit
          the file to remove &lt;&lt;&lt;&lt;, ====, &gt;&gt;&gt;&gt; then Save &
          Mark Resolved.
        </div>
      )}
    </div>
  );
}
