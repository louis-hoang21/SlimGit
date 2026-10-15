import type { StatusResult } from "../../types";
import DiffView, { type HunkAction } from "../DiffView";
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
  // Per-hunk staging (working tree only). null hides the controls.
  hunkMode: "staged" | "unstaged" | null;
  onHunkAction: (patch: string, action: HunkAction) => void;
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
  dark,
  hunkMode,
  onHunkAction,
}: ChangesPanelProps) {
  const oldLabel = journalSel !== null ? "Parent" : "HEAD";
  const newLabel =
    journalSel !== null ? "Commit" : stashSel !== null ? "Stash" : `Working Tree${status?.branch ? ` (${status.branch})` : ""}`;
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
        ) : (
          // SmartGit-style side-by-side: old (HEAD/index) on the left,
          // new (working tree / selected commit) on the right, lines aligned.
          <DiffView
            diff={diffText}
            theme={dark ? "dark" : "light"}
            layout="split"
            oldLabel={oldLabel}
            newLabel={newLabel}
            empty="Select a file to view its changes"
            hunkMode={hunkMode}
            onHunkAction={onHunkAction}
          />
        )}
      </div>
    </div>
  );
}
