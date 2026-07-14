import { FolderGit2, Folder, Clock } from "lucide-react";
import type { RepoRef } from "../ui-types";

interface WelcomeScreenProps {
  onOpenRepository: () => void;
  recentRepos?: RepoRef[];
  onOpenRecent?: (path: string) => void;
}

function WelcomeIntro() {
  return (
    <section className="welcome-pane welcome-intro">
      <div>
        <div className="welcome-kicker-blue">SlimGit</div>
        <h1>Welcome to <span className="welcome-kicker">V{__APP_VERSION__}</span></h1>
        <div className="welcome-divider" />
        <p className="welcome-tagline">Fast. Focused. Simple.</p>
      </div>
    </section>
  );
}

function WelcomeRepositoryPicker({ onOpenRepository, recentRepos = [], onOpenRecent }: WelcomeScreenProps) {
  return (
    <section className="welcome-pane welcome-action">
      <div className="welcome-action-inner">
        <div className="welcome-icon-wrap">
          <FolderGit2 size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h2>Open Repositories</h2>
          <p>Choose a local Git repository to start working.</p>
        </div>
        <button className="primary welcome-open-btn" onClick={onOpenRepository}>
          <Folder size={16} color="white" />
          Open Repositories
          <span className="welcome-kbd">⌘O</span>
        </button>

        {recentRepos.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-title">
              <Clock size={11} />
              Recent
            </div>
            {recentRepos.map((r) => (
              <div
                key={r.path}
                className="welcome-recent-item"
                onClick={() => onOpenRecent?.(r.path)}
                title={r.path}
              >
                <span className="welcome-recent-dot" />
                <span className="welcome-recent-name">{r.name}</span>
                {r.branch && <span className="welcome-recent-br">{r.branch}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function WelcomeScreen({ onOpenRepository, recentRepos, onOpenRecent }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <WelcomeIntro />
      <WelcomeRepositoryPicker
        onOpenRepository={onOpenRepository}
        recentRepos={recentRepos}
        onOpenRecent={onOpenRecent}
      />
    </div>
  );
}
