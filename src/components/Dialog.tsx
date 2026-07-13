import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

// ── Confirm dialog ────────────────────────────────────────────────────────────

interface ConfirmProps {
  message: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  danger = false,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onConfirm, onCancel]);

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="dlg" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-hd">
          <span className={`dlg-ico ${danger ? "dlg-ico-danger" : "dlg-ico-info"}`}>
            {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
          </span>
          <span className="dlg-msg">{message}</span>
        </div>
        <div className="dlg-ft">
          <button className="dlg-btn" onClick={onCancel}>Cancel</button>
          <button
            className={`dlg-btn dlg-btn-primary ${danger ? "dlg-btn-danger" : ""}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Input dialog ──────────────────────────────────────────────────────────────

interface InputProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  title,
  placeholder = "",
  defaultValue = "",
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: InputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="dlg" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-hd dlg-hd-input">
          <span className="dlg-title">{title}</span>
        </div>
        <div className="dlg-body">
          <input
            ref={inputRef}
            className="dlg-input"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
            }}
            autoFocus
          />
        </div>
        <div className="dlg-ft">
          <button className="dlg-btn" onClick={onCancel}>Cancel</button>
          <button
            className="dlg-btn dlg-btn-primary"
            onClick={() => { if (value.trim()) onConfirm(value.trim()); }}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
