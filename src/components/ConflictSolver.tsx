import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from "lucide-react";
import { api } from "../api";
import { highlight } from "./DiffView";

interface Props {
  repo: string;
  path: string;
  onResolved: () => void;
  onClose: () => void;
}

type Resolution = null | "ours" | "theirs" | "ours_theirs" | "theirs_ours";

interface CtxSeg {
  type: "ctx";
  lines: string[];
}
interface ConfSeg {
  type: "conf";
  ours: string[];
  theirs: string[];
  base: string[];
  oursLabel: string;
  theirsLabel: string;
}
type Seg = CtxSeg | ConfSeg;

interface PaneLine {
  t: string;
  /** conflict index this line belongs to (undefined = context) */
  ci?: number;
  cls?: "conf" | "res" | "marker";
  /** first line of its conflict block (anchor for the reset button) */
  first?: boolean;
}

function parseSegments(text: string): Seg[] {
  const segs: Seg[] = [];
  let ctx: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("<<<<<<<")) {
      if (ctx.length) {
        segs.push({ type: "ctx", lines: ctx });
        ctx = [];
      }
      const conf: ConfSeg = {
        type: "conf",
        ours: [],
        theirs: [],
        base: [],
        oursLabel: l.slice(7).trim() || "ours",
        theirsLabel: "theirs",
      };
      i++;
      let mode: "ours" | "base" | "theirs" = "ours";
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        const c = lines[i];
        if (c.startsWith("|||||||")) mode = "base";
        else if (c === "=======" || (c.startsWith("=======") && mode !== "theirs")) mode = "theirs";
        else conf[mode].push(c);
        i++;
      }
      if (i < lines.length) {
        conf.theirsLabel = lines[i].slice(7).trim() || "theirs";
        i++;
      }
      segs.push(conf);
    } else {
      ctx.push(l);
      i++;
    }
  }
  if (ctx.length) segs.push({ type: "ctx", lines: ctx });
  return segs;
}

const LINE_H = 18;

export default function ConflictSolver({ repo, path, onResolved, onClose }: Props) {
  const [segs, setSegs] = useState<Seg[] | null>(null);
  const [res, setRes] = useState<Resolution[]>([]);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Ready");

  const leftRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  // Snapshots of `res` before each change, so Cmd/Ctrl+Z can step back.
  const undoStack = useRef<Resolution[][]>([]);

  useEffect(() => {
    api
      .conflictContent(repo, path)
      .then((text) => {
        const s = parseSegments(text);
        setSegs(s);
        setRes(s.filter((x) => x.type === "conf").map(() => null));
        setCur(0);
        undoStack.current = [];
      })
      .catch((e) => setMsg(String(e)));
  }, [repo, path]);

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) {
      setMsg("Nothing to undo");
      return;
    }
    setRes(prev);
    setMsg("Undo");
  }

  // Cmd/Ctrl+Z undoes the last resolution while the solver is open.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const conflicts = useMemo(
    () => (segs ?? []).filter((s): s is ConfSeg => s.type === "conf"),
    [segs]
  );
  const total = conflicts.length;
  const resolvedCount = res.filter(Boolean).length;
  const oursLabel = conflicts[0]?.oursLabel ?? "ours";
  const theirsLabel = conflicts[0]?.theirsLabel ?? "theirs";

  /** Lines chosen for a resolved conflict. */
  function chosenLines(c: ConfSeg, r: Resolution): string[] {
    switch (r) {
      case "ours": return c.ours;
      case "theirs": return c.theirs;
      case "ours_theirs": return [...c.ours, ...c.theirs];
      case "theirs_ours": return [...c.theirs, ...c.ours];
      default: return [];
    }
  }

  const { left, mid, right, anchors } = useMemo(() => {
    const left: PaneLine[] = [];
    const mid: PaneLine[] = [];
    const right: PaneLine[] = [];
    // anchor line index of each conflict, per pane
    const anchors = { left: [] as number[], mid: [] as number[], right: [] as number[] };
    let ci = 0;
    for (const s of segs ?? []) {
      if (s.type === "ctx") {
        for (const t of s.lines) {
          left.push({ t });
          mid.push({ t });
          right.push({ t });
        }
        continue;
      }
      anchors.left.push(left.length);
      anchors.mid.push(mid.length);
      anchors.right.push(right.length);
      s.ours.forEach((t, k) => left.push({ t, ci, cls: "conf", first: k === 0 }));
      if (!s.ours.length) left.push({ t: "", ci, cls: "conf", first: true });
      s.theirs.forEach((t, k) => right.push({ t, ci, cls: "conf", first: k === 0 }));
      if (!s.theirs.length) right.push({ t: "", ci, cls: "conf", first: true });
      const r = res[ci];
      if (r) {
        const lines = chosenLines(s, r);
        if (lines.length) lines.forEach((t, k) => mid.push({ t, ci, cls: "res", first: k === 0 }));
        else mid.push({ t: "", ci, cls: "res", first: true });
      } else {
        mid.push({ t: `<<<<<<< ${s.oursLabel}`, ci, cls: "marker", first: true });
        s.ours.forEach((t) => mid.push({ t, ci, cls: "conf" }));
        mid.push({ t: "=======", ci, cls: "marker" });
        s.theirs.forEach((t) => mid.push({ t, ci, cls: "conf" }));
        mid.push({ t: `>>>>>>> ${s.theirsLabel}`, ci, cls: "marker" });
      }
      ci++;
    }
    return { left, mid, right, anchors };
  }, [segs, res]);

  function goto(i: number) {
    if (i < 0 || i >= total) return;
    setCur(i);
    syncing.current = true;
    const panes: [React.RefObject<HTMLDivElement>, number[]][] = [
      [leftRef, anchors.left],
      [midRef, anchors.mid],
      [rightRef, anchors.right],
    ];
    for (const [ref, a] of panes) {
      const el = ref.current;
      if (el) el.scrollTop = Math.max(0, a[i] * LINE_H - el.clientHeight / 3);
    }
    requestAnimationFrame(() => (syncing.current = false));
  }

  function nextUnresolved(from: number, r: Resolution[]): number {
    for (let k = 1; k <= total; k++) {
      const i = (from + k) % total;
      if (!r[i]) return i;
    }
    return from;
  }

  // Resolve a specific conflict block (used by the inline pane arrows). Unlike
  // `take`, it doesn't jump to the next conflict — you stay where you clicked.
  function takeAt(ci: number, kind: Exclude<Resolution, null>) {
    if (ci < 0 || ci >= total) return;
    undoStack.current.push([...res]);
    const r = [...res];
    r[ci] = kind;
    setRes(r);
    setCur(ci);
    setMsg(`Conflict ${ci + 1}: took ${kind.replace("_", " then ")}`);
  }

  function take(kind: Exclude<Resolution, null>) {
    if (!total) return;
    undoStack.current.push([...res]);
    const r = [...res];
    r[cur] = kind;
    setRes(r);
    setMsg(`Conflict ${cur + 1}: took ${kind.replace("_", " then ")}`);
    if (r.some((x) => !x)) goto(nextUnresolved(cur, r));
  }

  function resetConflict(i: number) {
    undoStack.current.push([...res]);
    const r = [...res];
    r[i] = null;
    setRes(r);
    setCur(i);
  }

  function composed(): string {
    const out: string[] = [];
    let ci = 0;
    for (const s of segs ?? []) {
      if (s.type === "ctx") {
        out.push(...s.lines);
        continue;
      }
      const r = res[ci];
      if (r) out.push(...chosenLines(s, r));
      else {
        out.push(`<<<<<<< ${s.oursLabel}`, ...s.ours, "=======", ...s.theirs, `>>>>>>> ${s.theirsLabel}`);
      }
      ci++;
    }
    return out.join("\n");
  }

  async function save() {
    setBusy(true);
    try {
      await api.saveFile(repo, path, composed());
      if (res.every(Boolean)) {
        await api.markResolved(repo, [path]);
        onResolved();
      } else {
        setMsg(`Saved — ${total - resolvedCount} conflict(s) remaining`);
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onScroll(src: "left" | "mid" | "right") {
    if (syncing.current) return;
    const refs = { left: leftRef, mid: midRef, right: rightRef };
    const el = refs[src].current;
    if (!el) return;
    const denom = el.scrollHeight - el.clientHeight;
    // A pane that can't scroll must never drive the others — otherwise a stray
    // scroll event from it (fired after we synced it) would yank everyone to the
    // top (ratio 0). Just ignore it.
    if (denom <= 0) return;
    syncing.current = true;
    const ratio = el.scrollTop / denom;
    for (const key of ["left", "mid", "right"] as const) {
      if (key === src) continue;
      const o = refs[key].current;
      if (!o) continue;
      const target = ratio * (o.scrollHeight - o.clientHeight);
      // Only write when it actually differs, so we don't spawn feedback scroll
      // events that fight the user's scrolling.
      if (Math.abs(o.scrollTop - target) > 1) o.scrollTop = target;
      if (Math.abs(o.scrollLeft - el.scrollLeft) > 1) o.scrollLeft = el.scrollLeft;
    }
    requestAnimationFrame(() => (syncing.current = false));
  }

  function pane(
    title: string,
    lines: PaneLine[],
    ref: React.RefObject<HTMLDivElement>,
    key: "left" | "mid" | "right"
  ) {
    return (
      <div className={`cfs-pane cfs-pane-${key}`}>
        <div className="cfs-pane-hd">{title}</div>
        <div className="cfs-code" ref={ref} onScroll={() => onScroll(key)}>
          {lines.map((ln, i) => (
            <div
              key={i}
              className={[
                "cfs-line",
                // Literal class names so Tailwind doesn't tree-shake them.
                ln.cls === "conf" ? "cfs-conf" : ln.cls === "res" ? "cfs-res" : ln.cls === "marker" ? "cfs-marker" : "",
                ln.ci === cur && ln.cls ? "cfs-cur" : "",
              ].filter(Boolean).join(" ")}
              onClick={ln.ci !== undefined ? () => setCur(ln.ci!) : undefined}
            >
              {/* SmartGit-style inline "take" arrows on each conflict block. */}
              {key === "left" && ln.cls === "conf" && ln.first && (
                <button
                  className={`cfs-take cfs-take-ours ${res[ln.ci!] === "ours" ? "on" : ""}`}
                  title="Take Left (ours)"
                  onClick={(e) => { e.stopPropagation(); takeAt(ln.ci!, "ours"); }}
                >
                  {"»"}
                </button>
              )}
              {key === "right" && ln.cls === "conf" && ln.first && (
                <button
                  className={`cfs-take cfs-take-theirs ${res[ln.ci!] === "theirs" ? "on" : ""}`}
                  title="Take Right (theirs)"
                  onClick={(e) => { e.stopPropagation(); takeAt(ln.ci!, "theirs"); }}
                >
                  {"«"}
                </button>
              )}
              <span className="cfs-ln">{i + 1}</span>
              <span className="cfs-act">
                {key === "mid" && ln.first && res[ln.ci!] && (
                  <button
                    className="cfs-reset"
                    title="Undo this resolution"
                    onClick={(e) => { e.stopPropagation(); resetConflict(ln.ci!); }}
                  >
                    ×
                  </button>
                )}
              </span>
              <span className="cfs-tx">
                {ln.cls === "marker" ? (ln.t || " ") : highlight(ln.t || " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tb = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false
  ) => (
    <button className="cfs-tool" disabled={disabled || busy} onClick={onClick} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="cfs-overlay">
      <div className="cfs-win">
        <div className="cfs-title">
          <span>[{path}] - Conflict Solver</span>
          <button className="cfs-x" onClick={onClose} title="Close"><X size={14} /></button>
        </div>
        <div className="cfs-toolbar">
          {tb("Save", <Save size={16} />, save, !total)}
          <span className="cfs-sep" />
          {tb("Prev. Change", <ArrowUp size={16} />, () => goto(cur - 1), cur <= 0)}
          {tb("Next Change", <ArrowDown size={16} />, () => goto(cur + 1), cur >= total - 1)}
          <span className="cfs-sep" />
          {tb("Take Left, Right", <ArrowLeftRight size={16} />, () => take("ours_theirs"), !total)}
          {tb("Take Left", <ArrowLeft size={16} />, () => take("ours"), !total)}
          {tb("Take Right", <ArrowRight size={16} />, () => take("theirs"), !total)}
          {tb("Take Right, Left", <ArrowLeftRight size={16} />, () => take("theirs_ours"), !total)}
          <div className="spacer" />
          {tb("Prev. Conflict", <ChevronUp size={16} />, () => goto(cur - 1), cur <= 0)}
          {tb("Next Conflict", <ChevronDown size={16} />, () => goto(cur + 1), cur >= total - 1)}
        </div>
        <div className="cfs-body">
          {pane(`${oursLabel} ("ours")`, left, leftRef, "left")}
          {pane("Working Tree", mid, midRef, "mid")}
          {pane(`${theirsLabel} ("theirs")`, right, rightRef, "right")}
        </div>
        <div className="cfs-status">
          <span>{msg}</span>
          <div className="spacer" />
          <span>
            {total
              ? `${resolvedCount}/${total} conflict(s) resolved`
              : segs
                ? "No conflict markers found"
                : "Loading…"}
          </span>
        </div>
      </div>
    </div>
  );
}
