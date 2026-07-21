// ============================================================
// AthleteOS — src/modules/Messaging.jsx
// ★ MESSAGERIE UNIVERSELLE :
//   Le coach peut écrire à TOUS les membres du club :
//   - Athlètes (via athletes.user_id)
//   - Autres coachs / staff (users avec role != athlete)
//   Les contacts sont unifiés sous une liste "contacts"
//   chacun avec { id, name, avatar, userId, type, subtitle }
// ============================================================

import {
  memo, useState, useMemo, useCallback,
  useEffect, useRef,
} from "react";
import { Send, Search, MessageSquare, Check, CheckCheck, Users, User } from "lucide-react";
import { supabase }              from "../utils/supabaseClient";
import { notifyAthleteMessage }  from "../utils/notifications";
import { useAuth }               from "../context/AuthContext";
import LoadingState              from "../components/ui/LoadingState";
import ErrorState                from "../components/ui/ErrorState";

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONTACT_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function contactColor(contact, contacts) {
  if (!contact) return "#94a3b8";
  const idx = contacts.findIndex((c) => c.id === contact.id);
  return CONTACT_COLORS[idx % CONTACT_COLORS.length] ?? "#94a3b8";
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const isToday     = d.toDateString() === now.toDateString();
  const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
  if (isToday)     return "Aujourd'hui";
  if (isYesterday) return "Hier";
  return d.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(msgs) {
  const groups = [];
  let currentDate = null;
  msgs.forEach((m) => {
    const d = new Date(m.date).toDateString();
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ type: "separator", date: m.date, key: `sep-${m.date}` });
    }
    groups.push({ type: "message", data: m, key: m.id });
  });
  return groups;
}

// Construit les conversations depuis messages + contacts
// Un "contact" a : { id (unique), userId (int dans users), name, avatar, type, subtitle }
function buildConversations(msgs, contacts, coachUserId) {
  const convMap = new Map();

  contacts.forEach((c) => {
    if (c.userId == null) return;
    convMap.set(c.id, { contactId: c.id, userId: c.userId, messages: [], unread: 0 });
  });

  msgs.forEach((m) => {
    const otherUserId = m.senderId === coachUserId ? m.receiverId : m.senderId;
    const contact     = contacts.find((c) => c.userId === otherUserId);
    if (!contact) return;
    const conv = convMap.get(contact.id);
    if (!conv) return;
    conv.messages.push(m);
    if (!m.isRead && m.senderId !== coachUserId) conv.unread++;
  });

  convMap.forEach((conv) => {
    conv.messages.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  return [...convMap.values()].sort((a, b) => {
    const la = a.messages[a.messages.length - 1]?.date ?? "";
    const lb = b.messages[b.messages.length - 1]?.date ?? "";
    if (!la && !lb) return 0;
    if (!la) return 1;
    if (!lb) return -1;
    return new Date(lb) - new Date(la);
  });
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

const MessageBubble = memo(({ msg, isOwn, contact, contacts }) => {
  const color = isOwn ? "#1D9E75" : contactColor(contact, contacts);
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {!isOwn && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5"
          style={{ background: color }}
        >
          {initialsFromName(contact?.name ?? "?")}
        </div>
      )}
      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm"
          style={
            isOwn
              ? { background: "#1D9E75", color: "white",   borderBottomRightRadius: "4px" }
              : { background: "#F1F5F9", color: "#334155", borderBottomLeftRadius: "4px"  }
          }
        >
          {msg.content}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1">
          <span>{formatTime(msg.date)}</span>
          {isOwn && (
            msg.isRead
              ? <CheckCheck size={11} color="#1D9E75" />
              : <Check      size={11} color="#94a3b8" />
          )}
        </div>
      </div>
    </div>
  );
});

const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-slate-100" />
    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 bg-white rounded-full border border-slate-100 py-0.5">
      {formatDateHeader(date)}
    </span>
    <div className="flex-1 h-px bg-slate-100" />
  </div>
);

const ConvItem = memo(({ conv, contact, contacts, isActive, onClick, coachUserId }) => {
  const lastMsg         = conv.messages[conv.messages.length - 1];
  const color           = contactColor(contact, contacts);
  const isLastFromCoach = lastMsg?.senderId === coachUserId;

  return (
    <button
      onClick={() => onClick(conv.contactId)}
      className={[
        "w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all hover:bg-slate-50 focus:outline-none",
        isActive ? "bg-emerald-50 border-r-2 border-emerald-500" : "",
      ].join(" ")}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{ background: color }}
        >
          {initialsFromName(contact?.name ?? "?")}
        </div>
        {/* Badge type coach */}
        {contact?.type === "coach" && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
            <User size={8} color="white" />
          </div>
        )}
        {conv.unread > 0 && (
          <div
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
            style={{ background: "#E24B4A" }}
          >
            {conv.unread}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={`text-[13px] truncate ${conv.unread > 0 ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>
              {contact?.name ?? "Contact"}
            </p>
            {/* Badge rôle */}
            {contact?.type === "coach" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                Coach
              </span>
            )}
          </div>
          {lastMsg && (
            <span className="text-[10px] text-slate-400 flex-shrink-0">
              {formatTime(lastMsg.date)}
            </span>
          )}
        </div>
        {lastMsg ? (
          <p className={`text-[11.5px] truncate ${conv.unread > 0 ? "text-slate-600 font-medium" : "text-slate-400"}`}>
            {isLastFromCoach ? "Vous : " : ""}{lastMsg.content}
          </p>
        ) : (
          <p className="text-[11.5px] text-slate-300 italic">{contact?.subtitle ?? "Aucun message"}</p>
        )}
      </div>
    </button>
  );
});

const ChatThread = memo(({ conv, contact, contacts, onSend, coachUserId }) => {
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const color     = contactColor(contact, contacts);
  const grouped   = useMemo(() => groupByDate(conv.messages), [conv.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv.messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSending(true);
    try { await onSend(text); } finally { setSending(false); }
  }, [input, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full">
      {/* Header thread */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
          style={{ background: color }}
        >
          {initialsFromName(contact?.name ?? "?")}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-slate-800">{contact?.name ?? "Contact"}</p>
            {contact?.type === "coach" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                Coach
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{contact?.subtitle ?? ""}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ background: "#FAFAFA" }}>
        {grouped.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <MessageSquare size={28} strokeWidth={1.5} />
            <p className="text-[12.5px]">Aucun message — écris le premier !</p>
          </div>
        ) : (
          grouped.map((item) =>
            item.type === "separator"
              ? <DateSeparator key={item.key} date={item.date} />
              : <MessageBubble
                  key={item.key}
                  msg={item.data}
                  isOwn={item.data.senderId === coachUserId}
                  contact={contact}
                  contacts={contacts}
                />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white flex items-end gap-2">
        <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5">
          <textarea
            className="w-full bg-transparent resize-none text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none max-h-28 min-h-[20px]"
            rows={1}
            placeholder={`Message à ${contact?.name?.split(" ")[0] ?? "…"}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ lineHeight: "1.5" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          style={{ background: "#1D9E75" }}
        >
          <Send size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

const EmptyConvState = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50">
    <MessageSquare size={40} strokeWidth={1.5} />
    <p className="text-[14px] font-semibold">Sélectionnez une conversation</p>
    <p className="text-[12px] text-slate-300 text-center max-w-[200px]">
      Cliquez sur un athlète ou un coach pour démarrer
    </p>
  </div>
);

// ─── Composant principal ──────────────────────────────────────────────────────
function Messaging() {
  const { profile, clubId } = useAuth();
  const coachUserId = profile?.id ?? null;

  // "contacts" = liste unifiée athlètes + autres users du club
  const [contacts,    setContacts]    = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeContactId, setActiveContactId] = useState(null);
  const [search,      setSearch]      = useState("");
  const [activeTab,   setActiveTab]   = useState("tous"); // "tous" | "athletes" | "coachs"

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId || !coachUserId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Athlètes du club
      const athletesRes = await supabase
        .from("athletes")
        .select("id, name, main_discipline, user_id, profile_data")
        .eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      // 2. Autres users du club (coachs, staff) — exclut le coach connecté
      const usersRes = await supabase
        .from("users")
        .select("id, name, role")
        .eq("club_id", clubId)
        .neq("id", coachUserId); // on s'exclut soi-même
      if (usersRes.error) throw usersRes.error;

      // Construire la liste unifiée de contacts
      // Chaque contact a un id unique (préfixé pour éviter collision)
      const athleteContacts = (athletesRes.data ?? []).map((a) => ({
        id:       `athlete-${a.id}`,       // id unique dans la liste
        athleteId: a.id,
        userId:   a.user_id,               // peut être null si non lié
        name:     a.name,
        avatar:   a.profile_data?.avatar ?? initialsFromName(a.name),
        type:     "athlete",
        subtitle: a.main_discipline ?? "Athlète",
        linked:   a.user_id != null,
      }));

      const coachContacts = (usersRes.data ?? [])
        .filter((u) => u.role !== "athlete") // on ne met pas les users-athlètes ici (déjà dans athleteContacts)
        .map((u) => ({
          id:       `user-${u.id}`,
          userId:   u.id,
          name:     u.name,
          avatar:   initialsFromName(u.name),
          type:     "coach",
          subtitle: u.role === "head_coach" ? "Head coach" : "Coach",
          linked:   true, // les users ont forcément un compte
        }));

      const allContacts = [...athleteContacts, ...coachContacts];

      // 3. Messages avec tous ces users
      const allUserIds = allContacts
        .map((c) => c.userId)
        .filter((id) => id != null);

      const messagesRes = allUserIds.length
        ? await supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${coachUserId},receiver_id.in.(${allUserIds.join(",")})),` +
              `and(receiver_id.eq.${coachUserId},sender_id.in.(${allUserIds.join(",")}))`
            )
        : { data: [], error: null };
      if (messagesRes.error) throw messagesRes.error;

      setContacts(allContacts);
      setAllMessages((messagesRes.data ?? []).map((m) => ({
        id:         m.id,
        senderId:   m.sender_id,
        receiverId: m.receiver_id,
        content:    m.content,
        date:       m.created_at,
        isRead:     m.is_read,
      })));
    } catch (err) {
      console.error("Messaging — chargement :", err);
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId, coachUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Conversations dérivées ═══════════════════════════════════════════════
  const conversations = useMemo(
    () => buildConversations(allMessages, contacts, coachUserId),
    [allMessages, contacts, coachUserId]
  );

  const unlinkedAthletes = useMemo(
    () => contacts.filter((c) => c.type === "athlete" && !c.linked),
    [contacts]
  );

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + c.unread, 0),
    [conversations]
  );

  // Filtre recherche + onglet
  const filteredConvs = useMemo(() => {
    let list = conversations;

    // Filtre par onglet
    if (activeTab === "athletes") {
      list = list.filter((conv) => {
        const c = contacts.find((x) => x.id === conv.contactId);
        return c?.type === "athlete";
      });
    } else if (activeTab === "coachs") {
      list = list.filter((conv) => {
        const c = contacts.find((x) => x.id === conv.contactId);
        return c?.type === "coach";
      });
    }

    // Filtre recherche
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((conv) => {
        const c = contacts.find((x) => x.id === conv.contactId);
        return c?.name.toLowerCase().includes(q) ||
          conv.messages.some((m) => m.content.toLowerCase().includes(q));
      });
    }

    return list;
  }, [conversations, search, contacts, activeTab]);

  const activeConv    = useMemo(() => conversations.find((c) => c.contactId === activeContactId) ?? null, [conversations, activeContactId]);
  const activeContact = useMemo(() => contacts.find((c) => c.id === activeContactId) ?? null, [contacts, activeContactId]);

  // ═══ Actions ══════════════════════════════════════════════════════════════

  const selectConv = useCallback(async (contactId) => {
    setActiveContactId(contactId);
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact?.userId) return;

    // Marquer comme lu
    const hasUnread = allMessages.some(
      (m) => m.senderId === contact.userId && m.receiverId === coachUserId && !m.isRead
    );
    if (!hasUnread) return;

    setAllMessages((prev) => prev.map((m) =>
      m.senderId === contact.userId && m.receiverId === coachUserId && !m.isRead
        ? { ...m, isRead: true }
        : m
    ));

    const { error: err } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", contact.userId)
      .eq("receiver_id", coachUserId)
      .eq("is_read", false);

    if (err) { console.error("Messaging — markRead :", err); fetchAll(); }
  }, [contacts, allMessages, coachUserId, fetchAll]);

  const handleSend = useCallback(async (text) => {
    if (!activeContactId || !coachUserId) return;
    const contact = contacts.find((c) => c.id === activeContactId);
    if (!contact?.userId) return;

    const { data, error: err } = await supabase
      .from("messages")
      .insert({
        sender_id:   coachUserId,
        receiver_id: contact.userId,
        content:     text,
        is_read:     false,
      })
      .select()
      .single();

    if (err) { console.error("Messaging — send :", err); return; }

    // Ajout optimiste
    setAllMessages((prev) => [...prev, {
      id:         data.id,
      senderId:   data.sender_id,
      receiverId: data.receiver_id,
      content:    data.content,
      date:       data.created_at,
      isRead:     data.is_read,
    }]);

    // Push notif si c'est un athlète
    if (contact.type === "athlete" && contact.athleteId) {
      await notifyAthleteMessage(
        clubId,
        contact.athleteId,
        profile?.name ?? "Coach",
        text
      ).catch(console.warn);
    }
  }, [activeContactId, contacts, coachUserId, clubId, profile]);

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement de la messagerie…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const coachCount   = contacts.filter((c) => c.type === "coach").length;
  const athleteCount = contacts.filter((c) => c.type === "athlete" && c.linked).length;

  return (
    <div className="flex h-full overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── Panneau gauche ─────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">

        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-800">Messagerie</h2>
            {totalUnread > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: "#E24B4A" }}
              >
                {totalUnread} non lu{totalUnread > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Recherche */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 mb-3">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Onglets filtre */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold">
            {[
              { id: "tous",     label: `Tous (${athleteCount + coachCount})` },
              { id: "athletes", label: `Athlètes (${athleteCount})`          },
              { id: "coachs",   label: `Coachs (${coachCount})`              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 py-1.5 transition-colors text-center",
                  activeTab === tab.id
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Coach connecté */}
        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2.5 flex-shrink-0 bg-slate-50">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
            style={{ background: "#378ADD" }}
          >
            {initialsFromName(profile?.name ?? "")}
          </div>
          <div>
            <p className="text-[11.5px] font-semibold text-slate-700">{profile?.name ?? "Coach"}</p>
            <p className="text-[10px] text-slate-400">Connecté · Head coach</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        </div>

        {/* Avertissement athlètes sans compte */}
        {unlinkedAthletes.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <p className="text-[10.5px] text-amber-700 leading-relaxed">
              ⚠️ {unlinkedAthletes.length} athlète{unlinkedAthletes.length > 1 ? "s" : ""} sans compte —
              {" "}{unlinkedAthletes.map((a) => a.name.split(" ")[0]).join(", ")}
            </p>
          </div>
        )}

        {/* Liste conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredConvs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Users size={24} className="mx-auto mb-2 text-slate-200" />
              <p className="text-[12px] text-slate-300">
                {search ? "Aucun résultat" : "Aucune conversation"}
              </p>
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const contact = contacts.find((c) => c.id === conv.contactId);
              return (
                <ConvItem
                  key={conv.contactId}
                  conv={conv}
                  contact={contact}
                  contacts={contacts}
                  isActive={conv.contactId === activeContactId}
                  onClick={selectConv}
                  coachUserId={coachUserId}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── Panneau droit ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeConv && activeContact ? (
          <ChatThread
            key={activeContactId}
            conv={activeConv}
            contact={activeContact}
            contacts={contacts}
            onSend={handleSend}
            coachUserId={coachUserId}
          />
        ) : (
          <EmptyConvState />
        )}
      </div>
    </div>
  );
}

export default memo(Messaging);