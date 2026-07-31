// ============================================================
// AthleteOS — Messagerie athlète
// Conversations privées avec les coachs et les autres athlètes du club.
// ============================================================

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyAthleteMessage, notifyCoachMessage } from "../../utils/notifications";
import LoadingState from "../../components/ui/LoadingState";
import ErrorState from "../../components/ui/ErrorState";
import { initialsFromName } from "../shared";
import {
  MESSAGE_FILTERS,
  MESSAGE_MAX_LENGTH,
  QUICK_REPLIES,
  appendUniqueMessage,
  buildAthleteConversations,
  filterAthleteConversations,
  formatConversationTime,
  formatMessageDay,
  formatMessageTime,
  groupMessagesByDay,
  mapMessageRow,
} from "./athleteMessaging";

const CONTACT_COLORS = ["#1D9E75", "#9B84F0", "#E8A020", "#E05252", "#14B8A6", "#F97316", "#EC4899"];

const ContactAvatar = memo(({ contact, size = 46, unread = 0 }) => (
  <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
    <div style={{
      width:size, height:size, borderRadius:"50%", background:contact?.color ?? "#5B8DEF",
      display:"flex", alignItems:"center", justifyContent:"center", color:"white",
      fontSize:size >= 44 ? 13 : 12, fontWeight:800,
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.16)",
    }}>
      {initialsFromName(contact?.name ?? "?")}
    </div>
    {contact?.type === "coach" && (
      <div aria-label="Coach" style={{
        position:"absolute", right:-2, bottom:-2, width:19, height:19, borderRadius:"50%",
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"#5B8DEF", border:"2px solid var(--c-surface)",
      }}>
        <ShieldCheck size={10} color="white" strokeWidth={2.5}/>
      </div>
    )}
    {unread > 0 && (
      <div aria-label={`${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`} style={{
        position:"absolute", right:-5, top:-5, minWidth:22, height:22, padding:"0 5px", borderRadius:99,
        display:"flex", alignItems:"center", justifyContent:"center", background:"#E05252",
        border:"2px solid var(--c-surface)", color:"white", fontSize:12, fontWeight:800,
      }}>
        {unread > 9 ? "9+" : unread}
      </div>
    )}
  </div>
));

const ConversationItem = memo(({ conversation, contact, currentUserId, active, onSelect }) => {
  const lastMessage = conversation.lastMsg;
  const ownLastMessage = lastMessage?.senderId === currentUserId;
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.contactId)}
      aria-current={active ? "page" : undefined}
      aria-label={`${contact?.name ?? "Contact"}${conversation.unread ? `, ${conversation.unread} non lu` : ""}`}
      className="tap-feedback"
      style={{
        width:"100%", minHeight:76, padding:"12px 14px", borderRadius:14, border:`1px solid ${active ? "rgba(77,201,160,0.28)" : "transparent"}`,
        background:active ? "linear-gradient(135deg, rgba(29,158,117,0.14), rgba(29,158,117,0.06))" : "transparent",
        display:"flex", alignItems:"center", gap:12, textAlign:"left", cursor:"pointer", color:"inherit",
      }}>
      <ContactAvatar contact={contact} unread={conversation.unread}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <p style={{ fontSize:14, fontWeight:conversation.unread ? 800 : 700, color:"var(--c-text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {contact?.name ?? "Contact"}
          </p>
          {lastMessage && (
            <span style={{ fontSize:12, fontWeight:600, color:conversation.unread ? "#7BD8B4" : "var(--c-text-3)", flexShrink:0 }}>
              {formatConversationTime(lastMessage.date)}
            </span>
          )}
        </div>
        {lastMessage ? (
          <p style={{ marginTop:5, fontSize:12, lineHeight:1.35, fontWeight:conversation.unread ? 600 : 500, color:conversation.unread ? "var(--c-text-2)" : "var(--c-text-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {ownLastMessage ? "Moi · " : ""}{lastMessage.content}
          </p>
        ) : (
          <p style={{ marginTop:5, fontSize:12, color:"var(--c-text-3)" }}>{contact?.subtitle ?? "Nouvelle conversation"}</p>
        )}
      </div>
    </button>
  );
});

const MessageBubble = memo(({ message, own, contact, showAvatar, showMeta }) => (
  <div style={{ display:"flex", alignItems:"flex-end", gap:8, flexDirection:own ? "row-reverse" : "row" }}>
    {!own && (showAvatar
      ? <ContactAvatar contact={contact} size={32}/>
      : <div aria-hidden="true" style={{ width:32, flexShrink:0 }}/>
    )}
    <div style={{ display:"flex", flexDirection:"column", alignItems:own ? "flex-end" : "flex-start", maxWidth:"min(82%, 620px)" }}>
      <div style={{
        padding:"10px 14px", borderRadius:own ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
        background:own ? "linear-gradient(135deg, #1D9E75, #16826C)" : "var(--c-surface)",
        border:own ? "1px solid rgba(77,201,160,0.18)" : "1px solid var(--c-border)",
        color:own ? "white" : "var(--c-text-1)", boxShadow:own ? "0 4px 14px rgba(29,158,117,0.16)" : "var(--shadow-card)",
        fontSize:15, lineHeight:1.5, whiteSpace:"pre-wrap", overflowWrap:"anywhere",
      }}>
        {message.content}
      </div>
      {showMeta && (
        <div style={{ minHeight:20, padding:"3px 4px 0", display:"flex", alignItems:"center", gap:5, color:"var(--c-text-3)" }}>
          <span style={{ fontSize:12 }}>{formatMessageTime(message.date)}</span>
          {own && (message.isRead
            ? <CheckCheck size={14} color="#7BD8B4" aria-label="Message lu"/>
            : <Check size={14} aria-label="Message envoyé"/>
          )}
        </div>
      )}
    </div>
  </div>
));

function EmptyThread({ onSuggestion }) {
  return (
    <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:"32px 20px", textAlign:"center" }}>
      <div style={{ width:64, height:64, borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(145deg, rgba(29,158,117,0.18), rgba(91,141,239,0.10))", border:"1px solid rgba(77,201,160,0.18)" }}>
        <MessageSquare size={27} color="#7BD8B4" strokeWidth={1.7}/>
      </div>
      <div>
        <p style={{ fontSize:17, fontWeight:800, color:"var(--c-text-1)" }}>Démarre la conversation</p>
        <p style={{ marginTop:6, maxWidth:360, fontSize:13, lineHeight:1.5, color:"var(--c-text-2)" }}>Un message simple suffit. Tu peux aussi partir d’une réponse rapide.</p>
      </div>
      <div aria-label="Réponses rapides" style={{ display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
        {QUICK_REPLIES.map(reply => (
          <button key={reply} type="button" onClick={() => onSuggestion(reply)} className="tap-feedback"
            style={{ minHeight:44, padding:"0 14px", borderRadius:99, border:"1px solid var(--c-border)", background:"var(--c-surface)", color:"var(--c-text-2)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AthleteMsgerie({ athlete, coachUserId, athleteUserId, clubId }) {
  const [contacts, setContacts] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [sending, setSending] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);
  const threadScrollRef = useRef(null);
  const initializedRef = useRef(false);
  const sendingRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const contactsRef = useRef(contacts);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  const fetchAll = useCallback(async () => {
    if (!athleteUserId || !clubId) {
      setLoadError("Ton compte n’est pas encore relié à la messagerie du club.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [athletesResult, usersResult] = await Promise.all([
        supabase.from("athletes")
          .select("id, name, main_discipline, profile_data, user_id")
          .eq("club_id", clubId)
          .neq("id", athlete.id),
        supabase.from("users")
          .select("id, name, role")
          .eq("club_id", clubId)
          .neq("role", "athlete"),
      ]);
      if (athletesResult.error) throw athletesResult.error;
      if (usersResult.error) throw usersResult.error;

      const coachContacts = (usersResult.data ?? []).map(user => ({
        id:`user-${user.id}`, userId:user.id, name:user.name ?? "Coach", type:"coach",
        subtitle:user.role === "head_coach" ? "Head coach" : "Coach", color:"#5B8DEF",
      }));
      const athleteContacts = (athletesResult.data ?? [])
        .filter(item => item.user_id != null)
        .map((item, index) => ({
          id:`athlete-${item.id}`, athleteId:item.id, userId:item.user_id,
          name:item.name ?? "Athlète", type:"athlete", subtitle:item.main_discipline ?? "Athlète",
          color:CONTACT_COLORS[index % CONTACT_COLORS.length],
        }));
      const nextContacts = [...coachContacts, ...athleteContacts];
      const contactUserIds = nextContacts.map(contact => contact.userId).filter(Boolean);

      let messageRows = [];
      if (contactUserIds.length) {
        const messagesResult = await supabase.from("messages")
          .select("*")
          .or(`and(sender_id.eq.${athleteUserId},receiver_id.in.(${contactUserIds.join(",")})),and(receiver_id.eq.${athleteUserId},sender_id.in.(${contactUserIds.join(",")}))`)
          .order("created_at", { ascending:true });
        if (messagesResult.error) throw messagesResult.error;
        messageRows = messagesResult.data ?? [];
      }

      setContacts(nextContacts);
      setAllMessages(messageRows.map(mapMessageRow));
      setActiveId(current => current && nextContacts.some(contact => contact.id === current) ? current : null);

      if (!initializedRef.current) {
        const defaultCoach = nextContacts.find(contact => contact.userId === coachUserId);
        const desktop = typeof window !== "undefined" && (window.matchMedia?.("(min-width: 768px)")?.matches ?? window.innerWidth >= 768);
        if (defaultCoach && desktop) setActiveId(defaultCoach.id);
        initializedRef.current = true;
      }
    } catch (error) {
      console.error("AthleteMsgerie — chargement :", error);
      setLoadError("La messagerie n’a pas pu être chargée. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }, [athlete.id, athleteUserId, clubId, coachUserId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!athleteUserId) return undefined;
    const applyRealtimeMessage = (row, isUpdate = false) => {
      if (row.receiver_id !== athleteUserId && row.sender_id !== athleteUserId) return;
      const message = mapMessageRow(row);
      if (isUpdate) {
        setAllMessages(previous => previous.map(item => item.id === message.id ? message : item));
        return;
      }

      const openContact = contactsRef.current.find(contact => contact.id === activeIdRef.current);
      const receivedInOpenThread = row.receiver_id === athleteUserId && openContact?.userId === row.sender_id;
      if (receivedInOpenThread) message.isRead = true;
      setAllMessages(previous => appendUniqueMessage(previous, message));

      if (receivedInOpenThread) {
        supabase.from("messages").update({ is_read:true }).eq("id", row.id).then(({ error }) => {
          if (!error) return;
          setAllMessages(previous => previous.map(item => item.id === row.id ? { ...item, isRead:false } : item));
          setActionError("Le message est arrivé, mais son statut de lecture n’a pas pu être synchronisé.");
        });
      }
    };

    const channel = supabase.channel(`athlete-messaging-${athleteUserId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, payload => applyRealtimeMessage(payload.new))
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"messages" }, payload => applyRealtimeMessage(payload.new, true))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [athleteUserId]);

  const conversations = useMemo(
    () => buildAthleteConversations(allMessages, contacts, athleteUserId),
    [allMessages, contacts, athleteUserId]
  );
  const filteredConversations = useMemo(
    () => filterAthleteConversations(conversations, contacts, activeFilter, search),
    [conversations, contacts, activeFilter, search]
  );
  const activeConversation = useMemo(
    () => conversations.find(conversation => conversation.contactId === activeId) ?? null,
    [conversations, activeId]
  );
  const activeContact = useMemo(
    () => contacts.find(contact => contact.id === activeId) ?? null,
    [contacts, activeId]
  );
  const messageGroups = useMemo(
    () => groupMessagesByDay(activeConversation?.messages ?? []),
    [activeConversation?.messages]
  );
  const totalUnread = useMemo(() => conversations.reduce((total, conversation) => total + conversation.unread, 0), [conversations]);
  const filterCounts = useMemo(() => ({
    all:conversations.length,
    coaches:conversations.filter(conversation => contacts.find(contact => contact.id === conversation.contactId)?.type === "coach").length,
    athletes:conversations.filter(conversation => contacts.find(contact => contact.id === conversation.contactId)?.type === "athlete").length,
    unread:totalUnread,
  }), [conversations, contacts, totalUnread]);

  const selectContact = useCallback(async contactId => {
    setActiveId(contactId);
    setDraft("");
    setActionError(null);
    const contact = contacts.find(item => item.id === contactId);
    if (!contact?.userId) return;
    const unreadIds = allMessages
      .filter(message => message.senderId === contact.userId && message.receiverId === athleteUserId && !message.isRead)
      .map(message => message.id);
    if (!unreadIds.length) return;

    const unreadSet = new Set(unreadIds);
    setAllMessages(previous => previous.map(message => unreadSet.has(message.id) ? { ...message, isRead:true } : message));
    const { error } = await supabase.from("messages").update({ is_read:true }).in("id", unreadIds);
    if (error) {
      setAllMessages(previous => previous.map(message => unreadSet.has(message.id) ? { ...message, isRead:false } : message));
      setActionError("Impossible de synchroniser les messages lus. Vérifie ta connexion.");
    }
  }, [contacts, allMessages, athleteUserId]);

  const handleSend = useCallback(async rawText => {
    const text = rawText.trim().slice(0, MESSAGE_MAX_LENGTH);
    if (!text || !activeId || !athleteUserId || sendingRef.current) return false;
    const contact = contacts.find(item => item.id === activeId);
    if (!contact?.userId) return false;

    sendingRef.current = true;
    setSending(true);
    setActionError(null);
    try {
      const { data, error } = await supabase.from("messages")
        .insert({ sender_id:athleteUserId, receiver_id:contact.userId, content:text, is_read:false })
        .select()
        .single();
      if (error) throw error;

      setAllMessages(previous => appendUniqueMessage(previous, mapMessageRow(data)));

      // Notifications existantes : conservées volontairement et déclenchées
      // uniquement après l'enregistrement réussi du message.
      if (contact.type === "coach") {
        notifyCoachMessage(contact.userId, athlete.name, text).catch(console.warn);
      } else if (contact.type === "athlete" && contact.athleteId) {
        notifyAthleteMessage(clubId, contact.athleteId, athlete.name, text).catch(console.warn);
      }
      return true;
    } catch (error) {
      console.error("AthleteMsgerie — envoi :", error);
      setActionError("Ton message n’a pas été envoyé. Le brouillon est conservé pour réessayer.");
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [activeId, athlete.name, athleteUserId, clubId, contacts]);

  const submitDraft = useCallback(async () => {
    const sent = await handleSend(draft);
    if (!sent) return;
    setDraft("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [draft, handleSend]);

  const handleKeyDown = useCallback(event => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitDraft();
    }
  }, [submitDraft]);

  const chooseSuggestion = useCallback(suggestion => {
    setDraft(suggestion);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    const container = threadScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => container.scrollTo({ top:container.scrollHeight, behavior:"smooth" }));
  }, [activeId, activeConversation?.messages.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [draft]);

  if (loading) return <LoadingState message="Chargement de la messagerie…"/>;
  if (loadError) return <ErrorState message={loadError} onRetry={fetchAll}/>;

  return (
    <div className="h-[calc(100dvh-56px-80px)] md:h-[calc(100dvh-56px)] md:p-4" style={{ boxSizing:"border-box", overflow:"hidden", background:"var(--c-bg)" }}>
      <section className="card" style={{ width:"100%", height:"100%", display:"flex", overflow:"hidden", background:"var(--c-surface)" }}>
        <aside className={["flex-col flex-shrink-0", activeId ? "hidden md:flex md:w-[340px]" : "flex w-full md:w-[340px]"].join(" ")}
          style={{ borderRight:"1px solid var(--c-border)", background:"linear-gradient(180deg, rgba(91,141,239,0.05), var(--c-surface) 22%)" }}>
          <div style={{ padding:"18px 16px 14px", borderBottom:"1px solid var(--c-border)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                  <Sparkles size={13} color="#8DB1F6"/>
                  <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--tone-info)" }}>Espace équipe</span>
                </div>
                <h1 style={{ fontSize:24, lineHeight:1.15, fontWeight:800, letterSpacing:"-0.025em", color:"var(--c-text-1)" }}>Messages</h1>
                <p style={{ marginTop:5, fontSize:13, color:"var(--c-text-2)" }}>{contacts.length} contact{contacts.length > 1 ? "s" : ""} dans ton club</p>
              </div>
              {totalUnread > 0 && (
                <span style={{ minHeight:32, padding:"0 10px", borderRadius:99, display:"inline-flex", alignItems:"center", background:"rgba(224,82,82,0.12)", border:"1px solid rgba(224,82,82,0.20)", color:"var(--tone-danger)", fontSize:12, fontWeight:800 }}>
                  {totalUnread} non lu{totalUnread > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div style={{ minHeight:48, marginTop:16, padding:"0 14px", borderRadius:14, display:"flex", alignItems:"center", gap:10, background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
              <Search size={17} color="var(--c-text-2)" aria-hidden="true"/>
              <label htmlFor="athlete-message-search" className="sr-only">Rechercher une conversation</label>
              <input id="athlete-message-search" type="search" placeholder="Nom ou contenu d’un message…" value={search} onChange={event => setSearch(event.target.value)}
                style={{ flex:1, minWidth:0, background:"transparent", border:"none", outline:"none", color:"var(--c-text-1)", fontSize:14 }}/>
              {search && (
                <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")}
                  style={{ width:44, height:44, marginRight:-12, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", color:"var(--c-text-2)", cursor:"pointer" }}>
                  <X size={16}/>
                </button>
              )}
            </div>

            <nav aria-label="Filtrer les conversations" style={{ marginTop:12, display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none" }}>
              {MESSAGE_FILTERS.map(filter => {
                const active = activeFilter === filter.id;
                return (
                  <button key={filter.id} type="button" aria-pressed={active} onClick={() => setActiveFilter(filter.id)} className="tap-feedback"
                    style={{ minHeight:44, padding:"0 12px", borderRadius:12, flexShrink:0, border:`1px solid ${active ? "rgba(77,201,160,0.30)" : "var(--c-border)"}`, background:active ? "rgba(29,158,117,0.13)" : "transparent", color:active ? "#7BD8B4" : "var(--c-text-2)", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                    {filter.label} · {filterCounts[filter.id]}
                  </button>
                );
              })}
            </nav>
          </div>

          <div style={{ flex:1, padding:8, overflowY:"auto" }}>
            {filteredConversations.length ? filteredConversations.map(conversation => (
              <ConversationItem
                key={conversation.contactId}
                conversation={conversation}
                contact={contacts.find(contact => contact.id === conversation.contactId)}
                currentUserId={athleteUserId}
                active={conversation.contactId === activeId}
                onSelect={selectContact}
              />
            )) : (
              <div style={{ minHeight:260, padding:24, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
                <div style={{ width:56, height:56, borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
                  <Users size={23} color="var(--c-text-3)"/>
                </div>
                <p style={{ marginTop:14, fontSize:15, fontWeight:800, color:"var(--c-text-1)" }}>{search ? "Aucun résultat" : "Aucune conversation"}</p>
                <p style={{ marginTop:5, maxWidth:240, fontSize:13, lineHeight:1.5, color:"var(--c-text-2)" }}>
                  {search ? "Essaie un autre nom ou un mot présent dans tes messages." : "Aucun contact ne correspond à ce filtre."}
                </p>
                {(search || activeFilter !== "all") && (
                  <button type="button" onClick={() => { setSearch(""); setActiveFilter("all"); }} className="btn-secondary" style={{ marginTop:16 }}>Réinitialiser</button>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className={["flex-col flex-1 min-w-0 overflow-hidden", activeId ? "flex" : "hidden md:flex"].join(" ")}>
          {activeConversation && activeContact ? (
            <>
              <header style={{ minHeight:72, padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0, borderBottom:"1px solid var(--c-border)", background:"rgba(18,20,24,0.88)", backdropFilter:"blur(16px)" }}>
                <button type="button" aria-label="Retour aux conversations" onClick={() => setActiveId(null)} className="md:hidden tap-feedback"
                  style={{ width:44, height:44, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid var(--c-border)", background:"var(--c-surface-2)", color:"var(--c-text-1)", cursor:"pointer" }}>
                  <ChevronLeft size={21}/>
                </button>
                <ContactAvatar contact={activeContact} size={44}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <h2 style={{ fontSize:15, fontWeight:800, color:"var(--c-text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeContact.name}</h2>
                    {activeContact.type === "coach" && (
                      <span style={{ padding:"3px 8px", borderRadius:99, background:"rgba(91,141,239,0.13)", border:"1px solid rgba(91,141,239,0.20)", color:"var(--tone-info)", fontSize:12, fontWeight:800 }}>Coach</span>
                    )}
                  </div>
                  <p style={{ marginTop:3, fontSize:12, color:"var(--c-text-2)" }}>{activeContact.subtitle} · conversation privée</p>
                </div>
                <div className="hidden sm:flex" style={{ minHeight:36, padding:"0 10px", alignItems:"center", gap:6, borderRadius:99, background:"rgba(29,158,117,0.08)", color:"var(--tone-success)", fontSize:12, fontWeight:700 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:"#4DC9A0", boxShadow:"0 0 0 4px rgba(77,201,160,0.10)" }}/>
                  Temps réel
                </div>
              </header>

              <div ref={threadScrollRef} style={{ flex:1, overflowY:"auto", padding:"16px clamp(14px, 3vw, 32px) 24px", background:"radial-gradient(circle at 50% 0%, rgba(91,141,239,0.05), transparent 36%), var(--c-bg)" }}>
                {messageGroups.length === 0 ? <EmptyThread onSuggestion={chooseSuggestion}/> : messageGroups.map(group => (
                  <section key={group.key} aria-label={formatMessageDay(group.date)}>
                    <div style={{ margin:"20px 0 16px", display:"flex", alignItems:"center", gap:12 }}>
                      <span aria-hidden="true" style={{ height:1, flex:1, background:"var(--c-border)" }}/>
                      <span style={{ padding:"5px 10px", borderRadius:99, border:"1px solid var(--c-border)", background:"var(--c-surface-2)", color:"var(--c-text-2)", fontSize:12, fontWeight:700, textTransform:"capitalize" }}>{formatMessageDay(group.date)}</span>
                      <span aria-hidden="true" style={{ height:1, flex:1, background:"var(--c-border)" }}/>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {group.messages.map((message, index) => {
                        const own = message.senderId === athleteUserId;
                        const next = group.messages[index + 1];
                        const clustered = next && next.senderId === message.senderId && new Date(next.date) - new Date(message.date) <= 120000;
                        return (
                          <MessageBubble key={message.id} message={message} own={own} contact={activeContact} showAvatar={!own && !clustered} showMeta={!clustered}/>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <footer style={{ flexShrink:0, background:"var(--c-surface)", borderTop:"1px solid var(--c-border)" }}>
                {actionError && (
                  <div role="alert" style={{ minHeight:48, padding:"8px 12px 8px 16px", display:"flex", alignItems:"center", gap:10, background:"rgba(224,82,82,0.08)", borderBottom:"1px solid rgba(224,82,82,0.16)" }}>
                    <p style={{ flex:1, fontSize:13, lineHeight:1.4, color:"var(--tone-danger)" }}>{actionError}</p>
                    <button type="button" aria-label="Fermer le message d’erreur" onClick={() => setActionError(null)} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", color:"var(--tone-danger)", cursor:"pointer" }}><X size={17}/></button>
                  </div>
                )}
                <div style={{ padding:"10px 12px max(10px, env(safe-area-inset-bottom))", display:"flex", alignItems:"flex-end", gap:10 }}>
                  <div style={{ flex:1, minWidth:0, padding:"10px 14px", borderRadius:18, background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      maxLength={MESSAGE_MAX_LENGTH}
                      aria-label={`Message à ${activeContact.name}`}
                      placeholder={`Message à ${activeContact.name.split(" ")[0]}…`}
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      style={{ width:"100%", minHeight:24, maxHeight:120, display:"block", resize:"none", overflowY:"auto", border:"none", outline:"none", background:"transparent", color:"var(--c-text-1)", fontSize:15, lineHeight:1.5 }}
                    />
                    {draft.length >= MESSAGE_MAX_LENGTH * 0.8 && (
                      <p style={{ marginTop:4, textAlign:"right", fontSize:12, color:draft.length === MESSAGE_MAX_LENGTH ? "#F19A9A" : "var(--c-text-3)" }}>{draft.length}/{MESSAGE_MAX_LENGTH}</p>
                    )}
                  </div>
                  <button type="button" aria-label="Envoyer le message" onClick={submitDraft} disabled={!draft.trim() || sending} className="tap-feedback"
                    style={{ width:48, height:48, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(77,201,160,0.22)", background:"linear-gradient(135deg, #1D9E75, #16826C)", color:"white", cursor:"pointer", opacity:!draft.trim() || sending ? 0.38 : 1, boxShadow:draft.trim() ? "0 6px 18px rgba(29,158,117,0.25)" : "none" }}>
                    {sending
                      ? <span aria-label="Envoi en cours" style={{ width:17, height:17, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.35)", borderTopColor:"white", animation:"spin-smooth 0.65s linear infinite" }}/>
                      : <Send size={18} strokeWidth={2.5}/>
                    }
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div style={{ flex:1, padding:24, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", background:"radial-gradient(circle at 50% 40%, rgba(29,158,117,0.07), transparent 34%), var(--c-bg)" }}>
              <div style={{ width:76, height:76, borderRadius:24, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(145deg, rgba(29,158,117,0.16), rgba(91,141,239,0.10))", border:"1px solid rgba(77,201,160,0.18)" }}>
                <MessageSquare size={32} color="#7BD8B4" strokeWidth={1.6}/>
              </div>
              <h2 style={{ marginTop:20, fontSize:20, fontWeight:800, letterSpacing:"-0.02em", color:"var(--c-text-1)" }}>Ta messagerie d’équipe</h2>
              <p style={{ marginTop:7, maxWidth:390, fontSize:14, lineHeight:1.55, color:"var(--c-text-2)" }}>Sélectionne un coach ou un athlète pour échanger dans un espace privé et synchronisé en temps réel.</p>
              <div style={{ marginTop:18, minHeight:40, padding:"0 12px", borderRadius:99, display:"flex", alignItems:"center", gap:7, background:"var(--c-surface)", border:"1px solid var(--c-border)", color:"var(--c-text-2)", fontSize:12, fontWeight:700 }}>
                <ShieldCheck size={15} color="#7BD8B4"/> Réservé aux membres du club
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
