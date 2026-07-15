import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "Loading…" }: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-screen-inner">
        <Loader2 size={26} className="loading-screen-spin" />
        <span className="loading-screen-text">{message}</span>
      </div>
    </div>
  );
}
