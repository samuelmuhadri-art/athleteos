// ============================================================
// AthleteOS — src/athlete/views/AthleteMsgerie.jsx  ★ DARK MODE
// Fix : bouton retour mobile toujours visible
// Dark : toutes couleurs hardcodées → variables CSS
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

  const fetchAll = useCallback(async () => {
    if (!athleteUserId || !clubId) return;
    try {
      const { data: athleteRows } = await supabase
        .from("athletes").select("id, name, profile_data, user_id")
        .eq("club_id", clubId).neq("id", athlete.id);
      const { data: userRows } = await supabase
        .from("users").select("id, name, role")
        .eq("club_id", clubId).neq("role", "athlete");

      const COLORS = ["#1D9E75","#9B84F0","#E8A020","#E05252","#14B8A6","#F97316","#EC4899"];
      const coachContacts = (userRows ?? []).map(u => ({
        id: `user-${u.id}`, userId: u.id, name: u.name,
        avatar: initialsFromName(u.name), type: "coach",
        subtitle: u.role === "head_coach" ? "Head coach" : "Coach",
        color: "#5B8DEF",
      }));
      const athleteContacts = (athleteRows ?? [])
        .filter(a => a.user_id != null)
        .map((a, idx) => ({
          id: `athlete-${a.id}`, userId: a.user_id, name: a.name,
          avatar: a.profile_data?.avatar ?? initialsFromName(a.name), type: "athlete",
          subtitle: a.main_discipline ?? "Athlète",
          color: COLORS[idx % COLORS.length],
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
    } catch (e) { console.error("AthleteMsgerie:", e); }
    finally { setLoading(false); }
  }, [athleteUserId, clubId, athlete.id, coachUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!athleteUserId) return;
    const ch = supabase.channel("ma-messagerie-universal")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
        const m = payload.new;
        if (m.receiver_id !== athleteUserId && m.sender_id !== athleteUserId) return;
        setAllMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, {
          id: m.id, senderId: m.sender_id, receiverId: m.receiver_id,
          content: m.content, date: m.created_at, isRead: m.is_read,
        }]);
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
      const la = a.lastMsg?.date ?? "", lb = b.lastMsg?.date ?? "";
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
    setActiveId(contactId); setDraft("");
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
      if (contact.type === "coach") notifyCoachMessage(contact.userId, athlete.name, text).catch(console.warn);
    }
    setSending(false);
  }, [activeId, contacts, athleteUserId, athlete.name]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(draft); setDraft(""); }
  }, [draft, handleSend]);

  const handleSendButton = useCallback(() => {
    handleSend(draft); setDraft(""); textareaRef.current?.focus();
  }, [draft, handleSend]);

  function formatTime(dateStr) {
    const d = new Date(dateStr), now = new Date(), diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString("fr-BE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
  }

  if (loading) return <LoadingState message="Chargement de la messagerie…" />;

  return (
    <div style={{ display: "flex", overflow: "hidden", height: "calc(100vh - 56px)" }}>

      {/* ── SIDEBAR CONTACTS ── */}
      <div className={activeId ? "hidden md:flex" : "flex"}
        style={{ flexShrink: 0, width: "100%", background: "var(--c-surface)", borderRight: "1px solid var(--c-border)", display: "flex", flexDirection: "column" }}
        // Desktop toujours w-72
      >
        <style>{`@media (min-width:768px) { .sidebar-msg { display:flex !important; width:288px !important; } }`}</style>
        <div className="sidebar-msg" style={{ flexShrink: 0, background: "var(--c-surface)", borderRight: "1px solid var(--c-border)", display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--c-border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--c-text-1)" }}>Messages</h2>
              {totalUnread > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#E05252", color: "white" }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "8px 12px", background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
              <Search size={12} color="var(--c-text-3)" style={{ flexShrink: 0 }} />
              <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12.5, color: "var(--c-text-1)" }} />
            </div>
          </div>

          {/* Liste */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConvs.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center" }}>
                <MessageSquare size={22} color="var(--c-text-4)" strokeWidth={1.5} style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Aucun contact disponible</p>
              </div>
            ) : filteredConvs.map(conv => {
              const contact   = contacts.find(c => c.id === conv.contactId);
              const isActive  = conv.contactId === activeId;
              const lastMsg   = conv.lastMsg;
              const isLastOwn = lastMsg?.senderId === athleteUserId;
              return (
                <button key={conv.contactId} onClick={() => selectContact(conv.contactId)}
                  style={{
                    width: "100%", textAlign: "left", padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 10,
                    background: isActive ? "rgba(29,158,117,0.08)" : "transparent",
                    borderLeft: `3px solid ${isActive ? "#1D9E75" : "transparent"}`,
                    borderLeft: `3px solid ${isActive ? "#1D9E75" : "transparent"}`,
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: contact?.color ?? "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600 }}>
                      {initialsFromName(contact?.name ?? "?")}
                    </div>
                    {contact?.type === "coach" && (
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderRadius: "50%", background: "#5B8DEF", border: "2px solid var(--c-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, color: "white", fontWeight: 700 }}>C</div>
                    )}
                    {conv.unread > 0 && (
                      <div style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, borderRadius: "50%", background: "#E05252", color: "white", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--c-surface)" }}>
                        {conv.unread}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 2 }}>
                      <p style={{ fontSize: 12.5, fontWeight: conv.unread > 0 ? 600 : 400, color: conv.unread > 0 ? "var(--c-text-1)" : "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {contact?.name ?? "?"}
                      </p>
                      {lastMsg && <span style={{ fontSize: 9.5, color: "var(--c-text-3)", flexShrink: 0 }}>{formatTime(lastMsg.date)}</span>}
                    </div>
                    {lastMsg ? (
                      <p style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: conv.unread > 0 ? "var(--c-text-2)" : "var(--c-text-3)", fontWeight: conv.unread > 0 ? 500 : 400 }}>
                        {isLastOwn && <span style={{ color: "var(--c-text-3)" }}>Moi : </span>}
                        {lastMsg.content}
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, color: "var(--c-text-4)", fontStyle: "italic" }}>{contact?.subtitle}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── THREAD ── */}
      <div className={!activeId ? "hidden md:flex" : "flex"}
        style={{ flex: 1, flexDirection: "column", overflow: "hidden", display: "flex" }}>

        {activeConv && activeContact ? (
          <>
            {/* Header — bouton retour TOUJOURS en premier, bien visible */}
            <div style={{ flexShrink: 0, padding: "10px 14px", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Bouton retour mobile — grand, bien visible */}
              <button onClick={() => setActiveId(null)}
                className="md:hidden tap-feedback"
                style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--c-text-1)" }}>
                <ChevronLeft size={20} />
              </button>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: activeContact.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600 }}>
                {initialsFromName(activeContact.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--c-text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeContact.name}
                  </p>
                  {activeContact.type === "coach" && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(91,141,239,0.15)", color: "#5B8DEF", flexShrink: 0 }}>
                      Coach
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 1 }}>{activeContact.subtitle}</p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 6, background: "var(--c-bg)" }}>
              {activeConv.messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MessageSquare size={22} color="var(--c-text-4)" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--c-text-3)" }}>Écris le premier message !</p>
                </div>
              ) : activeConv.messages.map((m, idx) => {
                const isOwn      = m.senderId === athleteUserId;
                const prev       = activeConv.messages[idx - 1];
                const showAvatar = !isOwn && (!prev || prev.senderId !== m.senderId);
                const showTime   = !activeConv.messages[idx + 1] || new Date(activeConv.messages[idx + 1].date) - new Date(m.date) > 120000;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isOwn ? "row-reverse" : "row" }}>
                    {!isOwn ? (
                      showAvatar ? (
                        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: activeContact.color, marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 8.5, fontWeight: 600 }}>
                          {initialsFromName(activeContact.name)}
                        </div>
                      ) : <div style={{ width: 26, flexShrink: 0 }} />
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: "76%", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                      <div style={{ padding: "9px 14px", fontSize: 13, lineHeight: 1.55, ...(isOwn ? { background: "#1D9E75", color: "white", borderRadius: "18px 18px 4px 18px", boxShadow: "0 2px 8px rgba(29,158,117,0.20)" } : { background: "var(--c-surface)", color: "var(--c-text-1)", borderRadius: "18px 18px 18px 4px", border: "1px solid var(--c-border)" }) }}>
                        {m.content}
                      </div>
                      {showTime && <p style={{ fontSize: 9.5, color: "var(--c-text-4)", padding: "0 4px" }}>{formatTime(m.date)}</p>}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Zone saisie */}
            <div style={{ flexShrink: 0, padding: "10px 12px", background: "var(--c-surface)", borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ flex: 1, borderRadius: 18, padding: "9px 14px", background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
                <textarea ref={textareaRef}
                  style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 13, color: "var(--c-text-1)", lineHeight: 1.5, maxHeight: 100, minHeight: 20 }}
                  rows={1}
                  placeholder={`Message à ${activeContact.name.split(" ")[0]}…`}
                  value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown}
                />
              </div>
              <button onClick={handleSendButton} disabled={!draft.trim() || sending}
                className="tap-feedback"
                style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: "#1D9E75", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: (!draft.trim() || sending) ? 0.35 : 1, boxShadow: draft.trim() ? "0 2px 8px rgba(29,158,117,0.28)" : "none", transition: "opacity 0.15s ease" }}>
                {sending
                  ? <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin-smooth 0.65s linear infinite" }} />
                  : <Send size={14} color="white" strokeWidth={2.5} />}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={24} color="var(--c-text-4)" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Sélectionne une conversation</p>
              <p style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 4 }}>
                {contacts.length > 0 ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} disponible${contacts.length > 1 ? "s" : ""}` : "Aucun contact"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}