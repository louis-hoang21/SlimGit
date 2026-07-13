import type { StatusResult } from "../types";

export interface CommitModalProps {
  status: StatusResult | null;
  stagedCount: number;
  commitMsg: string;
  amend: boolean;
  busy: boolean;
  onMsgChange: (v: string) => void;
  onAmendChange: (v: boolean) => void;
  onClose: () => void;
  onCommit: () => void;
}

export default function CommitModal({
  status,
  stagedCount,
  commitMsg,
  amend,
  busy,
  onMsgChange,
  onAmendChange,
  onClose,
  onCommit,
}: CommitModalProps) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">Commit</div>
        <div className="modal-bd">
          <textarea
            autoFocus
            placeholder="Commit message"
            value={commitMsg}
            onChange={(e) => onMsgChange(e.target.value)}
          />
          <div className="modal-staged">
            {status?.files
              .filter((f) => f.staged && !f.conflicted)
              .map((f) => (
                <div className="row" key={f.path}>
                  <span className="state-Added">✓</span>
                  {f.path}
                </div>
              ))}
            {stagedCount === 0 && (
              <div className="empty-msg">
                No staged files. Stage files first (or use Amend).
              </div>
            )}
          </div>
        </div>
        <div className="modal-ft">
          <label>
            <input
              type="checkbox"
              checked={amend}
              onChange={(e) => onAmendChange(e.target.checked)}
            />
            Amend last commit
          </label>
          <div className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={busy || (stagedCount === 0 && !amend)}
            onClick={onCommit}
          >
            Commit
          </button>
        </div>
      </div>
    </div>
  );
}
