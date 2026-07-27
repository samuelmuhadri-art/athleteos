// ============================================================
// AthleteOS — src/modules/CreateCompModal.jsx
// Modal de création de compétition — extraite de Competitions.jsx.
// ============================================================

import { memo, useState } from "react";
import { X, Plus } from "lucide-react";
import { TYPE_CONFIG } from "./competitionsShared";

const CreateCompModal = memo(({ athletes, onClose, onCreate }) => {
  const [form, setForm] = useState({
    name: "", date: "", location: "", type: "préparation", athleteEntries: [],
  });
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);

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

  const handleSubmit = async () => {
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

  const inputCls = "w-full border border-[var(--c-border-strong)] rounded-lg px-3 py-2 text-[13px] text-[var(--c-text-1)] focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-[var(--c-surface-2)]";
  const labelCls = "block text-[11px] font-semibold text-[var(--c-text-3)] uppercase tracking-wider mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-[var(--c-surface)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--c-border)] flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-[var(--c-text-1)]">Créer une compétition</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-[var(--c-surface-3)] transition-colors disabled:opacity-40">
            <X size={18} className="text-[var(--c-text-2)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {saveError && (
            <div className="bg-[rgba(224,82,82,0.15)] border border-[rgba(224,82,82,0.30)] rounded-lg px-3 py-2.5 text-[12px] text-[#E05252]">
              {saveError}
            </div>
          )}

          <div>
            <label className={labelCls}>Nom *</label>
            <input
              className={inputCls}
              placeholder="Ex: Championnats Provinciaux"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {Object.keys(TYPE_CONFIG).map((k) => (
                  <option key={k} value={k}>{TYPE_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Lieu</label>
            <input
              className={inputCls}
              placeholder="Ex: Namur, BE"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Athlètes engagés & épreuve prévue</label>
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
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium text-left"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                          style={{ background: selected ? "#1D9E75" : "#94a3b8" }}
                        >
                          {a.avatar?.slice(0, 1) ?? "?"}
                        </div>
                        <span className={selected ? "text-[#7BD8B4]" : "text-[var(--c-text-2)]"}>{a.name}</span>
                      </button>
                      {selected && (
                        <div className="px-2.5 pb-2">
                          <input
                            className="w-full border border-[var(--c-border-strong)] bg-[var(--c-surface-2)] text-[var(--c-text-1)] rounded px-2 py-1 text-[11.5px]"
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

        <div className="px-6 py-4 border-t border-[var(--c-border)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--c-surface-3)] text-[var(--c-text-2)] text-[13px] font-medium hover:bg-[var(--c-border-strong)] transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim() || !form.date || saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#1D9E75" }}
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
      </div>
    </div>
  );
});

export default CreateCompModal;
