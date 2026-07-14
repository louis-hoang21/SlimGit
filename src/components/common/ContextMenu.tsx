import { useRef, useLayoutEffect, useState } from "react";
import type { Menu } from "../../ui-types";

export interface ContextMenuProps {
  menu: Menu;
  onClose: () => void;
}

export default function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: menu.x,
    y: menu.y,
    visible: false,
  });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const maxX = window.innerWidth - width - 4;
    const maxY = window.innerHeight - height - 4;
    setPos({
      x: Math.min(menu.x, maxX),
      y: menu.y > maxY ? menu.y - height : menu.y,
      visible: true,
    });
  }, [menu.x, menu.y]);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{
        left: pos.x,
        top: pos.y,
        visibility: pos.visible ? "visible" : "hidden",
      }}
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
