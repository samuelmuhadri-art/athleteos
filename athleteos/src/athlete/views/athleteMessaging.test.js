import { describe, expect, it } from "vitest";
import {
  appendUniqueMessage,
  buildAthleteConversations,
  buildMessagingConversations,
  filterAthleteConversations,
  formatConversationTime,
  formatMessageDay,
  formatMessageTime,
  getLatestUnreadIncomingMessage,
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

  it("ignore un message entre deux contacts qui ne concerne pas le compte connecte", () => {
    const messageBetweenContacts = {
      id: 4,
      senderId: 2,
      receiverId: 3,
      content: "Message prive entre contacts",
      date: "2026-07-29T11:00:00Z",
      isRead: false,
    };
    const conversations = buildMessagingConversations([...messages, messageBetweenContacts], contacts, 1);

    expect(conversations.flatMap(conversation => conversation.messages).map(message => message.id)).not.toContain(4);
  });

  it("indexe une messagerie longue pour 30 contacts sans perdre de messages", () => {
    const manyContacts = Array.from({ length:30 }, (_, index) => ({
      id:`athlete-${index + 1}`,
      userId:index + 100,
      name:`Athlete ${index + 1}`,
      type:"athlete",
    }));
    const manyMessages = Array.from({ length:6000 }, (_, index) => {
      const contact = manyContacts[index % manyContacts.length];
      const incoming = index % 2 === 0;
      return {
        id:index + 1,
        senderId:incoming ? contact.userId : 1,
        receiverId:incoming ? 1 : contact.userId,
        content:`Message ${index + 1}`,
        date:new Date(Date.UTC(2026, 8, 1) + index * 1000).toISOString(),
        isRead:!incoming,
      };
    });

    const conversations = buildMessagingConversations(manyMessages, manyContacts, 1);

    expect(conversations).toHaveLength(30);
    expect(conversations.flatMap(conversation => conversation.messages)).toHaveLength(6000);
    expect(conversations.reduce((total, conversation) => total + conversation.unread, 0)).toBe(3000);
  });
});

describe("message important du dashboard", () => {
  it("retient uniquement le dernier message entrant non lu", () => {
    expect(getLatestUnreadIncomingMessage(messages, 1, 2)?.id).toBe(1);
    expect(getLatestUnreadIncomingMessage([{ ...messages[0], isRead:true }], 1, 2)).toBeNull();
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

  it.each([
    ["Europe/Brussels", "16:35"],
    ["Europe/Sofia", "17:35"],
    ["America/New_York", "10:35"],
    ["Asia/Tokyo", "23:35"],
  ])("affiche un timestamp serveur dans la timezone %s", (timeZone, expected) => {
    expect(formatMessageTime("2026-09-03T14:35:00Z", timeZone)).toBe(expected);
  });

  it("détermine Aujourd’hui/Hier selon le jour local, y compris autour de minuit", () => {
    const now = new Date("2026-09-04T00:30:00Z");
    expect(formatMessageDay("2026-09-03T23:45:00Z", now, "Europe/Brussels")).toBe("Aujourd’hui");
    expect(formatMessageDay("2026-09-03T02:00:00Z", now, "Europe/Brussels")).toBe("Hier");
  });
});
