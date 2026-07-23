// ============================================================
// AthleteOS — src/modules/Planning.jsx  ★ DESIGN PREMIUM DARK
// Rendu adapté au dark mode : plus de bg-white / text-slate-*
// hardcodés. Couleurs de catégorie recalibrées pour rester
// lisibles et subtiles sur fond sombre (fill faible opacité +
// texte clair teinté, jamais blanc pur sur noir).
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X,
  Clock, Users, FileText, AlertCircle,
  CheckCircle, AlertTriangle, XCircle, CalendarDays,
  Star, Zap,
} from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { LOAD_COEFFICIENTS } from "../utils/trainingLoad";
import {
  alertSessionAbsence,
  notifyAthleteNewSession,
} from "../utils/notifications";

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS_FR    = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTHS_FR  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const CATEGORIES = [
  { id: "sprint",       label: "Sprint"       },
  { id: "haies",        label: "Haies"        },
  { id: "force",        label: "Musculation"  },
  { id: "saut",         label: "Saut"         },
  { id: "lancer",       label: "Lancer"       },
  { id: "endurance",    label: "Endurance"    },
  { id: "technique",    label: "Technique"    },
  { id: "mobilite",     label: "Mobilité"     },
  { id: "recuperation", label: "Récupération" },
];

// Couleurs recalibrées pour le dark mode :
// - border = teinte saturée (accent visible)
// - text   = version claire de la teinte (lisible sur fond sombre)
// - bg     = utilisé uniquement en superposition ${border}1A/${border}22 (opacité faible)
const SESSION_COLORS = {
  sprint:       { border: "#5B9EF5", text: "#A9CBFB", dot: "#5B9EF5" },
  haies:        { border: "#A78BFA", text: "#D2C4FB", dot: "#A78BFA" },
  force:        { border: "#34D399", text: "#9CF0D1", dot: "#34D399" },
  saut:         { border: "#C084FC", text: "#E3C6FD", dot: "#C084FC" },
  lancer:       { border: "#FB923C", text: "#FDCBA0", dot: "#FB923C" },
  endurance:    { border: "#38BDF8", text: "#A6E4FC", dot: "#38BDF8" },
  technique:    { border: "#94A3B8", text: "#D3D9E0", dot: "#94A3B8" },
  mobilite:     { border: "#EAB308", text: "#F7DD8B", dot: "#EAB308" },
  recuperation: { border: "#64748B", text: "#C2C9D2", dot: "#64748B" },
};

const EMPTY_FORM = {
  title: "", type: "Sprint", category: "sprint",
  day: "Lundi", time: "10:00", durationMinutes: 60,
  description: "", instructions: "", athleteIds: [], sessionDate: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d - jan4) / (7 * 24 * 60 * 60 * 1000));
}

function parseLocalDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToISOWeek(s) { return getISOWeek(parseLocalDate(s)); }
function dateToDayName(s) { return DAYS_FR[(parseLocalDate(s).getDay()+6)%7]; }

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function sessionStatus(session) {
  const { validations, athleteIds } = session;
  if (!validations?.length) return "future";
  const done    = validations.filter(v => v.status === "done").length;
  const none    = validations.filter(v => v.status === "none").length;
  if (done === athleteIds.length && athleteIds.length > 0) return "done";
  if (none === athleteIds.length && athleteIds.length > 0) return "none";
  if (validations.filter(v => v.status === "partial").length > 0 || (done > 0 && done < athleteIds.length)) return "partial";
  return "future";
}

function colors(category) {
  return SESSION_COLORS[category] ?? SESSION_COLORS.technique;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  for (let d = 1; d <= lastDay.getDate(); d++) days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  return days;
}

// ─── Statuts génériques (couleurs identiques quel que soit le thème) ─────────
const STATUS_COLORS = {
  done:    "#3DBE8B",
  partial: "#EAB308",
  none:    "#EF6B6B",
};

function StatusIcon({ status, size = 14 }) {
  if (status === "done")    return <CheckCircle   size={size} color={STATUS_COLORS.done} />;
  if (status === "partial") return <AlertTriangle size={size} color={STATUS_COLORS.partial} />;
  if (status === "none")    return <XCircle       size={size} color={STATUS_COLORS.none} />;
  return null;
}

function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     bg: "rgba(61,190,139,0.14)", color: "#7BD8B4" },
    partial: { label: "Partielle",    bg: "rgba(234,179,8,0.14)",  color: "#F0CB61" },
    none:    { label: "Non réalisée", bg: "rgba(239,107,107,0.14)",color: "#F19A9A" },
  };
  const b = map[status] ?? { label: "À venir", bg: "var(--c-surface-3)", color: "var(--c-text-3)" };
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: b.bg, color: b.color }}
    >
      {b.label}
    </span>
  );
}

// ─── SessionModal premium (dark) ──────────────────────────────────────────────

const SessionModal = memo(({ session, athletes, onClose, onSetRpe, onSetStatus, onEditRequest, onDeleteSession }) => {
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const c      = colors(session.category);
  const status = sessionStatus(session);

  const dateStr = session.sessionDate
    ? new Date(session.sessionDate).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : `${session.day} · S${session.week}`;

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDeleteSession(session.id); onClose(); }
    catch { setDeleteError("Impossible de supprimer."); setDeleting(false); }
  };

  const pendingFeedback = session.athleteIds.filter(id => {
    const v = session.validations?.find(val => val.athleteId === id);
    return v?.status == null;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré — fill faible opacité, pas de blanc */}
        <div
          className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: `${c.border}14`, borderBottom: `2px solid ${c.border}40` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: c.border, color: "#0A150F" }}
              >
                {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
              </span>
              {session.createdByAthlete && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                  📋 Proposé par un athlète
                </span>
              )}
              <StatusIcon status={status} size={14} />
            </div>
            <h3 className="text-[20px] font-black leading-tight" style={{ color: c.text }}>
              {session.title}
            </h3>
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: "var(--c-text-2)" }}>
              📅 {dateStr}
              {session.time && ` · ⏰ ${session.time}`}
              {session.durationMinutes && ` · ${session.durationMinutes} min`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 transition-colors"
            style={{ background: "transparent" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Feedback rapide */}
          {pendingFeedback.length > 0 && (
            <div className="rounded-2xl border overflow-hidden"
              style={{ borderColor: "rgba(234,179,8,0.35)", background: "rgba(234,179,8,0.06)" }}>
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(234,179,8,0.18)" }}>
                  <Zap size={13} color="#EAB308" />
                </div>
                <p className="text-[13px] font-bold" style={{ color: "#F0CB61" }}>Confirmer les présences</p>
              </div>
              <div className="p-4 space-y-5">
                {pendingFeedback.map(id => {
                  const a = athletes.find(x => x.id === id);
                  const v = session.validations?.find(val => val.athleteId === id);
                  if (!a) return null;
                  return (
                    <div key={id}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{ background: c.border, color: "#0A150F" }}>
                          {a.avatar?.slice(0,1) ?? "?"}
                        </div>
                        <p className="text-[12.5px] font-bold" style={{ color: "#F0CB61" }}>{a.name.split(" ")[0]}</p>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {[
                          { id: "done",    label: "✅ Réalisée",  bg: "rgba(61,190,139,0.16)", border: "#3DBE8B", color: "#7BD8B4" },
                          { id: "partial", label: "🟡 Partielle", bg: "rgba(234,179,8,0.16)",  border: "#EAB308", color: "#F0CB61" },
                          { id: "none",    label: "❌ Absent",    bg: "rgba(239,107,107,0.16)",border: "#EF6B6B", color: "#F19A9A" },
                        ].map(opt => {
                          const sel = v?.status === opt.id;
                          return (
                            <button key={opt.id}
                              onClick={() => onSetStatus(session.id, id, opt.id)}
                              className="flex-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all tap-feedback"
                              style={sel
                                ? { background: opt.bg, borderColor: opt.border, color: opt.color }
                                : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {v?.status && v.status !== "none" && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--c-text-3)" }}>RPE</p>
                          <div className="flex gap-1 flex-wrap">
                            {Array.from({ length: 11 }, (_, i) => {
                              const sel = v?.rpe === i;
                              const rpeColor = i <= 3 ? "#3DBE8B" : i <= 6 ? "#EAB308" : "#EF6B6B";
                              return (
                                <button key={i} onClick={() => onSetRpe(session.id, id, i)}
                                  className="w-8 h-8 rounded-xl text-[11px] font-black border-2 transition-all tap-feedback"
                                  style={sel
                                    ? { background: rpeColor, borderColor: rpeColor, color: "#0A150F" }
                                    : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
                                >{i}</button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div className="rounded-2xl p-4" style={{ background: "var(--c-surface-2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: "var(--c-text-3)" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>Description</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--c-text-2)" }}>{session.description}</p>
            </div>
          )}

          {/* Consignes */}
          {session.instructions && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(234,179,8,0.30)", background: "rgba(234,179,8,0.06)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(234,179,8,0.20)" }}>
                <AlertCircle size={13} color="#EAB308" />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#F0CB61" }}>Consignes du coach</span>
              </div>
              <p className="px-4 py-3 text-[13px] leading-relaxed" style={{ color: "#E6D189" }}>{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <a href={session.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-semibold transition-colors"
              style={{ background: "rgba(91,158,245,0.10)", border: "1px solid rgba(91,158,245,0.25)", color: "#A9CBFB" }}>
              <span className="text-[18px]">📄</span>
              Voir le PDF de séance
            </a>
          )}

          {/* Athlètes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} style={{ color: "var(--c-text-3)" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--c-text-3)" }}>
                Participants ({session.athleteIds.length})
              </span>
            </div>
            {session.athleteIds.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--c-text-4)" }}>Aucun athlète assigné</p>
            ) : (
              <div className="space-y-2">
                {session.athleteIds.map(id => {
                  const a  = athletes.find(x => x.id === id);
                  const v  = session.validations?.find(val => val.athleteId === id);
                  const st = v?.status ?? "future";
                  if (!a) return null;
                  return (
                    <div key={id} className="card flex items-start gap-3 p-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: c.border, color: "#0A150F" }}>
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[13px] font-bold" style={{ color: "var(--c-text-1)" }}>{a.name}</span>
                          <ValidationBadge status={st} />
                          {v?.rpe != null && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>
                              RPE {v.rpe}
                            </span>
                          )}
                        </div>
                        {v?.feeling != null && (
                          <div className="flex gap-0.5 mb-1">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={11}
                                fill={v.feeling >= n ? "#EAB308" : "none"}
                                color={v.feeling >= n ? "#EAB308" : "var(--c-border-strong)"} />
                            ))}
                          </div>
                        )}
                        {v?.comment && (
                          <p className="text-[11.5px] italic" style={{ color: "var(--c-text-3)" }}>« {v.comment} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {deleteError && (
            <p className="text-[12px] rounded-xl px-3 py-2" style={{ color: "#F19A9A", background: "rgba(239,107,107,0.10)" }}>{deleteError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} disabled={deleting}
                className="text-[12px] font-semibold transition-colors"
                style={{ color: "#F19A9A" }}>
                Supprimer
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-[11px] font-bold rounded-lg px-2.5 py-1 tap-feedback"
                  style={{ background: "#EF6B6B", color: "#0A150F" }}>
                  {deleting ? "…" : "Oui"}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-[11px]" style={{ color: "var(--c-text-3)" }}>Non</button>
              </span>
            )}
          </div>
          <button onClick={() => onEditRequest(session)} className="btn-primary">
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── AddSessionModal premium (dark) ───────────────────────────────────────────

const AddSessionModal = memo(({ athletes, initialData, onClose, onAdd }) => {
  const isEdit = !!initialData;
  const today  = new Date().toISOString().split("T")[0];
  const [form, setForm]             = useState(initialData ?? { ...EMPTY_FORM, sessionDate: today });
  const [saving, setSaving]         = useState(false);
  const [pdfFile, setPdfFile]       = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const set = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);
  const toggleAthlete = useCallback(id => {
    setForm(f => ({
      ...f,
      athleteIds: f.athleteIds.includes(id)
        ? f.athleteIds.filter(x => x !== id)
        : [...f.athleteIds, id],
    }));
  }, []);

  const handleSubmit = async () => {
    if (!form.title.trim() || form.athleteIds.length === 0) return;
    setSaving(true);
    try {
      let pdfUrl = form.pdfUrl ?? null;
      if (pdfFile) {
        setUploadingPdf(true);
        const ext  = pdfFile.name.split(".").pop();
        const path = `session-pdfs/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("session-pdfs").upload(path, pdfFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("session-pdfs").getPublicUrl(path);
        pdfUrl = urlData?.publicUrl ?? null;
        setUploadingPdf(false);
      }
      const chosenDate = form.sessionDate || today;
      await onAdd({
        ...form,
        week:        dateToISOWeek(chosenDate),
        day:         dateToDayName(chosenDate),
        type:        CATEGORIES.find(c => c.id === form.category)?.label ?? form.category,
        pdfUrl,
        sessionDate: chosenDate,
      });
      onClose();
    } catch (err) {
      console.error("Erreur ajout séance :", err);
      setSaving(false);
      setUploadingPdf(false);
    }
  };

  const selCat = SESSION_COLORS[form.category] ?? SESSION_COLORS.technique;
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider mb-1.5";
  const labelStyle = { color: "var(--c-text-3)" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        <div
          className="px-6 py-5 flex items-center justify-between flex-shrink-0 transition-colors"
          style={{ background: `${selCat.border}14`, borderBottom: `1px solid ${selCat.border}40` }}
        >
          <div>
            <h3 className="text-[17px] font-black" style={{ color: selCat.text }}>
              {isEdit ? "Modifier la séance" : "Nouvelle séance"}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-2)" }}>
              {isEdit ? "Modifie les détails" : "Planifie un entraînement"}
            </p>
          </div>
          <button onClick={onClose} disabled={saving}
            className="p-2 rounded-xl disabled:opacity-40 transition-colors">
            <X size={18} style={{ color: selCat.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <div>
            <label className={labelCls} style={labelStyle}>Titre *</label>
            <input className="input-premium" placeholder="Ex: Sprint — sorties de blocs"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => {
                const cc  = SESSION_COLORS[cat.id];
                const sel = form.category === cat.id;
                return (
                  <button key={cat.id} onClick={() => set("category", cat.id)}
                    className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold border-2 transition-all tap-feedback"
                    style={sel
                      ? { background: cc.border, color: "#0A150F", borderColor: cc.border }
                      : { background: `${cc.border}14`, color: cc.text, borderColor: `${cc.border}40` }
                    }>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Date *</label>
              <input type="date" className="input-premium"
                value={form.sessionDate} onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Heure</label>
              <input type="time" className="input-premium"
                value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Durée (minutes)</label>
            <input type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes} onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Description</label>
            <textarea className="input-premium resize-none" rows={3}
              placeholder="Volume, intensité, objectifs…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Consignes spécifiques</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Instructions particulières…"
              value={form.instructions} onChange={e => set("instructions", e.target.value)} />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>PDF (optionnel)</label>
            {isEdit && form.pdfUrl && !pdfFile && (
              <p className="text-[11px] mb-1.5" style={{ color: "#7BD8B4" }}>📎 PDF déjà joint</p>
            )}
            <input type="file" accept="application/pdf"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              className="w-full text-[12px] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11.5px] file:font-semibold"
              style={{ color: "var(--c-text-3)" }} />
            {pdfFile && <p className="text-[11px] mt-1" style={{ color: "var(--c-text-3)" }}>📎 {pdfFile.name}</p>}
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>
              Athlètes * ({form.athleteIds.length} sélectionné{form.athleteIds.length > 1 ? "s" : ""})
            </label>
            {athletes.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--c-text-4)" }}>Aucun athlète disponible</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {athletes.map(a => {
                  const sel = form.athleteIds.includes(a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggleAthlete(a.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback"
                      style={sel
                        ? { background: "rgba(29,158,117,0.14)", borderColor: "#1D9E75", color: "#7BD8B4" }
                        : { background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ background: sel ? "#1D9E75" : "var(--c-surface-3)", color: sel ? "#0A150F" : "var(--c-text-3)" }}>
                        {a.avatar?.slice(0, 1) ?? "?"}
                      </div>
                      {a.name.split(" ")[0]}
                      {sel && <CheckCircle size={12} color="#3DBE8B" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">
            Annuler
          </button>
          <button onClick={handleSubmit}
            disabled={!form.title.trim() || form.athleteIds.length === 0 || saving}
            className="btn-primary">
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {uploadingPdf ? "Envoi PDF…" : "Enregistrement…"}</>
            ) : (
              <><Plus size={15} />{isEdit ? "Enregistrer" : "Ajouter"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────

function Planning() {
  const { clubId } = useAuth();
  const today   = new Date();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode,  setViewMode]  = useState(isMobile ? "week" : "month");

  const [athletes,           setAthletes]           = useState([]);
  const [sessionList,        setSessionList]         = useState([]);
  const [activeSession,      setActiveSession]       = useState(null);
  const [sessionModalTarget, setSessionModalTarget]  = useState(null);
  const [selectedDate,       setSelectedDate]        = useState(null);
  const [filterMode,         setFilterMode]          = useState("all");
  const [loading,            setLoading]             = useState(true);
  const [error,              setError]               = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes] = await Promise.all([
        supabase.from("athletes").select("id, name, main_discipline, profile_data").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const sessionIds = sessionsRes.data.map(s => s.id);
      const saRes = sessionIds.length
        ? await supabase.from("session_athletes").select("*").in("session_id", sessionIds)
        : { data: [], error: null };
      if (saRes.error) throw saRes.error;

      setAthletes(athletesRes.data.map(a => ({
        id: a.id, name: a.name, mainDiscipline: a.main_discipline,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
      })));

      setSessionList(sessionsRes.data.map(s => {
        const rows = saRes.data.filter(v => v.session_id === s.id);
        return {
          id: s.id, week: s.week, day: s.day,
          sessionDate:     s.session_date,
          time:            s.time,
          type:            s.type,
          category:        s.category,
          title:           s.title,
          description:     s.description,
          instructions:    s.instructions,
          durationMinutes: s.duration_minutes,
          pdfUrl:          s.pdf_url,
          createdBy:       s.created_by,
          createdByAthlete: s.created_by != null && !athletesRes.data.every(a => a.id !== s.created_by),
          athleteIds:  rows.map(v => v.athlete_id),
          validations: rows.map(v => ({
            athleteId: v.athlete_id, status: v.status,
            feeling: v.feeling, fatigue: v.fatigue,
            comment: v.comment, rpe: v.rpe,
          })),
        };
      }));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures ════════════════════════════════════════════════════════════

  const addSession = useCallback(async (form) => {
    const { data: newSession, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        club_id: clubId, week: form.week, day: form.day,
        session_date: form.sessionDate, time: form.time,
        type: form.type, category: form.category, title: form.title,
        description: form.description || null,
        instructions: form.instructions || null,
        duration_minutes: form.durationMinutes,
        load_weight: LOAD_COEFFICIENTS[form.category] ?? 1.0,
        pdf_url: form.pdfUrl ?? null,
      })
      .select().single();
    if (sessionError) throw sessionError;

    const { error: linkErr } = await supabase.from("session_athletes").insert(
      form.athleteIds.map(id => ({ session_id: newSession.id, athlete_id: id, status: null, feeling: null, fatigue: null, comment: null }))
    );
    if (linkErr) throw linkErr;

    await notifyAthleteNewSession(clubId, form.athleteIds, { title: form.title, sessionDate: form.sessionDate, day: form.day });
    await fetchAll();
  }, [clubId, fetchAll]);

  const updateSession = useCallback(async (sessionId, form) => {
    const { error: sessionError } = await supabase.from("sessions").update({
      week: form.week, day: form.day, session_date: form.sessionDate,
      time: form.time, type: form.type, category: form.category, title: form.title,
      description: form.description || null, instructions: form.instructions || null,
      duration_minutes: form.durationMinutes,
      load_weight: LOAD_COEFFICIENTS[form.category] ?? 1.0,
      pdf_url: form.pdfUrl ?? null,
    }).eq("id", sessionId);
    if (sessionError) throw sessionError;

    const existing    = sessionList.find(s => s.id === sessionId);
    const previousIds = existing?.athleteIds ?? [];
    const toAdd       = form.athleteIds.filter(id => !previousIds.includes(id));
    const toRemove    = previousIds.filter(id => !form.athleteIds.includes(id));
    if (toAdd.length)    { const { error: e } = await supabase.from("session_athletes").insert(toAdd.map(id => ({ session_id: sessionId, athlete_id: id, status: null, feeling: null, fatigue: null, comment: null, rpe: null }))); if (e) throw e; }
    if (toRemove.length) { const { error: e } = await supabase.from("session_athletes").delete().eq("session_id", sessionId).in("athlete_id", toRemove); if (e) throw e; }
    await fetchAll();
  }, [fetchAll, sessionList]);

  const deleteSession = useCallback(async (sessionId) => {
    await supabase.from("session_athletes").delete().eq("session_id", sessionId);
    const { error: e } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (e) throw e;
    await fetchAll();
  }, [fetchAll]);

  const setRpe = useCallback(async (sessionId, athleteId, rpe) => {
    setSessionList(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s, validations: s.validations.map(v => v.athleteId === athleteId ? { ...v, rpe } : v),
    }));
    await supabase.from("session_athletes").update({ rpe }).eq("session_id", sessionId).eq("athlete_id", athleteId);
  }, []);

  const setStatus = useCallback(async (sessionId, athleteId, status) => {
    setSessionList(prev => prev.map(s => s.id !== sessionId ? s : {
      ...s, validations: s.validations.map(v => v.athleteId === athleteId ? { ...v, status } : v),
    }));
    const { error: updateErr } = await supabase.from("session_athletes").update({ status })
      .eq("session_id", sessionId).eq("athlete_id", athleteId);
    if (updateErr) { fetchAll(); return; }
    if (status === "none") {
      const session = sessionList.find(s => s.id === sessionId);
      const athlete = athletes.find(a => a.id === athleteId);
      if (session && athlete) await alertSessionAbsence(clubId, athlete, session);
    }
  }, [fetchAll, sessionList, athletes, clubId]);

  // ═══ Dérivés calendrier ═══════════════════════════════════════════════════

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const filteredSessions = useMemo(() => {
    if (filterMode === "athlete") return sessionList.filter(s => s.createdByAthlete);
    if (filterMode === "coach")   return sessionList.filter(s => !s.createdByAthlete);
    return sessionList;
  }, [sessionList, filterMode]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    filteredSessions.forEach(s => {
      if (!s.sessionDate) return;
      const key = s.sessionDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [filteredSessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return (sessionsByDate[selectedDate.toISOString().slice(0, 10)] ?? [])
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, sessionsByDate]);

  const weekDays = useMemo(() => {
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };
  const prevWeek = () => {
    const d = new Date(selectedDate ?? today);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };
  const nextWeek = () => {
    const d = new Date(selectedDate ?? today);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  };

  const liveActiveSession = activeSession
    ? sessionList.find(s => s.id === activeSession.id) ?? activeSession
    : null;

  function buildFormFromSession(s) {
    return {
      title: s.title, type: s.type, category: s.category,
      day: s.day, time: s.time, week: s.week,
      durationMinutes: s.durationMinutes ?? 60,
      description: s.description ?? "", instructions: s.instructions ?? "",
      athleteIds: s.athleteIds, pdfUrl: s.pdfUrl ?? null,
      sessionDate: s.sessionDate?.slice(0, 10) ?? "",
    };
  }

  const navLabel = useMemo(() => {
    if (viewMode === "month") return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  // ═══ Render ═══════════════════════════════════════════════════════════════

  if (loading) return <LoadingState message="Chargement du planning…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const athleteSessionCount = sessionList.filter(s => s.createdByAthlete).length;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

      {/* ── Header glassmorphism ─────────────────────────────────────────── */}
      <div className="header-glass px-3 md:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-10">

        <div className="flex items-center gap-1">
          <button
            onClick={viewMode === "month" ? prevMonth : prevWeek}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all tap-feedback"
            style={{ color: "var(--c-text-2)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center px-1 min-w-[110px] md:min-w-[160px]">
            <p className="text-[14px] md:text-[16px] font-black tracking-tight truncate" style={{ color: "var(--c-text-1)" }}>
              {navLabel}
            </p>
          </div>
          <button
            onClick={viewMode === "month" ? nextMonth : nextWeek}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all tap-feedback"
            style={{ color: "var(--c-text-2)" }}
          >
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday}
            className="px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-bold transition-all ml-1"
            style={{ border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
            Auj.
          </button>
        </div>

        <div className="flex items-center gap-1.5">

          {/* Toggle vue */}
          <div className="flex rounded-xl overflow-hidden text-[10px] md:text-[11px] font-bold" style={{ border: "1px solid var(--c-border)" }}>
            {[
              { id: "month", label: "Mois" },
              { id: "week",  label: "Sem." },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className="px-2.5 md:px-3 py-1.5 transition-colors"
                style={viewMode === v.id
                  ? { background: "#1D9E75", color: "#0A150F" }
                  : { background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Filtre séances athlètes — desktop */}
          {athleteSessionCount > 0 && (
            <div className="hidden lg:flex rounded-xl overflow-hidden text-[11px] font-bold" style={{ border: "1px solid var(--c-border)" }}>
              {[
                { id: "all",     label: "Toutes" },
                { id: "coach",   label: "Coach"  },
                { id: "athlete", label: `📋 ${athleteSessionCount}` },
              ].map(f => (
                <button key={f.id} onClick={() => setFilterMode(f.id)}
                  className="px-2.5 py-1.5 transition-colors"
                  style={filterMode === f.id
                    ? { background: "#1D9E75", color: "#0A150F" }
                    : { background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setSessionModalTarget("create")}
            disabled={athletes.length === 0}
            className="btn-primary disabled:opacity-40 !py-2 !px-3 md:!px-4"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 overflow-auto">

          {/* ── VUE SEMAINE ── */}
          {viewMode === "week" && (
            <div className="p-3 md:p-4 space-y-2">
              {weekDays.map((date, i) => {
                const key     = date.toISOString().slice(0, 10);
                const ds      = (sessionsByDate[key] ?? []).sort((a, b) => a.time.localeCompare(b.time));
                const isToday = isSameDay(date, today);
                const isPast  = date < new Date(today.toISOString().slice(0, 10));

                return (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden border transition-all"
                    style={isToday
                      ? { borderColor: "rgba(29,158,117,0.45)", boxShadow: "0 0 0 1px rgba(29,158,117,0.20)" }
                      : { borderColor: "var(--c-border)" }}
                  >
                    {/* Header jour */}
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: isToday ? "rgba(29,158,117,0.08)" : "var(--c-surface)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[16px] flex-shrink-0"
                          style={isToday
                            ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" }
                            : { background: "var(--c-surface-2)", color: isPast ? "var(--c-text-4)" : "var(--c-text-2)" }}
                        >
                          {date.getDate()}
                        </div>
                        <div>
                          <p className="text-[14px] font-black"
                            style={{ color: isToday ? "#3DBE8B" : isPast ? "var(--c-text-4)" : "var(--c-text-1)" }}>
                            {DAYS_FR[i]}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
                            {date.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ds.length > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={isToday
                              ? { background: "rgba(29,158,117,0.16)", color: "#7BD8B4" }
                              : { background: "var(--c-surface-2)", color: "var(--c-text-2)" }}>
                            {ds.length} séance{ds.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          onClick={() => { setSelectedDate(date); setSessionModalTarget("create"); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Séances du jour */}
                    {ds.length > 0 ? (
                      <div style={{ background: "var(--c-surface)" }}>
                        {ds.map((s, idx) => {
                          const c  = colors(s.category);
                          const st = sessionStatus(s);
                          const missingStatus = s.athleteIds.filter(id => {
                            const v = s.validations?.find(val => val.athleteId === id);
                            return v?.status == null;
                          }).length;

                          return (
                            <div
                              key={s.id}
                              onClick={() => setActiveSession(s)}
                              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors tap-feedback"
                              style={{ borderTop: idx > 0 ? "1px solid var(--c-border)" : "none" }}
                              onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: c.border }} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                                  {s.createdByAthlete && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                                      📋
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--c-text-3)" }}>
                                  <span
                                    className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
                                    style={{ background: `${c.border}1F`, color: c.text }}
                                  >
                                    {CATEGORIES.find(x => x.id === s.category)?.label}
                                  </span>
                                  <Clock size={10} />
                                  <span>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</span>
                                  {missingStatus > 0 && isPast && (
                                    <span className="font-bold" style={{ color: "#F0CB61" }}>· {missingStatus} en attente</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex -space-x-1">
                                  {s.athleteIds.slice(0, 3).map(id => {
                                    const a = athletes.find(x => x.id === id);
                                    return a ? (
                                      <div key={id}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold"
                                        style={{ background: c.border, color: "#0A150F", border: "2px solid var(--c-surface)" }}>
                                        {a.avatar?.slice(0, 1)}
                                      </div>
                                    ) : null;
                                  })}
                                  {s.athleteIds.length > 3 && (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold"
                                      style={{ background: "var(--c-surface-3)", color: "var(--c-text-3)", border: "2px solid var(--c-surface)" }}>
                                      +{s.athleteIds.length - 3}
                                    </div>
                                  )}
                                </div>
                                {s.pdfUrl && <span className="text-[12px]">📄</span>}
                                <StatusIcon status={st} size={16} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-3" style={{ background: "var(--c-surface)" }}>
                        <p className="text-[12px] font-medium" style={{ color: "var(--c-text-4)" }}>Repos</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VUE MOIS ── */}
          {viewMode === "month" && (
            <div className="p-2 md:p-4">
              <div className="grid grid-cols-7 mb-2">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-[9px] md:text-[11px] font-black uppercase tracking-wider py-1.5"
                    style={{ color: "var(--c-text-3)" }}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                  const key         = date.toISOString().slice(0, 10);
                  const daySessions = sessionsByDate[key] ?? [];
                  const isToday     = isSameDay(date, today);
                  const isSelected  = selectedDate && isSameDay(date, selectedDate);
                  const hasSessions = daySessions.length > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(date);
                        if (window.innerWidth < 768) setViewMode("week");
                      }}
                      className="min-h-[52px] md:min-h-[96px] rounded-xl md:rounded-2xl p-1 md:p-2 cursor-pointer transition-all border"
                      style={isToday
                        ? { background: "rgba(29,158,117,0.08)", borderColor: "rgba(29,158,117,0.45)", borderWidth: 2 }
                        : isSelected
                        ? { background: "rgba(91,158,245,0.08)", borderColor: "rgba(91,158,245,0.45)", borderWidth: 2 }
                        : isCurrentMonth
                        ? { background: "var(--c-surface)", borderColor: "var(--c-border)" }
                        : { background: "transparent", borderColor: "transparent", opacity: 0.35 }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-[11px] md:text-[13px] font-black w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-xl"
                          style={isToday
                            ? { background: "linear-gradient(135deg, #1D9E75, #16826C)", color: "white" }
                            : { color: isCurrentMonth ? "var(--c-text-1)" : "var(--c-text-4)" }}
                        >
                          {date.getDate()}
                        </span>
                        {hasSessions && (
                          <div className="md:hidden flex gap-0.5 mt-1 flex-wrap justify-end">
                            {daySessions.slice(0, 3).map(s => (
                              <div
                                key={s.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: colors(s.category).border }}
                                onClick={e => { e.stopPropagation(); setActiveSession(s); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="hidden md:block space-y-0.5">
                        {daySessions.slice(0, 3).map(s => {
                          const c  = colors(s.category);
                          const st = sessionStatus(s);
                          return (
                            <div
                              key={s.id}
                              onClick={e => { e.stopPropagation(); setActiveSession(s); }}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9.5px] font-bold cursor-pointer transition-opacity truncate"
                              style={{ background: `${c.border}1F`, color: c.text, borderLeft: `2.5px solid ${c.border}` }}
                            >
                              <span className="truncate flex-1">{s.title}</span>
                              {st !== "future" && <StatusIcon status={st} size={8} />}
                              {s.createdByAthlete && <span className="text-[8px]">📋</span>}
                            </div>
                          );
                        })}
                        {daySessions.length > 3 && (
                          <p className="text-[9px] font-semibold px-1" style={{ color: "var(--c-text-3)" }}>
                            +{daySessions.length - 3} autre{daySessions.length - 3 > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Panneau latéral desktop ──────────────────────────────────── */}
        {selectedDate && (
          <div className="hidden lg:flex w-80 flex-shrink-0 flex-col overflow-hidden"
            style={{ background: "var(--c-surface)", borderLeft: "1px solid var(--c-border)" }}>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
              <div className="flex items-center justify-between mb-0.5">
                <div>
                  <p className="text-[14px] font-black" style={{ color: "var(--c-text-1)" }}>
                    {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
                    {selectedDaySessions.length} séance{selectedDaySessions.length !== 1 ? "s" : ""} planifiée{selectedDaySessions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => setSelectedDate(null)}
                  className="p-1.5 rounded-xl transition-colors" style={{ color: "var(--c-text-3)" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedDaySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10" style={{ color: "var(--c-text-4)" }}>
                  <CalendarDays size={32} strokeWidth={1.5} />
                  <p className="text-[12px] text-center font-medium">Aucune séance ce jour</p>
                  <button onClick={() => setSessionModalTarget("create")}
                    className="text-[12px] font-semibold transition-colors" style={{ color: "#3DBE8B" }}>
                    + Planifier une séance
                  </button>
                </div>
              ) : (
                selectedDaySessions.map(s => {
                  const c  = colors(s.category);
                  const st = sessionStatus(s);
                  const missingStatus = s.athleteIds.filter(id => !s.validations?.find(val => val.athleteId === id)?.status).length;
                  const missingRpe    = s.athleteIds.filter(id => {
                    const v = s.validations?.find(val => val.athleteId === id);
                    return v?.status && v.status !== "none" && v?.rpe == null;
                  }).length;

                  return (
                    <div key={s.id} onClick={() => setActiveSession(s)}
                      className="card card-hover rounded-2xl overflow-hidden cursor-pointer">
                      <div className="px-3.5 py-2.5 flex items-center justify-between"
                        style={{ background: `${c.border}14`, borderBottom: `1.5px solid ${c.border}40` }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9.5px] font-black uppercase tracking-wider" style={{ color: c.text }}>
                            {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
                          </span>
                          {s.createdByAthlete && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(168,85,247,0.16)", color: "#D8B4FE" }}>
                              📋
                            </span>
                          )}
                        </div>
                        <StatusIcon status={st} size={12} />
                      </div>

                      <div className="px-3.5 py-3">
                        <p className="text-[13px] font-bold leading-tight mb-1.5" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                        <div className="flex items-center gap-2 text-[11px] mb-2" style={{ color: "var(--c-text-3)" }}>
                          <Clock size={10} />
                          <span>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</span>
                          {s.pdfUrl && <span style={{ color: "#A9CBFB" }}>📄</span>}
                        </div>

                        {missingStatus > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(239,107,107,0.10)", color: "#F19A9A" }}>
                            ❗ {missingStatus} présence{missingStatus > 1 ? "s" : ""} à confirmer
                          </div>
                        )}
                        {missingRpe > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-1 mb-1"
                            style={{ background: "rgba(234,179,8,0.10)", color: "#F0CB61" }}>
                            🔥 {missingRpe} RPE manquant{missingRpe > 1 ? "s" : ""}
                          </div>
                        )}

                        <div className="flex -space-x-1.5 mt-2">
                          {s.athleteIds.slice(0, 5).map(id => {
                            const a = athletes.find(x => x.id === id);
                            return a ? (
                              <div key={id} title={a.name}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold"
                                style={{ background: c.border, color: "#0A150F", border: "2px solid var(--c-surface)" }}>
                                {a.avatar?.slice(0, 1) ?? "?"}
                              </div>
                            ) : null;
                          })}
                          {s.athleteIds.length > 5 && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold"
                              style={{ background: "var(--c-surface-3)", color: "var(--c-text-3)", border: "2px solid var(--c-surface)" }}>
                              +{s.athleteIds.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
              <button
                onClick={() => setSessionModalTarget("create")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-bold transition-colors"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "#3DBE8B" }}
              >
                <Plus size={13} /> Ajouter une séance
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawer mobile — séances du jour ──────────────────────────────── */}
      {selectedDate && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 rounded-t-3xl shadow-2xl animate-slide-up"
          style={{ background: "var(--c-surface)", backdropFilter: "blur(20px)", maxHeight: "65vh", border: "1px solid var(--c-border)", borderBottom: "none" }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
          </div>

          <div className="flex flex-col" style={{ maxHeight: "calc(65vh - 20px)" }}>
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[14px] font-black" style={{ color: "var(--c-text-1)" }}>
                  {selectedDate.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
                  {selectedDaySessions.length} séance{selectedDaySessions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)}
                className="p-2 rounded-xl tap-feedback" style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
              {selectedDaySessions.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--c-text-4)" }}>
                  <CalendarDays size={28} className="mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-[12px]">Aucune séance ce jour</p>
                </div>
              ) : selectedDaySessions.map(s => {
                const c  = colors(s.category);
                const st = sessionStatus(s);
                return (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSession(s); setSelectedDate(null); }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer tap-feedback"
                    style={{ background: "var(--c-surface-2)", borderColor: c.border, borderWidth: "1.5px", borderStyle: "solid" }}
                  >
                    <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ background: c.border }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--c-text-1)" }}>{s.title}</p>
                      <p className="text-[11px]" style={{ color: "var(--c-text-3)" }}>{s.time}{s.durationMinutes ? ` · ${s.durationMinutes}min` : ""}</p>
                    </div>
                    <StatusIcon status={st} size={16} />
                  </div>
                );
              })}
            </div>

            <div className="p-4 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
              <button
                onClick={() => { setSessionModalTarget("create"); setSelectedDate(null); }}
                className="w-full py-3 rounded-2xl text-[13px] font-bold tap-feedback"
                style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)", color: "#3DBE8B" }}
              >
                <Plus size={14} className="inline mr-1.5" />
                Ajouter une séance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {liveActiveSession && (
        <SessionModal
          session={liveActiveSession}
          athletes={athletes}
          onClose={() => setActiveSession(null)}
          onSetRpe={setRpe}
          onSetStatus={setStatus}
          onEditRequest={s => { setSessionModalTarget(s); setActiveSession(null); }}
          onDeleteSession={deleteSession}
        />
      )}

      {sessionModalTarget && (
        <AddSessionModal
          athletes={athletes}
          initialData={sessionModalTarget === "create" ? null : buildFormFromSession(sessionModalTarget)}
          onClose={() => setSessionModalTarget(null)}
          onAdd={sessionModalTarget === "create" ? addSession : form => updateSession(sessionModalTarget.id, form)}
        />
      )}
    </div>
  );
}

export default memo(Planning);