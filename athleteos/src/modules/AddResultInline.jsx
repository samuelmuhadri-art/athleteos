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

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.event.trim() || !form.result.trim()) return;
    setSaving(true);
    try {
      await onAdd(competitionId, athlete.id, form);
      setOpen(false);
      setForm({ event: "", result: "", context: "" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 mt-1 flex items-center gap-1"
      >
        <Plus size={11} /> Ajouter un résultat
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 bg-[var(--c-surface-2)] border border-[var(--c-border-strong)] rounded-lg p-2.5">
      <input
        className="w-full border border-[var(--c-border-strong)] bg-[var(--c-surface-2)] text-[var(--c-text-1)] rounded px-2 py-1 text-[11px]"
        placeholder="Épreuve (ex: 100m)"
        value={form.event}
        onChange={(e) => set("event", e.target.value)}
      />
      <input
        className="w-full border border-[var(--c-border-strong)] bg-[var(--c-surface-2)] text-[var(--c-text-1)] rounded px-2 py-1 text-[11px]"
        placeholder="Résultat (ex: 10.94s)"
        value={form.result}
        onChange={(e) => set("result", e.target.value)}
      />
      <input
        className="w-full border border-[var(--c-border-strong)] bg-[var(--c-surface-2)] text-[var(--c-text-1)] rounded px-2 py-1 text-[11px]"
        placeholder="Contexte (optionnel)"
        value={form.context}
        onChange={(e) => set("context", e.target.value)}
      />
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-text-2)]"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={!form.event.trim() || !form.result.trim() || saving}
          className="text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded px-2 py-1 disabled:opacity-40"
        >
          {saving ? "…" : "Valider"}
        </button>
      </div>
    </div>
  );
});

export default AddResultInline;
