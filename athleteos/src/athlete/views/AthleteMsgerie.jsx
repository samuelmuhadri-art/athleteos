// ============================================================
// AthleteOS — src/athlete/views/AthleteMsgerie.jsx
// Extrait de AthleteApp.jsx — function MaMessagerie(...)
// Zéro modification du code.
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MessageSquare, Search, Send, ChevronLeft } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage } from "../../utils/notifications";
import LoadingState from "../../components/ui/LoadingState";
import { initialsFromName } from "../shared";

export default function AthleteMsgerie({ athlete, coachUserId, athleteUserId, coachName, clubId, allAthletes }) {
  const [contacts,    setContacts]    = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [activeId,    setActiveId]    = useState(null);
  const [search,      setSearch]      = useState("");
  const bottomRef      = useRef(null);
  const initializedRef = useRef(false);

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
        subtitle: u.role === "head_coach" ? "Head coach" : "Coach", color: "#378ADD",
      }));

      const athleteContacts = (athleteRows ?? [])
        .filter(a => a.user_id != null)
        .map((a, idx) => ({
          id: `athlete-${a.id}`, userId: a.user_id, name: a.name,
          avatar: a.profile_data?.avatar ?? initialsFromName(a.name), type: "athlete",
          subtitle: a.main_discipline ?? "Athlète",
          color: ["#1D9E75","#A855F7","#EF9F27","#E24B4A","#14B8A6","#F97316","#EC4899"][idx % 7],
        }));

      const allContacts  = [...coachContacts, ...athleteContacts];
      const allUserIds   = allContacts.map(c => c.userId).filter(Boolean);

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
    } catch(e) {
      console.error("MaMessagerie:", e);
    } finally {
      setLoading(false);
    }
  }, [athleteUserId, clubId, athlete.id, coachUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!athleteUserId) return;
    const ch = supabase.channel("ma-messagerie-universal")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const m = payload.new;
        const isForMe = m.receiver_id === athleteUserId || m.sender_id === athleteUserId;
        if (!isForMe) return;
        setAllMessages(prev =>
          prev.some(x => x.id === m.id) ? prev : [...prev, {
            id: m.id, senderId: m.sender_id, receiverId: m.receiver_id,
            content: m.content, date: m.created_at, isRead: m.is_read,
          }]
        );
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [athleteUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, activeId]);

  const conversations = useMemo(() => {
    return contacts.map(contact => {
      const msgs = allMessages.filter(m =>
        (m.senderId === athleteUserId && m.receiverId === contact.userId) ||
        (m.senderId === contact.userId && m.receiverId === athleteUserId)
      ).sort((a, b) => new Date(a.date) - new Date(b.date));
      const unread = msgs.filter(m => m.senderId === contact.userId && !m.isRead).length;
      return { contactId: contact.id, messages: msgs, unread, lastMsg: msgs[msgs.length - 1] };
    }).sort((a, b) => {
      const la = a.lastMsg?.date ?? ""; const lb = b.lastMsg?.date ?? "";
      if (!la && !lb) return 0; if (!la) return 1; if (!lb) return -1;
      return new Date(lb) - new Date(la);
    });
  }, [contacts, allMessages, athleteUserId]);

  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unread, 0), [conversations]);

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

  const selectContact = useCallback(async (contactId) => {
    setActiveId(contactId);
    const contact = contacts.find(c => c.id === contactId);
    if (!contact?.userId) return;
    const hasUnread = allMessages.some(m => m.senderId === contact.userId && m.receiverId === athleteUserId && !m.isRead);
    if (!hasUnread) return;
    setAllMessages(prev => prev.map(m =>
      m.senderId === contact.userId && m.receiverId === athleteUserId && !m.isRead ? { ...m, isRead: true } : m
    ));
    await supabase.from("messages").update({ is_read: true })
      .eq("sender_id", contact.userId).eq("receiver_id", athleteUserId).eq("is_read", false);
  }, [contacts, allMessages, athleteUserId]);

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

  if (loading) return <LoadingState message="Chargement de la messagerie…" />;

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

      {/* Contacts */}
      <div className={["flex-shrink-0 bg-white border-r border-slate-100 flex flex-col transition-all",
        activeId ? "hidden md:flex w-64" : "flex w-full md:w-64"].join(" ")}>
        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-800">Messages</h2>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-red-500 animate-bounce-in">{totalUnread}</span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] text-slate-700 placeholder-slate-400 focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredConvs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-slate-200" />
              <p className="text-[12px] text-slate-300">Aucun contact disponible</p>
            </div>
          ) : filteredConvs.map(conv => {
            const contact    = contacts.find(c => c.id === conv.contactId);
            const isActive   = conv.contactId === activeId;
            const lastMsg    = conv.lastMsg;
            const isLastOwn  = lastMsg?.senderId === athleteUserId;
            return (
              <button key={conv.contactId} onClick={() => selectContact(conv.contactId)}
                className={["w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all hover:bg-slate-50",
                  isActive ? "bg-emerald-50 border-r-2 border-emerald-500" : ""].join(" ")}>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                    style={{ background: contact?.color ?? "#94a3b8" }}>
                    {initialsFromName(contact?.name ?? "?")}
                  </div>
                  {contact?.type === "coach" && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                      <span style={{ fontSize: 7, color: "white", fontWeight: 800 }}>C</span>
                    </div>
                  )}
                  {conv.unread > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {conv.unread}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={`text-[13px] truncate ${conv.unread > 0 ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>
                      {contact?.name ?? "?"}
                    </p>
                    {lastMsg && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {new Date(lastMsg.date).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  {lastMsg ? (
                    <p className={`text-[11.5px] truncate ${conv.unread > 0 ? "text-slate-600 font-medium" : "text-slate-400"}`}>
                      {isLastOwn ? "Moi : " : ""}{lastMsg.content}
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

      {/* Thread */}
      <div className={["flex-1 flex flex-col overflow-hidden", !activeId ? "hidden md:flex" : "flex"].join(" ")}>
        {activeConv && activeContact ? (
          <>
            <div className="flex-shrink-0 px-4 py-3.5 border-b border-slate-100 bg-white flex items-center gap-3">
              <button onClick={() => setActiveId(null)} className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0">
                <ChevronLeft size={18} />
              </button>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: activeContact.color }}>
                {initialsFromName(activeContact.name)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-slate-800">{activeContact.name}</p>
                  {activeContact.type === "coach" && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Coach</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">{activeContact.subtitle}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "#FAFAFA" }}>
              {activeConv.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                  <MessageSquare size={28} strokeWidth={1.5} />
                  <p className="text-[12.5px]">Aucun message — écris le premier !</p>
                </div>
              ) : activeConv.messages.map(m => {
                const isOwn = m.senderId === athleteUserId;
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    {!isOwn && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5"
                        style={{ background: activeContact.color }}>
                        {initialsFromName(activeContact.name)}
                      </div>
                    )}
                    <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                      <div className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm"
                        style={isOwn
                          ? { background: "#1D9E75", color: "white",   borderBottomRightRadius: "4px" }
                          : { background: "white",   color: "#334155", borderBottomLeftRadius: "4px", border: "1px solid #f1f5f9" }}>
                        {m.content}
                      </div>
                      <p className={`text-[10px] text-slate-400 px-1 ${isOwn ? "text-right" : ""}`}>
                        {new Date(m.date).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-end gap-2">
              <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5">
                <textarea
                  className="w-full bg-transparent resize-none text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none max-h-28 min-h-[20px]"
                  rows={1}
                  placeholder={`Message à ${activeContact.name.split(" ")[0]}…`}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  style={{ lineHeight: "1.5" }}
                />
              </div>
              <button
                onClick={(e) => {
                  const ta   = e.currentTarget.previousSibling.querySelector("textarea");
                  const text = ta.value.trim();
                  if (!text || sending) return;
                  handleSend(text);
                  ta.value = "";
                }}
                disabled={sending}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all"
                style={{ background: "#1D9E75" }}>
                <Send size={16} strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
            <MessageSquare size={36} strokeWidth={1.5} />
            <p className="text-[13px] font-semibold">Sélectionne une conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}