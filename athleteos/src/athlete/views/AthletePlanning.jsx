// ============================================================
// AthleteOS — src/athlete/views/AthletePlanning.jsx  ★ DESIGN PREMIUM + PORTALS
// ============================================================

import { useState, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom"; // <-- RÉINTÉGRATION DU PORTAL
import {
  Plus, ChevronLeft, ChevronRight, X, Clock, Star, CalendarDays,
  FileText, Users, AlertCircle, CheckCircle, Zap,
} from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage } from "../../utils/notifications";
import {
  DAYS_SHORT, MONTHS_FR, CATEGORIES,
  isSameDay, dateToISOWeek, dateToDayName,
} from "../shared";

// ─── Palette catégories (cohérente avec Planning.jsx coach) ──────────────────
const CAT_COLORS = {
  sprint:       { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", glow: "rgba(59,130,246,0.15)"  },
  haies:        { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95", glow: "rgba(124,58,237,0.15)" },
  force:        { bg: "#DCFCE7", border: "#16A34A", text: "#14532D", glow: "rgba(22,163,74,0.15)"  },
  saut:         { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8", glow: "rgba(168,85,247,0.15)" },
  lancer:       { bg: "#FFEDD5", border: "#F97316", text: "#9A3412", glow: "rgba(249,115,22,0.15)" },
  endurance:    { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", glow: "rgba(2,132,199,0.15)"  },
  technique:    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B", glow: "rgba(100,116,139,0.12)"},
  mobilite:     { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", glow: "rgba(202,138,4,0.15)"  },
  recuperation: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569", glow: "rgba(203,213,225,0.15)"},
};
const cat = (key) => CAT_COLORS[key] ?? CAT_COLORS.technique;

// ─── Helper : badge statut ────────────────────────────────────────────────────
function StatusBadge({ status, size = "sm" }) {
  const cfg = {
    done:    { label: "Réalisée",  bg: "#DCFCE7", color: "#15803D", dot: "#22C55E" },
    partial: { label: "Partielle", bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B" },
    none:    { label: "Absent",    bg: "#FEE2E2", color: "#B91C1C", dot: "#EF4444" },
    future:  { label: "Prévue",    bg: "#EFF6FF", color: "#1D4ED8", dot: "#60A5FA" },
  };
  const s = cfg[status] ?? cfg.future;
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full ${px}`}
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ─── RPE : couleur progressive ────────────────────────────────────────────────
function rpeColor(i) {
  if (i <= 3) return { active: "#22C55E", border: "#16A34A", text: "white" };
  if (i <= 6) return { active: "#F59E0B", border: "#D97706", text: "white" };
  return          { active: "#EF4444", border: "#DC2626", text: "white" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL CRÉATION DE SÉANCE
// ═══════════════════════════════════════════════════════════════════════════════
const CreateSessionModal = memo(({ athlete, allAthletes, clubId, createdBy, coachUserId, onClose, onCreated }) => {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "", category: "technique", time: "10:00", durationMinutes: 60,
    description: "", sessionDate: today, invitedAthletes: [],
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  const set       = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleInv = id => setForm(f => ({
    ...f,
    invitedAthletes: f.invitedAthletes.includes(id)
      ? f.invitedAthletes.filter(x => x !== id)
      : [...f.invitedAthletes, id],
  }));

  const c = cat(form.category);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true); setErr(null);
    try {
      let pdfUrl = null;
      if (pdfFile) {
        const ext  = pdfFile.name.split(".").pop();
        const path = `session-pdfs/${Date.now()}.${ext}`;
        const { error: ue } = await supabase.storage.from("session-pdfs").upload(path, pdfFile, { upsert: true });
        if (ue) throw ue;
        const { data: ud } = supabase.storage.from("session-pdfs").getPublicUrl(path);
        pdfUrl = ud?.publicUrl ?? null;
      }
      const catLabel = CATEGORIES.find(x => x.id === form.category)?.label ?? form.category;
      const { data: ns, error: se } = await supabase.from("sessions").insert({
        club_id: clubId, week: dateToISOWeek(form.sessionDate), day: dateToDayName(form.sessionDate),
        session_date: form.sessionDate, time: form.time, type: catLabel, category: form.category,
        title: form.title, description: form.description || null, duration_minutes: form.durationMinutes,
        load_weight: 1.0, pdf_url: pdfUrl, created_by: createdBy,
      }).select().single();
      if (se) throw se;

      const allIds = [athlete.id, ...form.invitedAthletes];
      await supabase.from("session_athletes").insert(
        allIds.map(id => ({ session_id: ns.id, athlete_id: id, status: null }))
      );
      await supabase.from("alerts").insert({
        club_id: clubId, athlete_id: athlete.id, type: "absence",
        title: `📋 Séance proposée par ${athlete.name}`,
        description: `${athlete.name} a planifié "${form.title}" (${catLabel}) le ${new Date(form.sessionDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}.`,
        severity: "légère", is_read: false,
      });
      if (coachUserId) notifyCoachMessage(coachUserId, athlete.name,
        `${athlete.name} a planifié "${form.title}" le ${new Date(form.sessionDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`
      ).catch(console.warn);
      onCreated(); onClose();
    } catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  const others = allAthletes.filter(a => a.id !== athlete.id);

  // <-- RÉINTÉGRATION DE createPortal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[95vh] flex flex-col overflow-hidden modal-content">

        {/* Poignée mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header coloré réactif à la catégorie */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0 transition-colors duration-300"
          style={{ background: c.bg, borderBottom: `2px solid ${c.border}40` }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
              style={{ background: c.border + "20", border: `1px solid ${c.border}40` }}>
              <Zap size={10} style={{ color: c.border }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.text }}>
                Planifier une séance
              </span>
            </div>
            <p className="text-[12px] font-medium" style={{ color: c.text + "80" }}>
              Ton coach sera notifié automatiquement
            </p>
          </div>
          <button onClick={onClose} disabled={saving}
            className="p-2 rounded-xl hover:bg-black/10 disabled:opacity-40 transition-colors flex-shrink-0">
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {err && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-red-700">{err}</p>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Titre *
            </label>
            <input className="input-premium" placeholder="Ex: Footing récup, Technique saut…"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          {/* Catégories — chips */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Type de séance
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ id, label }) => {
                const cc  = cat(id);
                const sel = form.category === id;
                return (
                  <button key={id} onClick={() => set("category", id)}
                    className="px-3 py-1.5 rounded-xl text-[11.5px] font-bold border-2 transition-all tap-feedback"
                    style={sel
                      ? { background: cc.border, color: "white",  borderColor: cc.border,        boxShadow: `0 2px 8px ${cc.glow}` }
                      : { background: cc.bg,     color: cc.text,  borderColor: cc.border + "50" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Date *</label>
              <input type="date" className="input-premium" value={form.sessionDate}
                onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">Heure</label>
              <input type="time" className="input-premium" value={form.time}
                onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Durée (min)
            </label>
            <input type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes}
              onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Description
            </label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Objectifs, détails…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* PDF */}
          <div>
            <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
              PDF (optionnel)
            </label>
            <label className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                {pdfFile
                  ? <p className="text-[12px] font-semibold text-slate-700 truncate">📎 {pdfFile.name}</p>
                  : <p className="text-[12px] text-slate-400">Appuie pour joindre un PDF</p>
                }
              </div>
              <input type="file" accept="application/pdf" className="sr-only"
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Inviter athlètes */}
          {others.length > 0 && (
            <div>
              <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <Users size={11} className="inline mr-1" />Inviter d'autres athlètes
              </label>
              <div className="flex flex-wrap gap-2">
                {others.map(a => {
                  const sel = form.invitedAthletes.includes(a.id);
                  return (
                    <button key={a.id} onClick={() => toggleInv(a.id)}
                      className={["flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback",
                        sel ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-white border-slate-200 text-slate-500"].join(" ")}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-black"
                        style={{ background: sel ? "#1D9E75" : "#94a3b8" }}>
                        {(a.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      {a.name.split(" ")[0]}
                      {sel && <CheckCircle size={12} className="text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="btn-secondary">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={!form.title.trim() || saving}
            className="btn-primary">
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Création…</>
              : <><Plus size={15} />Planifier</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DÉTAIL SÉANCE
// ═══════════════════════════════════════════════════════════════════════════════
const SessionDetailModal = memo(({ session, athlete, onClose, onSetStatus, onSetRpe, onSetFeeling, onSetComment }) => {
  const c   = cat(session.category);
  const val = session.validations?.find(v => v.athleteId === athlete.id);
  const [comment, setComment] = useState(val?.comment ?? "");

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : session.day;

  const status  = val?.status ?? null;
  const hasPerf = status === "done" || status === "partial";

  // <-- RÉINTÉGRATION DE createPortal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden modal-content">

        {/* Poignée mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header coloré catégorie */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${c.bg} 0%, ${c.bg}80 100%)`, borderBottom: `2px solid ${c.border}` }}>
          <div className="flex-1 min-w-0">
            <span className="text-[9.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full inline-flex items-center gap-1 mb-2.5"
              style={{ background: c.border, color: "white" }}>
              <span>{CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}</span>
            </span>
            <h3 className="text-[20px] font-black leading-tight" style={{ color: c.text }}>
              {session.title}
            </h3>
            <p className="text-[12px] mt-2 font-medium flex items-center gap-2 flex-wrap" style={{ color: c.text + "90" }}>
              <span>📅 {dateStr}</span>
              {session.time && <span>· ⏰ {session.time}</span>}
              {session.durationMinutes && <span>· {session.durationMinutes} min</span>}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/10 transition-colors flex-shrink-0">
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Description */}
          {session.description && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[13px] text-slate-600 leading-relaxed">{session.description}</p>
            </div>
          )}

          {/* Consignes coach */}
          {session.instructions && (
            <div className="rounded-2xl overflow-hidden border border-amber-200" style={{ background: "#FFFBF0" }}>
              <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
                <span className="text-[9.5px] font-black text-amber-700 uppercase tracking-widest">💬 Consignes du coach</span>
              </div>
              <p className="px-4 py-3 text-[13px] text-amber-800 leading-relaxed">{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <a href={session.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-[13px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors tap-feedback">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-blue-600" />
              </div>
              Voir le PDF de séance
              <ChevronRight size={14} className="ml-auto text-blue-400" />
            </a>
          )}

          {/* ── Présence ── */}
          <div>
            <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-3">Ma présence</p>
            <div className="flex gap-2">
              {[
                { id: "done",    label: "Réalisée",  icon: "✅", activeCls: "bg-emerald-50 border-emerald-400 text-emerald-700" },
                { id: "partial", label: "Partielle",  icon: "🟡", activeCls: "bg-amber-50 border-amber-400 text-amber-700"   },
                { id: "none",    label: "Absent",     icon: "❌", activeCls: "bg-red-50 border-red-400 text-red-700"          },
              ].map(opt => (
                <button key={opt.id} onClick={() => onSetStatus(session.id, athlete.id, opt.id)}
                  className={["flex-1 py-3 rounded-2xl text-[11.5px] font-bold border-2 transition-all tap-feedback flex flex-col items-center gap-1",
                    status === opt.id ? opt.activeCls : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"].join(" ")}>
                  <span className="text-[18px]">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── RPE ── affiché si présence renseignée et pas "none" */}
          {hasPerf && (
            <div>
              <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Effort ressenti (RPE)
                {val?.rpe != null && (
                  <span className="ml-2 font-black"
                    style={{ color: rpeColor(val.rpe).active }}>
                    {val.rpe}/10
                  </span>
                )}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => {
                  const rc  = rpeColor(i);
                  const sel = val?.rpe === i;
                  return (
                    <button key={i} onClick={() => onSetRpe(session.id, athlete.id, i)}
                      className="w-10 h-10 rounded-2xl text-[12px] font-black border-2 transition-all tap-feedback"
                      style={sel
                        ? { background: rc.active, borderColor: rc.border, color: rc.text, transform: "scale(1.12)", boxShadow: `0 2px 8px ${rc.active}60` }
                        : { background: "white",   borderColor: "#E2E8F0", color: "#94A3B8" }}>
                      {i}
                    </button>
                  );
                })}
              </div>
              {/* Légende RPE */}
              <div className="flex items-center gap-3 mt-2">
                {[{ range: "0-3", color: "#22C55E", label: "Facile" }, { range: "4-6", color: "#F59E0B", label: "Modéré" }, { range: "7-10", color: "#EF4444", label: "Intense" }].map(l => (
                  <div key={l.range} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px] text-slate-400 font-medium">{l.range} {l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ressenti général (étoiles) ── */}
          {hasPerf && (
            <div>
              <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Ressenti général
                {val?.feeling != null && (
                  <span className="ml-2 font-black text-amber-500">{val.feeling}/5 ⭐</span>
                )}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => onSetFeeling(session.id, athlete.id, n)}
                    className="p-1 transition-transform tap-feedback hover:scale-110">
                    <Star
                      size={32}
                      fill={val?.feeling >= n ? "#F59E0B" : "none"}
                      color={val?.feeling >= n ? "#F59E0B" : "#E2E8F0"}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Commentaire ── */}
          {hasPerf && (
            <div>
              <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Commentaire
              </p>
              <textarea
                className="input-premium resize-none"
                rows={3}
                placeholder="Comment s'est passée la séance ?"
                value={comment}
                onChange={e => setComment(e.target.value)}
                onBlur={() => onSetComment(session.id, athlete.id, comment.trim())}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — AthletePlanning
// ═══════════════════════════════════════════════════════════════════════════════
export default function AthletePlanning({
  athlete, sessions, allAthletes, clubId, createdBy, coachUserId,
  onRpeChange, onStatusChange, onFeelingChange, onCommentChange, onRefresh,
}) {
  const today    = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,      setViewYear]      = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(today.getMonth());
  const [viewMode,      setViewMode]      = useState(isMobile ? "agenda" : "month");
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [activeSession, setActiveSession] = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);

  // ── Index sessions par date ──────────────────────────────────────────────────
  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (!s.sessionDate) return;
      const key = s.sessionDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  // ── Jours du mois pour la grille ────────────────────────────────────────────
  const calDays = useMemo(() => {
    const first    = new Date(viewYear, viewMonth, 1);
    const last     = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const days     = [];
    for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth, -i), cur: false });
    for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(viewYear, viewMonth, d), cur: true });
    const rem = 7 - (days.length % 7);
    if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(viewYear, viewMonth + 1, d), cur: false });
    return days;
  }, [viewYear, viewMonth]);

  // ── Jours de la semaine sélectionnée ────────────────────────────────────────
  const weekDays = useMemo(() => {
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selectedDate]);

  // ── Agenda groupé par date ───────────────────────────────────────────────────
  const groupedAgenda = useMemo(() => {
    const sorted = [...sessions].filter(s => s.sessionDate).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const groups = []; const seen = new Set();
    sorted.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [sessions]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()-7); setSelectedDate(d); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()+7); setSelectedDate(d); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  // Toujours ouvrir la session en version live (mise à jour temps réel)
  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month")  return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    if (viewMode === "agenda") return "Mes séances";
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  // ── Helpers carte séance ─────────────────────────────────────────────────────
  const SessionCard = useCallback(({ s, isPast = false, compact = false }) => {
    const c   = cat(s.category);
    const val = s.validations?.find(v => v.athleteId === athlete.id);
    const st  = val?.status ?? "future";
    const rpeNeeded = isPast && val?.rpe == null && st !== "none" && st !== "future";

    if (compact) {
      return (
        <div onClick={e => { e.stopPropagation(); setActiveSession(s); }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl text-[9.5px] font-bold cursor-pointer hover:opacity-80 transition-opacity truncate"
          style={{ background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}>
          <span className="truncate flex-1">{s.title}</span>
          {st === "done" && <span className="flex-shrink-0">✅</span>}
          {st === "none" && <span className="flex-shrink-0">❌</span>}
        </div>
      );
    }

    return (
      <div onClick={() => setActiveSession(s)}
        className="card card-hover rounded-2xl overflow-hidden cursor-pointer tap-feedback"
        style={rpeNeeded ? { borderWidth: 2, borderColor: "#F59E0B", boxShadow: "0 0 0 3px rgba(245,158,11,0.12)" } : {}}>
        {/* En-tête coloré catégorie */}
        <div className="px-4 py-2.5 flex items-center justify-between"
          style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
              style={{ background: c.border, color: "white" }}>
              {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
            </span>
            {s.pdfUrl && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">📄 PDF</span>
            )}
          </div>
          <StatusBadge status={st} size="sm" />
        </div>
        {/* Corps */}
        <div className="px-4 py-3.5 bg-white">
          <p className="text-[15px] font-black text-slate-800 leading-tight mb-1.5">{s.title}</p>
          <div className="flex items-center gap-3 text-[11.5px] text-slate-400 mb-2">
            <span className="flex items-center gap-1"><Clock size={11} /> {s.time}</span>
            {s.durationMinutes && <span>{s.durationMinutes} min</span>}
            {val?.rpe != null && (
              <span className="font-bold" style={{ color: rpeColor(val.rpe).active }}>RPE {val.rpe}/10</span>
            )}
          </div>
          {s.instructions && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-2 line-clamp-2">
              💬 {s.instructions}
            </p>
          )}
          {rpeNeeded && (
            <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Valide ta séance
            </p>
          )}
        </div>
      </div>
    );
  }, [athlete.id, sessions]);

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg, #F5F5F2)" }}>

      {/* ── HEADER GLASSMORPHISM ─────────────────────────────────────────────── */}
      <div className="header-glass px-3 md:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-10">

        {/* Navigation mois / semaine */}
        <div className="flex items-center gap-1">
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? prevMonth : prevWeek}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all tap-feedback">
              <ChevronLeft size={16} />
            </button>
          )}
          <p className="text-[14px] md:text-[15px] font-black text-slate-800 px-1 min-w-[100px] text-center truncate">
            {navLabel}
          </p>
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? nextMonth : nextWeek}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all tap-feedback">
              <ChevronRight size={16} />
            </button>
          )}
          {viewMode !== "agenda" && (
            <button onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 ml-1 transition-colors">
              Auj.
            </button>
          )}
        </div>

        {/* Contrôles droite */}
        <div className="flex items-center gap-1.5">
          {/* Sélecteur de vue — pill premium */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[10px] font-bold bg-white">
            {[{ id: "agenda", label: "Liste" }, { id: "month", label: "Mois" }, { id: "week", label: "Sem." }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className="px-3 py-1.5 transition-colors"
                style={viewMode === v.id
                  ? { background: "#0F172A", color: "white" }
                  : { background: "white", color: "#64748B" }}>
                {v.label}
              </button>
            ))}
          </div>
          {/* Bouton planifier */}
          <button onClick={() => setShowCreate(true)} className="btn-primary !py-2 !px-3">
            <Plus size={14} /><span className="hidden sm:inline">Planifier</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
         VUE AGENDA (liste chronologique)
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "agenda" && (
        <div className="flex-1 overflow-y-auto">
          {groupedAgenda.length === 0 ? (
            /* État vide */
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                <CalendarDays size={28} className="text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-slate-500">Aucune séance planifiée</p>
                <p className="text-[12px] text-slate-400 mt-1">Ton coach ou toi pouvez planifier des séances</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={14} /> Planifier une séance
              </button>
            </div>
          ) : (
            <div className="p-3 md:p-5 space-y-6">
              {groupedAgenda.map(({ date, sessions: ds }) => {
                const dateObj = new Date(date);
                const isToday = isSameDay(dateObj, today);
                const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));
                return (
                  <div key={date}>
                    {/* En-tête groupe date */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm"
                        style={isToday
                          ? { background: "linear-gradient(135deg, #1D9E75, #16826C)" }
                          : isPast
                            ? { background: "#F1F5F9", border: "1px solid #E2E8F0" }
                            : { background: "white", border: "1.5px solid #E2E8F0" }}>
                        <span className="text-[9px] font-black uppercase leading-none"
                          style={{ color: isToday ? "rgba(255,255,255,0.75)" : isPast ? "#94A3B8" : "#64748B" }}>
                          {dateObj.toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span className="text-[18px] font-black leading-tight"
                          style={{ color: isToday ? "white" : isPast ? "#94A3B8" : "#1E293B" }}>
                          {dateObj.getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] font-black"
                          style={{ color: isToday ? "#1D9E75" : isPast ? "#94A3B8" : "#1E293B" }}>
                          {isToday
                            ? "Aujourd'hui"
                            : dateObj.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {ds.length} séance{ds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Cards séances avec ligne verticale */}
                    <div className="ml-4 pl-11 border-l-2 border-slate-100 space-y-2.5">
                      {ds.sort((a, b) => a.time.localeCompare(b.time)).map(s => (
                        <SessionCard key={s.id} s={s} isPast={isPast} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         VUE MOIS (grille calendrier)
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {/* En-têtes jours */}
          <div className="grid grid-cols-7 mb-2">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="text-center text-[9px] md:text-[10.5px] font-black text-slate-400 uppercase tracking-widest py-1.5">
                {d}
              </div>
            ))}
          </div>

          {/* Grille jours */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {calDays.map(({ date, cur }, idx) => {
              const key     = date.toISOString().slice(0, 10);
              const ds      = sessionsByDate[key] ?? [];
              const isToday = isSameDay(date, today);
              const isSel   = selectedDate && isSameDay(date, selectedDate);

              return (
                <div key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    if (window.innerWidth < 768) setViewMode("week");
                  }}
                  className="min-h-[52px] md:min-h-[90px] rounded-xl md:rounded-2xl p-1 md:p-2 cursor-pointer transition-all border"
                  style={isToday
                    ? { background: "#F0FBF7", borderColor: "#1D9E75", borderWidth: 2, boxShadow: "0 0 0 3px rgba(29,158,117,0.08)" }
                    : isSel
                      ? { background: "#EFF6FF", borderColor: "#60A5FA", borderWidth: 2 }
                      : cur
                        ? { background: "white", borderColor: "#F1F5F9" }
                        : { background: "rgba(248,250,252,0.4)", borderColor: "transparent", opacity: 0.4 }}>

                  <div className="flex items-start justify-between mb-1">
                    {/* Numéro du jour */}
                    <span className="text-[11px] md:text-[13px] font-black w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={isToday
                        ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" }
                        : { color: cur ? "#334155" : "#94a3b8" }}>
                      {date.getDate()}
                    </span>

                    {/* Dots mobile */}
                    {ds.length > 0 && (
                      <div className="md:hidden flex flex-wrap gap-0.5 justify-end mt-1">
                        {ds.slice(0, 3).map(s => (
                          <div key={s.id} className="w-1.5 h-1.5 rounded-full"
                            style={{ background: cat(s.category).border }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pills séances desktop */}
                  <div className="hidden md:block space-y-0.5">
                    {ds.slice(0, 3).map(s => (
                      <SessionCard key={s.id} s={s} compact />
                    ))}
                    {ds.length > 3 && (
                      <p className="text-[9px] text-slate-400 font-semibold px-1">+{ds.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Séances du jour sélectionné (en bas de la grille) */}
          {selectedDate && (() => {
            const key = selectedDate.toISOString().slice(0, 10);
            const ds  = (sessionsByDate[key] ?? []).sort((a, b) => a.time.localeCompare(b.time));
            if (!ds.length) return null;
            const isPast = selectedDate < new Date(today.toISOString().slice(0, 10));
            return (
              <div className="mt-5 space-y-2">
                <p className="text-[12px] font-bold text-slate-500 mb-3 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-lg flex items-center justify-center" style={{ background: "#1D9E75" }}>
                    <CalendarDays size={9} color="white" />
                  </span>
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {ds.map(s => <SessionCard key={s.id} s={s} isPast={isPast} />)}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         VUE SEMAINE
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "week" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Sélecteur de jour — strip horizontal */}
          <div className="flex overflow-x-auto gap-1.5 px-3 py-3 bg-white border-b border-slate-100 flex-shrink-0"
            style={{ scrollbarWidth: "none" }}>
            {weekDays.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isSel   = isSameDay(date, selectedDate ?? today);
              const hasSess = (sessionsByDate[date.toISOString().slice(0, 10)] ?? []).length > 0;
              return (
                <button key={i} onClick={() => setSelectedDate(date)}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 w-11 py-2.5 rounded-2xl transition-all tap-feedback"
                  style={isToday
                    ? { background: "linear-gradient(135deg, #1D9E75, #16826C)" }
                    : isSel
                      ? { background: "#0F172A" }
                      : { background: "transparent" }}>
                  <span className="text-[9px] font-black uppercase tracking-wider"
                    style={{ color: (isToday || isSel) ? "rgba(255,255,255,0.7)" : "#94A3B8" }}>
                    {["L", "M", "M", "J", "V", "S", "D"][i]}
                  </span>
                  <span className="text-[18px] font-black leading-tight"
                    style={{ color: (isToday || isSel) ? "white" : "#1E293B" }}>
                    {date.getDate()}
                  </span>
                  {/* Dot séance */}
                  <div className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{ background: hasSess
                      ? (isToday || isSel) ? "rgba(255,255,255,0.6)" : "#1D9E75"
                      : "transparent" }} />
                </button>
              );
            })}
          </div>

          {/* Séances du jour */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {(() => {
              const key     = (selectedDate ?? today).toISOString().slice(0, 10);
              const ds      = (sessionsByDate[key] ?? []).sort((a, b) => a.time.localeCompare(b.time));
              const dateObj = selectedDate ?? today;
              const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));

              if (ds.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
                    <CalendarDays size={24} className="text-slate-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-400">Repos ce jour</p>
                  <button onClick={() => setShowCreate(true)}
                    className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                    + Planifier une séance
                  </button>
                </div>
              );

              return ds.map(s => <SessionCard key={s.id} s={s} isPast={isPast} />);
            })()}
          </div>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {liveActive && (
        <SessionDetailModal
          session={liveActive}
          athlete={athlete}
          onClose={() => setActiveSession(null)}
          onSetStatus={onStatusChange}
          onSetRpe={onRpeChange}
          onSetFeeling={onFeelingChange}
          onSetComment={onCommentChange}
        />
      )}
      {showCreate && (
        <CreateSessionModal
          athlete={athlete}
          allAthletes={allAthletes}
          clubId={clubId}
          createdBy={createdBy}
          coachUserId={coachUserId}
          onClose={() => setShowCreate(false)}
          onCreated={onRefresh}
        />
      )}
    </div>
  );
}