import type { ReactNode } from "react";
import { Archive, ChevronDown, ChevronRight, Tag as TagIcon } from "lucide-react";
import type { BranchInfo, StashInfo } from "../../types";
import type { BNode } from "../../ui-types";

export interface BranchesPanelProps {
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
}

export default function BranchesPanel({
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
}: BranchesPanelProps) {
  return (
    <div className="panel sg-branches">
      <div className="panel-hd">
        Branches
        <div className="spacer" />
      </div>
      <div className="panel-bd">
        <div className="br-ghead" onClick={() => onToggleGroup("local")}>
          {collapsedGroups.has("local") ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <span>Local Branches</span>
          <span className="cnt">({localBranchCount})</span>
        </div>
        {!collapsedGroups.has("local") && renderBranchNodes(localTree, 0)}

        {Object.entries(remoteTrees).map(([remote, tree]) => (
          <div key={remote}>
            <div className="br-ghead" onClick={() => onToggleGroup("r:" + remote)}>
              {collapsedGroups.has("r:" + remote) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              <span>{remote.replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              <span className="cnt">({remoteGroups[remote].length})</span>
            </div>
            {!collapsedGroups.has("r:" + remote) && renderBranchNodes(tree, 0)}
          </div>
        ))}

        {tags.length > 0 && (
          <>
            <div className="br-ghead" onClick={() => onToggleGroup("tags")}>
              {collapsedGroups.has("tags") ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
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
                  onContextMenu={(e) => { e.preventDefault(); onTagContext(t, e.clientX, e.clientY); }}
                >
                  <span className="ico"><TagIcon size={13} /></span>
                  <span className="name">{t}</span>
                </div>
              ))}
          </>
        )}

        {stashes.length > 0 && (
          <>
            <div className="br-ghead" onClick={() => onToggleGroup("stashes")}>
              {collapsedGroups.has("stashes") ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
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
                  onContextMenu={(e) => { e.preventDefault(); onStashContext(s, e.clientX, e.clientY); }}
                >
                  <span className="ico"><Archive size={13} /></span>
                  <span className="name">{s.message}</span>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
