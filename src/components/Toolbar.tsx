import type { ReactNode } from "react";
import {
  ArrowDown,
  RefreshCcw,
  ArrowUp,
  ArrowDownUp,
  GitCommit,
  FilePlus,
  FileMinus,
  Undo2,
  Archive,
  ArchiveRestore,
  Clock,
  GitBranch,
  GitMerge,
  GitPullRequestArrow,
  Moon,
  Sun,
  MoreHorizontal,
} from "lucide-react";
import type { StatusResult } from "../types";
import type { BadgeColor } from "../ui-types";

// Full class names must appear as literals so Tailwind doesn't purge the rules.
const BADGE_CLASS: Record<BadgeColor, string> = {
  yellow: "tb-badge-yellow",
  red: "tb-badge-red",
  purple: "tb-badge-purple",
  green: "tb-badge-green",
  blue: "tb-badge-blue",
};

const ICON_SIZE = 19;

export interface ToolbarProps {
  status: StatusResult | null;
  stagedCount: number;
  hasStashes: boolean;
  // Stage/Unstage/Discard all act on the current file selection.
  noSelection: boolean;
  dark: boolean;
  busy: boolean;
  inProgress: boolean;
  conflictsCount: number;
  onPull: () => void;
  onFetch: () => void;
  onPullOptions: (e: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  onPush: () => void;
  onSync: () => void;
  onCommitClick: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onSaveStash: () => void;
  onApplyStash: () => void;
  onLog: () => void;
  onNewBranch: () => void;
  onMergeClick: (e: React.MouseEvent) => void;
  onRebaseClick: (e: React.MouseEvent) => void;
  onToggleTheme: () => void;
  onContinueRebase: () => void;
  onContinueCherryPick: () => void;
  onAbortMerge: () => void;
  onAbortRebase: () => void;
  onAbortCherryPick: () => void;
}

export default function Toolbar({
  status,
  stagedCount,
  hasStashes,
  noSelection,
  dark,
  busy,
  inProgress,
  conflictsCount,
  onPull,
  onFetch,
  onPullOptions,
  onMore,
  onPush,
  onSync,
  onCommitClick,
  onStage,
  onUnstage,
  onDiscard,
  onSaveStash,
  onApplyStash,
  onLog,
  onNewBranch,
  onMergeClick,
  onRebaseClick,
  onToggleTheme,
  onContinueRebase,
  onContinueCherryPick,
  onAbortMerge,
  onAbortRebase,
  onAbortCherryPick,
}: ToolbarProps) {
  const TB = (
    ico: ReactNode,
    lbl: string,
    onClick?: (e: React.MouseEvent) => void,
    badge?: string,
    disabled?: boolean,
    badgeColor: BadgeColor = "blue",
    onContextMenu?: (e: React.MouseEvent) => void,
    title?: string
  ) => (
    <button
      className="tb-btn"
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled || busy}
      title={title}
    >
      <span className="tb-ico">{ico}</span>
      <span className="tb-lbl">
        {lbl}
        {badge ? (
          <span className={`tb-badge ${BADGE_CLASS[badgeColor]}`}>{badge}</span>
        ) : (
          ""
        )}
      </span>
    </button>
  );

  return (
    <>
      <div className="sg-toolbar">
        <div className="tb-section tb-section-left">
          <div className="tb-group">
            {TB(
              <ArrowDown size={ICON_SIZE} />,
              "Pull",
              onPull,
              status && status.behind > 0 ? `${status.behind}` : undefined,
              false,
              "yellow",
              onPullOptions,
              "Pull — right-click for options"
            )}
            {TB(
              <RefreshCcw size={ICON_SIZE} />,
              "Fetch",
              onFetch,
              undefined,
              false,
              "blue",
              onPullOptions,
              "Fetch — right-click for options"
            )}
            {TB(
              <ArrowUp size={ICON_SIZE} />,
              "Push",
              onPush,
              status && status.ahead > 0 ? `${status.ahead}` : undefined,
              false,
              "green"
            )}
            {TB(<ArrowDownUp size={ICON_SIZE} />, "Sync", onSync)}
            {TB(
              <GitCommit size={ICON_SIZE} />,
              "Commit",
              onCommitClick,
              stagedCount ? `${stagedCount}` : undefined,
              false,
              "blue"
            )}
          </div>
        </div>
        <div className="tb-section tb-section-center">
          <div className="tb-group">
            {TB(<FilePlus size={ICON_SIZE} />, "Stage", onStage, undefined, noSelection)}
            {TB(<FileMinus size={ICON_SIZE} />, "Unstage", onUnstage, undefined, noSelection)}
            {TB(<Undo2 size={ICON_SIZE} />, "Discard", onDiscard, undefined, noSelection)}
            {TB(<Archive size={ICON_SIZE} />, "Save Stash", onSaveStash)}
            {TB(<ArchiveRestore size={ICON_SIZE} />, "Apply Stash", onApplyStash, undefined, !hasStashes)}
          </div>
          <div className="tb-group">
            {TB(<Clock size={ICON_SIZE} />, "Logs", onLog)}
          </div>
        </div>
        <div className="tb-section tb-section-right">
          <div className="tb-group">
            {TB(<GitBranch size={ICON_SIZE} />, "Branch", onNewBranch)}
            {/* {TB(<Workflow size={ICON_SIZE} />, "Git-Flow", undefined, undefined, true)} */}
            {TB(<GitMerge size={ICON_SIZE} />, "Merge", onMergeClick)}
            {TB(<GitPullRequestArrow size={ICON_SIZE} />, "Rebase", onRebaseClick)}
          </div>
          <div className="tb-group">
            {TB(<MoreHorizontal size={ICON_SIZE} />, "More", onMore)}
          </div>
          <div className="tb-group">
            <button className="tb-btn" onClick={onToggleTheme}>
              <span className="tb-ico">{dark ? <Sun size={ICON_SIZE} /> : <Moon size={ICON_SIZE} />}</span>
              <span className="tb-lbl">{dark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </div>

      {inProgress && (
        <div className="banner">
          <span>
            ⚠{" "}
            {status?.merging && "Merge in progress"}
            {status?.rebasing && "Rebase in progress"}
            {status?.cherry_picking && "Cherry-pick in progress"}
            {conflictsCount > 0 && ` — ${conflictsCount} conflicted file(s)`}
          </span>
          <div className="spacer" />
          {conflictsCount === 0 && status?.rebasing && (
            <button onClick={onContinueRebase}>Continue Rebase</button>
          )}
          {conflictsCount === 0 && status?.cherry_picking && (
            <button onClick={onContinueCherryPick}>Continue Cherry-pick</button>
          )}
          {status?.merging && (
            <button className="danger" onClick={onAbortMerge}>
              Abort Merge
            </button>
          )}
          {status?.rebasing && (
            <button className="danger" onClick={onAbortRebase}>
              Abort Rebase
            </button>
          )}
          {status?.cherry_picking && (
            <button className="danger" onClick={onAbortCherryPick}>
              Abort Cherry-pick
            </button>
          )}
        </div>
      )}
    </>
  );
}
