import { useState } from "react";
import { ChevronDown, Folder, FolderGit2 } from "lucide-react";
import type { RepoRef, RepoSortKey } from "../../ui-types";

export interface RepositoriesPanelProps {
  repoGroups: Record<string, RepoRef[]>;
  repo: string;
  onSwitchRepo: (path: string) => void;
  onRemoveRepo: (path: string) => void;
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
  onRemoveRepo,
  repoSort,
  onRepoSortChange,
}: RepositoriesPanelProps) {
  const [repoCtx, setRepoCtx] = useState<{ path: string; x: number; y: number } | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ branch: string; x: number; y: number } | null>(null);

  const closeMenus = () => {
    setRepoCtx(null);
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
            className="ctx-item danger"
            onClick={() => { onRemoveRepo(repoCtx.path); setRepoCtx(null); }}
          >
            Remove from List
          </div>
        </div>
      )}
    </>
  );
}
