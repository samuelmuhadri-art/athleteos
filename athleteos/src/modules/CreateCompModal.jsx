// ============================================================
// AthleteOS — src/modules/CreateCompModal.jsx
// Modal de création de compétition — extraite de Competitions.jsx.
// ============================================================

import { memo, useState } from "react";
import { X, Plus } from "lucide-react";
import { TYPE_CONFIG } from "./competitionsShared";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog";

const CreateCompModal = memo(({ athletes, onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: "", date: "", location: "", type: "préparation", athleteEntries: [],
  });
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { dialogRef } = useAccessibleDialog({ onClose, closeDisabled: saving });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleAthlete = (id) => {
    setForm((f) => {
      const exists = f.athleteEntries.some((e) => e.athleteId === id);
      return {
        ...f,
        athleteEntries: exists
          ? f.athleteEntries.filter((e) => e.athleteId !== id)
          : [...f.athleteEntries, { athleteId: id, plannedEvent: "" }],
      };
    });
  };

  const setPlannedEvent = (id, value) => {
    setForm((f) => ({
      ...f,
      athleteEntries: f.athleteEntries.map((e) =>
        e.athleteId === id ? { ...e, plannedEvent: value } : e
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!form.name.trim() || !form.date) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate(form);
      onClose();
    } catch (err) {
      setSaveError(err.message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "input-premium";
  const labelCls = "metric-label block mb-2";

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-competition-title" className="modal-content bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--c-border)] flex items-center justify-between">
          <h3 id="create-competition-title" className="section-title">Créer une compétition</h3>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={saving} className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg hover:bg-[var(--c-surface-3)] transition-colors disabled:opacity-40">
            <X size={18} className="text-[var(--c-text-2)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {saveError && (
            <div role="alert" className="bg-[rgba(224,82,82,0.15)] border border-[rgba(224,82,82,0.30)] rounded-lg px-3 py-2.5 text-[12px] text-[#E05252]">
              {saveError}
            </div>
          )}

          <div>
            <label htmlFor="competition-name" className={labelCls}>Nom *</label>
            <input
              id="competition-name"
              required
              className={inputCls}
              placeholder="Ex: Championnats Provinciaux"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="competition-date" className={labelCls}>Date *</label>
              <input id="competition-date" type="date" required className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label htmlFor="competition-type" className={labelCls}>Type</label>
              <select id="competition-type" className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {Object.keys(TYPE_CONFIG).map((k) => (
                  <option key={k} value={k}>{TYPE_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="competition-location" className={labelCls}>Lieu</label>
            <input
              id="competition-location"
              className={inputCls}
              placeholder="Ex: Namur, BE"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className={labelCls}>Athlètes engagés & épreuve prévue</p>
              <span className="meta-text">{form.athleteEntries.length} sélectionné{form.athleteEntries.length !== 1 ? "s" : ""}</span>
            </div>
            {athletes.length === 0 ? (
              <p className="text-[12px] text-[var(--c-text-3)] mt-1">Aucun athlète disponible</p>
            ) : (
              <div className="space-y-2 mt-1">
                {athletes.map((a) => {
                  const entry    = form.athleteEntries.find((e) => e.athleteId === a.id);
                  const selected = !!entry;
                  return (
                    <div
                      key={a.id}
                      className={`rounded-lg border transition-all ${selected ? "border-[#1D9E75] bg-[rgba(29,158,117,0.14)]" : "border-[var(--c-border-strong)]"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAthlete(a.id)}
                        aria-pressed={selected}
                        className="w-full min-h-11 flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-left"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                          style={{ background: selected ? "#1D9E75" : "#94a3b8" }}
                        >
                          {a.avatar?.slice(0, 1) ?? "?"}
                        </div>
                        <span className={selected ? "text-[#7BD8B4]" : "text-[var(--c-text-2)]"}>{a.name}</span>
                      </button>
                      {selected && (
                        <div className="px-3 pb-3">
                          <label htmlFor={`planned-event-${a.id}`} className="sr-only">Épreuve prévue pour {a.name}</label>
                          <input
                            id={`planned-event-${a.id}`}
                            className="input-premium"
                            placeholder="Épreuve prévue (ex: 100m, Longueur…)"
                            value={entry.plannedEvent}
                            onChange={(e) => setPlannedEvent(a.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-[var(--c-border)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-ghost"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || !form.date || saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Plus size={15} />
                Créer
              </>
            )}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
});

export default CreateCompModal;
