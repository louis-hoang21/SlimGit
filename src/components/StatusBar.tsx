import type { StatusResult } from "../types";

export interface StatusBarProps {
  repo: string | null;
  status: StatusResult | null;
  email?: string;
}

export default function StatusBar({ repo, status, email }: StatusBarProps) {
  return (
    <div className="sg-status">
      <span className="mono">{email ? `${email} — ${repo}` : repo}</span>
      <div className="spacer" />
      {status && (
        <span className="mono">
          {status.branch}
          {status.upstream ? ` → ${status.upstream}` : " (no upstream)"} · ↑
          {status.ahead} ↓{status.behind} · {status.files.length} change(s)
        </span>
      )}
    </div>
  );
}
