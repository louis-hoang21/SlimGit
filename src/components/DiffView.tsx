import type { ReactNode } from "react";

interface Props {
  diff: string;
  title?: string;
  empty?: string;
  theme?: "light" | "dark";
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

export default function DiffView({ diff, title, empty, theme = "light" }: Props) {
  const lines = diff.length ? diff.split("\n") : [];
  let oldNo = 0;
  let newNo = 0;

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
          if (kind === "meta") {
            return (
              <div className="dl dl-meta" key={i}>
                <span className="ln" />
                <span className="ln" />
                <span className="sign" />
                <span className="dt">{line}</span>
              </div>
            );
          }
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
          const content = kind === "ctx" ? line.slice(1) : line.slice(1);
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
