// ============================================================
// AthleteOS — src/athlete/views/AthleteClub.jsx  ★ v4 INSTA
// Fil vertical Instagram-style entre athlètes uniquement
// - Photo grande format, scroll naturel
// - Post rapide après séance (1 tap)
// - Réactions emoji + commentaires
// - Notifs push athlètes ↔ athlètes (pas le coach)
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { Plus, X, Camera, Send, MessageSquare, Heart, Image, ChevronDown } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { initialsFromName, colorsFor, getISOWeek } from "../shared";

const AVATAR_COLORS = ["#1D9E75","#5B8DEF","#9B84F0","#E8A020","#E05252","#14B8A6","#F97316","#EC4899"];
const QUICK_REACTIONS = ["🔥","💪","👏","⚡","🎯","❤️"];

function avatarColor(allAthletes, athleteId) {
  const idx = allAthletes.findIndex(a => a.id === athleteId);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? "#1D9E75";
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, maxWidth:340, width:"calc(100% - 32px)", animation:"slide-down 0.25s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ background:"var(--c-surface-3)", border:"1px solid var(--c-border-strong)", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.50)" }}>
        <div style={{ width:32, height:32, borderRadius:"50%", background:msg.color??"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:10, fontWeight:600, flexShrink:0 }}>
          {initialsFromName(msg.name)}
        </div>
        <p style={{ flex:1, fontSize:12.5, color:"var(--c-text-1)", lineHeight:1.3 }}>
          <span style={{ color:"#1D9E75", fontWeight:600 }}>{msg.name.split(" ")[0]}</span> {msg.action}
        </p>
        <button onClick={onDismiss} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--c-text-4)", padding:2, flexShrink:0 }}><X size={12}/></button>
      </div>
    </div>
  );
}

// ─── Modal commentaires ───────────────────────────────────────────────────────
const CommentsModal = memo(({ post, athlete, allAthletes, onClose, onCommentAdded }) => {
  const [comments, setComments] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    supabase.from("social_comments").select("*").eq("post_id", post.id).order("created_at", { ascending:true })
      .then(({ data }) => { setComments(data ?? []); setLoading(false); });
  }, [post.id]);

  useEffect(() => {
    const ch = supabase.channel(`com-${post.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"social_comments", filter:`post_id=eq.${post.id}` },
        p => setComments(prev => prev.some(c => c.id===p.new.id) ? prev : [...prev, p.new]))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [post.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [comments.length]);

  const send = async () => {
    const text = input.trim(); if (!text) return;
    setInput(""); setSending(true);
    const { data } = await supabase.from("social_comments")
      .insert({ post_id:post.id, athlete_id:athlete.id, content:text }).select().single();
    if (data) { setComments(p => [...p, data]); onCommentAdded(); }
    setSending(false);
  };

  const postAthlete = allAthletes.find(a => a.id===post.athlete_id);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ marginTop:"auto", background:"var(--c-surface)", borderRadius:"20px 20px 0 0", border:"1px solid var(--c-border)", display:"flex", flexDirection:"column", maxHeight:"88dvh" }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
          <div style={{ width:32, height:3, borderRadius:99, background:"var(--c-border-strong)" }}/>
        </div>

        {/* Header */}
        <div style={{ padding:"8px 16px 10px", borderBottom:"1px solid var(--c-border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:avatarColor(allAthletes, post.athlete_id), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:600 }}>
              {initialsFromName(postAthlete?.name ?? "?")}
            </div>
            <div>
              <p style={{ fontSize:12.5, fontWeight:500, color:"var(--c-text-1)" }}>{postAthlete?.name?.split(" ")[0]}</p>
              <p style={{ fontSize:10, color:"var(--c-text-3)" }}>Commentaires</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding:6, borderRadius:8, background:"var(--c-surface-2)", border:"none", cursor:"pointer", color:"var(--c-text-3)" }}><X size={14}/></button>
        </div>

        {/* Preview post */}
        {post.image_url && (
          <div style={{ flexShrink:0, maxHeight:160, overflow:"hidden" }}>
            <img src={post.image_url} alt="" style={{ width:"100%", objectFit:"cover", maxHeight:160 }}/>
          </div>
        )}
        {post.content && (
          <div style={{ padding:"8px 16px", background:"var(--c-surface-2)", borderBottom:"1px solid var(--c-border)", flexShrink:0 }}>
            <p style={{ fontSize:12, color:"var(--c-text-2)", lineHeight:1.4 }} className="line-clamp-2">{post.content}</p>
          </div>
        )}

        {/* Liste commentaires */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:24 }}><div className="loader-ring" style={{ margin:"0 auto" }}/></div>
          ) : comments.length===0 ? (
            <p style={{ textAlign:"center", padding:"24px 0", fontSize:12, color:"var(--c-text-3)" }}>Aucun commentaire — sois le premier !</p>
          ) : comments.map(c => {
            const ca    = allAthletes.find(a => a.id===c.athlete_id);
            const isOwn = c.athlete_id===athlete.id;
            const diff  = (Date.now()-new Date(c.created_at))/1000;
            const ago   = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:`${Math.floor(diff/3600)}h`;
            return (
              <div key={c.id} style={{ display:"flex", gap:8, flexDirection:isOwn?"row-reverse":"row" }}>
                <div style={{ width:26, height:26, borderRadius:"50%", background:isOwn?"#1D9E75":avatarColor(allAthletes, c.athlete_id), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:8.5, fontWeight:600, flexShrink:0 }}>
                  {initialsFromName(ca?.name ?? "?")}
                </div>
                <div style={{ maxWidth:"78%" }}>
                  <div style={{ background:isOwn?"rgba(29,158,117,0.12)":"var(--c-surface-2)", border:`1px solid ${isOwn?"rgba(29,158,117,0.18)":"var(--c-border)"}`, borderRadius:isOwn?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"7px 11px" }}>
                    {!isOwn && <p style={{ fontSize:10, fontWeight:500, color:avatarColor(allAthletes, c.athlete_id), marginBottom:2 }}>{ca?.name?.split(" ")[0]}</p>}
                    <p style={{ fontSize:12.5, color:"var(--c-text-1)", lineHeight:1.45 }}>{c.content}</p>
                  </div>
                  <p style={{ fontSize:9, color:"var(--c-text-4)", marginTop:2, paddingLeft:4 }}>{ago}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:"10px 12px", paddingBottom:"calc(10px + env(safe-area-inset-bottom))", borderTop:"1px solid var(--c-border)", display:"flex", alignItems:"center", gap:8, background:"var(--c-surface)", flexShrink:0 }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:8.5, fontWeight:600, flexShrink:0 }}>
            {initialsFromName(athlete.name)}
          </div>
          <div style={{ flex:1, background:"var(--c-surface-2)", borderRadius:20, padding:"8px 14px", border:"1px solid var(--c-border)" }}>
            <input style={{ width:"100%", background:"none", border:"none", outline:"none", fontSize:13, color:"var(--c-text-1)" }}
              placeholder="Ajouter un commentaire…" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); send(); } }}
              autoFocus/>
          </div>
          <button onClick={send} disabled={!input.trim()||sending}
            style={{ width:36, height:36, borderRadius:"50%", background:"#1D9E75", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(!input.trim()||sending)?0.35:1, flexShrink:0, boxShadow:"0 2px 8px rgba(29,158,117,0.25)" }}>
            <Send size={14} color="white" strokeWidth={2.5}/>
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Modal post rapide ────────────────────────────────────────────────────────
const QuickPostModal = memo(({ session, athlete, allAthletes, clubId, onClose, onPosted }) => {
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [caption,  setCaption]  = useState(session ? `Séance "${session.title}" ✅` : "");
  const [posting,  setPosting]  = useState(false);
  const [err,      setErr]      = useState(null);
  const fileRef = useRef(null);

  const pickImage = e => {
    const f = e.target.files?.[0]; if (!f) return;
    setImage(f); setPreview(URL.createObjectURL(f));
  };

  const post = async () => {
    setPosting(true); setErr(null);
    try {
      let imageUrl = null;
      if (image) {
        const ext  = image.name.split(".").pop() || "jpg";
        const path = `social-photos/${athlete.id}-${Date.now()}.${ext}`;
        const { error:ue } = await supabase.storage.from("social-photos").upload(path, image, { upsert:true });
        if (ue) throw new Error(ue.message);
        const { data:ud } = supabase.storage.from("social-photos").getPublicUrl(path);
        imageUrl = ud?.publicUrl ?? null;
      }

      await supabase.from("social_posts").insert({
        athlete_id: athlete.id, club_id: clubId,
        session_id: session?.id ?? null,
        content:    caption.trim() || null,
        image_url:  imageUrl,
      });

      // Notifier les autres athlètes (pas le coach)
      const otherAthletes = allAthletes.filter(a => a.id !== athlete.id && a.user_id);
      if (otherAthletes.length > 0) {
        await supabase.from("athlete_notifications").insert(
          otherAthletes.map(a => ({
            athlete_id:  a.id,
            club_id:     clubId,
            type:        "social",
            title:       `${athlete.name.split(" ")[0]} a partagé une séance`,
            description: caption.trim() || `Séance ${session?.title ?? ""}`,
            is_read:     false,
          }))
        );
      }

      onPosted(); onClose();
    } catch(e) {
      setErr(e.message);
      setPosting(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:preview?"#000":"rgba(0,0,0,0.75)", backdropFilter:preview?"none":"blur(12px)" }}
      onClick={e => e.target===e.currentTarget && !posting && onClose()}>

      {preview ? (
        /* Mode plein écran photo */
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          {/* Image plein écran */}
          <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
            <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            {/* Overlay haut */}
            <div style={{ position:"absolute", top:0, left:0, right:0, padding:"14px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}>
              <button onClick={() => { setImage(null); setPreview(null); }}
                style={{ width:36, height:36, borderRadius:"50%", background:"rgba(0,0,0,0.45)", border:"none", cursor:"pointer", color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={16}/>
              </button>
              <label style={{ padding:"7px 14px", borderRadius:20, background:"rgba(0,0,0,0.45)", color:"white", fontSize:12, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                <Camera size={13}/> Changer
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={pickImage}/>
              </label>
            </div>
          </div>

          {/* Zone saisie + publier */}
          <div style={{ background:"#0D0D0D", padding:"12px 14px", paddingBottom:"calc(12px + env(safe-area-inset-bottom))", display:"flex", flexDirection:"column", gap:10 }}>
            {err && <p style={{ fontSize:11.5, color:"#E05252" }}>{err}</p>}
            {session && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:8, background:"rgba(29,158,117,0.12)", border:"1px solid rgba(29,158,117,0.20)" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75", flexShrink:0 }}/>
                <p style={{ fontSize:11, color:"#1D9E75", fontWeight:500 }}>{session.title}</p>
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:600, flexShrink:0 }}>
                {initialsFromName(athlete.name)}
              </div>
              <input
                style={{ flex:1, background:"rgba(255,255,255,0.10)", border:"none", outline:"none", borderRadius:20, padding:"9px 14px", fontSize:13.5, color:"white", lineHeight:1.4 }}
                placeholder="Ajouter une légende…"
                value={caption} onChange={e => setCaption(e.target.value)}
                autoFocus
              />
            </div>
            <button onClick={post} disabled={posting}
              style={{ width:"100%", padding:"13px", borderRadius:12, background:"#1D9E75", border:"none", cursor:"pointer", color:"white", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(29,158,117,0.40)", opacity:posting?0.7:1 }}>
              {posting ? <><div style={{ width:16, height:16, border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin-smooth 0.65s linear infinite" }}/> Envoi en cours…</> : "Partager avec le club"}
            </button>
          </div>
        </div>
      ) : (
        /* Mode choix photo */
        <div style={{ marginTop:"auto", background:"var(--c-surface)", borderRadius:"20px 20px 0 0", border:"1px solid var(--c-border)", display:"flex", flexDirection:"column", overflow:"hidden", maxHeight:"70dvh" }}>
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
            <div style={{ width:32, height:3, borderRadius:99, background:"var(--c-border-strong)" }}/>
          </div>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--c-border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:14, fontWeight:500, color:"var(--c-text-1)" }}>Partager ma séance</p>
              {session && <p style={{ fontSize:11, color:"var(--c-accent)", marginTop:2 }}>{session.title}</p>}
            </div>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, background:"var(--c-surface-2)", border:"none", cursor:"pointer", color:"var(--c-text-3)" }}><X size={14}/></button>
          </div>

          <div style={{ padding:"20px 16px", display:"flex", flexDirection:"column", gap:10, paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }}>
            {err && <p style={{ fontSize:11.5, color:"#E05252", background:"rgba(224,82,82,0.08)", borderRadius:8, padding:"8px 12px" }}>{err}</p>}

            {/* Bouton caméra — action principale */}
            <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"18px", borderRadius:14, background:"linear-gradient(135deg, #1D9E75, #16826C)", cursor:"pointer", color:"white", fontSize:15, fontWeight:600, boxShadow:"0 4px 14px rgba(29,158,117,0.35)" }}>
              <Camera size={22} color="white"/>
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={pickImage}/>
            </label>

            {/* Galerie */}
            <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px", borderRadius:12, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)", fontSize:13, fontWeight:500 }}>
              <Image size={16}/>
              Choisir dans la galerie
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={pickImage}/>
            </label>

            {/* Publier sans photo */}
            <button onClick={post} disabled={posting || !caption.trim()}
              style={{ padding:"11px", borderRadius:12, background:"transparent", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-3)", fontSize:12, fontWeight:400 }}>
              {posting ? "Envoi…" : "Publier sans photo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Card post Instagram ──────────────────────────────────────────────────────
const PostCard = memo(({ post, athlete, allAthletes, sessions, onComment, onReact, onDelete, commentCount }) => {
  const postAthlete = allAthletes.find(a => a.id===post.athlete_id);
  const isOwn       = post.athlete_id===athlete.id;
  const linkedSess  = sessions.find(s => s.id===post.session_id);
  const myReaction  = post.social_reactions?.find(r => r.athlete_id===athlete.id);
  const totalLikes  = (post.social_reactions ?? []).length;
  const color       = avatarColor(allAthletes, post.athlete_id);

  const diff    = (Date.now() - new Date(post.created_at)) / 1000;
  const timeAgo = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:diff<86400?`${Math.floor(diff/3600)}h`:`${Math.floor(diff/86400)}j`;

  const rxCounts = {};
  (post.social_reactions ?? []).forEach(r => { rxCounts[r.emoji] = (rxCounts[r.emoji]??0)+1; });
  const topReactions = Object.entries(rxCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

  return (
    <div style={{ background:"var(--c-surface)", borderBottom:"1px solid var(--c-border)" }}>
      {/* Header auteur */}
      <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:11, fontWeight:600, flexShrink:0, border:isOwn?"2px solid #1D9E75":"none" }}>
          {initialsFromName(postAthlete?.name ?? "?")}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <p style={{ fontSize:13, fontWeight:600, color:"var(--c-text-1)" }}>{postAthlete?.name ?? "Athlète"}</p>
            {isOwn && <span style={{ fontSize:9, fontWeight:500, padding:"1px 5px", borderRadius:4, background:"rgba(29,158,117,0.12)", color:"#1D9E75" }}>Moi</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
            <p style={{ fontSize:10, color:"var(--c-text-3)" }}>{timeAgo}</p>
            {linkedSess && (
              <>
                <span style={{ color:"var(--c-text-4)", fontSize:10 }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:colorsFor(linkedSess.category).border }}/>
                  <p style={{ fontSize:10, color:"var(--c-text-3)", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{linkedSess.title}</p>
                </div>
              </>
            )}
          </div>
        </div>
        {isOwn && (
          <button onClick={onDelete} style={{ padding:4, background:"none", border:"none", cursor:"pointer", color:"var(--c-text-4)" }}><X size={13}/></button>
        )}
      </div>

      {/* Photo */}
      {post.image_url && (
        <div style={{ width:"100%", cursor:"pointer" }} onDoubleClick={() => onReact("❤️")}>
          <img src={post.image_url} alt="" style={{ width:"100%", maxHeight:400, objectFit:"cover", display:"block" }}/>
        </div>
      )}

      {/* Légende */}
      {post.content && (
        <div style={{ padding:"8px 14px 4px" }}>
          <p style={{ fontSize:13, color:"var(--c-text-1)", lineHeight:1.5 }}>
            <span style={{ fontWeight:600, color:"var(--c-text-1)", marginRight:5 }}>{postAthlete?.name?.split(" ")[0]}</span>
            {post.content}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding:"8px 14px 12px" }}>
        {/* Réactions existantes */}
        {topReactions.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <div style={{ display:"flex" }}>
              {topReactions.map(([emoji], i) => (
                <span key={emoji} style={{ fontSize:14, marginLeft:i>0?-2:0 }}>{emoji}</span>
              ))}
            </div>
            <p style={{ fontSize:11, color:"var(--c-text-3)", fontWeight:500 }}>
              {totalLikes} réaction{totalLikes>1?"s":""}
            </p>
          </div>
        )}

        {/* Boutons actions */}
        <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:8 }}>
          {/* Quick reactions */}
          {QUICK_REACTIONS.map(emoji => (
            <button key={emoji} onClick={() => onReact(emoji)}
              style={{
                width:34, height:34, borderRadius:9, fontSize:15, border:`1px solid ${myReaction?.emoji===emoji?"rgba(29,158,117,0.35)":"var(--c-border)"}`,
                background:myReaction?.emoji===emoji?"rgba(29,158,117,0.10)":"var(--c-surface-2)",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                transform:myReaction?.emoji===emoji?"scale(1.15)":"scale(1)", transition:"transform 0.12s ease",
                boxShadow:myReaction?.emoji===emoji?"0 2px 6px rgba(29,158,117,0.20)":"none",
              }}>
              {emoji}
            </button>
          ))}
          <div style={{ flex:1 }}/>
          <button onClick={onComment}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 10px", borderRadius:9, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)", fontSize:11.5, fontWeight:500 }}>
            <MessageSquare size={12}/>
            {commentCount>0 && <span>{commentCount}</span>}
          </button>
        </div>

        {/* Double-tap hint si image */}
        {post.image_url && (
          <p style={{ fontSize:9.5, color:"var(--c-text-4)" }}>Double-tap sur la photo pour ❤️</p>
        )}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthleteClub({ athlete, allAthletes, clubId, sessions, profile }) {
  const [posts,          setPosts]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeComments, setActiveComments] = useState(null);
  const [quickPost,      setQuickPost]      = useState(null); // session ou true
  const [toast,          setToast]          = useState(null);
  const [commentCounts,  setCommentCounts]  = useState({});

  const currentWeek  = getISOWeek(new Date());
  const sevenDaysAgo = useMemo(() => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString(); }, []);

  // ── Fetch posts ────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!clubId) return;
    const { data, error } = await supabase.from("social_posts")
      .select("*, social_reactions(*)")
      .eq("club_id", clubId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending:false })
      .limit(50);
    if (!error) setPosts(data ?? []);
    const ids = (data ?? []).map(p => p.id);
    if (ids.length > 0) {
      const { data:coms } = await supabase.from("social_comments").select("post_id").in("post_id", ids);
      const counts = {}; (coms??[]).forEach(c => { counts[c.post_id]=(counts[c.post_id]??0)+1; });
      setCommentCounts(counts);
    }
    setLoading(false);
  }, [clubId, sevenDaysAgo]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clubId) return;
    const ch = supabase.channel("club-feed")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"social_posts" }, async payload => {
        fetchPosts();
        if (payload.new.athlete_id !== athlete.id) {
          const { data:a } = await supabase.from("athletes").select("name").eq("id", payload.new.athlete_id).single();
          setToast({ name:a?.name??"Athlète", action:"a partagé une séance 📸", color:avatarColor(allAthletes, payload.new.athlete_id) });
        }
      })
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"social_reactions" }, fetchPosts)
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"social_reactions" }, fetchPosts)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"social_comments" }, fetchPosts)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchPosts, athlete.id, clubId, allAthletes]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleReact = async (postId, emoji) => {
    const post = posts.find(p => p.id===postId);
    const existing = post?.social_reactions?.find(r => r.athlete_id===athlete.id && r.emoji===emoji);
    // Optimiste UI
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const reactions = p.social_reactions ?? [];
      if (existing) return { ...p, social_reactions: reactions.filter(r => r.id!==existing.id) };
      const filtered  = reactions.filter(r => r.athlete_id!==athlete.id);
      return { ...p, social_reactions: [...filtered, { id:`tmp-${Date.now()}`, athlete_id:athlete.id, emoji, post_id:postId }] };
    }));
    if (existing) { await supabase.from("social_reactions").delete().eq("id", existing.id); }
    else {
      await supabase.from("social_reactions").delete().eq("post_id", postId).eq("athlete_id", athlete.id);
      await supabase.from("social_reactions").insert({ post_id:postId, athlete_id:athlete.id, emoji });
    }
  };

  const handleDelete = async postId => {
    setPosts(prev => prev.filter(p => p.id!==postId));
    await supabase.from("social_comments").delete().eq("post_id", postId);
    await supabase.from("social_reactions").delete().eq("post_id", postId);
    await supabase.from("social_posts").delete().eq("id", postId);
  };

  // Séance validée la plus récente pour le bouton rapide
  const lastValidatedSession = useMemo(() =>
    sessions.filter(s => s.week===currentWeek && s.validations?.find(v => v.athleteId===athlete.id && v.status==="done"))
      .sort((a,b) => (b.sessionDate??b.week).localeCompare(a.sessionDate??a.week))[0] ?? null,
  [sessions, athlete.id, currentWeek]);

  // Est-ce que l'athlète a déjà posté aujourd'hui ?
  const postedToday = posts.some(p => p.athlete_id===athlete.id && (Date.now()-new Date(p.created_at))<86400000);

  return (
    <div style={{ maxWidth:540, margin:"0 auto", display:"flex", flexDirection:"column", height:"100%" }}>
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)}/>}

      {/* ── HEADER ── */}
      <div className="header-glass" style={{ padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, position:"sticky", top:0, zIndex:10 }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:600, color:"var(--c-text-1)", letterSpacing:"-0.01em" }}>Mon club</h2>
          <p style={{ fontSize:10, color:"var(--c-text-3)", marginTop:1 }}>
            {allAthletes.length} athlètes · fil des 7 derniers jours
          </p>
        </div>
        {/* Bouton post rapide */}
        <button
          onClick={() => setQuickPost(lastValidatedSession ?? true)}
          className="btn-primary"
          style={{ minHeight:34, padding:"0 14px", fontSize:12, gap:5 }}>
          <Camera size={13}/> Partager
        </button>
      </div>

      {/* ── PROMPT POST (si séance validée & pas encore posté) ── */}
      {lastValidatedSession && !postedToday && (
        <div style={{ margin:"10px 14px 0", borderRadius:12, padding:"10px 14px", background:"rgba(29,158,117,0.08)", border:"1px solid rgba(29,158,117,0.15)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"rgba(29,158,117,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Camera size={16} color="#1D9E75"/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:12.5, fontWeight:500, color:"var(--c-text-1)", lineHeight:1.3 }}>Séance terminée !</p>
            <p style={{ fontSize:10.5, color:"var(--c-accent)" }} className="truncate">{lastValidatedSession.title}</p>
          </div>
          <button onClick={() => setQuickPost(lastValidatedSession)} className="btn-primary" style={{ flexShrink:0, minHeight:32, padding:"0 12px", fontSize:11.5, gap:4 }}>
            📸 Partager
          </button>
        </div>
      )}

      {/* ── AVATARS MEMBRES ── */}
      <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:8, overflowX:"auto", scrollbarWidth:"none", flexShrink:0 }}>
        {allAthletes.map((a, idx) => {
          const isMe      = a.id===athlete.id;
          const hasPosted = posts.some(p => p.athlete_id===a.id);
          const color     = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          return (
            <div key={a.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
              <div style={{
                width:44, height:44, borderRadius:"50%", background:color,
                display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:13, fontWeight:600,
                border:hasPosted?`2.5px solid #1D9E75`:isMe?`2.5px solid var(--c-border-strong)`:"2.5px solid transparent",
                boxShadow:hasPosted?"0 0 0 2px rgba(29,158,117,0.20)":"none",
              }}>
                {initialsFromName(a.name)}
              </div>
              <p style={{ fontSize:8.5, color:isMe?"#1D9E75":"var(--c-text-3)", fontWeight:isMe?600:400, maxWidth:44, textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {isMe?"Moi":a.name.split(" ")[0]}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── FIL POSTS ── */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"48px 0" }}>
            <div className="loader-ring" style={{ margin:"0 auto 10px" }}/>
            <p style={{ fontSize:12, color:"var(--c-text-3)" }}>Chargement du fil…</p>
          </div>
        ) : posts.length===0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:14 }}>
            <div style={{ width:56, height:56, borderRadius:16, background:"var(--c-surface-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Camera size={26} color="var(--c-text-4)" strokeWidth={1.5}/>
            </div>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:15, fontWeight:500, color:"var(--c-text-2)", marginBottom:6 }}>Fil vide</p>
              <p style={{ fontSize:12, color:"var(--c-text-3)" }}>Sois le premier à partager ta séance !</p>
            </div>
            <button onClick={() => setQuickPost(lastValidatedSession ?? true)} className="btn-primary">
              <Camera size={14}/> Partager maintenant
            </button>
          </div>
        ) : posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            athlete={athlete}
            allAthletes={allAthletes}
            sessions={sessions}
            commentCount={commentCounts[post.id] ?? 0}
            onComment={() => setActiveComments(post)}
            onReact={emoji => handleReact(post.id, emoji)}
            onDelete={() => handleDelete(post.id)}
          />
        ))}

        {posts.length>0 && (
          <p style={{ textAlign:"center", fontSize:10.5, color:"var(--c-text-4)", padding:"16px 0 24px" }}>
            Posts visibles 7 jours
          </p>
        )}
      </div>

      {/* ── MODALS ── */}
      {activeComments && (
        <CommentsModal
          post={activeComments} athlete={athlete} allAthletes={allAthletes}
          onClose={() => setActiveComments(null)}
          onCommentAdded={fetchPosts}
        />
      )}
      {quickPost && (
        <QuickPostModal
          session={quickPost===true ? null : quickPost}
          athlete={athlete} allAthletes={allAthletes} clubId={clubId}
          onClose={() => setQuickPost(null)}
          onPosted={() => { setQuickPost(null); fetchPosts(); }}
        />
      )}
    </div>
  );
}