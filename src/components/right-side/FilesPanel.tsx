import { Search, X } from "lucide-react";
import { baseOf, dirOf } from "../../utils";
import type { Row } from "../../ui-types";

export interface FilesPanelProps {
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
}

export default function FilesPanel({
  filesH,
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
}: FilesPanelProps) {
  return (
    <div className="panel sg-files" style={{ height: filesH, flexShrink: 0 }}>
      <div className="panel-hd">
        {filesTitle} &nbsp;
        <span className="hd-note">({filteredRows.length}/{totalRowsCount})</span>
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
        <table className="ftable">
          <thead>
            <tr>
              <th style={{ width: colW.name }}>
                Name
                <span className="col-resizer" onMouseDown={(e) => onStartColDrag(e, "name")} />
              </th>
              <th style={{ width: colW.state }}>
                State
                <span className="col-resizer" onMouseDown={(e) => onStartColDrag(e, "state")} />
              </th>
              <th>Relative Directory</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={3} className="empty-msg">No files to display</td></tr>
            ) : filteredRows.map((row) => (
              <tr
                key={row.path}
                className={[
                  selPaths.includes(row.path) || selPath === row.path ? "sel" : "",
                  row.conflicted ? "row-conflicted" : "",
                ].filter(Boolean).join(" ")}
                onClick={(e) => onSelectRow(row, e)}
                onContextMenu={(e) => { e.preventDefault(); onFileContext(row, e.clientX, e.clientY); }}
              >
                <td className="c-name">
                  <span className="fname">
                    <span className={`fdot dot-${row.state}`} />
                    {baseOf(row.path)}
                  </span>
                </td>
                <td className={`c-state state-${row.state}`}>
                  {row.state}
                  {row.staged && !row.conflicted && <span className="staged-flag">●staged</span>}
                </td>
                <td>{dirOf(row.orig ?? row.path)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
