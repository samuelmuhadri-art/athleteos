const DEFAULT_PRESENTATION = {
  label: "AthleteOS",
  icon: "bell",
  accent: "#4DC9A0",
  soft: "rgba(29,158,117,0.13)",
  border: "rgba(77,201,160,0.24)",
  destination: "dashboard",
  actionLabel: "Voir la notification",
  category: "sport",
  celebration: false,
};

const PRESENTATIONS = {
  message: {
    label: "Nouveau message", icon: "message", accent: "#8DB1F6",
    soft: "rgba(91,141,239,0.14)", border: "rgba(91,141,239,0.26)",
    destination: "messagerie", actionLabel: "Ouvrir la conversation", category: "messages",
  },
  social: {
    label: "Vie du club", icon: "heart", accent: "#F08AC0",
    soft: "rgba(236,72,153,0.13)", border: "rgba(236,72,153,0.24)",
    destination: "social", actionLabel: "Voir le club", category: "club",
  },
  new_session: {
    label: "Planning", icon: "calendar", accent: "#7BD8B4",
    soft: "rgba(29,158,117,0.13)", border: "rgba(77,201,160,0.24)",
    destination: "planning", actionLabel: "Voir la séance", category: "sport",
  },
  session_updated: {
    label: "Planning modifié", icon: "calendar", accent: "#69C5F7",
    soft: "rgba(56,189,248,0.13)", border: "rgba(56,189,248,0.24)",
    destination: "planning", actionLabel: "Voir les changements", category: "sport",
  },
  session_feedback_reminder: {
    label: "Retour de séance", icon: "calendar", accent: "#F2C46D",
    soft: "rgba(232,160,32,0.14)", border: "rgba(232,160,32,0.26)",
    destination: "planning", actionLabel: "Compléter mon retour", category: "sport",
  },
  session_day_reminder: {
    label: "Séance aujourd’hui", icon: "calendar", accent: "#7BD8B4",
    soft: "rgba(29,158,117,0.13)", border: "rgba(77,201,160,0.24)",
    destination: "planning", actionLabel: "Voir ma séance", category: "sport",
  },
  result_added: {
    label: "Performance", icon: "trophy", accent: "#F2C46D",
    soft: "rgba(232,160,32,0.14)", border: "rgba(232,160,32,0.26)",
    destination: "performances", actionLabel: "Voir mes performances", category: "sport", celebration: true,
  },
  goal_achieved: {
    label: "Objectif atteint", icon: "target", accent: "#B5A3F5",
    soft: "rgba(155,132,240,0.14)", border: "rgba(155,132,240,0.26)",
    destination: "performances", actionLabel: "Voir mon objectif", category: "sport", celebration: true,
  },
  competition_reminder: {
    label: "Compétition", icon: "flag", accent: "#F2C46D",
    soft: "rgba(232,160,32,0.14)", border: "rgba(232,160,32,0.26)",
    destination: "performances", actionLabel: "Voir la compétition", category: "sport",
  },
  weekly_recap: {
    label: "Bilan hebdomadaire", icon: "chart", accent: "#69C5F7",
    soft: "rgba(56,189,248,0.13)", border: "rgba(56,189,248,0.24)",
    destination: "performances", actionLabel: "Voir mon bilan", category: "sport",
  },
  weekly_report: {
    label: "Rapport disponible", icon: "report", accent: "#69C5F7",
    soft: "rgba(56,189,248,0.13)", border: "rgba(56,189,248,0.24)",
    destination: "performances", actionLabel: "Ouvrir le rapport", category: "sport",
  },
};

export const NOTIFICATION_FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "unread", label: "Non lues" },
  { id: "messages", label: "Messages" },
  { id: "sport", label: "Sport" },
  { id: "club", label: "Club" },
];

export function getNotificationPresentation(notificationOrType) {
  const type = typeof notificationOrType === "string" ? notificationOrType : notificationOrType?.type;
  return { ...DEFAULT_PRESENTATION, ...(PRESENTATIONS[type] ?? {}) };
}

export function filterNotificationItems(notifications, filter) {
  if (filter === "all") return notifications;
  if (filter === "unread") return notifications.filter(notification => !notification.is_read);
  return notifications.filter(notification => getNotificationPresentation(notification).category === filter);
}

export function mergeIncomingNotification(notifications, incoming, limit = 20) {
  const withoutDuplicate = notifications.filter(notification => notification.id !== incoming.id);
  return [incoming, ...withoutDuplicate]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

export function formatNotificationTime(dateValue, now = new Date()) {
  const date = new Date(dateValue);
  const seconds = Math.max(0, Math.floor((now - date) / 1000));
  if (seconds < 60) return "À l’instant";
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
  if (seconds < 172800) return "Hier";
  if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`;
  return date.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}
