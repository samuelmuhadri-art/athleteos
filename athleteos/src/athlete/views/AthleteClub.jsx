// ============================================================
// AthleteOS — src/athlete/views/AthleteClub.jsx  ★ v4 INSTA
// Fil vertical Instagram-style entre athlètes uniquement
// - Photo grande format, scroll naturel
// - Post rapide après séance (1 tap)
// - Réactions emoji + commentaires
// - Notifs push athlètes ↔ athlètes (pas le coach)
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Send, MessageSquare, Image, Trophy, Target, Users as UsersIcon, Award, Sparkles } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { initialsFromName, colorsFor, getISOWeek } from "../shared";
import { notifyClubNewPost, notifyCoachClubPost } from "../../utils/notifications";
import { filterClubPosts, validateSocialImage } from "./clubFeed";
import { EmptyState, SegmentedTabs } from "../../components/ui/premium";

const AVATAR_COLORS = ["#1D9E75","#5B8DEF","#9B84F0","#E8A020","#E05252","#14B8A6","#F97316","#EC4899"];
const QUICK_REACTIONS = ["🔥","💪","👏","⚡","🎯","❤️"];
const POSTS_PAGE_SIZE = 20;

function avatarColor(allAthletes, athleteId) {
  const idx = allAthletes.findIndex(a => a.id === athleteId);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? "#1D9E75";
}

function isSameCalendarDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, maxWidth:340, width:"calc(100% - 32px)", animation:"slide-down 0.25s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ background:"var(--c-surface-3)", border:"1px solid var(--c-border-strong)", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.50)" }}>
        <div style={{ width:36, height:36, borderRadius:"50%", background:msg.color??"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700, flexShrink:0 }}>
          {initialsFromName(msg.name)}
        </div>
        <p style={{ flex:1, fontSize:13, color:"var(--c-text-1)", lineHeight:1.4 }}>
          <span style={{ color:"#1D9E75", fontWeight:600 }}>{msg.name.split(" ")[0]}</span> {msg.action}
        </p>
        <button type="button" aria-label="Fermer la notification" onClick={onDismiss} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", color:"var(--c-text-2)", padding:0, flexShrink:0 }}><X size={16}/></button>
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
  const [error, setError]       = useState(null);
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
    setSending(true); setError(null);
    const { data, error: sendError } = await supabase.from("social_comments")
      .insert({ post_id:post.id, athlete_id:athlete.id, content:text }).select().single();
    if (sendError) {
      setError("Le commentaire n’a pas pu être envoyé. Réessaie.");
      setSending(false);
      return;
    }
    if (data) {
      setInput("");
      setComments(prev => prev.some(comment => comment.id === data.id) ? prev : [...prev, data]);
      onCommentAdded();
    }
    setSending(false);
  };

  const postAthlete = allAthletes.find(a => a.id===post.athlete_id);

  // Portal sur document.body : sinon, sur mobile, un ancêtre en scroll fait
  // dériver ce position:fixed hors de l'écran — même bug déjà rencontré et
  // corrigé sur FormeDetailPanel.jsx.
  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="comments-title" style={{ marginTop:"auto", width:"100%", maxWidth:640, alignSelf:"center", background:"var(--c-surface)", borderRadius:"24px 24px 0 0", border:"1px solid var(--c-border)", display:"flex", flexDirection:"column", maxHeight:"88dvh" }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
          <div style={{ width:32, height:3, borderRadius:99, background:"var(--c-border-strong)" }}/>
        </div>

        {/* Header */}
        <div style={{ padding:"8px 16px 10px", borderBottom:"1px solid var(--c-border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:avatarColor(allAthletes, post.athlete_id), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700 }}>
              {initialsFromName(postAthlete?.name ?? "?")}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--c-text-1)" }}>{postAthlete?.name?.split(" ")[0]}</p>
              <h2 id="comments-title" style={{ fontSize:12, color:"var(--c-text-2)" }}>Commentaires</h2>
            </div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:12, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)" }}><X size={17}/></button>
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
            <p style={{ textAlign:"center", padding:"24px 0", fontSize:13, color:"var(--c-text-2)" }}>Aucun commentaire — sois le premier !</p>
          ) : comments.map(c => {
            const ca    = allAthletes.find(a => a.id===c.athlete_id);
            const isOwn = c.athlete_id===athlete.id;
            const diff  = (Date.now()-new Date(c.created_at))/1000;
            const ago   = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:`${Math.floor(diff/3600)}h`;
            return (
              <div key={c.id} style={{ display:"flex", gap:8, flexDirection:isOwn?"row-reverse":"row" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:isOwn?"#1D9E75":avatarColor(allAthletes, c.athlete_id), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {initialsFromName(ca?.name ?? "?")}
                </div>
                <div style={{ maxWidth:"78%" }}>
                  <div style={{ background:isOwn?"rgba(29,158,117,0.12)":"var(--c-surface-2)", border:`1px solid ${isOwn?"rgba(29,158,117,0.18)":"var(--c-border)"}`, borderRadius:isOwn?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"7px 11px" }}>
                    {!isOwn && <p style={{ fontSize:12, fontWeight:700, color:avatarColor(allAthletes, c.athlete_id), marginBottom:3 }}>{ca?.name?.split(" ")[0]}</p>}
                    <p style={{ fontSize:13, color:"var(--c-text-1)", lineHeight:1.5 }}>{c.content}</p>
                  </div>
                  <p style={{ fontSize:12, color:"var(--c-text-3)", marginTop:3, paddingLeft:4 }}>{ago}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:"10px 12px", paddingBottom:"calc(10px + env(safe-area-inset-bottom))", borderTop:"1px solid var(--c-border)", display:"flex", alignItems:"center", gap:8, background:"var(--c-surface)", flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700, flexShrink:0 }}>
            {initialsFromName(athlete.name)}
          </div>
          <div style={{ flex:1, background:"var(--c-surface-2)", borderRadius:20, padding:"8px 14px", border:"1px solid var(--c-border)" }}>
            <input style={{ width:"100%", background:"none", border:"none", outline:"none", fontSize:13, color:"var(--c-text-1)" }}
              placeholder="Ajouter un commentaire…" value={input}
              maxLength={300}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); send(); } }}
              autoFocus/>
          </div>
          <button type="button" aria-label="Envoyer le commentaire" onClick={send} disabled={!input.trim()||sending}
            style={{ width:44, height:44, borderRadius:"50%", background:"#1D9E75", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(!input.trim()||sending)?0.35:1, flexShrink:0, boxShadow:"0 2px 8px rgba(29,158,117,0.25)" }}>
            <Send size={16} color="white" strokeWidth={2.5}/>
          </button>
        </div>
        {error && <p role="alert" style={{ padding:"0 16px 12px", fontSize:12, color:"var(--tone-danger)" }}>{error}</p>}
      </div>
    </div>,
    document.body
  );
});

// ─── Modal post rapide ────────────────────────────────────────────────────────
const QuickPostModal = memo(({ session, athlete, allAthletes, clubId, coachUserId, onClose, onPosted }) => {
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [caption,  setCaption]  = useState(session ? `Séance "${session.title}" ✅` : "");
  const [posting,  setPosting]  = useState(false);
  const [err,      setErr]      = useState(null);
  const pickImage = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const validationError = validateSocialImage(f);
    if (validationError) {
      setImage(null);
      setPreview(null);
      setErr(validationError);
      e.target.value = "";
      return;
    }
    setErr(null);
    setImage(f); setPreview(URL.createObjectURL(f));
  };

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

 const post = async () => {
    setPosting(true); setErr(null);
    try {
      let imageUrl = null;
      if (image) {
        const ext  = image.name.split(".").pop() || "jpg";
        // Préfixé par club_id — requis par les policies storage scopées par
        // club (sinon l'upload est rejeté par RLS).
        const path = `${clubId}/${athlete.id}-${Date.now()}.${ext}`;
        const { error:ue } = await supabase.storage.from("social-photos").upload(path, image);
        if (ue) throw new Error(ue.message);
        const { data:ud } = supabase.storage.from("social-photos").getPublicUrl(path);
        imageUrl = ud?.publicUrl ?? null;
      }

      const { error: postErr } = await supabase.from("social_posts").insert({
        athlete_id: athlete.id, club_id: clubId,
        session_id: session?.id ?? null,
        content:    caption.trim(), // social_posts.content est NOT NULL — jamais null, "" au pire
        image_url:  imageUrl,
      });
      if (postErr) throw new Error(postErr.message);

      // Notifier les autres athlètes (pas le coach)
      const otherAthletes = allAthletes.filter(a => a.id !== athlete.id && a.user_id);
      if (otherAthletes.length > 0) {

        // 1. Sauvegarde dans ta base de données (Ton Code 2)
        const { error: notifErr } = await supabase.from("athlete_notifications").insert(
          otherAthletes.map(a => ({
            athlete_id:  a.id,
            club_id:     clubId,
            type:        "social",
            title:       `${athlete.name.split(" ")[0]} a partagé une séance`,
            description: caption.trim() || `Séance ${session?.title ?? ""}`,
            is_read:     false,
          }))
        );
        if (notifErr) console.warn("Notification sociale non enregistrée:", notifErr.message);

        // 2. L'alerte de notification (Ton Code 1) 👇
        const otherAthleteIds = otherAthletes.map(a => a.id);
        notifyClubNewPost(clubId, athlete.name, otherAthleteIds).catch(console.warn);
      }

      await notifyCoachClubPost(clubId, coachUserId, athlete, {
        hasPhoto: Boolean(imageUrl),
        caption: caption.trim(),
      });

      onPosted(); onClose();
    } catch(e) {
      setErr(e.message);
      setPosting(false);
    }
  };

  // Portal sur document.body : même raison que CommentsModal ci-dessus —
  // sans ça, sur mobile, ce position:fixed dérive avec le scroll du fil et
  // les boutons "Prendre une photo"/"Choisir dans la galerie" se retrouvent
  // tout en bas de la page au lieu de rester à l'écran.
  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:preview?"#000":"rgba(0,0,0,0.75)", backdropFilter:preview?"none":"blur(12px)" }}
      onClick={e => e.target===e.currentTarget && !posting && onClose()}>

      {preview ? (
        /* Mode plein écran photo */
        <div role="dialog" aria-modal="true" aria-label="Prévisualiser la publication" style={{ flex:1, display:"flex", flexDirection:"column" }}>
          {/* Image plein écran */}
          <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
            <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            {/* Overlay haut */}
            <div style={{ position:"absolute", top:0, left:0, right:0, padding:"14px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}>
              <button type="button" aria-label="Retirer la photo" onClick={() => { setImage(null); setPreview(null); }}
                style={{ width:44, height:44, borderRadius:"50%", background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.14)", cursor:"pointer", color:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={18}/>
              </button>
              <label style={{ minHeight:44, padding:"0 14px", borderRadius:22, background:"rgba(0,0,0,0.45)", border:"1px solid rgba(255,255,255,0.14)", color:"white", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}>
                <Camera size={15}/> Changer
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={pickImage}/>
              </label>
            </div>
          </div>

          {/* Zone saisie + publier */}
          <div style={{ background:"#0D0D0D", padding:"12px 14px", paddingBottom:"calc(12px + env(safe-area-inset-bottom))", display:"flex", flexDirection:"column", gap:10 }}>
            {err && <p role="alert" style={{ fontSize:13, color:"var(--tone-danger)" }}>{err}</p>}
            {session && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:8, background:"rgba(29,158,117,0.12)", border:"1px solid rgba(29,158,117,0.20)" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75", flexShrink:0 }}/>
                <p style={{ fontSize:12, color:"var(--tone-success)", fontWeight:700 }}>{session.title}</p>
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700, flexShrink:0 }}>
                {initialsFromName(athlete.name)}
              </div>
              <input
                style={{ flex:1, background:"rgba(255,255,255,0.10)", border:"none", outline:"none", borderRadius:20, padding:"9px 14px", fontSize:13.5, color:"white", lineHeight:1.4 }}
                placeholder="Ajouter une légende…"
                value={caption} onChange={e => setCaption(e.target.value)}
                maxLength={500}
                autoFocus
              />
            </div>
            <button type="button" onClick={post} disabled={posting}
              style={{ width:"100%", minHeight:48, padding:"0 16px", borderRadius:12, background:"#1D9E75", border:"none", cursor:"pointer", color:"white", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(29,158,117,0.32)", opacity:posting?0.7:1 }}>
              {posting ? <><div style={{ width:16, height:16, border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin-smooth 0.65s linear infinite" }}/> Envoi en cours…</> : "Partager avec le club"}
            </button>
          </div>
        </div>
      ) : (
        /* Mode choix photo */
        <div role="dialog" aria-modal="true" aria-labelledby="quick-post-title" style={{ marginTop:"auto", width:"100%", maxWidth:560, alignSelf:"center", background:"var(--c-surface)", borderRadius:"24px 24px 0 0", border:"1px solid var(--c-border)", display:"flex", flexDirection:"column", overflow:"hidden", maxHeight:"82dvh" }}>
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
            <div style={{ width:32, height:3, borderRadius:99, background:"var(--c-border-strong)" }}/>
          </div>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--c-border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <h2 id="quick-post-title" style={{ fontSize:17, fontWeight:700, color:"var(--c-text-1)" }}>Partager avec le club</h2>
              {session && <p style={{ fontSize:12, color:"var(--tone-success)", marginTop:3 }}>{session.title}</p>}
            </div>
            <button type="button" aria-label="Fermer" onClick={onClose} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:12, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)" }}><X size={18}/></button>
          </div>

          <div style={{ padding:"20px 16px", display:"flex", flexDirection:"column", gap:10, paddingBottom:"calc(20px + env(safe-area-inset-bottom))" }}>
            {err && <p role="alert" style={{ fontSize:13, color:"var(--tone-danger)", background:"rgba(224,82,82,0.08)", borderRadius:10, padding:"10px 12px" }}>{err}</p>}

            <div>
              <label htmlFor="club-post-caption" style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--c-text-2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Message</label>
              <textarea id="club-post-caption" className="input-premium resize-none" rows={3}
                placeholder="Partage une séance, une sensation ou un encouragement…"
                maxLength={500}
                value={caption} onChange={event => setCaption(event.target.value)} />
            </div>

            {/* Bouton caméra — action principale */}
            <label style={{ minHeight:52, display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"0 18px", borderRadius:14, background:"linear-gradient(135deg, #1D9E75, #16826C)", cursor:"pointer", color:"white", fontSize:15, fontWeight:700, boxShadow:"0 4px 14px rgba(29,158,117,0.28)" }}>
              <Camera size={22} color="white"/>
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={pickImage}/>
            </label>

            {/* Galerie */}
            <label style={{ minHeight:48, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"0 14px", borderRadius:12, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)", fontSize:13, fontWeight:700 }}>
              <Image size={16}/>
              Choisir dans la galerie
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={pickImage}/>
            </label>

            {/* Publier sans photo */}
            <button type="button" onClick={post} disabled={posting || !caption.trim()}
              style={{ minHeight:48, padding:"0 14px", borderRadius:12, background:"transparent", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)", fontSize:13, fontWeight:700, opacity:posting || !caption.trim() ? 0.45 : 1 }}>
              {posting ? "Envoi…" : "Publier sans photo"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
});

// ─── Card post Instagram ──────────────────────────────────────────────────────
const AUTO_CELEBRATION_CONFIG = {
  record: { icon: Trophy, color: "var(--tone-warning)", label: "Nouveau record personnel", gradient: "linear-gradient(135deg, #7B5104 0%, #9A6800 50%, #C8890A 100%)" },
  goal:   { icon: Target, color: "#7C67C8", label: "Objectif atteint",         gradient: "linear-gradient(135deg, #362A5C 0%, #4A3780 50%, #7C67C8 100%)" },
};

const PostCard = memo(({ post, athlete, allAthletes, sessions, onComment, onReact, onDelete, commentCount }) => {
  const postAthlete = allAthletes.find(a => a.id===post.athlete_id);
  const isOwn       = post.athlete_id===athlete.id;
  const linkedSess  = sessions.find(s => s.id===post.session_id);
  const myReaction  = post.social_reactions?.find(r => r.athlete_id===athlete.id);
  const totalLikes  = (post.social_reactions ?? []).length;
  const color       = avatarColor(allAthletes, post.athlete_id);
  const autoCfg     = AUTO_CELEBRATION_CONFIG[post.auto_type] ?? null;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const diff    = (Date.now() - new Date(post.created_at)) / 1000;
  const timeAgo = diff<60?"À l'instant":diff<3600?`${Math.floor(diff/60)}min`:diff<86400?`${Math.floor(diff/3600)}h`:`${Math.floor(diff/86400)}j`;

  const rxCounts = {};
  (post.social_reactions ?? []).forEach(r => { rxCounts[r.emoji] = (rxCounts[r.emoji]??0)+1; });
  const topReactions = Object.entries(rxCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

  return (
    <article id={`post-${post.id}`} className="card" style={{ overflow:"hidden", scrollMarginTop:80 }}>
      {/* Header auteur — traitement distinct pour les posts auto-générés
          (record battu / objectif atteint), pour qu'ils se distinguent
          visuellement des photos partagées manuellement */}
      {autoCfg ? (
        <div className="animate-scale-in" style={{ position:"relative", overflow:"hidden", padding:"18px 16px 16px", background:autoCfg.gradient }}>
          {/* Halo décoratif — même langage que les cards héro du dashboard */}
          <div style={{ position:"absolute", right:-22, top:-22, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.08)", pointerEvents:"none" }} />
          <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:"rgba(255,255,255,0.14)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <autoCfg.icon size={19} color="white" strokeWidth={1.8} />
              </div>
              <div>
                <p style={{ fontSize:12, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"rgba(255,255,255,0.72)" }}>{autoCfg.label}</p>
                <p style={{ fontSize:15, fontWeight:700, color:"white", marginTop:4 }}>{postAthlete?.name ?? "Athlète"}</p>
              </div>
            </div>
            {isOwn && (
              <button type="button" aria-label="Supprimer la publication" onClick={() => setConfirmDelete(true)} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.10)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:12, cursor:"pointer", color:"rgba(255,255,255,0.82)", flexShrink:0 }}><X size={16}/></button>
            )}
          </div>
          <p style={{ position:"relative", fontSize:15, fontWeight:500, color:"white", marginTop:14, lineHeight:1.4 }}>{post.content}</p>
          <p style={{ position:"relative", fontSize:12, color:"rgba(255,255,255,0.68)", marginTop:8 }}>{timeAgo}</p>
        </div>
      ) : (
        <div style={{ padding:16, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:13, fontWeight:700, flexShrink:0, border:isOwn?"2px solid #1D9E75":"none" }}>
            {initialsFromName(postAthlete?.name ?? "?")}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <p style={{ fontSize:14, fontWeight:700, color:"var(--c-text-1)" }}>{postAthlete?.name ?? "Athlète"}</p>
              {isOwn && <span style={{ fontSize:12, fontWeight:700, padding:"2px 7px", borderRadius:6, background:"rgba(29,158,117,0.12)", color:"var(--tone-success)" }}>Moi</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
              <p style={{ fontSize:12, color:"var(--c-text-2)" }}>{timeAgo}</p>
              {linkedSess && (
                <>
                  <span style={{ color:"var(--c-text-3)", fontSize:12 }}>·</span>
                  <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:colorsFor(linkedSess.category).border }}/>
                    <p style={{ fontSize:12, color:"var(--c-text-2)", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{linkedSess.title}</p>
                  </div>
                </>
              )}
            </div>
          </div>
          {isOwn && (
            <button type="button" aria-label="Supprimer la publication" onClick={() => setConfirmDelete(true)} style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", color:"var(--c-text-3)" }}><X size={16}/></button>
          )}
        </div>
      )}

      {/* Photo */}
      {post.image_url && (
        <div style={{ width:"100%", position:"relative", cursor:"pointer", background:"var(--c-surface-2)" }} onDoubleClick={() => onReact("❤️")}>
          <img src={post.image_url} alt={`Publication de ${postAthlete?.name ?? "un athlète"}`} loading="lazy" style={{ width:"100%", maxHeight:520, objectFit:"cover", display:"block" }}/>
          {/* Réactions en overlay sur la photo (style Instagram) plutôt que sous l'image */}
          {topReactions.length > 0 && (
            <div style={{
              position:"absolute", left:10, bottom:10,
              display:"flex", alignItems:"center", gap:5,
              padding:"5px 10px", borderRadius:99,
              background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)",
            }}>
              <div style={{ display:"flex" }}>
                {topReactions.map(([emoji], i) => (
                  <span key={emoji} style={{ fontSize:13, marginLeft:i>0?-2:0 }}>{emoji}</span>
                ))}
              </div>
              <p style={{ fontSize:12, color:"white", fontWeight:700 }}>{totalLikes}</p>
            </div>
          )}
        </div>
      )}

      {/* Légende (posts manuels uniquement — le texte des posts auto est déjà
          affiché dans le header ci-dessus) */}
      {!autoCfg && post.content && (
        <div style={{ padding:"14px 16px 4px" }}>
          <p style={{ fontSize:14, color:"var(--c-text-1)", lineHeight:1.55 }}>
            <span style={{ fontWeight:600, color:"var(--c-text-1)", marginRight:5 }}>{postAthlete?.name?.split(" ")[0]}</span>
            {post.content}
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding:"12px 16px 16px" }}>
        {/* Réactions existantes — seulement si pas de photo (sinon déjà en overlay dessus) */}
        {!post.image_url && topReactions.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
            <div style={{ display:"flex" }}>
              {topReactions.map(([emoji], i) => (
                <span key={emoji} style={{ fontSize:14, marginLeft:i>0?-2:0 }}>{emoji}</span>
              ))}
            </div>
            <p style={{ fontSize:12, color:"var(--c-text-2)", fontWeight:600 }}>
              {totalLikes} réaction{totalLikes>1?"s":""}
            </p>
          </div>
        )}

        {/* Boutons actions */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, overflowX:"auto", scrollbarWidth:"none", flex:1 }}>
            {QUICK_REACTIONS.map(emoji => (
              <button key={emoji} type="button" aria-label={`Réagir ${emoji}`} aria-pressed={myReaction?.emoji===emoji} onClick={() => onReact(emoji)}
                style={{
                  width:44, height:44, flexShrink:0, borderRadius:12, fontSize:17, border:`1px solid ${myReaction?.emoji===emoji?"rgba(29,158,117,0.38)":"var(--c-border)"}`,
                  background:myReaction?.emoji===emoji?"rgba(29,158,117,0.12)":"var(--c-surface-2)",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                  transform:myReaction?.emoji===emoji?"scale(1.06)":"scale(1)", transition:"transform 0.12s ease",
                  boxShadow:myReaction?.emoji===emoji?"0 2px 8px rgba(29,158,117,0.18)":"none",
                }}>
                {emoji}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Ouvrir les commentaires" onClick={onComment}
            style={{ minWidth:44, height:44, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"0 12px", borderRadius:12, background:"var(--c-surface-2)", border:"1px solid var(--c-border)", cursor:"pointer", color:"var(--c-text-2)", fontSize:12, fontWeight:700 }}>
            <MessageSquare size={15}/>
            {commentCount>0 && <span>{commentCount}</span>}
          </button>
        </div>

        {/* Double-tap hint si image */}
        {post.image_url && (
          <p style={{ fontSize:12, color:"var(--c-text-3)" }}>Double-tap sur la photo pour ❤️</p>
        )}
      </div>
      {confirmDelete && (
        <div role="alert" style={{ padding:16, borderTop:"1px solid rgba(224,82,82,0.18)", background:"rgba(224,82,82,0.07)", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <p style={{ flex:1, minWidth:180, fontSize:13, fontWeight:700, color:"var(--c-text-1)" }}>Supprimer définitivement cette publication ?</p>
          <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary">Annuler</button>
          <button type="button" onClick={onDelete}
            style={{ minHeight:44, padding:"0 14px", borderRadius:12, border:"1px solid rgba(224,82,82,0.24)", background:"rgba(224,82,82,0.12)", color:"var(--tone-danger)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Supprimer
          </button>
        </div>
      )}
    </article>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthleteClub({ athlete, allAthletes, clubId, coachUserId, sessions, clubBrand }) {
  const [posts,          setPosts]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [hasMorePosts,   setHasMorePosts]   = useState(false);
  const [activeComments, setActiveComments] = useState(null);
  const [quickPost,      setQuickPost]      = useState(null); // session ou true
  const [toast,          setToast]          = useState(null);
  const [commentCounts,  setCommentCounts]  = useState({});
  const [feedFilter,     setFeedFilter]     = useState("all");
  const postsCountRef = useRef(0);

  const currentWeek  = getISOWeek(new Date());
  const sevenDaysAgo = useMemo(() => { const d=new Date(); d.setDate(d.getDate()-7); return d.toISOString(); }, []);
  const [squadStats, setSquadStats] = useState(null);

  // ── Récap du groupe cette semaine ────────────────────────────────────────
  // `sessions` (prop) ne contient que les séances de l'athlète connecté —
  // il faut une requête dédiée pour avoir la vue squad-wide (lundi→samedi).
  useEffect(() => {
    if (!clubId || allAthletes.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.from("sessions").select("id, day").eq("club_id", clubId).eq("week", currentWeek);
      const ids = (sess ?? []).filter(s => s.day !== "Dimanche").map(s => s.id);
      const perAthlete = {};
      allAthletes.forEach(a => { perAthlete[a.id] = { done: 0, total: 0 }; });
      let total = 0, done = 0;
      if (ids.length > 0) {
        const { data: rows } = await supabase.from("session_athletes").select("session_id, athlete_id, status").in("session_id", ids);
        (rows ?? []).forEach(r => {
          if (!perAthlete[r.athlete_id]) return;
          perAthlete[r.athlete_id].total++; total++;
          if (r.status === "done") { perAthlete[r.athlete_id].done++; done++; }
        });
      }
      if (cancelled) return;
      const ranking = allAthletes
        .map(a => ({ ...a, ...perAthlete[a.id] }))
        .filter(a => a.total > 0)
        .sort((a, b) => (b.done / b.total) - (a.done / a.total) || b.done - a.done)
        .slice(0, 3);
      setSquadStats({ total, done, pct: total > 0 ? Math.round((done / total) * 100) : null, ranking });
    })();
    return () => { cancelled = true; };
  }, [clubId, currentWeek, allAthletes]);

  // ── Fetch posts ────────────────────────────────────────────────────────────
  // Pagination par page de POSTS_PAGE_SIZE (au lieu d'un .limit(50) fixe qui
  // tronquait silencieusement un club actif sans possibilité d'aller plus
  // loin) — reset=true recharge depuis le début (nouvelle activité live,
  // changement de club…), reset=false ajoute la page suivante.
  const fetchPosts = useCallback(async (reset = true) => {
    if (!clubId) return;
    if (reset) setLoading(true); else setLoadingMore(true);
    const offset = reset ? 0 : postsCountRef.current;
    const { data, error } = await supabase.from("social_posts")
      .select("*, social_reactions(*)")
      .eq("club_id", clubId)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending:false })
      .range(offset, offset + POSTS_PAGE_SIZE - 1);

    if (!error) {
      const page = data ?? [];
      setPosts(prev => reset ? page : [...prev, ...page]);
      setHasMorePosts(page.length === POSTS_PAGE_SIZE);

      const ids = page.map(p => p.id);
      if (ids.length > 0) {
        const { data:coms } = await supabase.from("social_comments").select("post_id").in("post_id", ids);
        const counts = {}; (coms??[]).forEach(c => { counts[c.post_id]=(counts[c.post_id]??0)+1; });
        setCommentCounts(prev => reset ? counts : { ...prev, ...counts });
      }
    }
    setLoading(false);
    setLoadingMore(false);
  }, [clubId, sevenDaysAgo]);

  useEffect(() => { postsCountRef.current = posts.length; }, [posts.length]);
  useEffect(() => { fetchPosts(true); }, [fetchPosts]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clubId) return;
    const ch = supabase.channel("club-feed")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"social_posts", filter:`club_id=eq.${clubId}` }, async payload => {
        fetchPosts();
        if (payload.new.athlete_id !== athlete.id) {
          const { data:a } = await supabase.from("athletes").select("name").eq("id", payload.new.athlete_id).single();
          setToast({ name:a?.name??"Athlète", action:"a partagé une séance 📸", color:avatarColor(allAthletes, payload.new.athlete_id) });
        }
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"social_posts" }, fetchPosts)
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
    let operationError = null;
    if (existing) {
      const { error } = await supabase.from("social_reactions").delete().eq("id", existing.id);
      operationError = error;
    } else {
      const { error:deleteError } = await supabase.from("social_reactions").delete().eq("post_id", postId).eq("athlete_id", athlete.id);
      if (deleteError) operationError = deleteError;
      if (!operationError) {
        const { error:insertError } = await supabase.from("social_reactions").insert({ post_id:postId, athlete_id:athlete.id, emoji });
        operationError = insertError;
      }
    }
    if (operationError) {
      setPosts(prev => prev.map(item => item.id === postId ? post : item));
      setToast({ name:"AthleteOS", action:"n’a pas pu enregistrer ta réaction. Réessaie.", color:"var(--tone-danger)" });
    }
  };

  const handleDelete = async postId => {
    const deletedPost = posts.find(post => post.id === postId);
    if (!deletedPost) return;
    setPosts(prev => prev.filter(p => p.id!==postId));
    const { error } = await supabase.from("social_posts")
      .delete()
      .eq("id", postId)
      .eq("athlete_id", athlete.id);
    if (error) {
      setPosts(prev => [...prev, deletedPost].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      setToast({ name:"AthleteOS", action:"n’a pas pu supprimer la publication. Elle a été restaurée.", color:"var(--tone-danger)" });
      return;
    }
    setCommentCounts(prev => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  };

  // Séance validée la plus récente pour le bouton rapide
  const lastValidatedSession = useMemo(() =>
    sessions.filter(s => s.week===currentWeek && s.validations?.find(v => v.athleteId===athlete.id && v.status==="done"))
      .sort((a,b) => (b.sessionDate??b.week).localeCompare(a.sessionDate??a.week))[0] ?? null,
  [sessions, athlete.id, currentWeek]);

  // Est-ce que l'athlète a déjà posté aujourd'hui ?
  const postedToday = posts.some(p => p.athlete_id===athlete.id && (Date.now()-new Date(p.created_at))<86400000);
  const filteredPosts = useMemo(() => filterClubPosts(posts, feedFilter, athlete.id), [posts, feedFilter, athlete.id]);
  const activePosterCount = useMemo(() => new Set(posts.map(post => post.athlete_id)).size, [posts]);
  const feedFilters = [
    { id:"all", label:"Tout", count:posts.length },
    { id:"photos", label:"Photos", count:posts.filter(post => post.image_url).length },
    { id:"highlights", label:"Exploits", count:posts.filter(post => post.auto_type === "record" || post.auto_type === "goal").length },
    { id:"mine", label:"Mes posts", count:posts.filter(post => post.athlete_id === athlete.id).length },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto animate-slide-up">
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)}/>}

      <section className="card athlete-club-hero">
        {clubBrand?.coverUrl && <img className="athlete-club-hero__cover" src={clubBrand.coverUrl} alt="" aria-hidden="true" />}
        <div className="athlete-club-hero__overlay" aria-hidden="true" />
        <div className="athlete-club-hero__topline">
          <div className="athlete-club-hero__copy">
            <div className="athlete-club-hero__eyebrow">
              <span className="athlete-club-hero__logo" aria-hidden="true">
                {clubBrand?.logoUrl ? <img src={clubBrand.logoUrl} alt="" /> : <Sparkles size={15} />}
              </span>
              <span>Mon club</span>
            </div>
            <h1 className="page-title">{clubBrand?.name || "Mon club"}</h1>
            <p>Les séances, encouragements et exploits de ton groupe.</p>
          </div>
          <button type="button" onClick={() => setQuickPost(lastValidatedSession ?? true)} className="btn-primary" style={{ flexShrink:0 }}>
            <Camera size={16} aria-hidden="true"/> Partager
          </button>
        </div>
        <div className="athlete-club-hero__stats">
          {[
            { value:allAthletes.length, label:"Membres" },
            { value:activePosterCount, label:"Actifs cette semaine" },
            { value:posts.length, label:"Publications" },
          ].map((item,index) => (
            <div key={item.label} className={index === 0 ? undefined : "athlete-club-hero__stat--divided"}>
              <p className="athlete-club-hero__stat-value">{item.value}</p>
              <p className="athlete-club-hero__stat-label">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RÉCAP SQUAD DE LA SEMAINE ── */}
      {squadStats && squadStats.total > 0 && (
        <section className="card" style={{ padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"rgba(91,141,239,0.14)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <UsersIcon size={18} color="#8DB1F6" />
              </div>
              <div>
                <p style={{ fontSize:15, fontWeight:700, color:"var(--c-text-1)" }}>Semaine du groupe</p>
                <p style={{ fontSize:12, color:"var(--c-text-2)", marginTop:3 }}>S{currentWeek} · lundi → samedi</p>
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <p style={{ fontSize:20, fontWeight:700, lineHeight:1, color: squadStats.pct >= 70 ? "#1D9E75" : squadStats.pct >= 40 ? "#E8A020" : "#E05252" }}>
                {squadStats.pct}%
              </p>
              <p style={{ fontSize:12, color:"var(--c-text-2)", marginTop:4 }}>{squadStats.done}/{squadStats.total} séances</p>
            </div>
          </div>
          {squadStats.ranking.length > 0 && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid var(--c-border)" }}>
              <p style={{ fontSize:12, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--c-text-2)", marginBottom:16, textAlign:"center" }}>
                Les plus réguliers
              </p>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:18 }}>
                {[1, 0, 2].filter(idx => squadStats.ranking[idx]).map(idx => {
                  const a      = squadStats.ranking[idx];
                  const rank   = idx + 1;
                  const medal  = rank===1 ? "#E8A020" : rank===2 ? "#B8C4D0" : "#C87F3A";
                  const size   = rank===1 ? 46 : 38;
                  return (
                    <div key={a.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, marginBottom: rank===1 ? 8 : 0 }}>
                      <div style={{ position:"relative" }}>
                        <div style={{
                          width:size, height:size, borderRadius:"50%", background:avatarColor(allAthletes, a.id),
                          display:"flex", alignItems:"center", justifyContent:"center", color:"white",
                          fontSize:13, fontWeight:700, border:`2px solid ${medal}`,
                        }}>
                          {initialsFromName(a.name)}
                        </div>
                        <div style={{ position:"absolute", bottom:-3, right:-3, width:18, height:18, borderRadius:"50%", background:medal, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--c-surface)" }}>
                          <Award size={9} color="white" strokeWidth={2.5} />
                        </div>
                      </div>
                      <p style={{ fontSize:12, fontWeight:600, color:"var(--c-text-2)" }}>{a.name.split(" ")[0]}</p>
                      <p style={{ fontSize:13, fontWeight:700, color:medal }}>{a.done}/{a.total}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── PROMPT POST (si séance validée & pas encore posté) ── */}
      {lastValidatedSession && !postedToday && (
        <section style={{ borderRadius:16, padding:16, background:"rgba(29,158,117,0.08)", border:"1px solid rgba(29,158,117,0.16)", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:13, background:"rgba(29,158,117,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Camera size={16} color="#1D9E75"/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:14, fontWeight:700, color:"var(--c-text-1)", lineHeight:1.3 }}>Séance terminée</p>
            <p style={{ fontSize:12, color:"var(--tone-success)", marginTop:3 }} className="truncate">{lastValidatedSession.title}</p>
          </div>
          <button type="button" onClick={() => setQuickPost(lastValidatedSession)} className="btn-primary" style={{ flexShrink:0 }}>
            📸 Partager
          </button>
        </section>
      )}

      {/* ── AVATARS MEMBRES — anneau plein + cliquable pour qui a posté */}
      {/* AUJOURD'HUI (façon stories), anneau discret pour qui a posté dans   */}
      {/* les 7 jours mais pas aujourd'hui, transparent sinon.               */}
      <section className="card" style={{ padding:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:14 }}>
          <div>
            <h2 className="card-title">Membres du club</h2>
            <p style={{ fontSize:12, color:"var(--c-text-2)", marginTop:3 }}>Un anneau vert signale une publication aujourd’hui.</p>
          </div>
          <span style={{ fontSize:12, color:"var(--c-text-2)" }}>{activePosterCount} actif{activePosterCount>1?"s":""}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, overflowX:"auto", scrollbarWidth:"none" }}>
          {allAthletes.map((a, idx) => {
          const isMe          = a.id===athlete.id;
          const postedToday   = posts.some(p => p.athlete_id===a.id && isSameCalendarDay(new Date(p.created_at), new Date()));
          const postedThisWeek = !postedToday && posts.some(p => p.athlete_id===a.id);
          const color         = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const goToStory = () => {
            if (!postedToday) return;
            const mine = posts.filter(p => p.athlete_id===a.id && isSameCalendarDay(new Date(p.created_at), new Date()));
            document.getElementById(`post-${mine[0]?.id}`)?.scrollIntoView({ behavior:"smooth", block:"start" });
          };
          return (
            <button key={a.id} type="button" onClick={goToStory} disabled={!postedToday}
              aria-label={postedToday ? `Voir la publication de ${a.name}` : `${a.name} n’a pas publié aujourd’hui`}
              style={{ minWidth:56, background:"none", border:"none", padding:0, display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0, cursor:postedToday?"pointer":"default", opacity:postedToday||isMe?1:0.72 }}>
              <div className={postedToday ? "story-ring-pulse" : undefined} style={{
                width:44, height:44, borderRadius:"50%", background:color,
                display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:13, fontWeight:600,
                border:postedToday?"2.5px solid #1D9E75":postedThisWeek?"2.5px solid rgba(29,158,117,0.35)":isMe?"2.5px solid var(--c-border-strong)":"2.5px solid transparent",
                boxShadow:postedToday?"0 0 0 2px rgba(29,158,117,0.25)":"none",
              }}>
                {initialsFromName(a.name)}
              </div>
              <p style={{ fontSize:12, color:isMe?"#7BD8B4":"var(--c-text-2)", fontWeight:isMe?700:500, maxWidth:56, textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {isMe?"Moi":a.name.split(" ")[0]}
              </p>
            </button>
          );
        })}
        </div>
      </section>

      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:12 }}>
        <div>
          <h2 className="section-title">Fil du club</h2>
          <p style={{ fontSize:13, color:"var(--c-text-2)", marginTop:4 }}>Les 7 derniers jours de vie du groupe.</p>
        </div>
      </div>

      <SegmentedTabs
        ariaLabel="Filtrer les publications"
        items={feedFilters.map((filter) => ({ ...filter, badge: filter.count }))}
        value={feedFilter}
        onChange={setFeedFilter}
      />

      {/* ── FIL POSTS ── */}
      <div className="space-y-4">
        {loading ? (
          <div style={{ textAlign:"center", padding:"48px 0" }}>
            <div className="loader-ring" style={{ margin:"0 auto 10px" }}/>
            <p style={{ fontSize:12, color:"var(--c-text-3)" }}>Chargement du fil…</p>
          </div>
        ) : posts.length===0 ? (
          <EmptyState
            icon={Camera}
            title="Le fil du club attend son premier moment"
            description="Partage une séance, une photo ou un encouragement pour lancer la vie du groupe."
            action={<button type="button" onClick={() => setQuickPost(lastValidatedSession ?? true)} className="btn-primary"><Camera size={15} aria-hidden="true" /> Partager maintenant</button>}
          />
        ) : filteredPosts.length===0 ? (
          <EmptyState
            compact
            icon={Camera}
            title="Aucune publication dans ce filtre"
            description="Choisis un autre filtre ou partage quelque chose avec le club."
            action={<button type="button" onClick={() => setFeedFilter("all")} className="btn-secondary">Voir tout le fil</button>}
          />
        ) : filteredPosts.map(post => (
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

        {posts.length>0 && hasMorePosts && (
          <div style={{ textAlign:"center", padding:"8px 0 24px" }}>
            <button type="button" onClick={() => fetchPosts(false)} disabled={loadingMore} className="tap-feedback"
              style={{ minHeight:44, fontSize:13, fontWeight:700, color:"var(--tone-success)", background:"var(--c-surface-2)", border:"1px solid var(--c-border)", borderRadius:99, padding:"0 20px", cursor:"pointer" }}>
              {loadingMore ? <><div className="loader-ring loader-ring-sm" style={{ display:"inline-block", marginRight:6 }}/>Chargement…</> : "Charger plus"}
            </button>
          </div>
        )}
        {posts.length>0 && !hasMorePosts && (
          <p style={{ textAlign:"center", fontSize:12, color:"var(--c-text-3)", padding:"16px 0 24px" }}>
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
          athlete={athlete} allAthletes={allAthletes} clubId={clubId} coachUserId={coachUserId}
          onClose={() => setQuickPost(null)}
          onPosted={() => { setQuickPost(null); fetchPosts(); }}
        />
      )}
    </div>
  );
}
