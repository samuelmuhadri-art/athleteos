// ============================================================
// AthleteOS — src/modules/AddSessionModal.jsx
// Modal création/édition d'une séance (côté coach) — extraite de
// Planning.jsx.
// ============================================================

import { memo, useState, useCallback } from "react";
import { X, Plus, CheckCircle } from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import { CATEGORIES, SESSION_COLORS, EMPTY_FORM, dateToISOWeek, dateToDayName, toLocalDateStr } from "./planningShared";

const PDF_MAX_BYTES = 30 * 1024 * 1024; // aligné sur file_size_limit du bucket session-pdfs

const AddSessionModal = memo(({ athletes, initialData, onClose, onAdd }) => {
  const { clubId } = useAuth();
  const isEdit = !!initialData;
  const today  = toLocalDateStr(new Date());
  const [form, setForm]             = useState(initialData ?? { ...EMPTY_FORM, sessionDate: today });
  const [saving, setSaving]         = useState(false);
  const [pdfFile, setPdfFile]       = useState(null);
  const [pdfError, setPdfError]     = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const set = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);
  const pickPdf = useCallback(file => {
    if (!file) { setPdfFile(null); setPdfError(null); return; }
    if (file.type !== "application/pdf") { setPdfFile(null); setPdfError("Le fichier doit être un PDF."); return; }
    if (file.size > PDF_MAX_BYTES) { setPdfFile(null); setPdfError("PDF trop volumineux (30 Mo max)."); return; }
    setPdfError(null); setPdfFile(file);
  }, []);
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
        // Préfixé par club_id — requis par les policies storage scopées par
        // club (sinon l'upload est rejeté par RLS). Extension forcée en
        // .pdf (le bucket n'accepte que application/pdf côté serveur) et le
        // chemin (pas d'URL publique) est ce qui est stocké en base — le
        // bucket est privé, l'ouverture se fait via une URL signée générée
        // à la volée (voir src/utils/storage.js).
        const path = `${clubId}/${Date.now()}.pdf`;
        const { error: uploadErr } = await supabase.storage.from("session-pdfs").upload(path, pdfFile);
        if (uploadErr) throw uploadErr;
        pdfUrl = path;
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
  const labelCls = "block text-[12px] font-bold uppercase tracking-wide mb-1.5";
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
            <h2 className="text-[17px] font-bold" style={{ color: selCat.text }}>
              {isEdit ? "Modifier la séance" : "Nouvelle séance"}
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-2)" }}>
              {isEdit ? "Modifie les détails" : "Planifie un entraînement"}
            </p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving}
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
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all tap-feedback"
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
              <p className="text-[12px] mb-1.5" style={{ color: "#7BD8B4" }}>📎 PDF déjà joint</p>
            )}
            <input type="file" accept="application/pdf"
              onChange={e => pickPdf(e.target.files?.[0] ?? null)}
              className="w-full text-[12px] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[12px] file:font-semibold"
              style={{ color: "var(--c-text-3)" }} />
            {pdfFile && <p className="meta-text mt-1">📎 {pdfFile.name}</p>}
            {pdfError && <p className="text-[12px] mt-1" style={{ color: "#F19A9A" }}>{pdfError}</p>}
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>
              Athlètes * ({form.athleteIds.length} sélectionné{form.athleteIds.length > 1 ? "s" : ""})
            </label>
            {athletes.length === 0 ? (
              <p className="meta-text">Aucun athlète disponible</p>
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
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
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

export default AddSessionModal;
