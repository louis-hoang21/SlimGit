import type { Menu } from "../ui-types";

export interface ContextMenuProps {
  menu: Menu;
  onClose: () => void;
}

export default function ContextMenu({ menu, onClose }: ContextMenuProps) {
  return (
    <div
      className="ctx-menu"
      style={{ left: Math.min(menu.x, window.innerWidth - 230), top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.items.map((it, i) =>
        it.sep ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <div
            key={i}
            className={`ctx-item ${it.danger ? "danger" : ""} ${it.disabled ? "disabled" : ""}`}
            onClick={() => {
              if (it.disabled) return;
              onClose();
              it.run?.();
            }}
          >
            {it.label}
            {it.shortcut && <span className="sc">{it.shortcut}</span>}
          </div>
        )
      )}
    </div>
  );
}
