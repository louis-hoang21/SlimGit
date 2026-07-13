import type { BranchInfo, StatusResult } from "../types";

export interface CheckoutConfirmationProps {
  target: BranchInfo;
  status: StatusResult | null;
  onClose: () => void;
  onCheckout: (mode: "plain" | "discard" | "stash") => void;
}

export default function CheckoutConfirmation({
  target,
  status,
  onClose,
  onCheckout,
}: CheckoutConfirmationProps) {
  const hasChanges = Boolean(status && status.files.length > 0);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          Checkout <b>{target.name}</b>
        </div>
        <div className="modal-bd">
          {hasChanges ? (
            <>
              <div className="co-warn">
                ⚠ You have {status!.files.length} uncommitted change(s). What
                should happen to them before switching branches?
              </div>
              <ul className="co-opts">
                <li>
                  <b>Stash</b> — save changes to a stash, switch clean, keep
                  them for later.
                </li>
                <li>
                  <b>Keep</b> — carry changes into the new branch (fails if
                  they conflict).
                </li>
                <li className="danger">
                  <b>Discard</b> — permanently drop the changes, then switch.
                </li>
              </ul>
            </>
          ) : (
            <div className="co-warn ok">
              Switch to branch <b>{target.name}</b>?
            </div>
          )}
        </div>
        <div className="modal-ft">
          <div className="spacer" />
          <button onClick={onClose}>Cancel</button>
          {hasChanges ? (
            <>
              <button className="danger" onClick={() => onCheckout("discard")}>
                Discard &amp; Checkout
              </button>
              <button onClick={() => onCheckout("plain")}>Keep &amp; Checkout</button>
              <button className="primary" onClick={() => onCheckout("stash")}>
                Stash &amp; Checkout
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => onCheckout("plain")}>
              Checkout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
