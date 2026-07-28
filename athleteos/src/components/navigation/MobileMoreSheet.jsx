import { useEffect } from "react";
import { X } from "lucide-react";

function SheetBadge({ count }) {
  if (!count || count < 1) return null;

  return (
    <span className="mobile-more-count" aria-hidden="true">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MobileMoreSheet({ items, activeId, onSelect, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <>
      <div className="bottom-sheet-backdrop md:hidden" aria-hidden="true" onClick={onClose} />
      <section
        className="bottom-sheet md:hidden coach-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-more-title"
      >
        <div className="bottom-sheet-handle" />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-4">
          <div>
            <p className="meta-text uppercase tracking-[0.12em] font-semibold">Espace coach</p>
            <h2 id="coach-more-title" className="section-title mt-1">Plus</h2>
            <p className="secondary-text mt-1">Analyses et pilotage du club</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="icon-btn flex-shrink-0"
            aria-label="Fermer le menu Plus"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="grid grid-cols-2 gap-3 px-4 pb-2" aria-label="Fonctions supplémentaires">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            const badgeLabel = item.badge > 0 ? `, ${item.badge} non lue${item.badge > 1 ? "s" : ""}` : "";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={[
                  "mobile-more-item",
                  item.id === "rapports" ? "col-span-2" : "",
                  isActive ? "active" : "",
                ].join(" ")}
                aria-label={`${item.label}${badgeLabel}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="mobile-more-icon">
                  <Icon size={19} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden="true" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="flex items-center gap-2">
                    <span className="mobile-more-label">{item.label}</span>
                    <SheetBadge count={item.badge} />
                  </span>
                  <span className="mobile-more-description">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </section>
    </>
  );
}
