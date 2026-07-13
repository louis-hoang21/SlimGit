import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  msg: string;
  err: boolean;
  onClose: () => void;
}

export default function Toast({ msg, err, onClose }: Props) {
  const [progress, setProgress] = useState(100);
  const DURATION = 5000;

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
    }, 50);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className={`toast-v2 ${err ? "toast-err" : "toast-ok"}`}>
      <div className="toast-body">
        <span className="toast-icon">
          {err
            ? <AlertCircle size={18} strokeWidth={2} />
            : <CheckCircle2 size={18} strokeWidth={2} />
          }
        </span>
        <span className="toast-msg">{msg}</span>
        <button className="toast-close" onClick={onClose} title="Close">
          <X size={15} strokeWidth={2.5} />
        </button>
      </div>
      <div className="toast-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
