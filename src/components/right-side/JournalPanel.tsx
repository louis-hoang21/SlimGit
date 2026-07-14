import { CircleDot, Search, X } from "lucide-react";
import type { CommitInfo, StatusResult } from "../../types";
import CommitGraph from "../CommitGraph";

export interface JournalPanelProps {
  journalH: number;
  onStartVDrag: (e: React.MouseEvent, which: "files" | "journal") => void;
  journalQuery: string;
  onJournalQueryChange: (v: string) => void;
  onSelectWorkingTree: () => void;
  filteredCommits: CommitInfo[];
  onSelectCommit: (hash: string) => void;
  onCommitContext: (hash: string, x: number, y: number) => void;
  journalSel: string | null;
  stashSel: number | null;
  status: StatusResult | null;
}

export default function JournalPanel({
  journalH,
  onStartVDrag,
  journalQuery,
  onJournalQueryChange,
  onSelectWorkingTree,
  filteredCommits,
  onSelectCommit,
  onCommitContext,
  journalSel,
  stashSel,
  status,
}: JournalPanelProps) {
  return (
    <div className="panel sg-journal" style={{ height: journalH, flexShrink: 0 }}>
      <div className="v-splitter" onMouseDown={(e) => onStartVDrag(e, "journal")} />
      <div className="panel-hd">
        Journal
        <div className="spacer" />
        <div className="search">
          <Search size={12} />
          <input
            value={journalQuery}
            size={9}
            onChange={(e) => onJournalQueryChange(e.target.value)}
            placeholder="Search message or Commit"
          />
          {journalQuery && (
            <X size={12} className="clr" onClick={() => onJournalQueryChange("")} />
          )}
        </div>
      </div>
      <div
        className="panel-bd"
        style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div
          className={`journal-wt ${journalSel === null && stashSel === null ? "sel" : ""}`}
          onClick={onSelectWorkingTree}
        >
          <span className="wt-ico"><CircleDot size={14} /></span>
          <b>Working Tree</b>
          <span style={{ color: "var(--text-mute)" }}>
            {status ? `${status.files.length} uncommitted change(s)` : ""}
          </span>
        </div>
        <div className="journal-scroll">
          <CommitGraph
            commits={filteredCommits}
            selected={journalSel}
            onSelect={onSelectCommit}
            onContext={onCommitContext}
          />
        </div>
      </div>
    </div>
  );
}
