// ============================================================
// AthleteOS — src/athlete/views/AthletePlanning.jsx
// Extrait de AthleteApp.jsx — function MonPlanning(...)
//   + CreateSessionModal + SessionDetailModal
// Zéro modification du code.
// ============================================================

import { useState, useMemo, memo, useCallback } from "react";
import {
  Plus, ChevronLeft, ChevronRight, X, Clock, Star, CalendarDays,
} from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage } from "../../utils/notifications";
import {
  DAYS_SHORT, MONTHS_FR, DAYS_FR, CATEGORIES, SESSION_COLORS,
  isSameDay, getISOWeek, dateToISOWeek, dateToDayName,
} from "../shared";

const SESSION_COLORS_PLANNING = {
  sprint:       { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" },
  haies:        { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95" },
  force:        { bg: "#DCFCE7", border: "#16A34A", text: "#14532D" },
  saut:         { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8" },
  lancer:       { bg: "#FFEDD5", border: "#F97316", text: "#9A3412" },
  endurance:    { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E" },
  technique:    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B" },
  mobilite:     { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12" },
  recuperation: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" },
};

// ─── CreateSessionModal ───────────────────────────────────────────────────────
const CreateSessionModal = memo(({ athlete, allAthletes, clubId, createdBy, coachUserId, onClose, onCreated }) => {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title: "", category: "technique", time: "10:00", durationMinutes: 60,
    description: "", sessionDate: today, invitedAthletes: [],
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleInvite = id => setForm(f => ({
    ...f,
    invitedAthletes: f.invitedAthletes.includes(id)
      ? f.invitedAthletes.filter(x => x !== id)
      : [...f.invitedAthletes, id],
  }));

  const selCat = SESSION_COLORS_PLANNING[form.category] ?? SESSION_COLORS_PLANNING.technique;

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
      const catLabel = CATEGORIES.find(c => c.id === form.category)?.label ?? form.category;
      const { data: ns, error: se } = await supabase.from("sessions").insert({
        club_id: clubId, week: dateToISOWeek(form.sessionDate), day: dateToDayName(form.sessionDate),
        session_date: form.sessionDate, time: form.time, type: catLabel, category: form.category,
        title: form.title, description: form.description || null, duration_minutes: form.durationMinutes,
        load_weight: 1.0, pdf_url: pdfUrl, created_by: createdBy,
      }).select().single();
      if (se) throw se;

      const allIds = [athlete.id, ...form.invitedAthletes];
      await supabase.from("session_athletes").insert(allIds.map(id => ({ session_id: ns.id, athlete_id: id, status: null })));
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
    } catch(e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  const others = allAthletes.filter(a => a.id !== athlete.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content">
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 transition-colors"
          style={{ background: selCat.bg, borderBottom: `2px solid ${selCat.border}40` }}>
          <div>
            <h3 className="text-[17px] font-black" style={{ color: selCat.text }}>Planifier une séance</h3>
            <p className="text-[11px] mt-0.5" style={{ color: selCat.text + "80" }}>Ton coach sera notifié automatiquement</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl hover:bg-black/10 disabled:opacity-40 transition-colors">
            <X size={18} style={{ color: selCat.text }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-[12px] text-red-700">{err}</div>}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Titre *</label>
            <input className="input-premium" placeholder="Ex: Footing récup, Technique saut…"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type de séance</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => {
                const cc  = SESSION_COLORS_PLANNING[cat.id];
                const sel = form.category === cat.id;
                return (
                  <button key={cat.id} onClick={() => set("category", cat.id)}
                    className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold border-2 transition-all tap-feedback"
                    style={sel ? { background: cc.border, color: "white", borderColor: cc.border } : { background: cc.bg, color: cc.text, borderColor: cc.border + "60" }}>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date *</label>
              <input type="date" className="input-premium" value={form.sessionDate} onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Heure</label>
              <input type="time" className="input-premium" value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Durée (min)</label>
            <input type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes} onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
            <textarea className="input-premium resize-none" rows={2} placeholder="Objectifs, détails…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">PDF (optionnel)</label>
            <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              className="w-full text-[12px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700" />
            {pdfFile && <p className="text-[11px] text-slate-400 mt-1">📎 {pdfFile.name}</p>}
          </div>
          {others.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Inviter d'autres athlètes</label>
              <div className="flex flex-wrap gap-2">
                {others.map(a => {
                  const sel = form.invitedAthletes.includes(a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggleInvite(a.id)}
                      className={["flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback",
                        sel ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-white border-slate-200 text-slate-500"].join(" ")}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ background: sel ? "#1D9E75" : "#94a3b8" }}>
                        {(a.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      {a.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold hover:bg-slate-200 disabled:opacity-40 transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={!form.title.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Création…</> : <><Plus size={15} />Planifier</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── SessionDetailModal ───────────────────────────────────────────────────────
const SessionDetailModal = memo(({ session, athlete, onClose, onSetStatus, onSetRpe, onSetFeeling, onSetComment }) => {
  const c   = SESSION_COLORS_PLANNING[session.category] ?? SESSION_COLORS_PLANNING.technique;
  const val = session.validations?.find(v => v.athleteId === athlete.id);
  const [comment, setComment] = useState(val?.comment ?? "");

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : session.day;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content">
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: c.bg, borderBottom: `2px solid ${c.border}` }}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full inline-block mb-2"
              style={{ background: c.border, color: "white" }}>
              {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
            </span>
            <h3 className="text-[19px] font-black leading-tight" style={{ color: c.text }}>{session.title}</h3>
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: c.text + "90" }}>
              📅 {dateStr}{session.time && ` · ⏰ ${session.time}`}{session.durationMinutes && ` · ${session.durationMinutes} min`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/10 transition-colors flex-shrink-0">
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {session.description && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">{session.description}</p>
            </div>
          )}
          {session.instructions && (
            <div className="rounded-2xl overflow-hidden border border-amber-200" style={{ background: "#FFFBF0" }}>
              <div className="px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">💬 Consignes du coach</span>
              </div>
              <p className="px-4 py-3 text-[13px] text-amber-800 leading-relaxed">{session.instructions}</p>
            </div>
          )}
          {session.pdfUrl && (
            <a href={session.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-[13px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors">
              <span className="text-[18px]">📄</span>Voir le PDF de séance
            </a>
          )}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Ma présence</p>
            <div className="flex gap-2">
              {[
                { id: "done",    label: "✅ Réalisée",  cls: "border-emerald-400 bg-emerald-50 text-emerald-700" },
                { id: "partial", label: "🟡 Partielle", cls: "border-amber-400 bg-amber-50 text-amber-700"       },
                { id: "none",    label: "❌ Absent",    cls: "border-red-400 bg-red-50 text-red-700"             },
              ].map(opt => (
                <button key={opt.id} onClick={() => onSetStatus(session.id, athlete.id, opt.id)}
                  className={["flex-1 py-2.5 rounded-2xl text-[11.5px] font-bold border-2 transition-all tap-feedback",
                    val?.status === opt.id ? opt.cls : "bg-white border-slate-200 text-slate-400"].join(" ")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {val?.status && val.status !== "none" && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Effort ressenti (RPE){val?.rpe != null && <span className="ml-2 font-black text-amber-500">{val.rpe}/10</span>}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => (
                  <button key={i} onClick={() => onSetRpe(session.id, athlete.id, i)}
                    className={["w-10 h-10 rounded-2xl text-[12px] font-black border-2 transition-all tap-feedback",
                      val?.rpe === i
                        ? i <= 3 ? "bg-emerald-500 text-white border-emerald-600 scale-110"
                        : i <= 6 ? "bg-amber-500 text-white border-amber-600 scale-110"
                        :          "bg-red-500 text-white border-red-600 scale-110"
                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"].join(" ")}
                  >{i}</button>
                ))}
              </div>
            </div>
          )}
          {(val?.status === "done" || val?.status === "partial") && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Ressenti général{val?.feeling != null && <span className="ml-2 font-black text-amber-500">{val.feeling}/5</span>}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => onSetFeeling(session.id, athlete.id, n)} className="p-1 hover:scale-110 transition-transform tap-feedback">
                    <Star size={30} fill={val?.feeling >= n ? "#EF9F27" : "none"} color={val?.feeling >= n ? "#EF9F27" : "#e2e8f0"} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {(val?.status === "done" || val?.status === "partial") && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Commentaire</p>
              <textarea className="input-premium resize-none" rows={3} placeholder="Comment s'est passée la séance ?"
                value={comment} onChange={e => setComment(e.target.value)}
                onBlur={() => onSetComment(session.id, athlete.id, comment.trim())} />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold hover:bg-slate-200 transition-colors tap-feedback">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── MonPlanning ──────────────────────────────────────────────────────────────
export default function AthletePlanning({ athlete, sessions, allAthletes, clubId, createdBy, coachUserId, onRpeChange, onStatusChange, onFeelingChange, onCommentChange, onRefresh }) {
  const today    = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,      setViewYear]      = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(today.getMonth());
  const [viewMode,      setViewMode]      = useState(isMobile ? "agenda" : "month");
  const [selectedDate,  setSelectedDate]  = useState(today);
  const [activeSession, setActiveSession] = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);

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

  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last  = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth, -i), cur: false });
    for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(viewYear, viewMonth, d), cur: true });
    const rem = 7 - (days.length % 7);
    if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(viewYear, viewMonth + 1, d), cur: false });
    return days;
  }, [viewYear, viewMonth]);

  const weekDays = useMemo(() => {
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  }, [selectedDate]);

  const agendaSessions = useMemo(() =>
    [...sessions].filter(s => s.sessionDate).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
  [sessions]);

  const groupedAgenda = useMemo(() => {
    const groups = []; const seen = new Set();
    agendaSessions.forEach(s => {
      const key = s.sessionDate.slice(0, 10);
      if (!seen.has(key)) { seen.add(key); groups.push({ date: key, sessions: [] }); }
      groups.find(g => g.date === key).sessions.push(s);
    });
    return groups;
  }, [agendaSessions]);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate() - 7); setSelectedDate(d); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate() + 7); setSelectedDate(d); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    if (viewMode === "agenda") return "Mes séances";
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F5F2" }}>
      <div className="header-glass px-3 md:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-10">
        <div className="flex items-center gap-1">
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? prevMonth : prevWeek}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all tap-feedback">
              <ChevronLeft size={16} />
            </button>
          )}
          <p className="text-[14px] md:text-[15px] font-black text-slate-800 px-1 min-w-[100px] text-center truncate">{navLabel}</p>
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? nextMonth : nextWeek}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-all tap-feedback">
              <ChevronRight size={16} />
            </button>
          )}
          {viewMode !== "agenda" && (
            <button onClick={goToday} className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 ml-1">
              Auj.
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[10px] font-bold">
            {[{ id: "agenda", label: "Liste" }, { id: "month", label: "Mois" }, { id: "week", label: "Sem." }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className={["px-2.5 py-1.5 transition-colors", viewMode === v.id ? "bg-slate-800 text-white" : "bg-white text-slate-500"].join(" ")}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary !py-2 !px-3">
            <Plus size={14} /><span className="hidden sm:inline">Planifier</span>
          </button>
        </div>
      </div>

      {/* VUE AGENDA */}
      {viewMode === "agenda" && (
        <div className="flex-1 overflow-y-auto">
          {groupedAgenda.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4 p-8">
              <CalendarDays size={40} strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-[15px] font-bold text-slate-400">Aucune séance planifiée</p>
                <p className="text-[12px] text-slate-300 mt-1">Ton coach ou toi pouvez planifier des séances</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={14} /> Planifier une séance</button>
            </div>
          ) : (
            <div className="p-3 md:p-4 space-y-5">
              {groupedAgenda.map(({ date, sessions: ds }) => {
                const dateObj = new Date(date);
                const isToday = isSameDay(dateObj, today);
                const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));
                return (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={["w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm",
                        isToday ? "text-white" : isPast ? "bg-slate-100 text-slate-400" : "bg-white border border-slate-200 text-slate-700"].join(" ")}
                        style={isToday ? { background: "linear-gradient(135deg, #1D9E75, #16826C)" } : {}}>
                        <span className="text-[9px] font-black uppercase leading-none">
                          {dateObj.toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span className="text-[18px] font-black leading-tight">{dateObj.getDate()}</span>
                      </div>
                      <div>
                        <p className={["text-[13px] font-black", isToday ? "text-emerald-600" : isPast ? "text-slate-400" : "text-slate-700"].join(" ")}>
                          {isToday ? "Aujourd'hui" : dateObj.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p className="text-[10.5px] text-slate-400">{ds.length} séance{ds.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="ml-4 pl-11 border-l-2 border-slate-100 space-y-2">
                      {ds.sort((a, b) => a.time.localeCompare(b.time)).map(s => {
                        const c   = SESSION_COLORS_PLANNING[s.category] ?? SESSION_COLORS_PLANNING.technique;
                        const val = s.validations?.find(v => v.athleteId === athlete.id);
                        const st  = val?.status ?? "future";
                        const rpeNeeded = isPast && val?.rpe == null && st !== "none" && st !== "future";
                        return (
                          <div key={s.id} onClick={() => setActiveSession(s)}
                            className={["card card-hover rounded-2xl overflow-hidden cursor-pointer tap-feedback", rpeNeeded ? "border-2 border-amber-300" : ""].join(" ")}>
                            <div className="px-4 py-2.5 flex items-center justify-between"
                              style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                              <div className="flex items-center gap-2">
                                <span className="text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{ background: c.border, color: "white" }}>
                                  {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                                </span>
                                {s.pdfUrl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">📄 PDF</span>}
                              </div>
                              <span className={["text-[10px] font-bold px-2.5 py-1 rounded-full",
                                st === "done" ? "bg-emerald-100 text-emerald-700" : st === "partial" ? "bg-amber-100 text-amber-700" :
                                st === "none" ? "bg-red-100 text-red-700" : "bg-white/70 text-slate-500"].join(" ")}>
                                {st === "done" ? "✅ Faite" : st === "partial" ? "🟡 Partielle" : st === "none" ? "❌ Absent" : "🔵 Prévue"}
                              </span>
                            </div>
                            <div className="px-4 py-3.5 bg-white">
                              <p className="text-[15px] font-black text-slate-800 leading-tight mb-1.5">{s.title}</p>
                              <div className="flex items-center gap-3 text-[11.5px] text-slate-400">
                                <span className="flex items-center gap-1"><Clock size={11} /> {s.time}</span>
                                {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                                {val?.rpe != null && <span className="font-bold text-slate-600">RPE {val.rpe}/10</span>}
                              </div>
                              {s.instructions && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mt-2 line-clamp-2">💬 {s.instructions}</p>}
                              {rpeNeeded && <p className="text-[11px] font-bold text-amber-600 mt-2">⏳ RPE en attente · Valide ta séance</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VUE MOIS */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-7 mb-2">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-wider py-1.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {calDays.map(({ date, cur }, idx) => {
              const key     = date.toISOString().slice(0, 10);
              const ds      = sessionsByDate[key] ?? [];
              const isToday = isSameDay(date, today);
              const isSel   = selectedDate && isSameDay(date, selectedDate);
              return (
                <div key={idx}
                  onClick={() => { setSelectedDate(date); if (window.innerWidth < 768) setViewMode("week"); }}
                  className={["min-h-[52px] md:min-h-[90px] rounded-xl md:rounded-2xl p-1 md:p-2 cursor-pointer transition-all border",
                    isToday ? "bg-emerald-50 border-emerald-300 border-2 shadow-sm"
                      : isSel ? "bg-blue-50 border-blue-300 border-2"
                      : cur   ? "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                      : "bg-slate-50/30 border-transparent opacity-35"].join(" ")}>
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-[11px] md:text-[13px] font-black w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-xl"
                      style={isToday ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" } : { color: cur ? "#334155" : "#94a3b8" }}>
                      {date.getDate()}
                    </span>
                    {ds.length > 0 && (
                      <div className="md:hidden flex flex-wrap gap-0.5 justify-end mt-1">
                        {ds.slice(0, 3).map(s => (
                          <div key={s.id} className="w-1.5 h-1.5 rounded-full"
                            style={{ background: (SESSION_COLORS_PLANNING[s.category] ?? SESSION_COLORS_PLANNING.technique).border }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block space-y-0.5">
                    {ds.slice(0, 3).map(s => {
                      const cc  = SESSION_COLORS_PLANNING[s.category] ?? SESSION_COLORS_PLANNING.technique;
                      const val = s.validations?.find(v => v.athleteId === athlete.id);
                      const st  = val?.status ?? "future";
                      return (
                        <div key={s.id} onClick={e => { e.stopPropagation(); setActiveSession(s); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9.5px] font-bold cursor-pointer hover:opacity-80 truncate"
                          style={{ background: cc.bg, color: cc.text, borderLeft: `2.5px solid ${cc.border}` }}>
                          <span className="truncate flex-1">{s.title}</span>
                          {st === "done" && <span>✅</span>}
                          {st === "none" && <span>❌</span>}
                        </div>
                      );
                    })}
                    {ds.length > 3 && <p className="text-[9px] text-slate-400 font-semibold px-1">+{ds.length - 3}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDate && (() => {
            const key = selectedDate.toISOString().slice(0, 10);
            const ds  = (sessionsByDate[key] ?? []).sort((a, b) => a.time.localeCompare(b.time));
            if (!ds.length) return null;
            return (
              <div className="mt-4 space-y-2">
                <p className="text-[12px] font-bold text-slate-500 mb-2">
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {ds.map(s => {
                  const c   = SESSION_COLORS_PLANNING[s.category] ?? SESSION_COLORS_PLANNING.technique;
                  const val = s.validations?.find(v => v.athleteId === athlete.id);
                  const st  = val?.status ?? "future";
                  return (
                    <div key={s.id} onClick={() => setActiveSession(s)}
                      className="card card-hover rounded-2xl overflow-hidden cursor-pointer tap-feedback">
                      <div className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                        <span className="text-[10px] font-black uppercase" style={{ color: c.text }}>
                          {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                        </span>
                        <span className={["text-[9px] font-bold px-2 py-0.5 rounded-full",
                          st === "done" ? "bg-emerald-100 text-emerald-700" : st === "none" ? "bg-red-100 text-red-700" : "bg-white/70 text-slate-500"].join(" ")}>
                          {st === "done" ? "✅" : st === "none" ? "❌" : "🔵 Prévue"}
                        </span>
                      </div>
                      <div className="px-4 py-3 bg-white">
                        <p className="text-[13px] font-bold text-slate-800">{s.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.time}{s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* VUE SEMAINE */}
      {viewMode === "week" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex overflow-x-auto gap-2 px-3 py-3 bg-white border-b border-slate-100 scrollbar-hide flex-shrink-0">
            {weekDays.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isSel   = isSameDay(date, selectedDate ?? today);
              const hasSess = (sessionsByDate[date.toISOString().slice(0, 10)] ?? []).length > 0;
              return (
                <button key={i} onClick={() => setSelectedDate(date)}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 w-11 py-2 rounded-2xl transition-all tap-feedback"
                  style={isToday ? { background: "linear-gradient(135deg, #1D9E75, #16826C)" } : isSel ? { background: "#1e293b" } : {}}>
                  <span className={["text-[9px] font-black uppercase", (isToday || isSel) ? "text-white/70" : "text-slate-400"].join(" ")}>{DAYS_SHORT[i]}</span>
                  <span className={["text-[17px] font-black", (isToday || isSel) ? "text-white" : "text-slate-700"].join(" ")}>{date.getDate()}</span>
                  {hasSess && <div className={["w-1.5 h-1.5 rounded-full", (isToday || isSel) ? "bg-white/60" : "bg-emerald-400"].join(" ")} />}
                </button>
              );
            })}
          </div>
          <div className="p-3 space-y-2">
            {(() => {
              const key     = (selectedDate ?? today).toISOString().slice(0, 10);
              const ds      = (sessionsByDate[key] ?? []).sort((a, b) => a.time.localeCompare(b.time));
              const dateObj = selectedDate ?? today;
              const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));
              if (ds.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
                  <CalendarDays size={32} strokeWidth={1.5} />
                  <p className="text-[13px] font-semibold">Repos ce jour</p>
                  <button onClick={() => setShowCreate(true)} className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                    + Planifier une séance
                  </button>
                </div>
              );
              return ds.map(s => {
                const c   = SESSION_COLORS_PLANNING[s.category] ?? SESSION_COLORS_PLANNING.technique;
                const val = s.validations?.find(v => v.athleteId === athlete.id);
                const st  = val?.status ?? "future";
                const rpeNeeded = isPast && val?.rpe == null && st !== "none" && st !== "future";
                return (
                  <div key={s.id} onClick={() => setActiveSession(s)}
                    className={["card card-hover rounded-2xl overflow-hidden cursor-pointer tap-feedback", rpeNeeded ? "border-2 border-amber-300" : ""].join(" ")}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: c.bg, borderBottom: `1.5px solid ${c.border}` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: c.border, color: "white" }}>
                          {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                        </span>
                        {s.pdfUrl && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">📄</span>}
                      </div>
                      <span className={["text-[10px] font-bold px-2.5 py-1 rounded-full",
                        st === "done" ? "bg-emerald-100 text-emerald-700" : st === "partial" ? "bg-amber-100 text-amber-700" :
                        st === "none" ? "bg-red-100 text-red-700" : "bg-white/70 text-slate-500"].join(" ")}>
                        {st === "done" ? "✅ Faite" : st === "partial" ? "🟡 Partielle" : st === "none" ? "❌ Absent" : "🔵 Prévue"}
                      </span>
                    </div>
                    <div className="px-4 py-4 bg-white">
                      <p className="text-[16px] font-black text-slate-800 leading-tight mb-1.5">{s.title}</p>
                      <div className="flex items-center gap-3 text-[12px] text-slate-400 mb-2">
                        <span className="flex items-center gap-1"><Clock size={12} /> {s.time}</span>
                        {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                        {val?.rpe != null && <span className="font-bold text-slate-600">RPE {val.rpe}/10</span>}
                      </div>
                      {s.instructions && <p className="text-[11.5px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-2 line-clamp-2">💬 {s.instructions}</p>}
                      {s.pdfUrl && (
                        <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                          📄 Voir le PDF
                        </a>
                      )}
                      {rpeNeeded && <p className="text-[11.5px] font-bold text-amber-600 mt-2">⏳ Valide ta séance</p>}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {liveActive && (
        <SessionDetailModal session={liveActive} athlete={athlete}
          onClose={() => setActiveSession(null)}
          onSetStatus={onStatusChange} onSetRpe={onRpeChange}
          onSetFeeling={onFeelingChange} onSetComment={onCommentChange}
        />
      )}
      {showCreate && (
        <CreateSessionModal athlete={athlete} allAthletes={allAthletes}
          clubId={clubId} createdBy={createdBy} coachUserId={coachUserId}
          onClose={() => setShowCreate(false)} onCreated={onRefresh}
        />
      )}
    </div>
  );
}