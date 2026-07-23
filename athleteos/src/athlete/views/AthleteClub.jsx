// ============================================================
// AthleteOS — src/athlete/views/AthleteClub.jsx
// Extrait de AthleteApp.jsx — function MonClub(...)
//   + SocialNotif + CommentsModal + PhotoAlbumModal
// Zéro modification du code.
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Plus, X, Image, Camera, Send, MessageSquare } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { initialsFromName, colorsFor } from "../shared";

const REACTION_EMOJIS = ["🔥","💪","👏","⚡","🎯","❤️"];

function SocialNotif({ notif, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
      <div className="bg-slate-800 text-white rounded-2xl px-4 py-3.5 shadow-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {initialsFromName(notif.athleteName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight">
            <span className="text-emerald-400">{notif.athleteName.split(" ")[0]}</span> {notif.action}
          </p>
          {notif.preview && <p className="text-[11px] text-white/60 truncate mt-0.5">{notif.preview}</p>}
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white flex-shrink-0"><X size={14} /></button>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(15,23,42,0.6)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mt-auto bg-white rounded-t-2xl flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">Commentaires</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Post de {postAthlete?.name?.split(" ")[0] ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          {post.image_url && <img src={post.image_url} alt="" className="w-12 h-12 rounded-xl object-cover float-left mr-3 mb-1" />}
          <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2">{post.content}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-6"><div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto" /></div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-slate-300"><p className="text-[12px]">Aucun commentaire — sois le premier !</p></div>
          ) : comments.map(c => {
            const ca    = allAthletes.find(a => a.id === c.athlete_id);
            const isOwn = c.athlete_id === athlete.id;
            const diff  = (new Date() - new Date(c.created_at)) / 1000;
            const ago   = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)}min` : `${Math.floor(diff/3600)}h`;
            return (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                  style={{ background: isOwn ? "#1D9E75" : "#378ADD" }}>
                  {initialsFromName(ca?.name ?? "?")}
                </div>
                <div className="flex-1">
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <p className="text-[11px] font-bold text-slate-700 mb-0.5">
                      {ca?.name?.split(" ")[0] ?? "?"}{isOwn && <span className="ml-1 text-emerald-500">· Moi</span>}
                    </p>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed">{c.content}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 ml-2">{ago}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: "#1D9E75" }}>
            {initialsFromName(athlete.name)}
          </div>
          <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5">
            <input className="w-full bg-transparent text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none"
              placeholder="Ajouter un commentaire…" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }} />
          </div>
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
            style={{ background: "#1D9E75" }}>
            <Send size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
});

const PhotoAlbumModal = memo(({ posts, allAthletes, onClose }) => {
  const photos = posts.filter(p => p.image_url);
  const [selected, setSelected] = useState(null);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div>
          <h3 className="text-[16px] font-bold text-white">Album du club</h3>
          <p className="text-[11px] text-white/50">{photos.length} photo{photos.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white"><X size={18} /></button>
      </div>
      {selected ? (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={selected.image_url} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
          </div>
          <div className="px-5 py-4 bg-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                {initialsFromName(allAthletes.find(a => a.id === selected.athlete_id)?.name ?? "?")}
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">{allAthletes.find(a => a.id === selected.athlete_id)?.name ?? "-"}</p>
                <p className="text-[11px] text-white/50">{new Date(selected.created_at).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            </div>
            <p className="text-[12px] text-white/70">{selected.content}</p>
          </div>
          <button onClick={() => setSelected(null)} className="mx-5 mb-6 py-3 rounded-xl bg-white/10 text-white text-[13px] font-semibold">← Retour à l'album</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
              <Camera size={40} strokeWidth={1.5} /><p className="text-[13px]">Aucune photo partagée</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {photos.map(p => (
                <div key={p.id} className="aspect-square relative cursor-pointer" onClick={() => setSelected(p)}>
                  <img src={p.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <div className="absolute bottom-1 left-1">
                    <div className="w-5 h-5 rounded-full bg-white/80 flex items-center justify-center text-[7px] font-bold text-slate-700">
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
          setNotif({ athleteName: a?.name ?? "Un athlète", action: "a partagé une séance 📸", preview: payload.new.content });
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

  return (
    <div className="max-w-xl mx-auto" style={{ minHeight: "100%" }}>
      {notif && <SocialNotif notif={notif} onDismiss={() => setNotif(null)} />}

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-slate-800">Mon club</h2>
          <p className="text-[10px] text-slate-400">{allAthletes.length} athlètes · 7 derniers jours</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAlbum(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50">
            <Image size={13} /> Album
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-[12px] font-semibold cursor-pointer"
            style={{ background: "#1D9E75" }}>
            <Camera size={13} /> Photo
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { handleImageChange(e); setShowCreate(true); }} />
          </label>
          <button onClick={() => setShowCreate(v => !v)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {showCreate && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ background: "#1D9E75" }}>
                {initialsFromName(athlete.name)}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-slate-700">{athlete.name}</p>
                <p className="text-[10px] text-slate-400">Partage avec ton club</p>
              </div>
              <button onClick={() => { setShowCreate(false); setNewContent(""); setNewImage(null); setNewImageUrl(null); }}
                className="text-slate-300 hover:text-slate-500"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              {newImageUrl && (
                <div className="relative">
                  <img src={newImageUrl} alt="preview" className="w-full max-h-64 object-cover rounded-xl" />
                  <button onClick={() => { setNewImage(null); setNewImageUrl(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                    <X size={13} />
                  </button>
                </div>
              )}
              <textarea
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                rows={3} autoFocus placeholder="Comment s'est passée ta séance ? 💪"
                value={newContent} onChange={e => setNewContent(e.target.value)} />
              {recentSessions.length > 0 && (
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                  <option value="">📎 Lier une séance (optionnel)</option>
                  {recentSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${s.week}`}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                  <Image size={13} /> {newImage ? "Photo ✓" : "Galerie"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                  <Camera size={13} /> Caméra
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                </label>
                <button onClick={handlePost} disabled={!newContent.trim() || posting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-[12px] font-semibold disabled:opacity-40"
                  style={{ background: "#1D9E75" }}>
                  {posting ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Envoi…</> : <><Send size={12} />Publier</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-300">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[12px]">Chargement…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
            <Camera size={40} className="mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
            <p className="text-[15px] font-bold text-slate-400">Fil vide</p>
            <p className="text-[12px] text-slate-300 mt-1">Sois le premier à partager !</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold mx-auto shadow-sm"
              style={{ background: "#1D9E75" }}>
              <Camera size={14} /> Partager maintenant
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
          const diff      = (new Date() - new Date(post.created_at)) / 1000;
          const timeAgo   = diff < 60 ? "À l'instant" : diff < 3600 ? `${Math.floor(diff/60)} min` : diff < 86400 ? `${Math.floor(diff/3600)}h` : `${Math.floor(diff/86400)}j`;
          const expiresIn = Math.ceil((7*86400 - diff) / 3600);

          return (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ background: isOwn ? "#1D9E75" : "#378ADD" }}>
                    {initialsFromName(postAthlete?.name ?? "?")}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                      {postAthlete?.name ?? "Athlète"}
                      {isOwn && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Moi</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {timeAgo}
                      {expiresIn <= 24 && expiresIn > 0 && <span className="ml-1.5 text-amber-500 font-semibold">· expire dans {expiresIn}h</span>}
                    </p>
                  </div>
                </div>
                {isOwn && (
                  <button onClick={() => handleDelete(post.id)} className="text-slate-200 hover:text-red-400 transition-colors p-1.5">
                    <X size={14} />
                  </button>
                )}
              </div>
              {post.image_url && (
                <img src={post.image_url} alt="post" className="w-full max-h-96 object-cover cursor-pointer"
                  onClick={() => setActiveComments(post)} />
              )}
              <div className="px-4 py-3">
                <p className="text-[13.5px] text-slate-700 leading-relaxed">{post.content}</p>
                {linkedSess && (
                  <div className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorsFor(linkedSess.category).border }} />
                    <p className="text-[11px] font-semibold text-slate-600">{linkedSess.title}</p>
                    <span className="text-slate-300 text-[10px]">·</span>
                    <p className="text-[11px] text-slate-400">
                      {linkedSess.sessionDate ? new Date(linkedSess.sessionDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short"}) : `S${linkedSess.week}`}
                    </p>
                  </div>
                )}
              </div>
              <div className="px-4 pb-4">
                {Object.keys(rxCounts).length > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {Object.entries(rxCounts).sort((a,b) => b[1]-a[1]).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                        className={["flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all",
                          myReaction?.emoji === emoji ? "bg-emerald-50 border-emerald-300 text-emerald-700 scale-105" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"].join(" ")}>
                        <span>{emoji}</span><span className="text-[11px]">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => handleReact(post.id, emoji)}
                      className={["w-9 h-9 rounded-xl flex items-center justify-center text-[15px] transition-all border",
                        myReaction?.emoji === emoji ? "bg-emerald-50 border-emerald-300 scale-110" : "bg-slate-50 border-slate-100 hover:scale-110 hover:bg-slate-100"].join(" ")}>
                      {emoji}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button onClick={() => setActiveComments(post)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100 transition-colors">
                    <MessageSquare size={13} />
                    <span className="text-[11px] font-semibold">{comCount > 0 ? comCount : ""} Commenter</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {posts.length > 0 && (
          <p className="text-center text-[11px] text-slate-300 py-2">Posts visibles 7 jours · Photos conservées dans l'album</p>
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