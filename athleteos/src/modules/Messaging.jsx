// ============================================================
// AthleteOS — src/modules/Messaging.jsx
// Version nettoyée Phase 2 :
// - useAuth() remplace COACH_USER_ID = 1 hardcodé
// - club_id dynamique via clubId depuis useAuth()
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : split-screen, bulles, envoi, marquage lu.
// ============================================================

import {
  memo, useState, useMemo, useCallback,
  useEffect, useRef,
} from "react";
import { Send, Search, MessageSquare, Check, CheckCheck } from "lucide-react";
import { supabase }   from "../utils/supabaseClient";
import { notifyAthleteMessage } from "../utils/notifications";
import { useAuth }    from "../context/AuthContext";
import LoadingState   from "../components/ui/LoadingState";
import ErrorState     from "../components/ui/ErrorState";
import { notifyAthleteMessage } from "../utils/notifications";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATHLETE_COLORS = [
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

function athleteColor(athlete, athletes) {
  if (!athlete) return "#94a3b8";
  const idx = athletes.findIndex((a) => a.id === athlete.id);
  return ATHLETE_COLORS[idx % ATHLETE_COLORS.length] ?? "#94a3b8";
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

// Construit les conversations depuis les messages + athlètes
// coachUserId = l'id entier (int4) du coach dans la table users
function buildConversations(msgs, athletes, coachUserId) {
  const convMap = new Map();
  athletes.forEach((a) => {
    if (a.userId == null) return;
    convMap.set(a.id, { athleteId: a.id, userId: a.userId, messages: [], unread: 0 });
  });
  msgs.forEach((m) => {
    const otherUserId = m.senderId === coachUserId ? m.receiverId : m.senderId;
    const athlete     = athletes.find((a) => a.userId === otherUserId);
    if (!athlete) return;
    const conv = convMap.get(athlete.id);
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

const MessageBubble = memo(({ msg, isOwn, athlete, athletes }) => {
  const color = isOwn ? "#1D9E75" : athleteColor(athlete, athletes);
  return (
    <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mb-0.5" style={{ background: color }}>
          {athlete?.avatar ?? "?"}
        </div>
      )}
      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm"
          style={isOwn
            ? { background: "#1D9E75", color: "white",   borderBottomRightRadius: "4px" }
            : { background: "#F1F5F9", color: "#334155", borderBottomLeftRadius: "4px" }}
        >
          {msg.content}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1">
          <span>{formatTime(msg.date)}</span>
          {isOwn && (msg.isRead ? <CheckCheck size={11} color="#1D9E75" /> : <Check size={11} color="#94a3b8" />)}
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

const ConvItem = memo(({ conv, athlete, athletes, isActive, onClick, coachUserId }) => {
  const lastMsg         = conv.messages[conv.messages.length - 1];
  const color           = athleteColor(athlete, athletes);
  const isLastFromCoach = lastMsg?.senderId === coachUserId;
  return (
    <button
      onClick={() => onClick(conv.athleteId)}
      className={["w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all hover:bg-slate-50 focus:outline-none", isActive ? "bg-emerald-50 border-r-2 border-emerald-500" : ""].join(" ")}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: color }}>
          {athlete?.avatar ?? "?"}
        </div>
        {conv.unread > 0 && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: "#E24B4A" }}>
            {conv.unread}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className={`text-[13px] truncate ${conv.unread > 0 ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>
            {athlete?.name ?? `Athlète ${conv.athleteId}`}
          </p>
          {lastMsg && <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(lastMsg.date)}</span>}
        </div>
        {lastMsg ? (
          <p className={`text-[11.5px] truncate ${conv.unread > 0 ? "text-slate-600 font-medium" : "text-slate-400"}`}>
            {isLastFromCoach ? "Vous : " : ""}{lastMsg.content}
          </p>
        ) : (
          <p className="text-[11.5px] text-slate-300 italic">Aucun message échangé</p>
        )}
      </div>
    </button>
  );
});

const ChatThread = memo(({ conv, athlete, athletes, onSend, coachUserId }) => {
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const color   = athleteColor(athlete, athletes);
  const grouped = useMemo(() => groupByDate(conv.messages), [conv.messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conv.messages.length]);

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
      <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: color }}>
          {athlete?.avatar ?? "?"}
        </div>
        <div>
          <p className="text-[14px] font-bold text-slate-800">{athlete?.name ?? "Athlète"}</p>
          <p className="text-[11px] text-slate-400">{athlete?.mainDiscipline ?? ""}{athlete?.level ? ` · ${athlete.level}` : ""}</p>
        </div>
      </div>

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
              : <MessageBubble key={item.key} msg={item.data} isOwn={item.data.senderId === coachUserId} athlete={athlete} athletes={athletes} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white flex items-end gap-2">
        <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 flex items-end gap-2">
          <textarea
            className="flex-1 bg-transparent resize-none text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none max-h-28 min-h-[20px]"
            rows={1}
            placeholder={`Message à ${athlete?.name?.split(" ")[0] ?? "l'athlète"}…`}
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
    <p className="text-[12px] text-slate-300">Cliquez sur un athlète pour voir le fil de discussion</p>
  </div>
);

// ─── Composant principal ──────────────────────────────────────────────────────
function Messaging() {
  // profile.id = l'id entier (int4) du coach dans la table users
  // C'est lui qu'on utilise comme sender_id / receiver_id dans messages
  const { profile, clubId } = useAuth();
  const coachUserId = profile?.id ?? null;

  const [athletes,    setAthletes]    = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activeAthleteId, setActiveAthleteId] = useState(null);
  const [search,      setSearch]      = useState("");

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId || !coachUserId) return;
    try {
      setLoading(true);
      setError(null);

      const athletesRes = await supabase
        .from("athletes")
        .select("id, name, main_discipline, user_id, profile_data")
        .eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const remappedAthletes = athletesRes.data.map((a) => ({
        id:             a.id,
        name:           a.name,
        mainDiscipline: a.main_discipline,
        userId:         a.user_id,
        avatar:         a.profile_data?.avatar ?? initialsFromName(a.name),
        level:          a.profile_data?.level ?? null,
      }));

      const linkedUserIds = remappedAthletes.map((a) => a.userId).filter((id) => id != null);

      const messagesRes = linkedUserIds.length
        ? await supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${coachUserId},receiver_id.in.(${linkedUserIds.join(",")})),` +
              `and(receiver_id.eq.${coachUserId},sender_id.in.(${linkedUserIds.join(",")}))`
            )
        : { data: [], error: null };
      if (messagesRes.error) throw messagesRes.error;

      setAthletes(remappedAthletes);
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

  // ═══ Conversations dérivées ════════════════════════════════════════════════
  const conversations    = useMemo(() => buildConversations(allMessages, athletes, coachUserId), [allMessages, athletes, coachUserId]);
  const unlinkedAthletes = useMemo(() => athletes.filter((a) => a.userId == null), [athletes]);

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((conv) => {
      const athlete = athletes.find((a) => a.id === conv.athleteId);
      return athlete?.name.toLowerCase().includes(q) || conv.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [conversations, search, athletes]);

  const activeConv    = useMemo(() => conversations.find((c) => c.athleteId === activeAthleteId) ?? null, [conversations, activeAthleteId]);
  const activeAthlete = useMemo(() => athletes.find((a) => a.id === activeAthleteId) ?? null, [athletes, activeAthleteId]);
  const totalUnread   = useMemo(() => conversations.reduce((s, c) => s + c.unread, 0), [conversations]);

  // ═══ Actions ══════════════════════════════════════════════════════════════

  const selectConv = useCallback(async (athleteId) => {
    setActiveAthleteId(athleteId);
    const athlete = athletes.find((a) => a.id === athleteId);
    if (!athlete?.userId) return;
    const hasUnread = allMessages.some((m) => m.senderId === athlete.userId && m.receiverId === coachUserId && !m.isRead);
    if (!hasUnread) return;
    // Mise à jour optimiste
    setAllMessages((prev) => prev.map((m) =>
      m.senderId === athlete.userId && m.receiverId === coachUserId && !m.isRead ? { ...m, isRead: true } : m
    ));
    const { error: err } = await supabase
      .from("messages").update({ is_read: true })
      .eq("sender_id", athlete.userId).eq("receiver_id", coachUserId).eq("is_read", false);
    if (err) { console.error("Messaging — markRead :", err); fetchAll(); }
  }, [athletes, allMessages, coachUserId, fetchAll]);

  const handleSend = useCallback(async (text) => {
  if (!activeAthleteId || !coachUserId) return;
  const athlete = athletes.find((a) => a.id === activeAthleteId);
  if (!athlete?.userId) return;
  const { data, error: err } = await supabase
    .from("messages")
    .insert({ sender_id: coachUserId, receiver_id: athlete.userId, content: text, is_read: false })
    .select().single();
  if (err) { console.error("Messaging — send :", err); return; }
  setAllMessages((prev) => [...prev, { id: data.id, senderId: data.sender_id, receiverId: data.receiver_id, content: data.content, date: data.created_at, isRead: data.is_read }]);

  // Notif athlète
  if (data && athlete?.userId) {
    await notifyAthleteMessage(
      clubId,
      athlete.userId,
      profile?.name ?? "Coach",
      text
    );
  }
}, [activeAthleteId, athletes, coachUserId, clubId, profile]);
  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement de la messagerie…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="flex h-full overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── Panneau gauche ─────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">

        <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-slate-800">Messagerie</h2>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#E24B4A" }}>
                {totalUnread} non lu{totalUnread > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[12.5px] text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Coach connecté */}
        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2.5 flex-shrink-0 bg-slate-50">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: "#378ADD" }}>
            {initialsFromName(profile?.name ?? "")}
          </div>
          <div>
            <p className="text-[11.5px] font-semibold text-slate-700">{profile?.name ?? "Coach"}</p>
            <p className="text-[10px] text-slate-400">Connecté</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        </div>

        {unlinkedAthletes.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <p className="text-[10.5px] text-amber-700 leading-relaxed">
              ⚠️ {unlinkedAthletes.length} athlète{unlinkedAthletes.length > 1 ? "s" : ""} sans compte lié —
              messagerie indisponible pour {unlinkedAthletes.map((a) => a.name.split(" ")[0]).join(", ")}.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredConvs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-slate-300">
              {athletes.filter((a) => a.userId).length === 0
                ? "Aucun athlète lié à un compte pour l'instant"
                : "Aucune conversation trouvée"}
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const athlete = athletes.find((a) => a.id === conv.athleteId);
              return (
                <ConvItem
                  key={conv.athleteId}
                  conv={conv}
                  athlete={athlete}
                  athletes={athletes}
                  isActive={conv.athleteId === activeAthleteId}
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
        {activeConv && activeAthlete ? (
          <ChatThread
            key={activeAthleteId}
            conv={activeConv}
            athlete={activeAthlete}
            athletes={athletes}
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