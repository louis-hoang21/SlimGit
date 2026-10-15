import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderGit2 } from "lucide-react";
import type { RepoRef, RepoSortKey } from "../../ui-types";

export interface RepositoriesPanelProps {
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
}

const SORT_LABELS: Record<RepoSortKey, string> = {
  name: "Name",
  added: "Date Added",
  recent: "Recently Used",
};

export default function RepositoriesPanel({
  repoGroups,
  repo,
  onSwitchRepo,
  onRemoveRepos,
  onOpenInNewWindow,
  onRenameRepo,
  onOpenRepoLog,
  groupLabels,
  onRenameGroup,
  repoSort,
  onRepoSortChange,
}: RepositoriesPanelProps) {
  const [repoCtx, setRepoCtx] = useState<{ path: string; x: number; y: number } | null>(null);
  const [groupCtx, setGroupCtx] = useState<{ parent: string; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ branch: string; x: number; y: number } | null>(null);

  const toggleGroup = (parent: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(parent) ? next.delete(parent) : next.add(parent);
      return next;
    });

  const closeMenus = () => {
    setRepoCtx(null);
    setGroupCtx(null);
    setSortMenuOpen(false);
  };

  return (
    <>
      <div className="panel sg-repos" onClick={closeMenus}>
        <div className="panel-hd">
          Repositories
          <div className="spacer" />
          <div style={{ position: "relative" }}>
            <span
              className="hd-tool"
              title={`Sort: ${SORT_LABELS[repoSort]}`}
              onClick={(e) => { e.stopPropagation(); setSortMenuOpen((o) => !o); }}
            >
              ≡
            </span>
            {sortMenuOpen && (
              <div
                className="ctx-menu"
                style={{ position: "absolute", top: "100%", right: 0, zIndex: 999 }}
                onClick={(e) => e.stopPropagation()}
              >
                {(["name", "added", "recent"] as RepoSortKey[]).map((key) => (
                  <div
                    key={key}
                    className="ctx-item"
                    onClick={() => { onRepoSortChange(key); setSortMenuOpen(false); }}
                  >
                    {SORT_LABELS[key]}
                    {repoSort === key && <span className="sc">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel-bd">
          {Object.entries(repoGroups).map(([parent, list]) => (
            <div key={parent}>
              <div
                className="tree-root"
                style={{ cursor: "pointer" }}
                onClick={() => toggleGroup(parent)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGroupCtx({ parent, x: e.clientX, y: e.clientY });
                }}
              >
                {collapsed.has(parent) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <Folder size={14} />
                <span>{groupLabels[parent] ?? parent}</span>
              </div>
              {!collapsed.has(parent) && list.map((r) => (
                <div
                  key={r.path}
                  className={`tree-item ${repo === r.path ? "active" : ""}`}
                  onClick={() => repo !== r.path && onSwitchRepo(r.path)}
                  onMouseEnter={(e) => r.branch && setTooltip({ branch: r.branch, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => r.branch && setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRepoCtx({ path: r.path, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span className="ico"><FolderGit2 size={14} /></span>
                  <span className="name">{r.name}</span>
                  {r.branch && <span className="br">({r.branch})</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div
          className="repo-branch-tooltip"
          style={{ position: "fixed", top: tooltip.y + 14, left: tooltip.x, zIndex: 1000 }}
        >
          {tooltip.branch}
        </div>
      )}

      {repoCtx && (
        <div
          className="ctx-menu"
          style={{ position: "fixed", top: repoCtx.y, left: repoCtx.x, zIndex: 999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`ctx-item ${repo === repoCtx.path ? "disabled" : ""}`}
            onClick={() => { if (repo !== repoCtx.path) { onSwitchRepo(repoCtx.path); setRepoCtx(null); } }}
          >
            Open Repository
          </div>
          <div
            className="ctx-item"
            onClick={() => { onOpenInNewWindow(repoCtx.path); setRepoCtx(null); }}
          >
            Open Repository in New Window
          </div>
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => { onOpenRepoLog(repoCtx.path); setRepoCtx(null); }}
          >
            Log
            <span className="sc">⌘L</span>
          </div>
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => { onRenameRepo(repoCtx.path); setRepoCtx(null); }}
          >
            Rename…
            <span className="sc">F2</span>
          </div>
          <div
            className="ctx-item danger"
            onClick={() => { onRemoveRepos([repoCtx.path]); setRepoCtx(null); }}
          >
            Remove from List
            <span className="sc">⌫</span>
          </div>
        </div>
      )}

      {groupCtx && (
        <div
          className="ctx-menu"
          style={{ position: "fixed", top: groupCtx.y, left: groupCtx.x, zIndex: 999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="ctx-item"
            onClick={() => { toggleGroup(groupCtx.parent); setGroupCtx(null); }}
          >
            {collapsed.has(groupCtx.parent) ? "Expand" : "Collapse"}
          </div>
          <div className="ctx-sep" />
          <div
            className="ctx-item"
            onClick={() => { onRenameGroup(groupCtx.parent); setGroupCtx(null); }}
          >
            Rename…
            <span className="sc">F2</span>
          </div>
          <div
            className="ctx-item danger"
            onClick={() => {
              onRemoveRepos((repoGroups[groupCtx.parent] ?? []).map((r) => r.path));
              setGroupCtx(null);
            }}
          >
            Remove All from List
          </div>
        </div>
      )}
    </>
  );
}
