function NavigationBadge({ count }) {
  if (!count || count < 1) return null;

  return (
    <span className="mobile-nav-badge" aria-hidden="true">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MobileBottomNav({
  ariaLabel,
  items,
  activeId,
  onSelect,
  more = null,
}) {
  const MoreIcon = more?.icon;
  const moreBadgeLabel = more?.badge > 0
    ? `, ${more.badge} alerte${more.badge > 1 ? "s" : ""} non lue${more.badge > 1 ? "s" : ""}`
    : "";

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bottom-nav" aria-label={ariaLabel}>
      <div className="flex items-stretch justify-between w-full px-1" style={{ height: 60 }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          const badgeLabel = item.badge > 0 ? `, ${item.badge} non lu${item.badge > 1 ? "s" : ""}` : "";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={["bottom-nav-item tap-feedback", isActive ? "active" : ""].join(" ")}
              aria-label={`${item.label}${badgeLabel}`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.1 : 1.6} aria-hidden="true" />
                <NavigationBadge count={item.badge} />
              </div>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}

        {more && (
          <button
            ref={more.buttonRef}
            type="button"
            onClick={more.onSelect}
            className={["bottom-nav-item tap-feedback", more.active ? "active" : ""].join(" ")}
            aria-label={`${more.label}${moreBadgeLabel}`}
            aria-expanded={more.expanded}
            aria-haspopup="dialog"
          >
            <div className="relative">
              <MoreIcon size={21} strokeWidth={more.active ? 2.1 : 1.6} aria-hidden="true" />
              <NavigationBadge count={more.badge} />
            </div>
            <span className="bottom-nav-label">{more.label}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
