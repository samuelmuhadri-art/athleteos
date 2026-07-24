// ============================================================
// AthleteOS — src/athlete/views/AthleteClub.jsx  ★ DARK MODE v2
// Logique identique + section membres du club enrichie
// ============================================================

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Plus, X, Image, Camera, Send, MessageSquare, Users } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { initialsFromName, colorsFor } from "../shared";

const REACTION_EMOJIS = ["🔥","💪","👏","⚡","🎯","❤️"];

// ─── Notif toast ──────────────────────────────────────────────────────────────
function SocialNotif({ notif, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, maxWidth: 340, width: "calc(100% - 32px)" }}>
      <div style={{
        background: "var(--c-surface-3)", border: "1px solid var(--c-border-strong)",
        borderRadius: 14, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
      }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
          {initialsFromName(notif.athleteName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)", lineHeight: 1.3 }}>
            <span style={{ color: "#1D9E75" }}>{notif.athleteName.split(" ")[0]}</span> {notif.action}
          </p>
          {notif.preview && <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }} className="truncate">{notif.preview}</p>}
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)", padding: 2 }}>
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Modal commentaires — dark ────────────────────────────────────────────────
const CommentsModal = memo(({ post, postAthlete, athlete, allAthletes, onClose, onCommentAdded }) => {
  const [comments, setComments] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase.from("social_comments")
      .select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    setComments(data ?? []); setLoading(false);
  }, [post.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  useEffect(() => {
    const ch = supabase.channel(`comments-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_comments", filter: `post_id=eq.${post.id}` },
        payload => { setComments(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new]); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id]);

  const handleSend = async () => {
    const text = input.trim(); if (!text) return;
    setInput(""); setSending(true);
    const { data } = await supabase.from("social_comments")
      .insert({ post_id: post.id, athlete_id: athlete.id, content: text }).select().single();
    if (data) { setComments(p => [...p, data]); onCommentAdded(); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ marginTop: "auto", background: "var(--c-surface)", borderRadius: "20px 20px 0 0", border: "1px solid var(--c-border)", borderBottom: "none", display: "flex", flexDirection: "column", maxHeight: "85dvh" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>
        {/* Header */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--c-text-1)" }}>Commentaires</h3>
            <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 1 }}>Post de {postAthlete?.name?.split(" ")[0] ?? "—"}</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-3)" }}>
            <X size={15} />
          </button>
        </div>
        {/* Preview post */}
        <div style={{ padding: "10px 16px", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", flexShrink: 0 }}>
          {post.image_url && <img src={post.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", float: "left", marginRight: 10, marginBottom: 4 }} />}
          <p style={{ fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.5 }} className="line-clamp-2">{post.content}</p>
        </div>
        {/* Commentaires */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div className="loader-ring" style={{ margin: "0 auto" }} />
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Aucun commentaire — sois le premier !</p>
            </div>
          ) : comments.map(c => {
            const ca    = allAthletes.find(a => a.id === c.athlete_id);
            const isOwn = c.athlete_id === athlete.id;
            const diff  = (new Date() - new Date(c.created_at)) / 1000;
            const ago   = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)}min` : `${Math.floor(diff/3600)}h`;
            return (
              <div key={c.id} style={{ display: "flex", gap: 8, flexDirection: isOwn ? "row-reverse" : "row" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isOwn ? "#1D9E75" : "#5B8DEF", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                  {initialsFromName(ca?.name ?? "?")}
                </div>
                <div style={{ maxWidth: "75%" }}>
                  <div style={{
                    background: isOwn ? "#1D9E7520" : "var(--c-surface-2)",
                    border: `1px solid ${isOwn ? "#1D9E7530" : "var(--c-border)"}`,
                    borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "8px 12px",
                  }}>
                    <p style={{ fontSize: 10.5, fontWeight: 500, color: isOwn ? "#1D9E75" : "var(--c-text-2)", marginBottom: 3 }}>
                      {ca?.name?.split(" ")[0] ?? "?"}{isOwn && " · Moi"}
                    </p>
                    <p style={{ fontSize: 12.5, color: "var(--c-text-1)", lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                  <p style={{ fontSize: 9.5, color: "var(--c-text-4)", marginTop: 3, paddingLeft: 6 }}>{ago}</p>
                </div>
              </div>
            );
          })}
        </div>
        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 8, background: "var(--c-surface)", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
            {initialsFromName(athlete.name)}
          </div>
          <div style={{ flex: 1, background: "var(--c-surface-2)", borderRadius: 20, padding: "8px 14px", border: "1px solid var(--c-border)" }}>
            <input style={{ width: "100%", background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--c-text-1)" }}
              placeholder="Ajouter un commentaire…" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }} />
          </div>
          <button onClick={handleSend} disabled={!input.trim() || sending}
            style={{ width: 34, height: 34, borderRadius: "50%", background: "#1D9E75", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: !input.trim() || sending ? 0.4 : 1 }}>
            <Send size={13} color="white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Album photos — dark ──────────────────────────────────────────────────────
const PhotoAlbumModal = memo(({ posts, allAthletes, onClose }) => {
  const photos = posts.filter(p => p.image_url);
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 500, color: "white" }}>Album du club</h3>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.40)" }}>{photos.length} photo{photos.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={onClose} style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.10)", border: "none", cursor: "pointer", color: "white" }}>
          <X size={16} />
        </button>
      </div>
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <img src={selected.image_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 14, objectFit: "contain" }} />
          </div>
          <div style={{ padding: "14px 20px", background: "rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9, fontWeight: 600 }}>
                {initialsFromName(allAthletes.find(a => a.id === selected.athlete_id)?.name ?? "?")}
              </div>
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "white" }}>{allAthletes.find(a => a.id === selected.athlete_id)?.name ?? "—"}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.40)" }}>{new Date(selected.created_at).toLocaleDateString("fr-BE",{day:"numeric",month:"long"})}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>{selected.content}</p>
          </div>
          <button onClick={() => setSelected(null)}
            style={{ margin: "0 20px 24px", padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "white", fontSize: 13 }}>
            ← Retour à l'album
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
          {photos.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "rgba(255,255,255,0.25)" }}>
              <Camera size={36} strokeWidth={1.5} />
              <p style={{ fontSize: 13 }}>Aucune photo partagée</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3 }}>
              {photos.map(p => (
                <div key={p.id} style={{ aspectRatio: "1", position: "relative", cursor: "pointer" }} onClick={() => setSelected(p)}>
                  <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                  <div style={{ position: "absolute", bottom: 4, left: 4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "#1C1C1A" }}>
                      {initialsFromName(allAthletes.find(a => a.id === p.athlete_id)?.name ?? "?")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthleteClub({ athlete, allAthletes, clubId, sessions, profile }) {
  const [posts,           setPosts]           = useState([]);
  const [allPosts,        setAllPosts]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showCreate,      setShowCreate]      = useState(false);
  const [showAlbum,       setShowAlbum]       = useState(false);
  const [activeComments,  setActiveComments]  = useState(null);
  const [newContent,      setNewContent]      = useState("");
  const [newImage,        setNewImage]        = useState(null);
  const [newImageUrl,     setNewImageUrl]     = useState(null);
  const [selectedSession, setSelectedSession] = useState("");
  const [posting,         setPosting]         = useState(false);
  const [notif,           setNotif]           = useState(null);
  const [commentCounts,   setCommentCounts]   = useState({});

  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString();
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!clubId) return;
    const [feedRes, allRes] = await Promise.all([
      supabase.from("social_posts").select("*, social_reactions(*)")
        .eq("club_id", clubId).gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("social_posts").select("id, image_url, athlete_id, content, created_at")
        .eq("club_id", clubId).not("image_url", "is", null)
        .order("created_at", { ascending: false }),
    ]);
    if (!feedRes.error) setPosts(feedRes.data ?? []);
    if (!allRes.error)  setAllPosts(allRes.data ?? []);
    const ids = (feedRes.data ?? []).map(p => p.id);
    if (ids.length > 0) {
      const { data: coms } = await supabase.from("social_comments").select("post_id").in("post_id", ids);
      const counts = {};
      (coms ?? []).forEach(c => { counts[c.post_id] = (counts[c.post_id] ?? 0) + 1; });
      setCommentCounts(counts);
    }
    setLoading(false);
  }, [clubId, sevenDaysAgo]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!clubId) return;
    const ch = supabase.channel("social-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_posts" }, async payload => {
        fetchPosts();
        if (payload.new.athlete_id !== athlete.id) {
          const { data: a } = await supabase.from("athletes").select("name").eq("id", payload.new.athlete_id).single();
          setNotif({ athleteName: a?.name ?? "Un athlète", action: "a partagé une séance", preview: payload.new.content });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_reactions" }, () => fetchPosts())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "social_reactions" }, () => fetchPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_comments" }, () => fetchPosts())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchPosts, athlete.id, clubId]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setNewImage(file); setNewImageUrl(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (newImage) {
        const ext  = newImage.name.split(".").pop() || "jpg";
        const path = `social-photos/${athlete.id}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("social-photos").upload(path, newImage, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("social-photos").getPublicUrl(path);
          imageUrl = urlData?.publicUrl ?? null;
        }
      }
      await supabase.from("social_posts").insert({
        athlete_id: athlete.id, club_id: clubId,
        session_id: selectedSession ? Number(selectedSession) : null,
        content: newContent.trim(), image_url: imageUrl,
      });
      setNewContent(""); setNewImage(null); setNewImageUrl(null);
      setSelectedSession(""); setShowCreate(false);
    } finally { setPosting(false); }
  };

  const handleReact = async (postId, emoji) => {
    const post     = posts.find(p => p.id === postId);
    const existing = post?.social_reactions?.find(r => r.athlete_id === athlete.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("social_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("social_reactions").delete().eq("post_id", postId).eq("athlete_id", athlete.id);
      await supabase.from("social_reactions").insert({ post_id: postId, athlete_id: athlete.id, emoji });
    }
    fetchPosts();
  };

  const handleDelete = async (postId) => {
    await supabase.from("social_comments").delete().eq("post_id", postId);
    await supabase.from("social_reactions").delete().eq("post_id", postId);
    await supabase.from("social_posts").delete().eq("id", postId);
    fetchPosts();
  };

  const recentSessions = sessions.slice(0, 10);

  // ── Couleurs avatar par index ──────────────────────────────────────────────
  const AVATAR_COLORS = ["#1D9E75","#5B8DEF","#9B84F0","#E8A020","#E05252","#14B8A6","#F97316","#EC4899"];

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", minHeight: "100%" }}>
      {notif && <SocialNotif notif={notif} onDismiss={() => setNotif(null)} />}

      {/* ── HEADER ── */}
      <div className="header-glass" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--c-text-1)", letterSpacing: "-0.01em" }}>Mon club</h2>
          <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 1 }}>
            {allAthletes.length} athlète{allAthletes.length > 1 ? "s" : ""} · 7 derniers jours
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setShowAlbum(true)}
            className="btn-secondary" style={{ minHeight: 34, padding: "0 10px", fontSize: 11, gap: 4 }}>
            <Image size={12} /> Album
          </button>
          <label className="btn-primary" style={{ minHeight: 34, padding: "0 10px", fontSize: 11, gap: 4, cursor: "pointer" }}>
            <Camera size={12} /> Photo
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={e => { handleImageChange(e); setShowCreate(true); }} />
          </label>
          <button onClick={() => setShowCreate(v => !v)}
            style={{ width: 34, height: 34, borderRadius: 10, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)" }}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── MEMBRES DU CLUB ── section enrichie */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(29,158,117,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={13} color="#1D9E75" strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }}>Membres du club</p>
              <p style={{ fontSize: 10, color: "var(--c-text-3)" }}>{allAthletes.length} athlète{allAthletes.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allAthletes.map((a, idx) => {
              const isMe = a.id === athlete.id;
              const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const activityThisWeek = posts.some(p => p.athlete_id === a.id);
              return (
                <div key={a.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 56 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontSize: 12, fontWeight: 600,
                      border: isMe ? `2px solid #1D9E75` : "2px solid transparent",
                      boxShadow: isMe ? `0 0 0 2px rgba(29,158,117,0.25)` : "none",
                    }}>
                      {initialsFromName(a.name)}
                    </div>
                    {/* Dot vert si actif cette semaine */}
                    {activityThisWeek && (
                      <div style={{
                        position: "absolute", bottom: 1, right: 1,
                        width: 9, height: 9, borderRadius: "50%",
                        background: "#1D9E75",
                        border: "1.5px solid var(--c-surface)",
                      }} />
                    )}
                  </div>
                  <p style={{ fontSize: 8.5, color: isMe ? "#1D9E75" : "var(--c-text-3)", fontWeight: isMe ? 600 : 400, textAlign: "center", lineHeight: 1.2, maxWidth: 52 }} className="truncate">
                    {isMe ? "Moi" : a.name.split(" ")[0]}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Légende */}
          <div style={{ padding: "6px 14px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D9E75" }} />
            <p style={{ fontSize: 9.5, color: "var(--c-text-4)" }}>= actif cette semaine</p>
          </div>
        </div>

        {/* ── CRÉER UN POST ── */}
        {showCreate && (
          <div className="card" style={{ overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                {initialsFromName(athlete.name)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }}>{athlete.name}</p>
                <p style={{ fontSize: 10, color: "var(--c-text-3)" }}>Partage avec ton club</p>
              </div>
              <button onClick={() => { setShowCreate(false); setNewContent(""); setNewImage(null); setNewImageUrl(null); }}
                style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--c-text-3)" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {newImageUrl && (
                <div style={{ position: "relative" }}>
                  <img src={newImageUrl} alt="preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
                  <button onClick={() => { setNewImage(null); setNewImageUrl(null); }}
                    style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.60)", border: "none", cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={11} />
                  </button>
                </div>
              )}
              <textarea
                className="input-premium"
                style={{ minHeight: 80, padding: "10px 12px", resize: "none", lineHeight: 1.5 }}
                rows={3} autoFocus
                placeholder="Comment s'est passée ta séance ?"
                value={newContent} onChange={e => setNewContent(e.target.value)} />
              {recentSessions.length > 0 && (
                <select className="input-premium" style={{ minHeight: 38 }}
                  value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                  <option value="">Lier une séance (optionnel)</option>
                  {recentSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${s.week}`}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label className="btn-secondary" style={{ minHeight: 34, padding: "0 10px", fontSize: 11, gap: 4, cursor: "pointer", flex: "none" }}>
                  <Image size={12} /> {newImage ? "Photo ✓" : "Galerie"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                </label>
                <label className="btn-secondary" style={{ minHeight: 34, padding: "0 10px", fontSize: 11, gap: 4, cursor: "pointer", flex: "none" }}>
                  <Camera size={12} /> Caméra
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleImageChange} />
                </label>
                <button onClick={handlePost} disabled={!newContent.trim() || posting}
                  className="btn-primary" style={{ flex: 1, minHeight: 34, fontSize: 12 }}>
                  {posting
                    ? <><div className="loader-ring loader-ring-sm" />Envoi…</>
                    : <><Send size={12} />Publier</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FIL POSTS ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="loader-ring" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Chargement…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
            <Camera size={36} color="var(--c-text-4)" strokeWidth={1.5} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--c-text-2)", marginBottom: 6 }}>Fil vide</p>
            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 16 }}>Sois le premier à partager !</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ margin: "0 auto", fontSize: 12 }}>
              <Camera size={13} /> Partager maintenant
            </button>
          </div>
        ) : posts.map(post => {
          const postAthlete = allAthletes.find(a => a.id === post.athlete_id);
          const isOwn       = post.athlete_id === athlete.id;
          const linkedSess  = sessions.find(s => s.id === post.session_id);
          const myReaction  = post.social_reactions?.find(r => r.athlete_id === athlete.id);
          const comCount    = commentCounts[post.id] ?? 0;
          const rxCounts    = {};
          (post.social_reactions ?? []).forEach(r => { rxCounts[r.emoji] = (rxCounts[r.emoji] ?? 0) + 1; });
          const diff    = (new Date() - new Date(post.created_at)) / 1000;
          const timeAgo = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)} min` : diff < 86400 ? `${Math.floor(diff/3600)}h` : `${Math.floor(diff/86400)}j`;
          const expiresIn = Math.ceil((7*86400 - diff) / 3600);
          const avatarColor = AVATAR_COLORS[allAthletes.findIndex(a => a.id === post.athlete_id) % AVATAR_COLORS.length] ?? "#1D9E75";

          return (
            <div key={post.id} className="card" style={{ overflow: "hidden" }}>
              {/* Header post */}
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: isOwn ? "#1D9E75" : avatarColor, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    {initialsFromName(postAthlete?.name ?? "?")}
                  </div>
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)", display: "flex", alignItems: "center", gap: 6 }}>
                      {postAthlete?.name ?? "Athlète"}
                      {isOwn && (
                        <span style={{ fontSize: 9.5, fontWeight: 500, padding: "1px 6px", borderRadius: 4, background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}>Moi</span>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 1 }}>
                      {timeAgo}
                      {expiresIn <= 24 && expiresIn > 0 && (
                        <span style={{ marginLeft: 6, color: "#E8A020", fontWeight: 500 }}>· expire dans {expiresIn}h</span>
                      )}
                    </p>
                  </div>
                </div>
                {isOwn && (
                  <button onClick={() => handleDelete(post.id)}
                    style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "var(--c-text-4)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Image */}
              {post.image_url && (
                <img src={post.image_url} alt="post" style={{ width: "100%", maxHeight: 340, objectFit: "cover", cursor: "pointer", display: "block" }}
                  onClick={() => setActiveComments(post)} />
              )}

              {/* Contenu texte */}
              <div style={{ padding: "10px 14px" }}>
                <p style={{ fontSize: 13, color: "var(--c-text-1)", lineHeight: 1.55 }}>{post.content}</p>
                {linkedSess && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, background: "var(--c-surface-2)", borderRadius: 9, padding: "7px 10px" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: colorsFor(linkedSess.category).border, flexShrink: 0 }} />
                    <p style={{ fontSize: 11, fontWeight: 500, color: "var(--c-text-2)" }}>{linkedSess.title}</p>
                    <span style={{ color: "var(--c-text-4)", fontSize: 10 }}>·</span>
                    <p style={{ fontSize: 11, color: "var(--c-text-3)" }}>
                      {linkedSess.sessionDate ? new Date(linkedSess.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${linkedSess.week}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Réactions + commentaires */}
              <div style={{ padding: "0 14px 12px" }}>
                {Object.keys(rxCounts).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {Object.entries(rxCounts).sort((a,b) => b[1]-a[1]).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 20,
                          border: `1px solid ${myReaction?.emoji === emoji ? "rgba(29,158,117,0.35)" : "var(--c-border)"}`,
                          background: myReaction?.emoji === emoji ? "rgba(29,158,117,0.10)" : "var(--c-surface-2)",
                          cursor: "pointer", fontSize: 12,
                          transform: myReaction?.emoji === emoji ? "scale(1.05)" : "scale(1)",
                          transition: "all 0.15s ease",
                        }}>
                        <span>{emoji}</span>
                        <span style={{ fontSize: 10.5, color: "var(--c-text-2)", fontWeight: 500 }}>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                      style={{
                        width: 32, height: 32, borderRadius: 9, fontSize: 14,
                        border: `1px solid ${myReaction?.emoji === emoji ? "rgba(29,158,117,0.30)" : "var(--c-border)"}`,
                        background: myReaction?.emoji === emoji ? "rgba(29,158,117,0.08)" : "var(--c-surface-2)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transform: myReaction?.emoji === emoji ? "scale(1.1)" : "scale(1)",
                        transition: "transform 0.15s ease",
                      }}>
                      {emoji}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setActiveComments(post)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9,
                      background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                      cursor: "pointer", color: "var(--c-text-2)", fontSize: 11.5, fontWeight: 500,
                    }}>
                    <MessageSquare size={12} />
                    {comCount > 0 ? comCount : ""} Commenter
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {posts.length > 0 && (
          <p style={{ textAlign: "center", fontSize: 10.5, color: "var(--c-text-4)", padding: "4px 0 8px" }}>
            Posts visibles 7 jours · Photos conservées dans l'album
          </p>
        )}
      </div>

      {activeComments && (
        <CommentsModal
          post={activeComments}
          postAthlete={allAthletes.find(a => a.id === activeComments.athlete_id)}
          athlete={athlete} allAthletes={allAthletes}
          onClose={() => setActiveComments(null)}
          onCommentAdded={() => fetchPosts()}
        />
      )}
      {showAlbum && <PhotoAlbumModal posts={allPosts} allAthletes={allAthletes} onClose={() => setShowAlbum(false)} />}
    </div>
  );
}