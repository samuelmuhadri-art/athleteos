import { calendarDayDifference, formatLocalTimestamp, timestampDayKey } from "../../utils/dateTime";

export const MESSAGE_MAX_LENGTH = 1000;

export const MESSAGE_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "coaches", label: "Coachs" },
  { id: "athletes", label: "Athlètes" },
  { id: "unread", label: "Non lus" },
];

export const QUICK_REPLIES = [
  "Bien reçu 👍",
  "Je te fais un retour après la séance.",
  "J’ai une question sur la séance.",
];

export function mapMessageRow(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content ?? "",
    date: row.created_at,
    isRead: Boolean(row.is_read),
  };
}

export function appendUniqueMessage(messages, message) {
  if (messages.some(item => item.id === message.id)) return messages;
  return [...messages, message];
}

export function getLatestUnreadIncomingMessage(messages, currentUserId, preferredSenderId = null) {
  return [...(messages ?? [])]
    .filter(message => message.receiverId === currentUserId && message.senderId !== currentUserId && !message.isRead)
    .filter(message => preferredSenderId == null || message.senderId === preferredSenderId)
    .sort((first, second) => new Date(second.date) - new Date(first.date))[0] ?? null;
}

export function buildAthleteConversations(messages, contacts, currentUserId) {
  const contactsByUserId = new Map(
    contacts.filter(contact => contact.userId != null).map(contact => [contact.userId, contact])
  );
  const conversations = new Map(
    contacts.filter(contact => contact.userId != null).map(contact => [contact.id, {
      contactId: contact.id,
      messages: [],
      unread: 0,
      lastMsg: null,
    }])
  );

  messages.forEach(message => {
    if (message.senderId !== currentUserId && message.receiverId !== currentUserId) return;
    const otherUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;
    const contact = contactsByUserId.get(otherUserId);
    const conversation = contact ? conversations.get(contact.id) : null;
    if (!conversation) return;
    conversation.messages.push(message);
    if (message.senderId === contact.userId && !message.isRead) conversation.unread += 1;
  });

  conversations.forEach(conversation => {
    conversation.messages.sort((a, b) => new Date(a.date) - new Date(b.date));
    conversation.lastMsg = conversation.messages.at(-1) ?? null;
  });

  return [...conversations.values()].sort((a, b) => {
    if (!a.lastMsg && !b.lastMsg) return 0;
    if (!a.lastMsg) return 1;
    if (!b.lastMsg) return -1;
    return new Date(b.lastMsg.date) - new Date(a.lastMsg.date);
  });
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filterAthleteConversations(conversations, contacts, filter, search) {
  const contactsById = new Map(contacts.map(contact => [contact.id, contact]));
  const query = normalizeSearch(search).trim();

  return conversations.filter(conversation => {
    const contact = contactsById.get(conversation.contactId);
    if (!contact) return false;
    if (filter === "coaches" && contact.type !== "coach") return false;
    if (filter === "athletes" && contact.type !== "athlete") return false;
    if (filter === "unread" && conversation.unread === 0) return false;
    if (!query) return true;
    return normalizeSearch(contact.name).includes(query)
      || conversation.messages.some(message => normalizeSearch(message.content).includes(query));
  });
}

export function groupMessagesByDay(messages, timeZone) {
  return messages.reduce((groups, message) => {
    const key = timestampDayKey(message.date, timeZone);
    const lastGroup = groups.at(-1);
    if (lastGroup?.key === key) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ key, date: message.date, messages: [message] });
    }
    return groups;
  }, []);
}

export function formatMessageTime(dateValue, timeZone) {
  return formatLocalTimestamp(dateValue, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "fr-BE", timeZone);
}

export function formatConversationTime(dateValue, now = new Date(), timeZone) {
  const dayDifference = calendarDayDifference(dateValue, now, timeZone);
  if (dayDifference === 0) return formatMessageTime(dateValue, timeZone);
  if (dayDifference > 0 && dayDifference < 7) return formatLocalTimestamp(dateValue, { weekday: "short" }, "fr-BE", timeZone);
  return formatLocalTimestamp(dateValue, { day: "numeric", month: "short" }, "fr-BE", timeZone);
}

export function formatMessageDay(dateValue, now = new Date(), timeZone) {
  const dayDifference = calendarDayDifference(dateValue, now, timeZone);
  if (dayDifference === 0) return "Aujourd’hui";
  if (dayDifference === 1) return "Hier";
  return formatLocalTimestamp(dateValue, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, "fr-BE", timeZone);
}
