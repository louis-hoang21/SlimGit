import { X, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  msg: string;
  err: boolean;
  onClose: () => void;
}

export default function Toast({ msg, err, onClose }: Props) {
  // Auto-hide runs silently in the parent; no visible countdown bar.
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
    </div>
  );
}
