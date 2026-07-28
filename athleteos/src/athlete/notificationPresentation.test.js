import { describe, expect, it } from "vitest";
import {
  filterNotificationItems,
  formatNotificationTime,
  getNotificationPresentation,
  mergeIncomingNotification,
} from "./notificationPresentation";

const notifications = [
  { id: 1, type: "message", is_read: false, created_at: "2026-07-29T09:00:00Z" },
  { id: 2, type: "social", is_read: true, created_at: "2026-07-29T08:00:00Z" },
  { id: 3, type: "goal_achieved", is_read: false, created_at: "2026-07-28T08:00:00Z" },
];

describe("notification presentation", () => {
  it("associe chaque type à une destination et garde un fallback sûr", () => {
    expect(getNotificationPresentation("message")).toMatchObject({ destination: "messagerie", category: "messages" });
    expect(getNotificationPresentation("goal_achieved")).toMatchObject({ destination: "performances", celebration: true });
    expect(getNotificationPresentation("type_inconnu")).toMatchObject({ destination: "dashboard", icon: "bell" });
  });

  it("filtre les notifications par état et catégorie", () => {
    expect(filterNotificationItems(notifications, "unread").map(item => item.id)).toEqual([1, 3]);
    expect(filterNotificationItems(notifications, "messages").map(item => item.id)).toEqual([1]);
    expect(filterNotificationItems(notifications, "club").map(item => item.id)).toEqual([2]);
  });

  it("ajoute le temps réel sans doublon et respecte la limite", () => {
    const incoming = { ...notifications[0], created_at: "2026-07-29T10:00:00Z" };
    expect(mergeIncomingNotification(notifications, incoming, 2).map(item => item.id)).toEqual([1, 2]);
  });

  it("formate un temps relatif lisible", () => {
    const now = new Date("2026-07-29T10:00:00Z");
    expect(formatNotificationTime("2026-07-29T09:58:30Z", now)).toBe("Il y a 1 min");
    expect(formatNotificationTime("2026-07-28T09:00:00Z", now)).toBe("Hier");
  });
});
