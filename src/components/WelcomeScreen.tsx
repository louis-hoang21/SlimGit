import { FolderGit2, Folder } from "lucide-react";

interface WelcomeScreenProps {
  onOpenRepository: () => void;
}

function WelcomeIntro() {
  return (
    <section className="welcome-pane welcome-intro">
      <div className="welcome-kicker">SlimGit</div>
      <h1>Welcome to SlimGit</h1>
    </section>
  );
}

function WelcomeRepositoryPicker({ onOpenRepository }: WelcomeScreenProps) {
  return (
    <section className="welcome-pane welcome-action">
      <div className="welcome-action-inner">
        <FolderGit2 size={42} strokeWidth={1.5} />
        <div>
          <h2>Open Repositories</h2>
          <p>Choose a local Git repository to start working.</p>
        </div>
        <button className="primary welcome-open-btn" onClick={onOpenRepository}>
          <Folder size={16} />
          Open Repositories
        </button>
      </div>
    </section>
  );
}

export default function WelcomeScreen({ onOpenRepository }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <WelcomeIntro />
      <WelcomeRepositoryPicker onOpenRepository={onOpenRepository} />
    </div>
  );
}
