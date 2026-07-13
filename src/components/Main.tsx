import type { ReactNode } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Folder,
  FolderGit2,
  Search,
  Tag as TagIcon,
  X,
} from "lucide-react";
import type {
  BranchInfo,
  CommitInfo,
  StashInfo,
  StatusResult,
} from "../types";
import type { BNode, Row, RepoRef } from "../ui-types";
import { baseOf, dirOf } from "../utils";
import CommitGraph from "./CommitGraph";
import DiffView from "./DiffView";
import ConflictView from "./ConflictView";

export interface MainProps {
  // ---------- Repositories panel ----------
  repoGroups: Record<string, RepoRef[]>;
  repo: string;
  onSwitchRepo: (path: string) => void;

  // ---------- Branches panel ----------
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  localBranchCount: number;
  localTree: BNode[];
  remoteTrees: Record<string, BNode[]>;
  remoteGroups: Record<string, BranchInfo[]>;
  renderBranchNodes: (nodes: BNode[], depth: number) => ReactNode;
  tags: string[];
  onTagCheckout: (tag: string) => void;
  onTagContext: (tag: string, x: number, y: number) => void;
  stashes: StashInfo[];
  stashSel: number | null;
  onSelectStash: (index: number) => void;
  onStashContext: (s: StashInfo, x: number, y: number) => void;

  // ---------- Files panel ----------
  filesH: number;
  onStartVDrag: (e: React.MouseEvent, which: "files" | "journal") => void;
  filesTitle: string;
  filteredRows: Row[];
  totalRowsCount: number;
  colW: { name: number; state: number };
  onStartColDrag: (e: React.MouseEvent, col: "name" | "state") => void;
  fileQuery: string;
  onFileQueryChange: (v: string) => void;
  onFilesKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  selPath: string | null;
  selPaths: string[];
  onSelectRow: (row: Row, e: React.MouseEvent) => void;
  onFileContext: (row: Row, x: number, y: number) => void;

  // ---------- Changes panel ----------
  conflictFile: string | null;
  onConflictResolved: () => void;
  journalSel: string | null;
  status: StatusResult | null;
  diffText: string;
  compareDiff: string;
  compareBase: string | null;
  dark: boolean;

  // ---------- Journal panel ----------
  journalH: number;
  journalQuery: string;
  onJournalQueryChange: (v: string) => void;
  onSelectWorkingTree: () => void;
  filteredCommits: CommitInfo[];
  onSelectCommit: (hash: string) => void;
  onCommitContext: (hash: string, x: number, y: number) => void;
}

export default function Main({
  repoGroups,
  repo,
  onSwitchRepo,
  collapsedGroups,
  onToggleGroup,
  localBranchCount,
  localTree,
  remoteTrees,
  remoteGroups,
  renderBranchNodes,
  tags,
  onTagCheckout,
  onTagContext,
  stashes,
  stashSel,
  onSelectStash,
  onStashContext,
  filesH,
  onStartVDrag,
  filesTitle,
  filteredRows,
  totalRowsCount,
  colW,
  onStartColDrag,
  fileQuery,
  onFileQueryChange,
  onFilesKeyDown,
  selPath,
  selPaths,
  onSelectRow,
  onFileContext,
  conflictFile,
  onConflictResolved,
  journalSel,
  status,
  diffText,
  compareDiff,
  compareBase,
  dark,
  journalH,
  journalQuery,
  onJournalQueryChange,
  onSelectWorkingTree,
  filteredCommits,
  onSelectCommit,
  onCommitContext,
}: MainProps) {
  return (
    <div className="sg-main">
      {/* Left column */}
      <div className="sg-left">
        <div className="panel sg-repos">
          <div className="panel-hd">
            Repositories <span className="x">✕</span>
            <div className="spacer" />
            <span className="hd-tool">≡</span>
          </div>
          <div className="panel-bd">
            {Object.entries(repoGroups).map(([parent, list]) => (
              <div key={parent}>
                <div className="tree-root">
                  <ChevronDown size={13} />
                  <Folder size={14} />
                  <span>{parent}</span>
                </div>
                {list.map((r) => (
                  <div
                    key={r.path}
                    className={`tree-item ${repo === r.path ? "active" : ""}`}
                    onClick={() => repo !== r.path && onSwitchRepo(r.path)}
                  >
                    <span className="ico">
                      <FolderGit2 size={14} />
                    </span>
                    <span className="name">{r.name}</span>
                    {r.branch && <span className="br">({r.branch})</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel sg-branches">
          <div className="panel-hd">
            Branches <span className="x">✕</span>
            <div className="spacer" />
            <span className="hd-tool">≡</span>
          </div>
          <div className="panel-bd">
            <div className="br-ghead" onClick={() => onToggleGroup("local")}>
              {collapsedGroups.has("local") ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
              <span>Local Branches</span>
              <span className="cnt">({localBranchCount})</span>
            </div>
            {!collapsedGroups.has("local") && renderBranchNodes(localTree, 0)}

            {Object.entries(remoteTrees).map(([remote, tree]) => (
              <div key={remote}>
                <div
                  className="br-ghead"
                  onClick={() => onToggleGroup("r:" + remote)}
                >
                  {collapsedGroups.has("r:" + remote) ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                  <span>{remote.replace(/\b\w/g, (char) => char.toUpperCase())}</span>
                  <span className="cnt">({remoteGroups[remote].length})</span>
                </div>
                {!collapsedGroups.has("r:" + remote) && renderBranchNodes(tree, 0)}
              </div>
            ))}

            {tags.length > 0 && (
              <>
                <div className="br-ghead" onClick={() => onToggleGroup("tags")}>
                  {collapsedGroups.has("tags") ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                  <span>Tags</span>
                  <span className="cnt">({tags.length})</span>
                </div>
                {!collapsedGroups.has("tags") &&
                  tags.map((t) => (
                    <div
                      key={t}
                      className="br-item"
                      style={{ paddingLeft: 24 }}
                      onDoubleClick={() => onTagCheckout(t)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onTagContext(t, e.clientX, e.clientY);
                      }}
                    >
                      <span className="ico">
                        <TagIcon size={13} />
                      </span>
                      <span className="name">{t}</span>
                    </div>
                  ))}
              </>
            )}

            {stashes.length > 0 && (
              <>
                <div className="br-ghead" onClick={() => onToggleGroup("stashes")}>
                  {collapsedGroups.has("stashes") ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                  <span>Stashes</span>
                  <span className="cnt">({stashes.length})</span>
                </div>
                {!collapsedGroups.has("stashes") &&
                  stashes.map((s) => (
                    <div
                      key={s.index}
                      className={`br-item ${stashSel === s.index ? "current" : ""}`}
                      style={{ paddingLeft: 24 }}
                      onClick={() => onSelectStash(s.index)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onStashContext(s, e.clientX, e.clientY);
                      }}
                    >
                      <span className="ico">
                        <Archive size={13} />
                      </span>
                      <span className="name">{s.message}</span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="sg-right">
        {/* Files */}
        <div className="panel sg-files" style={{ height: filesH, flexShrink: 0 }}>
          <div className="panel-hd">
            {filesTitle} &nbsp;
            <span className="hd-note">
              ({filteredRows.length}/{totalRowsCount})
            </span>
            <div className="spacer" />
            <div className="search">
              <Search size={12} />
              <input
                value={fileQuery}
                onChange={(e) => onFileQueryChange(e.target.value)}
                placeholder="Filter files"
              />
              {fileQuery && (
                <X size={12} className="clr" onClick={() => onFileQueryChange("")} />
              )}
            </div>
          </div>
          <div
            className="panel-bd files-panel-bd"
            tabIndex={0}
            onKeyDown={onFilesKeyDown}
            onMouseDown={(e) => e.currentTarget.focus()}
          >
            {filteredRows.length === 0 ? (
              <div className="empty-msg">No files to display</div>
            ) : (
              <table className="ftable">
                <thead>
                  <tr>
                    <th style={{ width: colW.name }}>
                      Name
                      <span
                        className="col-resizer"
                        onMouseDown={(e) => onStartColDrag(e, "name")}
                      />
                    </th>
                    <th style={{ width: colW.state }}>
                      State
                      <span
                        className="col-resizer"
                        onMouseDown={(e) => onStartColDrag(e, "state")}
                      />
                    </th>
                    <th>Relative Directory</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.path}
                      className={
                        selPaths.includes(row.path) || selPath === row.path ? "sel" : ""
                      }
                      onClick={(e) => onSelectRow(row, e)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onFileContext(row, e.clientX, e.clientY);
                      }}
                    >
                      <td className="c-name">
                        <span className="fname">
                          <span className={`fdot dot-${row.state}`} />
                          {baseOf(row.path)}
                        </span>
                      </td>
                      <td className={`c-state state-${row.state}`}>
                        {row.state}
                        {row.staged && !row.conflicted && (
                          <span className="staged-flag">●staged</span>
                        )}
                      </td>
                      <td>{dirOf(row.orig ?? row.path)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Changes */}
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
                <div className="head-gutter">
                  <span>HEAD</span>
                </div>
                <ConflictView
                  repo={repo}
                  path={conflictFile}
                  onResolved={onConflictResolved}
                />
              </>
            ) : journalSel === null && stashSel === null ? (
              <div className="changes-split">
                {/* Left: the current file (working tree vs HEAD). */}
                <div className="changes-pane">
                  <div className="cmp-hd">
                    <span className="cmp-ttl">Working Tree</span>
                    {status?.branch && <span className="cmp-sub">{status.branch}</span>}
                  </div>
                  <div className="cmp-body">
                    <div className="head-gutter">
                      <span>HEAD</span>
                    </div>
                    <DiffView
                      diff={diffText}
                      theme={dark ? "dark" : "light"}
                      empty="Select a file to view its changes"
                    />
                  </div>
                </div>
                {/* Right: current branch compared with the branch it forked from. */}
                <div className="changes-pane">
                  <div className="cmp-hd">
                    <span className="cmp-ttl">Index</span>
                    {compareBase && (
                      <span className="cmp-sub">
                        {status?.branch} ↔ {compareBase}
                      </span>
                    )}
                  </div>
                  <div className="cmp-body">
                    <DiffView
                      diff={compareDiff}
                      theme={dark ? "dark" : "light"}
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
                <div className="head-gutter">
                  <span>HEAD</span>
                </div>
                <DiffView
                  diff={diffText}
                  theme={dark ? "dark" : "light"}
                  empty="Select a file to view its changes"
                />
              </>
            )}
          </div>
        </div>

        {/* Journal */}
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
          <div className="panel-bd" style={{ display: "flex", flexDirection: "column" }}>
            <div
              className={`journal-wt ${journalSel === null && stashSel === null ? "sel" : ""}`}
              onClick={onSelectWorkingTree}
            >
              <span className="wt-ico">
                <CircleDot size={14} />
              </span>
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
      </div>
    </div>
  );
}
