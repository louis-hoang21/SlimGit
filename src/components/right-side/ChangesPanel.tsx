import type { StatusResult } from "../../types";
import DiffView from "../DiffView";
import ConflictView from "../ConflictView";

export interface ChangesPanelProps {
  repo: string;
  onStartVDrag: (e: React.MouseEvent, which: "files" | "journal") => void;
  selPath: string | null;
  conflictFile: string | null;
  onConflictResolved: () => void;
  journalSel: string | null;
  stashSel: number | null;
  status: StatusResult | null;
  diffText: string;
  compareDiff: string;
  compareBase: string | null;
  dark: boolean;
}

export default function ChangesPanel({
  repo,
  onStartVDrag,
  selPath,
  conflictFile,
  onConflictResolved,
  journalSel,
  stashSel,
  status,
  diffText,
  compareDiff,
  compareBase,
  dark,
}: ChangesPanelProps) {
  return (
    <div className="panel sg-changes flex-1 min-h-0">
      <div className="v-splitter" onMouseDown={(e) => onStartVDrag(e, "files")} />
      <div className="panel-hd">
        Changes {selPath && <span className="hd-note">— {selPath}</span>}
        <span className="x">✕</span>
        <div className="spacer" />
      </div>
      <div className="changes-body">
        {conflictFile ? (
          <>
            <div className="head-gutter"><span>HEAD</span></div>
            <ConflictView repo={repo} path={conflictFile} onResolved={onConflictResolved} />
          </>
        ) : journalSel === null && stashSel === null ? (
          <div className="changes-split">
            <div className="changes-pane">
              <div className="cmp-hd">
                <span className="cmp-ttl">Working Tree</span>
                {status?.branch && <span className="cmp-sub">{status.branch}</span>}
              </div>
              <div className="cmp-body">
                <div className="head-gutter"><span>HEAD</span></div>
                <DiffView
                  diff={diffText}
                  theme={dark ? "dark" : "light"}
                  empty="Select a file to view its changes"
                />
              </div>
            </div>
            <div className="changes-pane">
              <div className="cmp-hd">
                <span className="cmp-ttl">Index</span>
                {compareBase && (
                  <span className="cmp-sub">{status?.branch} ↔ {compareBase}</span>
                )}
              </div>
              <div className="cmp-body">
                <DiffView
                  diff={compareDiff}
                  theme={dark ? "dark" : "light"}
                  side="old"
                  empty={
                    selPath
                      ? `No differences vs ${compareBase ?? "base branch"}`
                      : "Select a file to compare with its base branch"
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="head-gutter"><span>HEAD</span></div>
            <DiffView
              diff={diffText}
              theme={dark ? "dark" : "light"}
              empty="Select a file to view its changes"
            />
          </>
        )}
      </div>
    </div>
  );
}
