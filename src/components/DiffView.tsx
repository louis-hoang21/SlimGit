import type { ReactNode } from "react";

export type HunkAction = "stage" | "unstage" | "discard";

interface Props {
  diff: string;
  title?: string;
  empty?: string;
  theme?: "light" | "dark";
  /** "old" renders only the base-branch side of the diff (single column) */
  side?: "old";
  /** "split" renders SmartGit-style side-by-side old|new columns */
  layout?: "split";
  /** Column headers in split layout. */
  oldLabel?: string;
  newLabel?: string;
  /**
   * Enables per-hunk staging controls (split layout only). "unstaged" offers
   * Stage/Discard, "staged" offers Unstage. Omit/null to hide the controls.
   */
  hunkMode?: "staged" | "unstaged" | null;
  /** Invoked with a minimal single-hunk unified-diff patch. */
  onHunkAction?: (patch: string, action: HunkAction) => void;
}

// Split a raw unified diff into its file header (everything before the first
// `@@`) and one string per hunk (the `@@` line plus its body). A single-hunk
// patch = header + one hunk, which `git apply` accepts for partial staging.
function extractHunkPatches(lines: string[]): { header: string; hunks: string[] } {
  const headerLines: string[] = [];
  const hunks: string[] = [];
  let cur: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (cur) hunks.push(cur.join("\n"));
      cur = [line];
    } else if (cur) {
      cur.push(line);
    } else {
      headerLines.push(line);
    }
  }
  if (cur) hunks.push(cur.join("\n"));
  return { header: headerLines.join("\n"), hunks };
}

type Kind = "hunk" | "add" | "del" | "meta" | "ctx";

function classify(line: string): Kind {
  if (line.startsWith("@@")) return "hunk";
  if (
    line.startsWith("diff ") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("similarity ") ||
    line.startsWith("rename ") ||
    line.startsWith("old mode") ||
    line.startsWith("new mode")
  )
    return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "ctx";
}

const KEYWORDS = new Set([
  "function", "return", "const", "let", "var", "if", "else", "for", "while",
  "switch", "case", "break", "continue", "new", "class", "extends", "import",
  "from", "export", "default", "async", "await", "try", "catch", "finally",
  "throw", "typeof", "instanceof", "in", "of", "this", "super", "yield", "void",
  "delete", "public", "private", "protected", "static", "interface", "type",
  "enum", "namespace", "implements", "readonly", "func", "struct", "fn", "pub",
  "use", "impl", "match", "def", "package", "return;", "null", "nil",
  "undefined", "true", "false", "and", "or", "not", "with", "as", "is",
]);
const TYPES = new Set([
  "string", "number", "boolean", "void", "any", "unknown", "never", "object",
  "bigint", "symbol", "int", "int64", "int32", "float", "float64", "double",
  "bool", "byte", "rune", "error", "String", "Number", "Boolean", "Object",
  "Array", "Promise", "Map", "Set", "Date", "RegExp",
]);

// Lightweight, single-pass syntax highlighter good enough for diff previews.
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /(\/\/[^\n]*|#[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d_.]*\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\sA-Za-z0-9_$]+)/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(code))) {
    if (m[1]) out.push(<span key={key++} className="tok-com">{m[1]}</span>);
    else if (m[2]) out.push(<span key={key++} className="tok-str">{m[2]}</span>);
    else if (m[3]) out.push(<span key={key++} className="tok-num">{m[3]}</span>);
    else if (m[4]) {
      const w = m[4];
      const isCall = /^\s*\(/.test(code.slice(re.lastIndex));
      let cls = "";
      if (KEYWORDS.has(w)) cls = "tok-kw";
      else if (TYPES.has(w)) cls = "tok-type";
      else if (isCall) cls = "tok-fn";
      else if (/^[A-Z]/.test(w)) cls = "tok-type";
      out.push(cls ? <span key={key++} className={cls}>{w}</span> : w);
    } else if (m[5]) out.push(m[5]);
    else if (m[6]) out.push(<span key={key++} className="tok-punct">{m[6]}</span>);
    else out.push(m[0]);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

type SplitRow =
  | { kind: "hunk"; text: string }
  | { kind: "ctx"; oldLn: number; newLn: number; content: string }
  | { kind: "del"; oldLn: number; content: string }
  | { kind: "add"; newLn: number; content: string };

function parseSplitRows(lines: string[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of lines) {
    const k = classify(line);
    if (k === "meta") continue;
    if (k === "hunk") {
      const mm = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (mm) { oldNo = parseInt(mm[1], 10); newNo = parseInt(mm[2], 10); }
      rows.push({ kind: "hunk", text: line });
      continue;
    }
    const content = line.slice(1);
    if (k === "del")      rows.push({ kind: "del", oldLn: oldNo++, content });
    else if (k === "add") rows.push({ kind: "add", newLn: newNo++, content });
    else                  rows.push({ kind: "ctx", oldLn: oldNo++, newLn: newNo++, content });
  }
  return rows;
}

// Pair diff rows into aligned left(old)/right(new) columns, SmartGit-style:
// a run of deletions is zipped with the following run of additions, extra
// lines on either side get an empty cell so both columns stay in lockstep.
type Cell = { ln: number; content: string; tone: "ctx" | "del" | "add" } | null;
type DualRow = { kind: "hunk"; text: string } | { kind: "pair"; left: Cell; right: Cell };

function buildDualRows(rows: SplitRow[]): DualRow[] {
  const out: DualRow[] = [];
  let dels: Extract<SplitRow, { kind: "del" }>[] = [];
  let adds: Extract<SplitRow, { kind: "add" }>[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) {
      const d = dels[i];
      const a = adds[i];
      out.push({
        kind: "pair",
        left: d ? { ln: d.oldLn, content: d.content, tone: "del" } : null,
        right: a ? { ln: a.newLn, content: a.content, tone: "add" } : null,
      });
    }
    dels = [];
    adds = [];
  };
  for (const r of rows) {
    if (r.kind === "hunk") {
      flush();
      out.push({ kind: "hunk", text: r.text });
    } else if (r.kind === "del") {
      dels.push(r);
    } else if (r.kind === "add") {
      adds.push(r);
    } else {
      flush();
      out.push({
        kind: "pair",
        left: { ln: r.oldLn, content: r.content, tone: "ctx" },
        right: { ln: r.newLn, content: r.content, tone: "ctx" },
      });
    }
  }
  flush();
  return out;
}

function SplitCell({ cell }: { cell: Cell }) {
  if (!cell) return <div className="ds-half ds-empty" />;
  const toneCls = cell.tone === "del" ? "ds-del" : cell.tone === "add" ? "ds-add" : "";
  return (
    <div className={`ds-half ${toneCls}`}>
      <span className="ds-ln">{cell.ln}</span>
      <span className="ds-dt">{highlight(cell.content || " ")}</span>
    </div>
  );
}

export default function DiffView({
  diff, title, empty, theme = "light", side, layout, oldLabel, newLabel,
  hunkMode, onHunkAction,
}: Props) {
  const lines = diff.length ? diff.split("\n") : [];
  let oldNo = 0;
  let newNo = 0;

  if (layout === "split") {
    if (lines.length === 0) {
      return (
        <div className="diff">
          <div className="diff-empty diff-empty-fill">{empty ?? "No changes to display"}</div>
        </div>
      );
    }
    const dual = buildDualRows(parseSplitRows(lines));
    const hunkControls = Boolean(hunkMode && onHunkAction);
    const { header, hunks } = hunkControls
      ? extractHunkPatches(lines)
      : { header: "", hunks: [] as string[] };
    // Build a self-contained single-hunk patch (header + one hunk + newline).
    const patchFor = (idx: number) => `${header}\n${hunks[idx]}\n`;
    let hunkIdx = -1;
    return (
      <div className="diff">
        {(oldLabel || newLabel) && (
          <div className="ds-colhd">
            <span className="ds-colhd-cell">{oldLabel ?? "Old"}</span>
            <span className="ds-colhd-cell">{newLabel ?? "New"}</span>
          </div>
        )}
        {lines.length === 0 && <div className="diff-empty">{empty ?? "No changes to display"}</div>}
        <div className={`diff-body code-${theme}`}>
          {dual.map((row, i) => {
            if (row.kind === "hunk") {
              hunkIdx++;
              const idx = hunkIdx;
              return (
                <div className="ds-row ds-hunk" key={i}>
                  <span className="dt">{row.text}</span>
                  {hunkControls && hunks[idx] !== undefined && (
                    <span className="hunk-acts">
                      {hunkMode === "unstaged" ? (
                        <>
                          <button
                            className="hunk-btn"
                            onClick={() => onHunkAction!(patchFor(idx), "stage")}
                          >
                            Stage hunk
                          </button>
                          <button
                            className="hunk-btn hunk-btn-danger"
                            onClick={() => onHunkAction!(patchFor(idx), "discard")}
                          >
                            Discard
                          </button>
                        </>
                      ) : (
                        <button
                          className="hunk-btn"
                          onClick={() => onHunkAction!(patchFor(idx), "unstage")}
                        >
                          Unstage hunk
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            }
            return (
              <div className="ds-row" key={i}>
                <SplitCell cell={row.left} />
                <SplitCell cell={row.right} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (side === "old") {
    // Render only the base-branch version: context + deleted lines.
    // Added lines (present only in the current branch) become empty
    // placeholder rows so both panes stay vertically aligned.
    const rows = parseSplitRows(lines);
    return (
      <div className="diff">
        {title && <div className="diff-title">{title}</div>}
        {lines.length === 0 && <div className="diff-empty">{empty ?? "No changes to display"}</div>}
        <div className={`diff-body code-${theme}`}>
          {rows.map((r, i) => {
            if (r.kind === "hunk") {
              return (
                <div className="dl dl-hunk" key={i}>
                  <span className="ln" />
                  <span className="sign" />
                  <span className="dt">{r.text}</span>
                </div>
              );
            }
            if (r.kind === "add") {
              return (
                <div className="dl dl-old-gap" key={i}>
                  <span className="ln" />
                  <span className="sign" />
                  <span className="dt"> </span>
                </div>
              );
            }
            return (
              <div className={`dl ${r.kind === "del" ? "dl-del" : "dl-ctx"}`} key={i}>
                <span className="ln">{r.oldLn}</span>
                <span className="sign">{r.kind === "del" ? "-" : " "}</span>
                <span className="dt">{highlight(r.content || " ")}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="diff">
      {title && <div className="diff-title">{title}</div>}
      {lines.length === 0 && (
        <div className="diff-empty">{empty ?? "No changes to display"}</div>
      )}
      <div className={`diff-body code-${theme}`}>
        {lines.map((line, i) => {
          const kind = classify(line);
          if (kind === "hunk") {
            const mm = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (mm) {
              oldNo = parseInt(mm[1], 10);
              newNo = parseInt(mm[2], 10);
            }
            return (
              <div className="dl dl-hunk" key={i}>
                <span className="ln" />
                <span className="ln" />
                <span className="sign" />
                <span className="dt">{line}</span>
              </div>
            );
          }
          if (kind === "meta") return null;
          let l = "";
          let r = "";
          let sign = " ";
          if (kind === "add") {
            r = String(newNo++);
            sign = "+";
          } else if (kind === "del") {
            l = String(oldNo++);
            sign = "-";
          } else {
            l = String(oldNo++);
            r = String(newNo++);
          }
          const content = line.slice(1);
          return (
            <div className={`dl dl-${kind}`} key={i}>
              <span className="ln">{l}</span>
              <span className="ln">{r}</span>
              <span className="sign">{sign}</span>
              <span className="dt">{highlight(content || " ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
