import type { ReactNode } from "react";

interface Props {
  diff: string;
  title?: string;
  empty?: string;
  theme?: "light" | "dark";
  /** "old" renders only the base-branch side of the diff (single column) */
  side?: "old";
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
// Exported so the Conflict Solver can render its panes with the same theme.
export function highlight(code: string): ReactNode[] {
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

export default function DiffView({ diff, title, empty, theme = "light", side }: Props) {
  const lines = diff.length ? diff.split("\n") : [];
  let oldNo = 0;
  let newNo = 0;

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
