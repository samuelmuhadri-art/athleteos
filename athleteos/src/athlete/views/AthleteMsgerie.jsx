// ============================================================
// AthleteOS — src/athlete/views/AthleteMsgerie.jsx  ★ DESIGN PREMIUM
//
// Logique métier 100% identique.
// Rendu repoli :
//   - Sidebar contacts : header glassmorphism, search premium,
//     avatar avec badge coach/unread, item actif liseré vert
//   - Thread : header avec avatar coloré + badge rôle, fond #F8F9FA
//     subtil, bulles arrondies avec queue, horodatage discret
//   - Input zone : textarea auto-expand dans pill gris, bouton
//     send rond vert avec tap-feedback, disabled state propre
//   - État vide : icône centrée avec call-to-action
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MessageSquare, Search, Send, ChevronLeft } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage } from "../../utils/notifications";
import LoadingState from "../../components/ui/LoadingState";
import { initialsFromName } from "../shared";

export default function AthleteMsgerie({
  athlete, coachUserId, athleteUserId, coachName, clubId, allAthletes,
}) {
  const [contacts,    setContacts]    = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [activeId,    setActiveId]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [draft,       setDraft]       = useState("");
  const bottomRef      = useRef(null);
  const textareaRef    = useRef(null);
  const initializedRef = useRef(false);

  // ── Fetch contacts + messages ─────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!athleteUserId || !clubId) return;
    try {
      const { data: athleteRows } = await supabase
        .from("athletes").select("id, name, profile_data, user_id")
        .eq("club_id", clubId).neq("id", athlete.id);

      const { data: userRows } = await supabase
        .from("users").select("id, name, role")
        .eq("club_id", clubId).neq("role", "athlete");

      const coachContacts = (userRows ?? []).map(u => ({
        id: `user-${u.id}`, userId: u.id, name: u.name,
        avatar: initialsFromName(u.name), type: "coach",
        subtitle: u.role === "head_coach" ? "Head coach" : "Coach",
        color: "#378ADD",
      }));

      const athleteContacts = (athleteRows ?? [])
        .filter(a => a.user_id != null)
        .map((a, idx) => ({
          id: `athlete-${a.id}`, userId: a.user_id, name: a.name,
          avatar: a.profile_data?.avatar ?? initialsFromName(a.name), type: "athlete",
          subtitle: a.main_discipline ?? "Athlète",
          color: ["#1D9E75","#A855F7","#EF9F27","#E24B4A","#14B8A6","#F97316","#EC4899"][idx % 7],
        }));

      const allContacts = [...coachContacts, ...athleteContacts];
      const allUserIds  = allContacts.map(c => c.userId).filter(Boolean);

      const { data: msgs } = allUserIds.length
        ? await supabase.from("messages").select("*")
            .or(`and(sender_id.eq.${athleteUserId},receiver_id.in.(${allUserIds.join(",")})),and(receiver_id.eq.${athleteUserId},sender_id.in.(${allUserIds.join(",")}))`)
            .order("created_at", { ascending: true })
        : { data: [] };

      setContacts(allContacts);
      setAllMessages((msgs ?? []).map(m => ({
        id: m.id, senderId: m.sender_id, receiverId: m.receiver_id,
        content: m.content, date: m.created_at, isRead: m.is_read,
      })));

      if (!initializedRef.current && coachUserId) {
        const coach = allContacts.find(c => c.userId === coachUserId);
        if (coach) setActiveId(coach.id);
        initializedRef.current = true;
      }
    } catch (e) {
      console.error("AthleteMsgerie:", e);
    } finally {
      setLoading(false);
    }
  }, [athleteUserId, clubId, athlete.id, coachUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!athleteUserId) return;
    const ch = supabase.channel("ma-messagerie-universal")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const m = payload.new;
        if (m.receiver_id !== athleteUserId && m.sender_id !== athleteUserId) return;
        setAllMessages(prev =>
          prev.some(x => x.id === m.id) ? prev : [...prev, {
            id: m.id, senderId: m.sender_id, receiverId: m.receiver_id,
            content: m.content, date: m.created_at, isRead: m.is_read,
          }]
        );
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [athleteUserId]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, activeId]);

  // ── Conversations triées ──────────────────────────────────────────────────
  const conversations = useMemo(() => {
    return contacts.map(contact => {
      const msgs = allMessages.filter(m =>
        (m.senderId === athleteUserId && m.receiverId === contact.userId) ||
        (m.senderId === contact.userId && m.receiverId === athleteUserId)
      ).sort((a, b) => new Date(a.date) - new Date(b.date));
      const unread  = msgs.filter(m => m.senderId === contact.userId && !m.isRead).length;
      return { contactId: contact.id, messages: msgs, unread, lastMsg: msgs[msgs.length - 1] };
    }).sort((a, b) => {
      const la = a.lastMsg?.date ?? ""; const lb = b.lastMsg?.date ?? "";
      if (!la && !lb) return 0; if (!la) return 1; if (!lb) return -1;
      return new Date(lb) - new Date(la);
    });
  }, [contacts, allMessages, athleteUserId]);

  const totalUnread = useMemo(() =>
    conversations.reduce((s, c) => s + c.unread, 0), [conversations]);

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(conv => {
      const c = contacts.find(x => x.id === conv.contactId);
      return c?.name.toLowerCase().includes(q) || conv.messages.some(m => m.content.toLowerCase().includes(q));
    });
  }, [conversations, search, contacts]);

  const activeConv    = conversations.find(c => c.contactId === activeId) ?? null;
  const activeContact = contacts.find(c => c.id === activeId) ?? null;

  // ── Sélection contact + mark as read ─────────────────────────────────────
  const selectContact = useCallback(async (contactId) => {
    setActiveId(contactId);
    setDraft("");
    const contact = contacts.find(c => c.id === contactId);
    if (!contact?.userId) return;
    const hasUnread = allMessages.some(m =>
      m.senderId === contact.userId && m.receiverId === athleteUserId && !m.isRead);
    if (!hasUnread) return;
    setAllMessages(prev => prev.map(m =>
      m.senderId === contact.userId && m.receiverId === athleteUserId && !m.isRead
        ? { ...m, isRead: true } : m
    ));
    await supabase.from("messages").update({ is_read: true })
      .eq("sender_id", contact.userId).eq("receiver_id", athleteUserId).eq("is_read", false);
  }, [contacts, allMessages, athleteUserId]);

  // ── Envoi message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    if (!text.trim() || !activeId || !athleteUserId) return;
    const contact = contacts.find(c => c.id === activeId);
    if (!contact?.userId) return;
    setSending(true);
    const { data, error } = await supabase.from("messages")
      .insert({ sender_id: athleteUserId, receiver_id: contact.userId, content: text, is_read: false })
      .select().single();
    if (!error && data) {
      setAllMessages(prev => [...prev, {
        id: data.id, senderId: data.sender_id, receiverId: data.receiver_id,
        content: data.content, date: data.created_at, isRead: data.is_read,
      }]);
      if (contact.type === "coach") {
        notifyCoachMessage(contact.userId, athlete.name, text).catch(console.warn);
      }
    }
    setSending(false);
  }, [activeId, contacts, athleteUserId, athlete.name]);

  // ── Envoi clavier ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(draft);
      setDraft("");
    }
  }, [draft, handleSend]);

  const handleSendButton = useCallback(() => {
    handleSend(draft);
    setDraft("");
    textareaRef.current?.focus();
  }, [draft, handleSend]);

  // ── Horodatage ────────────────────────────────────────────────────────────
  function formatTime(dateStr) {
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("fr-BE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  }

  if (loading) return <LoadingState message="Chargement de la messagerie…" />;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── SIDEBAR CONTACTS ─────────────────────────────────────────────── */}
      <div className={[
        "flex-shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all",
        activeId ? "hidden md:flex w-72" : "flex w-full md:w-72",
      ].join(" ")}>

        {/* Header sidebar */}
        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-black text-slate-800">Messages</h2>
            {totalUnread > 0 && (
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full text-white"
                style={{ background: "#E24B4A" }}>
                {totalUnread}
              </span>
            )}
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 border border-slate-200"
            style={{ background: "#F8FAFC" }}>
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Liste contacts */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <MessageSquare size={20} className="text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-[12px] text-slate-400">Aucun contact disponible</p>
            </div>
          ) : filteredConvs.map(conv => {
            const contact   = contacts.find(c => c.id === conv.contactId);
            const isActive  = conv.contactId === activeId;
            const lastMsg   = conv.lastMsg;
            const isLastOwn = lastMsg?.senderId === athleteUserId;
            return (
              <button
                key={conv.contactId}
                onClick={() => selectContact(conv.contactId)}
                className="w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all hover:bg-slate-50 relative"
                style={isActive ? { background: "#F0FBF7", borderLeft: "3px solid #1D9E75" } : { borderLeft: "3px solid transparent" }}>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[12px] font-black shadow-sm"
                    style={{ background: contact?.color ?? "#94a3b8" }}>
                    {initialsFromName(contact?.name ?? "?")}
                  </div>
                  {/* Badge coach */}
                  {contact?.type === "coach" && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                      <span style={{ fontSize: 7, color: "white", fontWeight: 900 }}>C</span>
                    </div>
                  )}
                  {/* Badge non-lus */}
                  {conv.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-sm"
                      style={{ background: "#E24B4A" }}>
                      {conv.unread}
                    </div>
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={`text-[13px] truncate ${conv.unread > 0 ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}>
                      {contact?.name ?? "?"}
                    </p>
                    {lastMsg && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                        {formatTime(lastMsg.date)}
                      </span>
                    )}
                  </div>
                  {lastMsg ? (
                    <p className={`text-[11.5px] truncate ${conv.unread > 0 ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                      {isLastOwn ? <span className="text-slate-400">Moi : </span> : null}
                      {lastMsg.content}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300 italic">{contact?.subtitle}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── THREAD ───────────────────────────────────────────────────────── */}
      <div className={[
        "flex-1 flex flex-col overflow-hidden",
        !activeId ? "hidden md:flex" : "flex",
      ].join(" ")}>

        {activeConv && activeContact ? (
          <>
            {/* Header thread */}
            <div className="flex-shrink-0 px-4 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3 shadow-sm">
              {/* Retour mobile */}
              <button onClick={() => setActiveId(null)}
                className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0 transition-colors">
                <ChevronLeft size={18} />
              </button>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-black flex-shrink-0 shadow-sm"
                style={{ background: activeContact.color }}>
                {initialsFromName(activeContact.name)}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-black text-slate-800 truncate">{activeContact.name}</p>
                  {activeContact.type === "coach" && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                      Coach
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">{activeContact.subtitle}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2"
              style={{ background: "#F5F5F2" }}>
              {activeConv.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-3xl bg-white flex items-center justify-center shadow-sm">
                    <MessageSquare size={24} className="text-slate-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-400">
                    Écris le premier message !
                  </p>
                </div>
              ) : (
                activeConv.messages.map((m, idx) => {
                  const isOwn = m.senderId === athleteUserId;
                  const prev  = activeConv.messages[idx - 1];
                  const showAvatar = !isOwn && (!prev || prev.senderId !== m.senderId);
                  const showTime   = !activeConv.messages[idx + 1] ||
                    new Date(activeConv.messages[idx + 1].date) - new Date(m.date) > 120000;

                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar interlocuteur */}
                      {!isOwn ? (
                        showAvatar ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-black flex-shrink-0 mb-0.5 shadow-sm"
                            style={{ background: activeContact.color }}>
                            {initialsFromName(activeContact.name)}
                          </div>
                        ) : (
                          <div className="w-7 flex-shrink-0" />
                        )
                      ) : null}

                      <div className={`flex flex-col gap-0.5 max-w-[78%] ${isOwn ? "items-end" : "items-start"}`}>
                        {/* Bulle */}
                        <div className="px-4 py-2.5 text-[13px] leading-relaxed"
                          style={isOwn
                            ? {
                                background: "#1D9E75",
                                color: "white",
                                borderRadius: "20px 20px 4px 20px",
                                boxShadow: "0 2px 8px rgba(29,158,117,0.25)",
                              }
                            : {
                                background: "white",
                                color: "#334155",
                                borderRadius: "20px 20px 20px 4px",
                                border: "1px solid #F1F5F9",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                              }}>
                          {m.content}
                        </div>
                        {/* Horodatage — affiché uniquement si gap ou dernier */}
                        {showTime && (
                          <p className="text-[10px] text-slate-400 px-1 font-medium">
                            {formatTime(m.date)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Zone de saisie */}
            <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-end gap-2.5">
              <div className="flex-1 rounded-2xl px-4 py-2.5 border border-slate-200 bg-slate-50 focus-within:border-emerald-300 focus-within:bg-white transition-colors">
                <textarea
                  ref={textareaRef}
                  className="w-full bg-transparent resize-none text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none max-h-28 min-h-[20px]"
                  rows={1}
                  placeholder={`Message à ${activeContact.name.split(" ")[0]}…`}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ lineHeight: "1.5" }}
                />
              </div>
              <button
                onClick={handleSendButton}
                disabled={!draft.trim() || sending}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all tap-feedback disabled:opacity-30"
                style={{ background: "#1D9E75", boxShadow: draft.trim() ? "0 2px 8px rgba(29,158,117,0.35)" : "none" }}>
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send size={15} strokeWidth={2.5} />}
              </button>
            </div>
          </>
        ) : (
          /* Aucune conversation sélectionnée */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
              <MessageSquare size={28} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-bold text-slate-500">Sélectionne une conversation</p>
              <p className="text-[12px] text-slate-400 mt-1">
                {contacts.length > 0 ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} disponible${contacts.length > 1 ? "s" : ""}` : "Aucun contact"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}