import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  const target = typeof document !== "undefined" ? (document.querySelector(".app") ?? document.body) : null;
  if (!target) return null;
  return createPortal(
    <div className="sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet__head">
          <h2 className="h2 grow">{title}</h2>
          <button type="button" className="btn btn--small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    target,
  );
}
