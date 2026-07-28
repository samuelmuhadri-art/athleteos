import { describe, expect, it } from "vitest";
import {
  appendUniqueMessage,
  buildAthleteConversations,
  filterAthleteConversations,
  formatConversationTime,
  formatMessageDay,
  groupMessagesByDay,
  mapMessageRow,
} from "./athleteMessaging";

const contacts = [
  { id: "coach-2", userId: 2, name: "Benoît Marchal", type: "coach" },
  { id: "athlete-3", userId: 3, name: "Émilie Laurent", type: "athlete" },
];

const messages = [
  { id: 1, senderId: 2, receiverId: 1, content: "Plan de séance", date: "2026-07-28T08:00:00Z", isRead: false },
  { id: 2, senderId: 1, receiverId: 3, content: "Bravo pour le relais", date: "2026-07-29T09:00:00Z", isRead: true },
  { id: 3, senderId: 99, receiverId: 98, content: "Hors conversation", date: "2026-07-29T10:00:00Z", isRead: false },
];

describe("buildAthleteConversations", () => {
  it("construit, trie et compte uniquement les messages du compte connecté", () => {
    const conversations = buildAthleteConversations(messages, contacts, 1);
    expect(conversations.map(conversation => conversation.contactId)).toEqual(["athlete-3", "coach-2"]);
    expect(conversations.find(conversation => conversation.contactId === "coach-2")?.unread).toBe(1);
    expect(conversations.flatMap(conversation => conversation.messages).some(message => message.id === 3)).toBe(false);
  });
});

describe("filterAthleteConversations", () => {
  const conversations = buildAthleteConversations(messages, contacts, 1);

  it("filtre les rôles, les non-lus et recherche sans tenir compte des accents", () => {
    expect(filterAthleteConversations(conversations, contacts, "coaches", "").map(item => item.contactId)).toEqual(["coach-2"]);
    expect(filterAthleteConversations(conversations, contacts, "unread", "").map(item => item.contactId)).toEqual(["coach-2"]);
    expect(filterAthleteConversations(conversations, contacts, "all", "emilie").map(item => item.contactId)).toEqual(["athlete-3"]);
    expect(filterAthleteConversations(conversations, contacts, "all", "relais").map(item => item.contactId)).toEqual(["athlete-3"]);
  });
});

describe("message helpers", () => {
  it("évite les doublons temps réel et regroupe les messages par journée", () => {
    expect(appendUniqueMessage(messages, messages[0])).toBe(messages);
    expect(appendUniqueMessage(messages, { ...messages[0], id: 4 })).toHaveLength(4);
    expect(groupMessagesByDay(messages.slice(0, 2))).toHaveLength(2);
  });

  it("normalise les lignes Supabase et les libellés temporels", () => {
    expect(mapMessageRow({ id: 8, sender_id: 1, receiver_id: 2, content: null, created_at: "2026-07-29T08:00:00Z", is_read: null })).toMatchObject({ content: "", isRead: false });
    const now = new Date("2026-07-29T12:00:00Z");
    expect(formatMessageDay("2026-07-29T08:00:00Z", now)).toBe("Aujourd’hui");
    expect(formatConversationTime("2026-07-28T08:00:00Z", now)).toBe("mar.");
  });
});
