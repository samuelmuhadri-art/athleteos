// ============================================================
// AthleteOS — src/athlete/views/AthletePlanning.jsx  ★ DESIGN PREMIUM DARK v2
//
// Logique métier 100% identique à l'original.
// Corrections apportées :
//   - CAT_COLORS : anciennes couleurs pastel "faites pour fond blanc"
//     remplacées par des accents vifs + fonds semi-transparents (rgba)
//     qui fonctionnent sur fond sombre.
//   - Toutes les modales (CreateSessionModal, SessionDetailModal) :
//     bg-white / text-slate-* / border-slate-* (littéraux, cassés en
//     dark) remplacés par les variables CSS var(--c-*) utilisées
//     partout ailleurs dans l'app (Dashboard, Planning coach, etc.)
//   - StatusBadge, boutons présence/RPE : passage en rgba() dark-safe.
// ============================================================

import { useState, useMemo, memo, useCallback } from "react";
import {
  Plus, ChevronLeft, ChevronRight, X, Clock, Star, CalendarDays,
  FileText, Users, AlertCircle, CheckCircle, Zap,
} from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage, alertAthleteSession } from "../../utils/notifications";
import {
  DAYS_SHORT, MONTHS_FR, CATEGORIES,
  isSameDay, dateToISOWeek, dateToDayName,
} from "../shared";

// ─── Palette catégories — accents vifs + fond rgba dark-safe ────────────────
const CAT_COLORS_RAW = {
  sprint:       "#5B9EF5",
  haies:        "#A78BFA",
  force:        "#34D399",
  saut:         "#C084FC",
  lancer:       "#FB923C",
  endurance:    "#38BDF8",
  technique:    "#94A3B8",
  mobilite:     "#EAB308",
  recuperation: "#64748B",
};
function cat(key) {
  const border = CAT_COLORS_RAW[key] ?? CAT_COLORS_RAW.technique;
  return {
    border,
    text: border,
    bg: `${border}1F`,   // ~12% opacité — fond doux sur dark
    glow: `${border}33`, // ~20% opacité — pour box-shadow
  };
}

// ─── Helper : badge statut ────────────────────────────────────────────────────
function StatusBadge({ status, size = "sm" }) {
  const cfg = {
    done:    { label: "Réalisée",  bg: "rgba(61,190,139,0.16)",  color: "#7BD8B4", dot: "#3DBE8B" },
    partial: { label: "Partielle", bg: "rgba(234,179,8,0.16)",   color: "#F0CB61", dot: "#EAB308" },
    none:    { label: "Absent",    bg: "rgba(239,107,107,0.16)", color: "#F19A9A", dot: "#EF6B6B" },
    future:  { label: "Prévue",    bg: "var(--c-surface-3)",     color: "var(--c-text-3)", dot: "#5B9EF5" },
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
  if (i <= 3) return { active: "#22C55E", border: "#16A34A", text: "#0A150F" };
  if (i <= 6) return { active: "#F59E0B", border: "#D97706", text: "#0A150F" };
  return          { active: "#EF4444", border: "#DC2626", text: "#0A150F" };
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
  const labelStyle = { display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 };

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
      await alertAthleteSession(clubId, athlete, { title: form.title, sessionDate: form.sessionDate });
      if (coachUserId) notifyCoachMessage(coachUserId, athlete.name,
        `${athlete.name} a planifié "${form.title}" le ${new Date(form.sessionDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`
      ).catch(console.warn);
      onCreated(); onClose();
    } catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  const others = allAthletes.filter(a => a.id !== athlete.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[95vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        {/* Poignée mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré réactif à la catégorie */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0 transition-colors duration-300"
          style={{ background: c.bg, borderBottom: `2px solid ${c.border}40` }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2"
              style={{ background: `${c.border}25`, border: `1px solid ${c.border}40` }}>
              <Zap size={10} style={{ color: c.border }} />
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: c.text }}>
                Planifier une séance
              </span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>
              Ton coach sera notifié automatiquement
            </p>
          </div>
          <button onClick={onClose} disabled={saving}
            style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {err && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(239,107,107,0.10)", border: "1px solid rgba(239,107,107,0.25)", borderRadius: 14, padding: "12px 14px" }}>
              <AlertCircle size={14} color="#F19A9A" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#F19A9A" }}>{err}</p>
            </div>
          )}

          {/* Titre */}
          <div>
            <label style={labelStyle}>Titre *</label>
            <input className="input-premium" placeholder="Ex: Footing récup, Technique saut…"
              value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          {/* Catégories — chips */}
          <div>
            <label style={labelStyle}>Type de séance</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ id, label }) => {
                const cc  = cat(id);
                const sel = form.category === id;
                return (
                  <button key={id} onClick={() => set("category", id)}
                    className="tap-feedback"
                    style={{
                      padding: "7px 13px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${sel ? cc.border : `${cc.border}40`}`,
                      background: sel ? cc.border : cc.bg,
                      color: sel ? "#0A150F" : cc.text,
                      boxShadow: sel ? `0 2px 8px ${cc.glow}` : "none",
                      cursor: "pointer",
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" className="input-premium" value={form.sessionDate}
                onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Heure</label>
              <input type="time" className="input-premium" value={form.time}
                onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label style={labelStyle}>Durée (min)</label>
            <input type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes}
              onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea className="input-premium resize-none" rows={2}
              placeholder="Objectifs, détails…"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* PDF */}
          <div>
            <label style={labelStyle}>PDF (optionnel)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, border: "2px dashed var(--c-border-strong)", cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(91,158,245,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={14} color="#5B9EF5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {pdfFile
                  ? <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-1)" }} className="truncate">{pdfFile.name}</p>
                  : <p style={{ fontSize: 12, color: "var(--c-text-3)" }}>Appuie pour joindre un PDF</p>}
              </div>
              <input type="file" accept="application/pdf" className="sr-only"
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Inviter athlètes */}
          {others.length > 0 && (
            <div>
              <label style={labelStyle}><Users size={11} style={{ display: "inline", marginRight: 5 }} />Inviter d'autres athlètes</label>
              <div className="flex flex-wrap gap-2">
                {others.map(a => {
                  const sel = form.invitedAthletes.includes(a.id);
                  return (
                    <button key={a.id} onClick={() => toggleInv(a.id)}
                      className="tap-feedback"
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12,
                        fontSize: 12, fontWeight: 600, border: `1.5px solid ${sel ? "#1D9E75" : "var(--c-border-strong)"}`,
                        background: sel ? "rgba(29,158,117,0.14)" : "var(--c-surface-2)",
                        color: sel ? "#7BD8B4" : "var(--c-text-2)", cursor: "pointer",
                      }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 8, fontWeight: 800, background: sel ? "#1D9E75" : "var(--c-surface-3)" }}>
                        {(a.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      {a.name.split(" ")[0]}
                      {sel && <CheckCircle size={12} color="#3DBE8B" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.title.trim() || saving} className="btn-primary">
            {saving
              ? <><div className="loader-ring loader-ring-sm" />Création…</>
              : <><Plus size={15} />Planifier</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL DÉTAIL SÉANCE
// ═══════════════════════════════════════════════════════════════════════════════
const SessionDetailModal = memo(({ session, athlete, allAthletes, onClose, onSetStatus, onSetRpe, onSetFeeling, onSetComment }) => {
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
  const labelStyle = { fontSize: 10.5, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, display: "block" };

  const presenceOpts = [
    { id: "done",    label: "Réalisée",  activeBg: "rgba(61,190,139,0.16)",  activeBorder: "#3DBE8B", activeText: "#7BD8B4" },
    { id: "partial", label: "Partielle", activeBg: "rgba(234,179,8,0.16)",   activeBorder: "#EAB308", activeText: "#F0CB61" },
    { id: "none",    label: "Absent",    activeBg: "rgba(239,107,107,0.16)", activeBorder: "#EF6B6B", activeText: "#F19A9A" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        {/* Poignée mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré catégorie */}
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: c.bg, borderBottom: `2px solid ${c.border}` }}>
          <div className="flex-1 min-w-0">
            <span style={{
              fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
              padding: "4px 10px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4,
              marginBottom: 10, background: c.border, color: "#0A150F",
            }}>
              {CATEGORIES.find(x => x.id === session.category)?.label ?? session.type}
            </span>
            <h3 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: c.text }}>
              {session.title}
            </h3>
            <p style={{ fontSize: 12, marginTop: 8, fontWeight: 500, color: "var(--c-text-2)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{dateStr}</span>
              {session.time && <span>· {session.time}</span>}
              {session.durationMinutes && <span>· {session.durationMinutes} min</span>}
            </p>
          </div>
          <button onClick={onClose}
            style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} style={{ color: c.text }} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Description */}
          {session.description && (
            <div style={{ background: "var(--c-surface-2)", borderRadius: 16, padding: 16, border: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--c-text-2)" }}>{session.description}</p>
            </div>
          )}

          {/* Consignes coach */}
          {session.instructions && (
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(234,179,8,0.25)", background: "rgba(234,179,8,0.06)" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(234,179,8,0.18)" }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#F0CB61", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Consignes du coach
                </span>
              </div>
              <p style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "#E6D189" }}>{session.instructions}</p>
            </div>
          )}

          {/* PDF */}
          {session.pdfUrl && (
            <a href={session.pdfUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16,
                background: "rgba(91,158,245,0.10)", border: "1px solid rgba(91,158,245,0.25)",
                fontSize: 13, fontWeight: 700, color: "#5B9EF5", textDecoration: "none",
              }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(91,158,245,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={14} color="#5B9EF5" />
              </div>
              Voir le PDF de séance
              <ChevronRight size={14} style={{ marginLeft: "auto", color: "#5B9EF5", opacity: 0.6 }} />
            </a>
          )}

          {/* Athlètes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Users size={13} color="var(--c-text-3)" />
              <span style={labelStyle}>Participants ({session.athleteIds.length})</span>
            </div>
            {session.athleteIds.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--c-text-4)" }}>Aucun athlète assigné</p>
            ) : (
              <div className="space-y-2">
                {session.athleteIds.map(id => {
                  const a  = allAthletes?.find(x => x.id === id);
                  const v  = session.validations?.find(val => val.athleteId === id);
                  const st = v?.status ?? "future";
                  return (
                    <div key={id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: c.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A150F", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {a?.avatar ?? "?"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-1)" }}>{a?.name ?? `Athlète #${id}`}</span>
                          <StatusBadge status={st} />
                          {v?.rpe != null && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>
                              RPE {v.rpe}
                            </span>
                          )}
                        </div>
                        {v?.feeling != null && (
                          <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={11}
                                fill={v.feeling >= n ? "#EAB308" : "none"}
                                color={v.feeling >= n ? "#EAB308" : "var(--c-border-strong)"} />
                            ))}
                          </div>
                        )}
                        {v?.comment && (
                          <p style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--c-text-3)" }}>« {v.comment} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Présence ── */}
          <div>
            <label style={labelStyle}>Ma présence</label>
            <div className="flex gap-2">
              {presenceOpts.map(opt => {
                const sel = status === opt.id;
                return (
                  <button key={opt.id} onClick={() => onSetStatus(session.id, athlete.id, opt.id)}
                    className="tap-feedback"
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 16, fontSize: 11.5, fontWeight: 700,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      border: `1.5px solid ${sel ? opt.activeBorder : "var(--c-border-strong)"}`,
                      background: sel ? opt.activeBg : "var(--c-surface-2)",
                      color: sel ? opt.activeText : "var(--c-text-3)",
                      cursor: "pointer",
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── RPE ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>
                Effort ressenti (RPE)
                {val?.rpe != null && (
                  <span style={{ marginLeft: 8, fontWeight: 800, color: rpeColor(val.rpe).active }}>
                    {val.rpe}/10
                  </span>
                )}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => {
                  const rc  = rpeColor(i);
                  const sel = val?.rpe === i;
                  return (
                    <button key={i} onClick={() => onSetRpe(session.id, athlete.id, i)}
                      className="tap-feedback"
                      style={{
                        width: 38, height: 38, borderRadius: 12, fontSize: 12, fontWeight: 800,
                        border: `1.5px solid ${sel ? rc.border : "var(--c-border-strong)"}`,
                        background: sel ? rc.active : "var(--c-surface-2)",
                        color: sel ? rc.text : "var(--c-text-3)",
                        transform: sel ? "scale(1.1)" : "scale(1)",
                        boxShadow: sel ? `0 2px 8px ${rc.active}55` : "none",
                        cursor: "pointer",
                      }}>
                      {i}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                {[{ range: "0-3", color: "#22C55E", label: "Facile" }, { range: "4-6", color: "#F59E0B", label: "Modéré" }, { range: "7-10", color: "#EF4444", label: "Intense" }].map(l => (
                  <div key={l.range} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
                    <span style={{ fontSize: 10, color: "var(--c-text-4)", fontWeight: 500 }}>{l.range} {l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Ressenti général ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>
                Ressenti général
                {val?.feeling != null && <span style={{ marginLeft: 8, fontWeight: 800, color: "#EAB308" }}>{val.feeling}/5</span>}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => onSetFeeling(session.id, athlete.id, n)}
                    className="tap-feedback" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                    <Star size={30}
                      fill={val?.feeling >= n ? "#EAB308" : "none"}
                      color={val?.feeling >= n ? "#EAB308" : "var(--c-border-strong)"}
                      strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Commentaire ── */}
          {hasPerf && (
            <div>
              <label style={labelStyle}>Commentaire</label>
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
        <div className="px-6 py-4 flex justify-end flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} className="btn-secondary">Fermer</button>
        </div>
      </div>
    </div>
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

  const weekDays = useMemo(() => {
    const ref = selectedDate ?? today;
    const dow = (ref.getDay() + 6) % 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); } else setViewMonth(m => m+1); };
  const prevWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()-7); setSelectedDate(d); };
  const nextWeek  = () => { const d = new Date(selectedDate ?? today); d.setDate(d.getDate()+7); setSelectedDate(d); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  const liveActive = activeSession ? sessions.find(s => s.id === activeSession.id) ?? activeSession : null;

  const navLabel = useMemo(() => {
    if (viewMode === "month")  return `${MONTHS_FR[viewMonth]} ${viewYear}`;
    if (viewMode === "agenda") return "Mes séances";
    const mon = weekDays[0], sun = weekDays[6];
    if (mon.getMonth() === sun.getMonth())
      return `${mon.getDate()} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
    return `${mon.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}`;
  }, [viewMode, viewMonth, viewYear, weekDays]);

  const SessionCard = useCallback(({ s, isPast = false, compact = false }) => {
    const c   = cat(s.category);
    const val = s.validations?.find(v => v.athleteId === athlete.id);
    const st  = val?.status ?? "future";
    const rpeNeeded = isPast && val?.rpe == null && st !== "none" && st !== "future";

    if (compact) {
      return (
        <div onClick={e => { e.stopPropagation(); setActiveSession(s); }}
          className="tap-feedback truncate"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 10,
            fontSize: 9.5, fontWeight: 700, cursor: "pointer",
            background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}`,
          }}>
          <span className="truncate" style={{ flex: 1 }}>{s.title}</span>
          {st === "done" && <CheckCircle size={9} color="#3DBE8B" style={{ flexShrink: 0 }} />}
        </div>
      );
    }

    return (
      <div onClick={() => setActiveSession(s)}
        className="card card-hover tap-feedback"
        style={{ overflow: "hidden", cursor: "pointer", ...(rpeNeeded ? { borderWidth: 2, borderColor: "#EAB308", boxShadow: "0 0 0 3px rgba(234,179,8,0.14)" } : {}) }}>
        {/* En-tête coloré catégorie */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: c.bg, borderBottom: `1.5px solid ${c.border}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 99, background: c.border, color: "#0A150F" }}>
              {CATEGORIES.find(x => x.id === s.category)?.label ?? s.type}
            </span>
            {s.pdfUrl && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(91,158,245,0.16)", color: "#5B9EF5" }}>
                PDF
              </span>
            )}
          </div>
          <StatusBadge status={st} size="sm" />
        </div>
        {/* Corps */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 6, color: "var(--c-text-1)" }}>{s.title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {s.time}</span>
            {s.durationMinutes && <span>{s.durationMinutes} min</span>}
            {val?.rpe != null && (
              <span style={{ fontWeight: 700, color: rpeColor(val.rpe).active }}>RPE {val.rpe}/10</span>
            )}
          </div>
          {s.instructions && (
            <p style={{ fontSize: 11, color: "#F0CB61", background: "rgba(234,179,8,0.08)", borderRadius: 12, padding: "8px 12px", marginBottom: 8 }} className="line-clamp-2">
              {s.instructions}
            </p>
          )}
          {rpeNeeded && (
            <p style={{ fontSize: 11, fontWeight: 700, color: "#F0CB61", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EAB308" }} className="animate-pulse-soft" />
              Valide ta séance
            </p>
          )}
        </div>
      </div>
    );
  }, [athlete.id]);

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--c-bg)" }}>

      {/* ── HEADER GLASSMORPHISM ─────────────────────────────────────────────── */}
      <div className="header-glass px-3 md:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0 z-10">

        <div className="flex items-center gap-1">
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? prevMonth : prevWeek}
              className="tap-feedback"
              style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-2)" }}>
              <ChevronLeft size={16} />
            </button>
          )}
          <p style={{ fontSize: 14, fontWeight: 800, padding: "0 4px", minWidth: 100, textAlign: "center", color: "var(--c-text-1)" }} className="truncate">
            {navLabel}
          </p>
          {viewMode !== "agenda" && (
            <button onClick={viewMode === "month" ? nextMonth : nextWeek}
              className="tap-feedback"
              style={{ width: 32, height: 32, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-2)" }}>
              <ChevronRight size={16} />
            </button>
          )}
          {viewMode !== "agenda" && (
            <button onClick={goToday}
              style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, border: "1px solid var(--c-border-strong)", color: "var(--c-text-3)", background: "none", cursor: "pointer", marginLeft: 4 }}>
              Auj.
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border-strong)" }}>
            {[{ id: "agenda", label: "Liste" }, { id: "month", label: "Mois" }, { id: "week", label: "Sem." }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                style={{
                  padding: "6px 12px", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer",
                  background: viewMode === v.id ? "#1D9E75" : "var(--c-surface-2)",
                  color: viewMode === v.id ? "#0A150F" : "var(--c-text-3)",
                }}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ padding: "0 12px", minHeight: 34 }}>
            <Plus size={14} /><span className="hidden sm:inline">Planifier</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VUE AGENDA
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "agenda" && (
        <div className="flex-1 overflow-y-auto">
          {groupedAgenda.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarDays size={28} color="var(--c-text-4)" strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>Aucune séance planifiée</p>
                <p style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 4 }}>Ton coach ou toi pouvez planifier des séances</p>
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
                    <div className="flex items-center gap-3 mb-3">
                      <div style={{
                        width: 48, height: 48, borderRadius: 16, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : "var(--c-surface-2)",
                        border: isToday ? "none" : "1px solid var(--c-border)",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", lineHeight: 1, color: isToday ? "rgba(255,255,255,0.75)" : "var(--c-text-3)" }}>
                          {dateObj.toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "")}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: isToday ? "white" : (isPast ? "var(--c-text-4)" : "var(--c-text-1)") }}>
                          {dateObj.getDate()}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#4DC9A0" : (isPast ? "var(--c-text-4)" : "var(--c-text-1)") }}>
                          {isToday ? "Aujourd'hui" : dateObj.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>
                          {ds.length} séance{ds.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16, paddingLeft: 44, borderLeft: "2px solid var(--c-border)" }} className="space-y-2.5">
                      {ds.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")).map(s => (
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
          VUE MOIS
         ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-7 mb-2">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "var(--c-text-4)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "6px 0" }}>
                {d}
              </div>
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
                  className="tap-feedback"
                  style={{
                    minHeight: 60, borderRadius: 14, padding: 6, cursor: "pointer",
                    border: isToday ? "2px solid rgba(29,158,117,0.45)" : isSel ? "2px solid rgba(91,158,245,0.45)" : "1px solid var(--c-border)",
                    background: isToday ? "rgba(29,158,117,0.08)" : isSel ? "rgba(91,158,245,0.08)" : cur ? "var(--c-surface)" : "transparent",
                    opacity: cur ? 1 : 0.35,
                  }}>
                  <div className="flex items-start justify-between mb-1">
                    <span style={{
                      fontSize: 12, fontWeight: 800, width: 24, height: 24, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : "transparent",
                      color: isToday ? "white" : (cur ? "var(--c-text-1)" : "var(--c-text-4)"),
                    }}>
                      {date.getDate()}
                    </span>
                    {ds.length > 0 && (
                      <div className="md:hidden flex flex-wrap gap-0.5 justify-end mt-1">
                        {ds.slice(0, 3).map(s => (
                          <div key={s.id} style={{ width: 6, height: 6, borderRadius: "50%", background: cat(s.category).border }}
                            onClick={e => { e.stopPropagation(); setActiveSession(s); }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block space-y-0.5">
                    {ds.slice(0, 3).map(s => <SessionCard key={s.id} s={s} compact />)}
                    {ds.length > 3 && (
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-4)", padding: "0 4px" }}>+{ds.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && (() => {
            const key = selectedDate.toISOString().slice(0, 10);
            const ds  = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
            if (!ds.length) return null;
            const isPast = selectedDate < new Date(today.toISOString().slice(0, 10));
            return (
              <div className="mt-5 space-y-2">
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", flexShrink: 0, scrollbarWidth: "none" }}>
            {weekDays.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isSel   = isSameDay(date, selectedDate ?? today);
              const hasSess = (sessionsByDate[date.toISOString().slice(0, 10)] ?? []).length > 0;
              return (
                <button key={i} onClick={() => setSelectedDate(date)}
                  className="tap-feedback"
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 44, padding: "10px 0", borderRadius: 16, border: "none", cursor: "pointer",
                    background: isToday ? "linear-gradient(135deg, #1D9E75, #16826C)" : isSel ? "var(--c-surface-3)" : "transparent",
                  }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: (isToday || isSel) ? "rgba(255,255,255,0.7)" : "var(--c-text-4)" }}>
                    {["L", "M", "M", "J", "V", "S", "D"][i]}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: (isToday || isSel) ? "white" : "var(--c-text-1)" }}>
                    {date.getDate()}
                  </span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: hasSess ? ((isToday || isSel) ? "rgba(255,255,255,0.6)" : "#1D9E75") : "transparent" }} />
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {(() => {
              const key     = (selectedDate ?? today).toISOString().slice(0, 10);
              const ds      = (sessionsByDate[key] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
              const dateObj = selectedDate ?? today;
              const isPast  = dateObj < new Date(today.toISOString().slice(0, 10));

              if (ds.length === 0) return (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CalendarDays size={24} color="var(--c-text-4)" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text-3)" }}>Repos ce jour</p>
                  <button onClick={() => setShowCreate(true)} style={{ fontSize: 12, fontWeight: 700, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer" }}>
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
          allAthletes={allAthletes}
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