// ============================================================
// AthleteOS — src/athlete/views/CreateSessionModal.jsx
// Modal "Planifier une séance" — extraite d'AthletePlanning.jsx.
// ============================================================

import { useState, memo } from "react";
import { createPortal } from "react-dom";
import { Plus, X, FileText, Users, AlertCircle, CheckCircle, Zap } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { notifyCoachMessage, alertAthleteSession } from "../../utils/notifications";
import { CATEGORIES, dateToISOWeek, dateToDayName, toLocalDateStr } from "../shared";
import { parseLocalDate } from "../../utils/helpers";
import { cat } from "./planningShared";

const PDF_MAX_BYTES = 30 * 1024 * 1024; // aligné sur file_size_limit du bucket session-pdfs

const CreateSessionModal = memo(({ athlete, allAthletes, clubId, createdBy, coachUserId, onClose, onCreated }) => {
  const today = toLocalDateStr(new Date());
  const [form, setForm] = useState({
    title: "", category: "technique", time: "10:00", durationMinutes: 60,
    description: "", sessionDate: today, invitedAthletes: [],
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  const set       = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pickPdf = file => {
    if (!file) { setPdfFile(null); return; }
    if (file.type !== "application/pdf") { setPdfFile(null); setErr("Le fichier doit être un PDF."); return; }
    if (file.size > PDF_MAX_BYTES) { setPdfFile(null); setErr("PDF trop volumineux (30 Mo max)."); return; }
    setErr(null); setPdfFile(file);
  };
  const toggleInv = id => setForm(f => ({
    ...f,
    invitedAthletes: f.invitedAthletes.includes(id)
      ? f.invitedAthletes.filter(x => x !== id)
      : [...f.invitedAthletes, id],
  }));

  const c = cat(form.category);
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 };

  const handleSubmit = async event => {
    event?.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true); setErr(null);
    try {
      let pdfUrl = null;
      if (pdfFile) {
        // Préfixé par club_id — requis par les policies storage scopées par
        // club (sinon l'upload est rejeté par RLS). Extension forcée en
        // .pdf et chemin (pas d'URL publique) stocké en base — le bucket
        // est privé, ouverture via URL signée à la volée (src/utils/storage.js).
        const path = `${clubId}/${Date.now()}.pdf`;
        const { error: ue } = await supabase.storage.from("session-pdfs").upload(path, pdfFile);
        if (ue) throw ue;
        pdfUrl = path;
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
        `${athlete.name} a planifié "${form.title}" le ${parseLocalDate(form.sessionDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`
      ).catch(console.warn);
      onCreated(); onClose();
    } catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  const others = allAthletes.filter(a => a.id !== athlete.id);

  // Portal sur document.body : ce composant est ouvert depuis des pages qui
  // scrollent (Planning, Dashboard) — sans ça, sur mobile, ce position:fixed
  // dérive avec le scroll au lieu de rester épinglé à l'écran (même bug déjà
  // rencontré et corrigé sur FormeDetailPanel.jsx et AthleteClub.jsx).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="create-session-title"
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[95vh] flex flex-col overflow-hidden modal-content"
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
              <Zap size={14} style={{ color: c.border }} aria-hidden="true" />
              <h2 id="create-session-title" style={{ fontSize: 15, fontWeight: 800, color: c.text }}>
                Planifier une séance
              </h2>
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-2)" }}>
              Ton coach sera notifié automatiquement
            </p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving}
            style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.06)", border: "1px solid var(--c-border)", cursor: "pointer", flexShrink: 0 }}>
            <X size={18} style={{ color: c.text }} aria-hidden="true" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {err && (
            <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(239,107,107,0.10)", border: "1px solid rgba(239,107,107,0.25)", borderRadius: 14, padding: "12px 14px" }}>
              <AlertCircle size={14} color="#F19A9A" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#F19A9A" }}>{err}</p>
            </div>
          )}

          {/* Titre */}
          <div>
            <label htmlFor="session-title" style={labelStyle}>Titre *</label>
            <input id="session-title" className="input-premium" placeholder="Ex: Footing récup, Technique saut…" required autoFocus
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
                  <button key={id} type="button" aria-pressed={sel} onClick={() => set("category", id)}
                    className="tap-feedback"
                    style={{
                      minHeight: 44, padding: "8px 13px", borderRadius: 12, fontSize: 13, fontWeight: 700,
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
              <label htmlFor="session-date" style={labelStyle}>Date *</label>
              <input id="session-date" type="date" className="input-premium" value={form.sessionDate} required
                onChange={e => set("sessionDate", e.target.value)} />
            </div>
            <div>
              <label htmlFor="session-time" style={labelStyle}>Heure</label>
              <input id="session-time" type="time" className="input-premium" value={form.time}
                onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label htmlFor="session-duration" style={labelStyle}>Durée (min)</label>
            <input id="session-duration" type="number" min="5" step="5" className="input-premium"
              value={form.durationMinutes}
              onChange={e => set("durationMinutes", Number(e.target.value))} />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="session-description" style={labelStyle}>Description</label>
            <textarea id="session-description" className="input-premium resize-none" rows={3}
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
                  ? <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)" }} className="truncate">{pdfFile.name}</p>
                  : <p style={{ fontSize: 13, color: "var(--c-text-2)" }}>Appuie pour joindre un PDF</p>}
              </div>
              <input type="file" accept="application/pdf" className="sr-only"
                onChange={e => pickPdf(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Inviter athlètes */}
          {others.length > 0 && (
            <div>
              <label style={labelStyle}><Users size={14} style={{ display: "inline", marginRight: 5 }} aria-hidden="true" />Inviter d'autres athlètes</label>
              <div className="flex flex-wrap gap-2">
                {others.map(a => {
                  const sel = form.invitedAthletes.includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={sel} onClick={() => toggleInv(a.id)}
                      className="tap-feedback"
                      style={{
                        minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12,
                        fontSize: 13, fontWeight: 600, border: `1.5px solid ${sel ? "#1D9E75" : "var(--c-border-strong)"}`,
                        background: sel ? "rgba(29,158,117,0.14)" : "var(--c-surface-2)",
                        color: sel ? "#7BD8B4" : "var(--c-text-2)", cursor: "pointer",
                      }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 800, background: sel ? "#1D9E75" : "var(--c-surface-3)" }}>
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
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={!form.title.trim() || saving} className="btn-primary">
            {saving
              ? <><div className="loader-ring loader-ring-sm" />Création…</>
              : <><Plus size={15} />Planifier</>}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
});

export default CreateSessionModal;
