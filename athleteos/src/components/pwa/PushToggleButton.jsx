export function PushToggleButton({ subscribed, onToggle, permissionState, compact = false }) {
  const noSupport = !("serviceWorker" in navigator) || !("PushManager" in window);
  if (noSupport) return null;
  const denied = permissionState === "denied";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={subscribed || denied}
      aria-label={compact ? (subscribed ? "Notifications actives" : denied ? "Notifications bloquées par le navigateur" : "Activer les notifications") : undefined}
      title={compact ? (subscribed ? "Notifications actives" : denied ? "Notifications bloquées" : "Activer les notifications") : undefined}
      className={[
        "flex items-center justify-center rounded-xl text-[12px] font-semibold border transition-all",
        compact ? "w-11 h-11 p-0" : "gap-2 px-3 py-2",
        subscribed || denied ? "cursor-default" : "hover:border-[var(--c-border-strong)]",
      ].join(" ")}
      style={
        subscribed
          ? { background: "rgba(29,158,117,0.12)", borderColor: "rgba(29,158,117,0.30)", color: "var(--tone-success)" }
          : denied
            ? { background: "rgba(224,82,82,0.08)", borderColor: "rgba(224,82,82,0.18)", color: "var(--tone-danger)" }
            : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-2)" }
      }
    >
      <span aria-hidden={compact ? "true" : undefined}>{subscribed ? "🔔" : "🔕"}</span>
      {!compact && <span>{subscribed ? "Notifs actives" : denied ? "Bloquées par le navigateur" : "Activer les notifs"}</span>}
    </button>
  );
}
