import { useMemo } from "react";
import { CommitInfo } from "../types";
import { computeGraph, GRAPH_COLORS, laneColor } from "../graph";

interface Props {
  commits: CommitInfo[];
  selected: string | null;
  onSelect: (hash: string) => void;
  onContext: (hash: string, x: number, y: number) => void;
}

const ROW_H = 28;
const COL_W = 18;
const PAD = 12;

// Show "Today"/"Yesterday" instead of the full date, keeping the time as-is.
function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfTomorrow = startOfToday + 86400000;
  const startOfYesterday = startOfToday - 86400000;
  const t = d.getTime();
  const time = d.toLocaleTimeString();
  if (t >= startOfToday && t < startOfTomorrow) return `Today ${time}`;
  if (t >= startOfYesterday && t < startOfToday) return `Yesterday ${time}`;
  return d.toLocaleString();
}

function refBadges(refs: string[]) {
  return refs
    .filter((r) => r && r !== "HEAD")
    .map((r) => {
      let cls = "ref";
      if (r.startsWith("HEAD -> ")) {
        r = r.replace("HEAD -> ", "");
        cls = "ref ref-head";
      } else if (r.startsWith("tag: ")) {
        r = r.replace("tag: ", "");
        cls = "ref ref-tag";
      } else if (r.includes("/")) {
        cls = "ref ref-remote";
      }
      return { label: r, cls };
    });
}

export default function CommitGraph({
  commits,
  selected,
  onSelect,
  onContext,
}: Props) {
  const layout = useMemo(() => computeGraph(commits), [commits]);
  const graphW = (layout.maxCol + 1) * COL_W + PAD;
  const totalH = commits.length * ROW_H;

  const nodeCol = new Map(layout.nodes.map((n) => [n.commit.hash, n.col]));

  return (
    <div className="graph" style={{ height: totalH }}>
      <svg
        className="graph-svg"
        width={graphW}
        height={totalH}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {layout.edges.map((e, i) => {
          const x1 = e.x1 * COL_W + COL_W / 2 + PAD / 2;
          const y1 = e.y1 * ROW_H + ROW_H / 2;
          const x2 = e.x2 * COL_W + COL_W / 2 + PAD / 2;
          const y2 = e.y2 * ROW_H + ROW_H / 2;
          const d =
            x1 === x2
              ? `M ${x1} ${y1} L ${x2} ${y2}`
              : `M ${x1} ${y1} C ${x1} ${y1 + ROW_H * 0.6}, ${x2} ${
                  y1 + ROW_H * 0.4
                }, ${x2} ${y1 + ROW_H} L ${x2} ${y2}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={GRAPH_COLORS[e.color]}
              strokeWidth={2}
            />
          );
        })}
        {layout.nodes.map((n) => {
          const cx = n.col * COL_W + COL_W / 2 + PAD / 2;
          const cy = n.row * ROW_H + ROW_H / 2;
          return (
            <circle
              key={n.commit.hash}
              cx={cx}
              cy={cy}
              r={5}
              fill={laneColor(n.col)}
              stroke="var(--graph-stroke)"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      <div className="graph-rows">
        {commits.map((c) => {
          const badges = refBadges(c.refs);
          const col = nodeCol.get(c.hash) ?? 0;
          return (
            <div
              key={c.hash}
              className={`grow ${selected === c.hash ? "sel" : ""}`}
              style={{ height: ROW_H, paddingLeft: graphW }}
              onClick={() => onSelect(c.hash)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContext(c.hash, e.clientX, e.clientY);
              }}
            >
              <span className="c-subject">
                {badges.map((b, k) => (
                  <span
                    key={k}
                    className={b.cls}
                    style={
                      b.cls === "ref ref-head"
                        ? { borderColor: laneColor(col) }
                        : undefined
                    }
                  >
                    {b.label}
                  </span>
                ))}
                {c.subject}
              </span>
              <span className="c-author">{c.author}</span>
              <span className="c-hash">{c.short}</span>
              <span className="c-date">{fmtDate(c.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
