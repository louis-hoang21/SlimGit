import type { ReactNode } from "react";
import type { BranchInfo, CommitInfo, StashInfo, StatusResult } from "../types";
import type { BNode, Row, RepoRef, RepoSortKey } from "../ui-types";
import type { HunkAction } from "./DiffView";
import RepositoriesPanel from "./left-side/RepositoriesPanel";
import BranchesPanel from "./left-side/BranchesPanel";
import FilesPanel from "./right-side/FilesPanel";
import ChangesPanel from "./right-side/ChangesPanel";
import JournalPanel from "./right-side/JournalPanel";

export interface MainProps {
  // ---------- Repositories ----------
  repoGroups: Record<string, RepoRef[]>;
  repo: string;
  onSwitchRepo: (path: string) => void;
  onRemoveRepos: (paths: string[]) => void;
  onOpenInNewWindow: (path: string) => void;
  onRenameRepo: (path: string) => void;
  onOpenRepoLog: (path: string) => void;
  groupLabels: Record<string, string>;
  onRenameGroup: (parent: string) => void;
  repoSort: RepoSortKey;
  onRepoSortChange: (sort: RepoSortKey) => void;

  // ---------- Branches ----------
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

  // ---------- Files ----------
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

  // ---------- Changes ----------
  conflictFile: string | null;
  onConflictResolved: () => void;
  journalSel: string | null;
  status: StatusResult | null;
  diffText: string;
  compareDiff: string;
  compareBase: string | null;
  dark: boolean;
  hunkMode: "staged" | "unstaged" | null;
  onHunkAction: (patch: string, action: HunkAction) => void;

  // ---------- Journal ----------
  journalH: number;
  journalQuery: string;
  onJournalQueryChange: (v: string) => void;
  onSelectWorkingTree: () => void;
  filteredCommits: CommitInfo[];
  onSelectCommit: (hash: string) => void;
  onCommitContext: (hash: string, x: number, y: number) => void;
}

export default function Main({
  repoGroups, repo, onSwitchRepo, onRemoveRepos, onOpenInNewWindow, onRenameRepo, onOpenRepoLog, groupLabels, onRenameGroup, repoSort, onRepoSortChange,
  collapsedGroups, onToggleGroup, localBranchCount, localTree, remoteTrees,
  remoteGroups, renderBranchNodes, tags, onTagCheckout, onTagContext,
  stashes, stashSel, onSelectStash, onStashContext,
  filesH, onStartVDrag, filesTitle, filteredRows, totalRowsCount, colW,
  onStartColDrag, fileQuery, onFileQueryChange, onFilesKeyDown,
  selPath, selPaths, onSelectRow, onFileContext,
  conflictFile, onConflictResolved, journalSel, status, diffText,
  compareDiff, compareBase, dark, hunkMode, onHunkAction,
  journalH, journalQuery, onJournalQueryChange, onSelectWorkingTree,
  filteredCommits, onSelectCommit, onCommitContext,
}: MainProps) {
  return (
    <div className="sg-main">
      <div className="sg-left">
        <RepositoriesPanel
          repoGroups={repoGroups}
          repo={repo}
          onSwitchRepo={onSwitchRepo}
          onRemoveRepos={onRemoveRepos}
          onOpenInNewWindow={onOpenInNewWindow}
          onRenameRepo={onRenameRepo}
          onOpenRepoLog={onOpenRepoLog}
          groupLabels={groupLabels}
          onRenameGroup={onRenameGroup}
          repoSort={repoSort}
          onRepoSortChange={onRepoSortChange}
        />
        <BranchesPanel
          collapsedGroups={collapsedGroups}
          onToggleGroup={onToggleGroup}
          localBranchCount={localBranchCount}
          localTree={localTree}
          remoteTrees={remoteTrees}
          remoteGroups={remoteGroups}
          renderBranchNodes={renderBranchNodes}
          tags={tags}
          onTagCheckout={onTagCheckout}
          onTagContext={onTagContext}
          stashes={stashes}
          stashSel={stashSel}
          onSelectStash={onSelectStash}
          onStashContext={onStashContext}
        />
      </div>
      <div className="sg-right">
        <FilesPanel
          filesH={filesH}
          onStartVDrag={onStartVDrag}
          filesTitle={filesTitle}
          filteredRows={filteredRows}
          totalRowsCount={totalRowsCount}
          colW={colW}
          onStartColDrag={onStartColDrag}
          fileQuery={fileQuery}
          onFileQueryChange={onFileQueryChange}
          onFilesKeyDown={onFilesKeyDown}
          selPath={selPath}
          selPaths={selPaths}
          onSelectRow={onSelectRow}
          onFileContext={onFileContext}
        />
        <ChangesPanel
          repo={repo}
          onStartVDrag={onStartVDrag}
          selPath={selPath}
          conflictFile={conflictFile}
          onConflictResolved={onConflictResolved}
          journalSel={journalSel}
          stashSel={stashSel}
          status={status}
          diffText={diffText}
          compareDiff={compareDiff}
          compareBase={compareBase}
          dark={dark}
          hunkMode={hunkMode}
          onHunkAction={onHunkAction}
        />
        <JournalPanel
          journalH={journalH}
          onStartVDrag={onStartVDrag}
          journalQuery={journalQuery}
          onJournalQueryChange={onJournalQueryChange}
          onSelectWorkingTree={onSelectWorkingTree}
          filteredCommits={filteredCommits}
          onSelectCommit={onSelectCommit}
          onCommitContext={onCommitContext}
          journalSel={journalSel}
          stashSel={stashSel}
          status={status}
        />
      </div>
    </div>
  );
}
