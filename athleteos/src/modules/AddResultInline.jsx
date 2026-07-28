// ============================================================
// AthleteOS — src/modules/AddResultInline.jsx
// Mini-formulaire "Ajouter un résultat" inline — extrait de
// Competitions.jsx (utilisé dans CompModal.jsx).
// ============================================================

import { memo, useState } from "react";
import { Plus } from "lucide-react";

const AddResultInline = memo(({ athlete, competitionId, defaultEvent, onAdd }) => {
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({ event: defaultEvent || "", result: "", context: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!form.event.trim() || !form.result.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAdd(competitionId, athlete.id, form);
      setOpen(false);
      setForm({ event: defaultEvent || "", result: "", context: "" });
    } catch (error) {
      setSaveError(error.message ?? "Impossible d'enregistrer ce résultat");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] font-semibold text-[var(--color-success)] hover:text-[var(--c-accent)] mt-2 min-h-11 flex items-center gap-1.5"
      >
        <Plus size={14} /> Ajouter un résultat
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 bg-[var(--c-surface-2)] border border-[var(--c-border-strong)] rounded-xl p-3">
      <label htmlFor={`result-event-${athlete.id}`} className="sr-only">Épreuve</label>
      <input
        id={`result-event-${athlete.id}`}
        className="input-premium"
        placeholder="Épreuve (ex: 100m)"
        value={form.event}
        onChange={(e) => set("event", e.target.value)}
      />
      <label htmlFor={`result-value-${athlete.id}`} className="sr-only">Résultat</label>
      <input
        id={`result-value-${athlete.id}`}
        className="input-premium"
        placeholder="Résultat (ex: 10.94s)"
        value={form.result}
        onChange={(e) => set("result", e.target.value)}
      />
      <label htmlFor={`result-context-${athlete.id}`} className="sr-only">Contexte optionnel</label>
      <input
        id={`result-context-${athlete.id}`}
        className="input-premium"
        placeholder="Contexte (optionnel)"
        value={form.context}
        onChange={(e) => set("context", e.target.value)}
      />
      {saveError && <p role="alert" className="text-[12px] text-[var(--color-danger)]">{saveError}</p>}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => { setOpen(false); setSaveError(null); }}
          disabled={saving}
          className="btn-ghost"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!form.event.trim() || !form.result.trim() || saving}
          className="btn-primary"
        >
          {saving ? "…" : "Valider"}
        </button>
      </div>
    </form>
  );
});

export default AddResultInline;
