// ============================================================
// AthleteOS — src/modules/AthleteList.jsx
// ★ DESIGN PREMIUM DARK + PORTALS
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  ArrowLeft, Trophy, Activity, Dumbbell, HeartPulse,
  User, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Clock, Star, ChevronRight, Zap, Users as UsersIcon,
  Plus, X,
} from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import {
  getAthleteMetricsForWeek,
  computeChargeChartData,
  generateContextAnalysis,
  getStatusLabel,
  computePerformanceStability,
} from "../utils/chargeCalculations";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "performances",  label: "Performances",      icon: Trophy     },
  { id: "charge",        label: "Charge & Forme",    icon: Activity   },
  { id: "entrainements", label: "Entraînements",     icon: Dumbbell   },
  { id: "blessures",     label: "Blessures",         icon: HeartPulse },
  { id: "profil",        label: "Profil",            icon: User       },
];

const RADAR_KEYS = [
  { key: "speed",       label: "Vitesse"     },
  { key: "strength",    label: "Force"       },
  { key: "explosivity", label: "Explosivité" },
  { key: "endurance",   label: "Endurance"   },
  { key: "technique",   label: "Technique"   },
];

const INJURY_STATUS_OPTIONS = ["actif", "en suivi", "chronique", "résolu"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(val, inv = false) {
  if (inv) { if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "#1D9E75"; }
  if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
}

function acwrColor(v) { return v > 1.3 ? "#E24B4A" : v < 0.8 ? "#378ADD" : "#1D9E75"; }

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── Composants UI partagés ───────────────────────────────────────────────────

function StatusBadge({ readiness, fatigue, acwr }) {
  const s = getStatusLabel(readiness, fatigue, acwr);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold text-white shadow-sm"
      style={{ background: s.color }}
    >
      {s.dot} {s.label}
    </span>
  );
}

function ScoreRing({ value, color, label, size = 72 }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{value}</text>
      </svg>
      <span className="text-[10.5px] font-semibold text-center leading-tight" style={{ color: "var(--c-text-3)" }}>{label}</span>
    </div>
  );
}

function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     bg: "rgba(61,190,139,0.15)", color: "#7BD8B4", border: "rgba(61,190,139,0.3)" },
    partial: { label: "Partielle",    bg: "rgba(234,179,8,0.15)",  color: "#F0CB61", border: "rgba(234,179,8,0.3)" },
    none:    { label: "Non réalisée", bg: "rgba(239,107,107,0.15)",color: "#F19A9A", border: "rgba(239,107,107,0.3)" },
    future:  { label: "À venir",      bg: "var(--c-surface-3)",    color: "var(--c-text-3)", border: "transparent" },
  };
  const b = map[status] ?? map.future;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
      {b.label}
    </span>
  );
}

function StarRow({ value, max = 5, color = "#EF9F27" }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={11} fill={i < value ? color : "none"} color={i < value ? color : "var(--c-border-strong)"} />
      ))}
    </div>
  );
}

function EmptySection({ icon: Icon = Trophy, title, sub }) {
  return (
    <div className="card p-12 text-center">
      <Icon size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--c-text-4)" }} />
      <p className="text-[13.5px] font-bold" style={{ color: "var(--c-text-2)" }}>{title}</p>
      {sub && <p className="text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>{sub}</p>}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl shadow-lg px-3 py-2.5 text-[12px]" style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
      <p className="font-bold mb-1" style={{ color: "var(--c-text-1)" }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Inputs partagés ──────────────────────────────────────────────────────────
const inputCls = "input-premium";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider mb-1.5";

// ─── AddRecordModal premium + Portal ──────────────────────────────────────────

const AddRecordModal = memo(({ athleteName, onClose, onAdd }) => {
  const [form, setForm]     = useState({ discipline: "", sb: "", pr: "", prDate: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.discipline.trim() || !form.sb.trim() || !form.pr.trim()) return;
    setSaving(true); setErr(null);
    try { await onAdd(form); onClose(); }
    catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden modal-content"
           style={{ background: "var(--c-surface)" }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h3 className="text-[16px] font-black" style={{ color: "var(--c-text-1)" }}>Ajouter un record</h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-3)" }}>{athleteName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl transition-colors disabled:opacity-40"
                  style={{ color: "var(--c-text-2)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="rounded-2xl px-4 py-3 text-[12px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)", color: "#F19A9A" }}>{err}</div>}
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Épreuve *</label>
            <input className={inputCls} placeholder="Ex: 100m, Longueur…"
              value={form.discipline} onChange={e => set("discipline", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Season Best *</label>
              <input className={inputCls} placeholder="Ex: 10.94s" value={form.sb} onChange={e => set("sb", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Record perso *</label>
              <input className={inputCls} placeholder="Ex: 10.62s" value={form.pr} onChange={e => set("pr", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Date du record perso</label>
            <input type="date" className={inputCls} value={form.prDate} onChange={e => set("prDate", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.discipline.trim() || !form.sb.trim() || !form.pr.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />Ajouter</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

// ─── AddInjuryModal premium + Portal ──────────────────────────────────────────

const AddInjuryModal = memo(({ athleteName, initialData, onClose, onSave }) => {
  const isEdit = initialData != null;
  const [form, setForm]     = useState(initialData ?? { name: "", location: "", intensity: 5, status: "actif", startDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const intColor = form.intensity <= 3 ? "#1D9E75" : form.intensity <= 6 ? "#EF9F27" : "#E24B4A";

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try { await onSave(form); onClose(); }
    catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
           style={{ background: "var(--c-surface)" }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} /></div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: "rgba(226,75,74,0.08)", borderBottom: "2px solid rgba(226,75,74,0.2)" }}>
          <div>
            <h3 className="text-[16px] font-black" style={{ color: "#E24B4A" }}>{isEdit ? "Modifier la blessure" : "Signaler une blessure"}</h3>
            <p className="text-[12px] mt-0.5" style={{ color: "#F19A9A" }}>{athleteName}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl transition-colors disabled:opacity-40"
                  style={{ color: "#F19A9A" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(226,75,74,0.15)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="rounded-2xl px-4 py-3 text-[12px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)", color: "#F19A9A" }}>{err}</div>}
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Nom de la blessure *</label>
            <input className={inputCls} placeholder="Ex: Tendinopathie rotulienne"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Localisation</label>
            <input className={inputCls} placeholder="Ex: Genou droit"
              value={form.location} onChange={e => set("location", e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls} style={{ color: "var(--c-text-3)", marginBottom: 0 }}>Intensité douleur</label>
              <span className="text-[14px] font-black" style={{ color: intColor }}>{form.intensity}/10</span>
            </div>
            <input type="range" min="0" max="10" value={form.intensity}
              onChange={e => set("intensity", Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: intColor, background: "var(--c-surface-3)" }} />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--c-text-4)" }}>
              <span>Légère</span><span>Modérée</span><span>Intense</span>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Statut</label>
            <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value)}>
              {INJURY_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Date de début</label>
            <input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Notes / suivi</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              placeholder="Kiné, consignes, restrictions…"
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />{isEdit ? "Enregistrer" : "Ajouter"}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

// ─── AddAthleteModal premium + Portal ─────────────────────────────────────────

const AddAthleteModal = memo(({ onClose, onCreate, initialData = null }) => {
  const isEdit = initialData != null;
  const [form, setForm] = useState(initialData ?? {
    name: "", email: "", age: "", mainDiscipline: "", secondaryDisciplines: "",
    group: "", level: "", speed: 50, strength: 50, explosivity: 50, endurance: 50, technique: 50,
    recoveryRate: "normale", volumeTolerance: "modérée", intensityTolerance: "modérée", psychProfile: "",
  });
  const [showProfile, setShowProfile] = useState(isEdit);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setErr(null);
    try { await onCreate(form); onClose(); }
    catch (e) { setErr(e.message ?? "Erreur"); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-content"
           style={{ background: "var(--c-surface)" }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0"><div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} /></div>
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h3 className="text-[17px] font-black" style={{ color: "var(--c-text-1)" }}>
              {isEdit ? "Modifier le profil" : "Inscrire un athlète"}
            </h3>
            <p className="text-[12px]" style={{ color: "var(--c-text-3)", mt: 0.5 }}>
              {isEdit ? "Modifie uniquement ce qui a changé." : "Seul le nom est obligatoire."}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl transition-colors disabled:opacity-40"
                  style={{ color: "var(--c-text-2)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {err && <div className="rounded-2xl px-4 py-3 text-[12px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.2)", color: "#F19A9A" }}>{err}</div>}
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Nom complet *</label>
            <input className={inputCls} placeholder="Ex: Nora Vandenberghe"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Email (pour la messagerie)</label>
            <input type="email" className={inputCls} placeholder="nora.v@exemple.be"
              value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Âge</label>
              <input type="number" className={inputCls} value={form.age} onChange={e => set("age", e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Niveau</label>
              <input className={inputCls} placeholder="Ex: Régional" value={form.level} onChange={e => set("level", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Discipline principale</label>
            <input className={inputCls} placeholder="Ex: Sprint 100m/200m"
              value={form.mainDiscipline} onChange={e => set("mainDiscipline", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Disciplines secondaires</label>
            <input className={inputCls} placeholder="Séparées par des virgules"
              value={form.secondaryDisciplines} onChange={e => set("secondaryDisciplines", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Groupe d'entraînement</label>
            <input className={inputCls} placeholder="Ex: Sprint-Haies"
              value={form.group} onChange={e => set("group", e.target.value)} />
          </div>

          {/* Profil athlétique collapsible */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--c-border)" }}>
            <button type="button" onClick={() => setShowProfile(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between transition-colors tap-feedback"
              style={{ background: "var(--c-surface-2)" }}>
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--c-text-1)" }}>
                Profil athlétique initial (optionnel)
              </span>
              <span className="text-[11px]" style={{ color: "var(--c-text-4)" }}>{showProfile ? "▲" : "▼"}</span>
            </button>
            {showProfile && (
              <div className="p-4 space-y-3" style={{ background: "var(--c-surface)" }}>
                {RADAR_KEYS.map(k => (
                  <div key={k.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11.5px] font-semibold" style={{ color: "var(--c-text-2)" }}>{k.label}</label>
                      <span className="text-[12px] font-black" style={{ color: scoreColor(form[k.key]) }}>
                        {form[k.key]}
                      </span>
                    </div>
                    <input type="range" min="0" max="100" value={form[k.key]}
                      onChange={e => set(k.key, Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none" style={{ accentColor: "#1D9E75", background: "var(--c-surface-3)" }} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Récupération</label>
                    <select className={inputCls} value={form.recoveryRate} onChange={e => set("recoveryRate", e.target.value)}>
                      {["lente","normale","rapide"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Tolérance volume</label>
                    <select className={inputCls} value={form.volumeTolerance} onChange={e => set("volumeTolerance", e.target.value)}>
                      {["faible","modérée","élevée"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Tolérance intensité</label>
                    <select className={inputCls} value={form.intensityTolerance} onChange={e => set("intensityTolerance", e.target.value)}>
                      {["faible","modérée","élevée","très élevée"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: "var(--c-text-3)" }}>Profil psychologique</label>
                    <input className={inputCls} placeholder="Ex: compétitif"
                      value={form.psychProfile} onChange={e => set("psychProfile", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <button onClick={onClose} disabled={saving} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="btn-primary">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isEdit ? "Enregistrement…" : "Inscription…"}</> : <><Plus size={15} />{isEdit ? "Enregistrer" : "Inscrire l'athlète"}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

// ─── Onglet Performances ──────────────────────────────────────────────────────

const TabPerformances = memo(({ athlete, competitions, onAddRecord }) => {
  const disciplines    = Object.keys(athlete.records ?? {});
  const [selectedDisc, setSelectedDisc]   = useState(disciplines[0]);
  const [showAdd,      setShowAdd]        = useState(false);

  const chartData = useMemo(() =>
    (athlete.performanceHistory ?? []).filter(p => p.value !== null).map(p => ({ ...p, label: String(p.month).slice(0,7) })),
  [athlete]);

  const compHistory = useMemo(() => {
    const all = [];
    (competitions ?? []).forEach(c => {
      if (!c.athleteIds.includes(athlete.id)) return;
      c.results.filter(r => r.athleteId === athlete.id).forEach(r => all.push({ comp: c, result: r }));
    });
    return all.sort((a,b) => new Date(b.comp.date) - new Date(a.comp.date));
  }, [athlete, competitions]);

  const rec = selectedDisc ? athlete.records?.[selectedDisc] : null;

  return (
    <div className="space-y-5">
      {/* Records table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h4 className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Records & Season Best</h4>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-3)" }}>{disciplines.length} épreuve{disciplines.length > 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary !py-1.5 !px-3 !text-[11.5px]">
            <Plus size={12} /> Ajouter
          </button>
        </div>

        {disciplines.length === 0 ? (
          <EmptySection icon={Trophy} title="Aucun record enregistré" sub="Les records apparaîtront ici dès qu'ils seront ajoutés." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--c-border)" }}>
                  {["Épreuve","SB","PR","Date PR","Progression"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--c-text-3)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ divideY: "1px solid var(--c-border)" }}>
                {disciplines.map((disc, i) => {
                  const r    = athlete.records[disc];
                  const sbN  = parseFloat(r.sb), prN = parseFloat(r.pr);
                  const pct  = !isNaN(sbN) && !isNaN(prN) && prN > 0 ? Math.min(100, Math.round((sbN/prN)*100)) : null;
                  const pc   = pct === null ? "var(--c-text-4)" : pct >= 95 ? "#1D9E75" : pct >= 85 ? "#EF9F27" : "#E24B4A";
                  return (
                    <tr key={disc} style={{ borderTop: i > 0 ? "1px solid var(--c-border)" : "none", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td className="px-4 py-3.5 font-bold" style={{ color: "var(--c-text-1)" }}>{disc}</td>
                      <td className="px-4 py-3.5" style={{ color: "var(--c-text-2)" }}>{r.sb}</td>
                      <td className="px-4 py-3.5 font-black text-[14px]" style={{ color: "#1D9E75" }}>{r.pr}</td>
                      <td className="px-4 py-3.5" style={{ color: "var(--c-text-3)" }}>
                        {r.prDate ? new Date(r.prDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "var(--c-surface-3)" }}>
                              <div className="h-full rounded-full" style={{ width:`${pct}%`, background:pc }} />
                            </div>
                            <span className="text-[11px] font-bold" style={{ color:pc }}>{pct}%</span>
                          </div>
                        ) : <span className="text-[11px]" style={{ color: "var(--c-text-4)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Graphique évolution */}
      {disciplines.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h4 className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Évolution — {athlete.mainDiscipline}</h4>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-3)" }}>24 derniers mois</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {disciplines.slice(0,5).map(d => (
                <button key={d} onClick={() => setSelectedDisc(d)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all tap-feedback"
                  style={selectedDisc === d ? { background: "#1D9E75", color: "white", boxShadow: "0 2px 8px rgba(29,158,117,0.3)" } : { background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="value" name={athlete.mainDiscipline} stroke="#1D9E75" strokeWidth={2.5}
                  dot={{ r:4, fill:"#1D9E75", strokeWidth: 2, stroke: "var(--c-surface)" }} activeDot={{ r:6 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[13px]" style={{ color: "var(--c-text-4)" }}>
              Pas de données disponibles
            </div>
          )}
          {rec && (
            <div className="mt-3 flex items-center gap-4 text-[12px] flex-wrap pt-3" style={{ color: "var(--c-text-3)", borderTop: "1px solid var(--c-border)" }}>
              <span>SB : <strong style={{ color: "var(--c-text-2)" }}>{rec.sb}</strong></span>
              <span>PR : <strong style={{ color: "#3DBE8B" }}>{rec.pr}</strong></span>
              {rec.prDate && <span>Date PR : <strong style={{ color: "var(--c-text-2)" }}>{new Date(rec.prDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short",year:"numeric"})}</strong></span>}
            </div>
          )}
        </div>
      )}

      {/* Historique compétitions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <h4 className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Historique compétitions</h4>
        </div>
        {compHistory.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--c-text-4)" }}>Aucune compétition enregistrée</div>
        ) : (
          <div>
            {compHistory.map(({ comp, result }, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-4 transition-colors"
                   style={{ borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}
                   onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"}
                   onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,159,39,0.15)" }}>
                  <Trophy size={16} color="#EF9F27" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13px] font-bold" style={{ color: "var(--c-text-1)" }}>{comp.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>{comp.type}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>
                    {result.event} — <strong className="text-[13px]" style={{ color: "#3DBE8B" }}>{result.result}</strong>
                  </p>
                  {result.context && <p className="text-[11px] italic mt-0.5" style={{ color: "var(--c-text-4)" }}>{result.context}</p>}
                </div>
                <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--c-text-3)" }}>
                  {new Date(comp.date).toLocaleDateString("fr-BE",{day:"numeric",month:"short"})}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddRecordModal athleteName={athlete.name} onClose={() => setShowAdd(false)} onAdd={form => onAddRecord(athlete.id, form)} />}
    </div>
  );
});

// ─── Onglet Charge ────────────────────────────────────────────────────────────

const TabCharge = memo(({ athlete, metrics, weeklyCharge, competitions }) => {
  const { fatigue, forme, recuperation, readiness, risque, acwr } = metrics;
  const chartData = useMemo(() => computeChargeChartData(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const nextComp  = useMemo(() => {
    const now = new Date();
    return (competitions ?? []).filter(c => c.athleteIds.includes(athlete.id) && new Date(c.date) >= now)
      .sort((a,b) => new Date(a.date) - new Date(b.date))[0] ?? null;
  }, [athlete.id, competitions]);
  const analysis  = useMemo(() => generateContextAnalysis(metrics, nextComp), [metrics, nextComp]);
  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  if (!hasCharge) return <EmptySection icon={Activity} title="Aucune charge enregistrée" sub="Les scores apparaîtront dès la première séance saisie." />;

  const scoreCards = [
    { label: "Fatigue",      value: fatigue,      color: scoreColor(fatigue, true),  hint: "> 70 = alerte"  },
    { label: "Forme",        value: forme,        color: scoreColor(forme),          hint: "> 65 = optimal" },
    { label: "Récupération", value: recuperation, color: scoreColor(recuperation),   hint: "0–100"          },
    { label: "Readiness",    value: readiness,    color: scoreColor(readiness),      hint: "> 75 = optimal" },
    { label: "Risque",       value: risque,       color: scoreColor(risque, true),   hint: "> 60 = alerte"  },
  ];

  return (
    <div className="space-y-5">
      {/* Score rings */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {scoreCards.map(s => (
          <div key={s.label} className="card p-4 flex flex-col items-center gap-2">
            <ScoreRing value={s.value} color={s.color} label={s.label} />
            <span className="text-[9.5px] font-medium" style={{ color: "var(--c-text-4)" }}>{s.hint}</span>
          </div>
        ))}
      </div>

      {/* ACWR */}
      <div className="card px-6 py-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--c-text-3)" }}>ACWR (Acute : Chronic)</p>
          <p className="text-[32px] font-black leading-none" style={{ color: acwrColor(acwr) }}>{acwr.toFixed(2)}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--c-text-4)" }}>Cible : 0.80 – 1.30</p>
        </div>
        <div className="flex flex-col gap-1.5 text-[11.5px]" style={{ color: "var(--c-text-3)" }}>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#1D9E75" }} /> 0.80 – 1.30 : Zone optimale</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#378ADD" }} /> {"< 0.80 : Sous-charge"}</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#E24B4A" }} /> {"> 1.30 : Surcharge aiguë"}</span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-3 rounded-full overflow-hidden relative" style={{ background: "var(--c-surface-3)" }}>
            <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(100,(acwr/2)*100)}%`, background:acwrColor(acwr) }} />
          </div>
          <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--c-text-4)" }}><span>0</span><span>0.8</span><span>1.3</span><span>2.0</span></div>
        </div>
      </div>

      {/* Graphique charge */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h4 className="text-[14px] font-bold mb-1" style={{ color: "var(--c-text-1)" }}>Charge vs Forme — 12 semaines</h4>
          <p className="text-[11px] mb-4" style={{ color: "var(--c-text-3)" }}>Charge brute · Forme · Fatigue</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCharge2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradForme2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="rawLoad" name="Charge brute" stroke="#378ADD" fill="url(#gradCharge2)" strokeWidth={2} />
              <Area dataKey="forme"   name="Forme"        stroke="#1D9E75" fill="url(#gradForme2)"  strokeWidth={2} />
              <Line dataKey="fatigue" name="Fatigue"      stroke="#E24B4A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Analyse contextuelle */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,159,39,0.15)" }}>
            <Zap size={15} color="#EF9F27" />
          </div>
          <div>
            <h4 className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Analyse contextuelle</h4>
            <p className="text-[10px]" style={{ color: "var(--c-text-4)" }}>Règles JS · sans IA</p>
          </div>
        </div>
        <div className="space-y-2">
          {analysis.map((line, i) => (
            <div key={i} className="rounded-2xl px-4 py-3" style={{ background: "var(--c-surface-2)" }}>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--c-text-2)" }}>{line}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Onglet Entraînements ─────────────────────────────────────────────────────

const TabEntrainements = memo(({ athlete, sessions }) => {
  const athleteSessions = useMemo(() => {
    if (!sessions.length) return [];
    const maxWeek = Math.max(...sessions.map(s => s.week));
    return sessions
      .filter(s => s.athleteIds.includes(athlete.id) && s.week >= maxWeek - 3)
      .sort((a,b) => b.week - a.week || a.day.localeCompare(b.day));
  }, [athlete.id, sessions]);

  return (
    <div className="space-y-3">
      {athleteSessions.length === 0 ? (
        <EmptySection icon={Dumbbell} title="Aucune séance enregistrée" sub="Les séances apparaîtront ici une fois programmées." />
      ) : (
        athleteSessions.map(s => {
          const val    = s.validations.find(v => v.athleteId === athlete.id);
          const status = val?.status ?? "future";
          const iconBg = { done:"rgba(29,158,117,0.15)", partial:"rgba(239,159,39,0.15)", none:"rgba(226,75,74,0.15)", future:"var(--c-surface-2)" }[status] ?? "var(--c-surface-2)";
          return (
            <div key={s.id} className="card px-5 py-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                {status === "done"    ? <CheckCircle   size={18} color="#1D9E75" /> :
                 status === "partial" ? <AlertTriangle size={18} color="#EF9F27" /> :
                 status === "none"    ? <AlertTriangle size={18} color="#E24B4A" /> :
                 <Clock size={18} style={{ color: "var(--c-text-4)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--c-text-1)" }}>{s.title}</span>
                  <ValidationBadge status={status} />
                </div>
                <p className="text-[11.5px] mb-2" style={{ color: "var(--c-text-3)" }}>
                  {s.day} · Semaine {s.week} · {s.time} · {s.type}
                </p>
                {val?.comment && (
                  <p className="text-[12px] italic mb-2" style={{ color: "var(--c-text-2)" }}>« {val.comment} »</p>
                )}
                {(val?.feeling != null || val?.fatigue != null) && (
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--c-text-3)" }}>
                    {val.feeling != null && <span className="flex items-center gap-1.5">Ressenti <StarRow value={val.feeling} /></span>}
                    {val.fatigue != null && <span className="flex items-center gap-1.5">Fatigue <StarRow value={val.fatigue} color="#E24B4A" /></span>}
                  </div>
                )}
              </div>
              <span className="text-[10px] whitespace-nowrap mt-0.5" style={{ color: "var(--c-text-4)" }}>S{s.week}</span>
            </div>
          );
        })
      )}
    </div>
  );
});

// ─── Onglet Blessures ─────────────────────────────────────────────────────────

const TabBlessures = memo(({ athlete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const injuries = athlete.injuries ?? [];
  const [modalTarget,      setModalTarget]      = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const statusConfig = {
    "chronique": { bg: "rgba(226,75,74,0.15)", color: "#F19A9A", border: "#E24B4A", label: "Chronique" },
    "en suivi":  { bg: "rgba(239,159,39,0.15)", color: "#F0CB61", border: "#EF9F27", label: "En suivi"  },
    "résolu":    { bg: "rgba(29,158,117,0.15)", color: "#7BD8B4", border: "#1D9E75", label: "Résolu"    },
    "actif":     { bg: "rgba(226,75,74,0.15)", color: "#F19A9A", border: "#E24B4A", label: "Actif"      },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalTarget("create")} className="btn-primary">
          <Plus size={13} /> Signaler une blessure
        </button>
      </div>

      {injuries.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={36} color="#1D9E75" className="mx-auto mb-3" />
          <p className="text-[14px] font-bold" style={{ color: "var(--c-text-2)" }}>Aucun antécédent enregistré</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--c-text-4)" }}>Athlète sans blessure connue</p>
        </div>
      ) : (
        injuries.map(inj => {
          const sc     = statusConfig[inj.status] ?? statusConfig["en suivi"];
          const active = inj.status !== "résolu";
          const pct    = (inj.intensity / 10) * 100;
          const iColor = inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#EF9F27" : "#E24B4A";
          return (
            <div
              key={inj.id}
              className={["card overflow-hidden", active ? "border-l-4" : ""].join(" ")}
              style={active ? { borderLeftColor: sc.border } : {}}
            >
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-[15px] font-black" style={{ color: "var(--c-text-1)" }}>{inj.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>📍 {inj.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] mb-1.5" style={{ color: "var(--c-text-4)" }}>Intensité douleur</p>
                    <div className="flex items-center gap-1 justify-end">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-sm transition-colors"
                          style={{ background: i < inj.intensity ? iColor : "var(--c-surface-3)" }} />
                      ))}
                      <span className="text-[13px] font-black ml-1.5" style={{ color: iColor }}>
                        {inj.intensity}/10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barre intensité */}
                <div className="progress-bar mb-3">
                  <div className="progress-fill" style={{ width:`${pct}%`, background:iColor }} />
                </div>

                <div className="flex items-center gap-4 text-[11.5px] mb-3 flex-wrap" style={{ color: "var(--c-text-3)" }}>
                  {inj.startDate && (
                    <span>Début : <strong style={{ color: "var(--c-text-2)" }}>
                      {new Date(inj.startDate).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}
                    </strong></span>
                  )}
                  {!inj.endDate && active && <span className="font-bold" style={{ color: "#EF9F27" }}>⚡ En cours</span>}
                </div>

                {inj.notes && (
                  <div className="rounded-2xl px-4 py-3 border mb-3" style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--c-text-4)" }}>Notes / suivi</p>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--c-text-2)" }}>{inj.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid var(--c-border)" }}>
                  <button onClick={() => setModalTarget(inj)}
                    className="text-[11.5px] font-semibold transition-colors" style={{ color: "var(--c-text-3)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-1)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-3)"}>
                    ✏️ Modifier
                  </button>
                  {confirmDeleteId === inj.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
                      <button onClick={async () => { await onDeleteInjury(inj.id); setConfirmDeleteId(null); }}
                        className="text-[11px] font-bold text-white rounded-lg px-2 py-0.5" style={{ background: "#E24B4A" }}>Oui</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[11px]" style={{ color: "var(--c-text-4)" }}>Non</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(inj.id)}
                      className="text-[11.5px] font-semibold transition-colors" style={{ color: "#F19A9A" }} onMouseEnter={e => e.currentTarget.style.color = "#E24B4A"} onMouseLeave={e => e.currentTarget.style.color = "#F19A9A"}>
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {modalTarget && (
        <AddInjuryModal
          athleteName={athlete.name}
          initialData={modalTarget === "create" ? null : {
            name: modalTarget.name, location: modalTarget.location,
            intensity: modalTarget.intensity, status: modalTarget.status,
            startDate: modalTarget.startDate ?? "", notes: modalTarget.notes ?? "",
          }}
          onClose={() => setModalTarget(null)}
          onSave={form => modalTarget === "create" ? onAddInjury(athlete.id, form) : onUpdateInjury(modalTarget.id, form)}
        />
      )}
    </div>
  );
});

// ─── Onglet Profil ────────────────────────────────────────────────────────────

const TabProfil = memo(({ athlete }) => {
  const p = athlete.profile ?? {};
  const hasProfile = Object.keys(p).length > 0;
  const stabilityScore = computePerformanceStability(athlete.performanceHistory);
  const stabilityColor = s => s === null ? "var(--c-text-4)" : s >= 75 ? "#1D9E75" : s >= 50 ? "#EF9F27" : "#E24B4A";
  const toleranceColor = v => (v==="très élevée"||v==="élevée") ? "#1D9E75" : (v==="modérée"||v==="normale") ? "#EF9F27" : "#E24B4A";

  const stabilityCard = (
    <div className="card px-6 py-5 flex items-center gap-5">
      <div className="flex-shrink-0">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="var(--c-surface-3)" strokeWidth="7" />
          {stabilityScore !== null && (
            <circle cx="36" cy="36" r="28" fill="none" stroke={stabilityColor(stabilityScore)} strokeWidth="7"
              strokeDasharray={`${(stabilityScore/100)*2*Math.PI*28} ${2*Math.PI*28}`}
              strokeLinecap="round" transform="rotate(-90 36 36)" />
          )}
          <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="800" fill={stabilityColor(stabilityScore)}>
            {stabilityScore ?? "—"}
          </text>
        </svg>
      </div>
      <div>
        <p className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>Stabilité de performance</p>
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--c-text-3)" }}>
          {stabilityScore !== null
            ? "Régularité des résultats (coefficient de variation)."
            : "Pas encore assez de mesures (minimum 3)."}
        </p>
      </div>
    </div>
  );

  if (!hasProfile) return <div className="space-y-5">{stabilityCard}<EmptySection icon={User} title="Profil athlétique non complété" sub="L'athlète n'a pas encore renseigné son profil." /></div>;

  const radarData = RADAR_KEYS.map(k => ({ discipline: k.label, value: p[k.key] ?? 0 }));
  const infoRows  = [
    { label: "Récupération",        value: p.recoveryRate       ?? "—" },
    { label: "Tolérance volume",    value: p.volumeTolerance    ?? "—" },
    { label: "Tolérance intensité", value: p.intensityTolerance ?? "—" },
    { label: "Profil psycho",       value: p.psychProfile       ?? "—" },
  ];

  return (
    <div className="space-y-5">
      {stabilityCard}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h4 className="text-[14px] font-bold mb-1" style={{ color: "var(--c-text-1)" }}>Profil athlétique</h4>
          <p className="text-[11px] mb-4" style={{ color: "var(--c-text-4)" }}>Scores 0 – 100</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--c-border)" />
              <PolarAngleAxis dataKey="discipline" tick={{ fontSize:12, fill:"var(--c-text-3)", fontWeight:600 }} />
              <PolarRadiusAxis angle={90} domain={[0,100]} tick={{ fontSize:9, fill:"var(--c-text-4)" }} tickCount={4} />
              <Radar name={athlete.name} dataKey="value" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.18} strokeWidth={2.5} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {RADAR_KEYS.map(k => (
              <div key={k.key} className="text-center">
                <p className="text-[18px] font-black" style={{ color: scoreColor(p[k.key] ?? 0) }}>{p[k.key] ?? "—"}</p>
                <p className="text-[9.5px]" style={{ color: "var(--c-text-4)" }}>{k.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h4 className="text-[14px] font-bold mb-4" style={{ color: "var(--c-text-1)" }}>Caractéristiques</h4>
            <div className="space-y-3">
              {infoRows.map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--c-border)" }}>
                  <span className="text-[12.5px]" style={{ color: "var(--c-text-3)" }}>{r.label}</span>
                  <span className="text-[12.5px] font-bold capitalize" style={{ color: toleranceColor(r.value) }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h4 className="text-[14px] font-bold mb-3" style={{ color: "var(--c-text-1)" }}>Identité</h4>
            <div className="space-y-2.5 text-[12.5px]">
              <div className="flex justify-between"><span style={{ color: "var(--c-text-4)" }}>Discipline</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.mainDiscipline ?? "—"}</span></div>
              {athlete.secondaryDisciplines?.length > 0 && <div className="flex justify-between gap-4"><span style={{ color: "var(--c-text-4)" }}>Secondaires</span><span className="font-bold text-right" style={{ color: "var(--c-text-1)" }}>{athlete.secondaryDisciplines.join(", ")}</span></div>}
              <div className="flex justify-between"><span style={{ color: "var(--c-text-4)" }}>Groupe</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.group ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--c-text-4)" }}>Niveau</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.level ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--c-text-4)" }}>Âge</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.age ? `${athlete.age} ans` : "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── AthleteProfile premium ───────────────────────────────────────────────────

const AthleteProfile = memo(({ athlete, weeklyCharge, sessions, competitions, onBack, onAddRecord, onEditRequest, onDelete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const [activeTab,      setActiveTab]      = useState("performances");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);

  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];

  const handleDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try { await onDelete(athlete.id); onBack(); }
    catch { setDeleteError("Impossible de supprimer : cet athlète a des données liées."); setDeleting(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 animate-slide-up">
      {/* Barre actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors tap-feedback" style={{ color: "var(--c-text-3)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-1)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-3)"}>
          <ArrowLeft size={16} /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onEditRequest(athlete)}
            className="text-[12px] font-bold border rounded-xl px-3 py-1.5 transition-colors" style={{ color: "var(--c-text-3)", borderColor: "var(--c-border)", background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            ✏️ Modifier
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="text-[12px] font-bold border rounded-xl px-3 py-1.5 transition-colors" style={{ color: "#F19A9A", borderColor: "rgba(226,75,74,0.3)", background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(226,75,74,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              🗑️ Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5" style={{ background: "rgba(226,75,74,0.1)", borderColor: "rgba(226,75,74,0.3)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="text-[11px] font-bold text-white rounded-lg px-2 py-0.5 disabled:opacity-50" style={{ background: "#E24B4A" }}>
                {deleting ? "…" : "Oui"}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="text-[11px]" style={{ color: "var(--c-text-4)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-2)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>Non</button>
            </div>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="rounded-2xl px-4 py-3 text-[12.5px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", color: "#F19A9A" }}>
          {deleteError}
        </div>
      )}

      {/* Hero banner */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D9E75 0%, #0f7a5a 60%, #0a6048 100%)" }}
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[20px] font-black flex-shrink-0 shadow-lg"
            style={{ background: "rgba(255,255,255,0.20)" }}
          >
            {athlete.avatar}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-[22px] font-black text-white tracking-tight">{athlete.name}</h2>
              <StatusBadge readiness={readiness} fatigue={fatigue} acwr={acwr} />
              {activeInjuries.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "rgba(239,159,39,0.3)", border: "1px solid rgba(239,159,39,0.4)" }}>
                  <HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-white/70 text-[13px]">{athlete.mainDiscipline ?? "Discipline non renseignée"}</p>
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-white/50 mt-1">
              <span>{athlete.group ?? "—"}</span>
              <span>·</span>
              <span>{athlete.level ?? "—"}</span>
              <span>·</span>
              <span>{athlete.age ? `${athlete.age} ans` : "—"}</span>
            </div>
          </div>

          {/* Métriques inline */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ScoreRing value={readiness} color="white" label="Readiness" size={80} />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">Fatigue</span>
                <span className="font-black text-white">{fatigue}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">Forme</span>
                <span className="font-black text-white">{metrics.forme}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">ACWR</span>
                <span className="font-black text-white">{acwr.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs pill premium */}
      <div className="flex gap-1 rounded-2xl border p-1.5 overflow-x-auto" style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}>
        {TABS.map(tab => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={["flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all flex-1 justify-center tap-feedback", isActive ? "" : "hover:opacity-80"].join(" ")}
              style={isActive ? { background: "#1D9E75", color: "#0A150F", boxShadow: "0 2px 8px rgba(29,158,117,0.30)" } : { color: "var(--c-text-3)", background: "transparent" }}
            >
              <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu onglet */}
      <div className="view-transition">
        {activeTab === "performances"  && <TabPerformances  athlete={athlete} competitions={competitions} onAddRecord={onAddRecord} />}
        {activeTab === "charge"        && <TabCharge        athlete={athlete} metrics={metrics} weeklyCharge={weeklyCharge} competitions={competitions} />}
        {activeTab === "entrainements" && <TabEntrainements athlete={athlete} sessions={sessions} />}
        {activeTab === "blessures"     && <TabBlessures     athlete={athlete} onAddInjury={onAddInjury} onUpdateInjury={onUpdateInjury} onDeleteInjury={onDeleteInjury} />}
        {activeTab === "profil"        && <TabProfil        athlete={athlete} />}
      </div>
    </div>
  );
});

// ─── AthleteCard premium ──────────────────────────────────────────────────────

const AthleteCard = memo(({ athlete, weeklyCharge, onClick }) => {
  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const status         = getStatusLabel(readiness, fatigue, acwr);
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];
  const hasCharge      = weeklyCharge.some(w => w.athleteId === athlete.id);

  return (
    <button
      onClick={() => onClick(athlete)}
      className="card card-hover card-glow-green shimmer-hover text-left p-5 flex flex-col gap-4 w-full tap-feedback"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[14px] font-black flex-shrink-0 shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}
          >
            {athlete.avatar}
          </div>
          <div>
            <p className="text-[14.5px] font-black leading-tight" style={{ color: "var(--c-text-1)" }}>{athlete.name}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--c-text-4)" }}>{athlete.mainDiscipline ?? "—"}</p>
          </div>
        </div>
        <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: "var(--c-text-4)" }} />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {hasCharge && (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
            style={{ background: status.color }}>
            {status.dot} {status.label}
          </span>
        )}
        <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--c-surface-2)", color: "var(--c-text-3)" }}>
          {athlete.level ?? "Niveau —"}
        </span>
        {activeInjuries.length > 0 && (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(239,159,39,0.15)", color: "#F0CB61", border: "1px solid rgba(239,159,39,0.3)" }}>
            ⚕ {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Métriques */}
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Readiness", value: readiness,       color: scoreColor(readiness)       },
            { label: "Fatigue",   value: fatigue,         color: scoreColor(fatigue, true)   },
            { label: "ACWR",      value: acwr.toFixed(2), color: acwrColor(acwr)             },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-2.5 text-center" style={{ background: "var(--c-surface-2)" }}>
              <p className="text-[18px] font-black leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[9.5px] mt-0.5 font-medium" style={{ color: "var(--c-text-4)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl p-3 text-center" style={{ background: "var(--c-surface-2)" }}>
          <p className="text-[11px] font-medium" style={{ color: "var(--c-text-4)" }}>Pas encore de charge enregistrée</p>
        </div>
      )}

      <p className="text-[11px] font-medium" style={{ color: "var(--c-text-4)" }}>{athlete.group ?? "Groupe —"}</p>
    </button>
  );
});

// ─── Composant principal ──────────────────────────────────────────────────────

function AthleteList({ onNavigate }) {
  const { clubId } = useAuth();

  const [selectedAthlete,    setSelectedAthlete]    = useState(null);
  const [athleteModalTarget, setAthleteModalTarget] = useState(null);
  const [athletes,           setAthletes]           = useState([]);
  const [weeklyCharge,       setWeeklyCharge]       = useState([]);
  const [sessions,           setSessions]           = useState([]);
  const [competitions,       setCompetitions]       = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);

  // ═══ Chargement (identique) ═══════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes, competitionsRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
        supabase.from("competitions").select("*").eq("club_id", clubId),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (competitionsRes.error) throw competitionsRes.error;

      const athleteIds     = athletesRes.data.map(a => a.id);
      const sessionIds     = sessionsRes.data.map(s => s.id);
      const competitionIds = competitionsRes.data.map(c => c.id);

      const [recordsRes,injuriesRes,perfHistRes,sessionAthletesRes,compAthletesRes,compResultsRes] = await Promise.all([
        athleteIds.length     ? supabase.from("records").select("*").in("athlete_id", athleteIds)              : Promise.resolve({data:[]}),
        athleteIds.length     ? supabase.from("injuries").select("*").in("athlete_id", athleteIds)             : Promise.resolve({data:[]}),
        athleteIds.length     ? supabase.from("performance_history").select("*").in("athlete_id", athleteIds)  : Promise.resolve({data:[]}),
        sessionIds.length     ? supabase.from("session_athletes").select("*").in("session_id", sessionIds)     : Promise.resolve({data:[]}),
        competitionIds.length ? supabase.from("competition_athletes").select("*").in("competition_id", competitionIds) : Promise.resolve({data:[]}),
        competitionIds.length ? supabase.from("competition_results").select("*").in("competition_id", competitionIds)  : Promise.resolve({data:[]}),
      ]);

      // Charge depuis session_athletes
      const byAthleteWeek = {};
      sessionsRes.data.forEach(s => {
        (sessionAthletesRes.data ?? []).filter(r => r.session_id === s.id).forEach(r => {
          if (r.rpe == null) return;
          const key = `${r.athlete_id}-${s.week}`;
          byAthleteWeek[key] = (byAthleteWeek[key] ?? 0) + (s.duration_minutes ?? 60) * r.rpe;
        });
      });
      const remappedCharge = Object.entries(byAthleteWeek).map(([key, rawLoad]) => {
        const [athleteId, week] = key.split("-").map(Number);
        return { athleteId, week, rawLoad };
      });

      setAthletes((athletesRes.data ?? []).map(a => {
        const pd = a.profile_data ?? {};
        const recs = {};
        (recordsRes.data ?? []).filter(r => r.athlete_id === a.id).forEach(r => { recs[r.discipline] = { sb: r.sb, pr: r.pr, prDate: r.pr_date }; });
        return {
          id: a.id, name: a.name, age: a.age, avatar: pd.avatar ?? initialsFromName(a.name),
          mainDiscipline: a.main_discipline, secondaryDisciplines: pd.secondary_disciplines ?? [],
          group: a.group_name, level: pd.level ?? null,
          records: recs,
          injuries: (injuriesRes.data ?? []).filter(i => i.athlete_id === a.id).map(i => ({
            id: i.id, name: i.name, location: i.location, intensity: i.intensity,
            status: i.status, startDate: i.start_date, endDate: null, notes: i.notes,
          })),
          performanceHistory: (perfHistRes.data ?? []).filter(p => p.athlete_id === a.id).sort((x,y) => x.month.localeCompare(y.month)).map(p => ({ month: p.month, value: p.value })),
          profile: pd.profile ?? {},
        };
      }));

      setWeeklyCharge(remappedCharge);
      setSessions((sessionsRes.data ?? []).map(s => {
        const rows = (sessionAthletesRes.data ?? []).filter(v => v.session_id === s.id);
        return { id: s.id, week: s.week, day: s.day, time: s.time, type: s.type, category: s.category, title: s.title, description: s.description, instructions: s.instructions, loadWeight: s.load_weight, pdfUrl: s.pdf_url, athleteIds: rows.map(v => v.athlete_id), validations: rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, fatigue: v.fatigue, comment: v.comment })) };
      }));
      setCompetitions((competitionsRes.data ?? []).map(c => ({
        id: c.id, name: c.name, date: c.date, location: c.location, type: c.type,
        athleteIds: (compAthletesRes.data ?? []).filter(x => x.competition_id === c.id).map(x => x.athlete_id),
        results:    (compResultsRes.data ?? []).filter(r => r.competition_id === c.id).map(r => ({ athleteId: r.athlete_id, event: r.event, result: r.result, context: r.context })),
      })));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures (identiques) ═══════════════════════════════════════════════
  const addRecord = useCallback(async (athleteId, form) => {
    const { error: e } = await supabase.from("records").insert({ athlete_id: athleteId, discipline: form.discipline, sb: form.sb, pr: form.pr, pr_date: form.prDate || null });
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const createAthlete = useCallback(async (form) => {
    let newUserId = null;
    if (form.email.trim()) {
      const { data: u, error: ue } = await supabase.from("users").insert({ club_id: clubId, name: form.name, email: form.email, role: "athlete" }).select().single();
      if (ue) throw ue; newUserId = u.id;
    }
    const secDisc = form.secondaryDisciplines.split(",").map(s => s.trim()).filter(Boolean);
    const pd = { level: form.level||null, secondary_disciplines:secDisc, profile:{speed:form.speed,strength:form.strength,explosivity:form.explosivity,endurance:form.endurance,technique:form.technique,recoveryRate:form.recoveryRate,volumeTolerance:form.volumeTolerance,intensityTolerance:form.intensityTolerance,psychProfile:form.psychProfile||null} };
    const { error: ae } = await supabase.from("athletes").insert({ club_id:clubId, name:form.name, age:form.age?Number(form.age):null, main_discipline:form.mainDiscipline||null, group_name:form.group||null, user_id:newUserId, profile_data:pd });
    if (ae) throw ae; await fetchAll();
  }, [clubId, fetchAll]);

  const updateAthlete = useCallback(async (athleteId, form) => {
    const secDisc = form.secondaryDisciplines.split(",").map(s => s.trim()).filter(Boolean);
    const pd = { level:form.level||null, secondary_disciplines:secDisc, profile:{speed:form.speed,strength:form.strength,explosivity:form.explosivity,endurance:form.endurance,technique:form.technique,recoveryRate:form.recoveryRate,volumeTolerance:form.volumeTolerance,intensityTolerance:form.intensityTolerance,psychProfile:form.psychProfile||null} };
    const { error: e } = await supabase.from("athletes").update({ name:form.name, age:form.age?Number(form.age):null, main_discipline:form.mainDiscipline||null, group_name:form.group||null, profile_data:pd }).eq("id", athleteId);
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const deleteAthlete = useCallback(async (id) => {
    const { error: e } = await supabase.from("athletes").delete().eq("id", id);
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const addInjury    = useCallback(async (aid, form) => { const {error:e}=await supabase.from("injuries").insert({athlete_id:aid,name:form.name,location:form.location||null,intensity:form.intensity,status:form.status,start_date:form.startDate||null,notes:form.notes||null}); if(e)throw e; await fetchAll(); }, [fetchAll]);
  const updateInjury = useCallback(async (id,  form) => { const {error:e}=await supabase.from("injuries").update({name:form.name,location:form.location||null,intensity:form.intensity,status:form.status,start_date:form.startDate||null,notes:form.notes||null}).eq("id",id); if(e)throw e; await fetchAll(); }, [fetchAll]);
  const deleteInjury = useCallback(async (id)        => { const {error:e}=await supabase.from("injuries").delete().eq("id",id); if(e)throw e; await fetchAll(); }, [fetchAll]);

  function buildFormFromAthlete(a) {
    return { name:a.name??"", email:"", age:a.age??"", mainDiscipline:a.mainDiscipline??"", secondaryDisciplines:(a.secondaryDisciplines??[]).join(", "), group:a.group??"", level:a.level??"", speed:a.profile?.speed??50, strength:a.profile?.strength??50, explosivity:a.profile?.explosivity??50, endurance:a.profile?.endurance??50, technique:a.profile?.technique??50, recoveryRate:a.profile?.recoveryRate??"normale", volumeTolerance:a.profile?.volumeTolerance??"modérée", intensityTolerance:a.profile?.intensityTolerance??"modérée", psychProfile:a.profile?.psychProfile??"" };
  }

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des athlètes…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const liveSelected = selectedAthlete ? athletes.find(a => a.id === selectedAthlete.id) ?? selectedAthlete : null;

  if (liveSelected) {
    return (
      <>
        <AthleteProfile
          athlete={liveSelected} weeklyCharge={weeklyCharge}
          sessions={sessions} competitions={competitions}
          onBack={() => setSelectedAthlete(null)}
          onAddRecord={addRecord}
          onEditRequest={setAthleteModalTarget}
          onDelete={deleteAthlete}
          onAddInjury={addInjury} onUpdateInjury={updateInjury} onDeleteInjury={deleteInjury}
        />
        {athleteModalTarget && (
          <AddAthleteModal
            onClose={() => setAthleteModalTarget(null)}
            onCreate={athleteModalTarget === "create" ? createAthlete : form => updateAthlete(athleteModalTarget.id, form)}
            initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-black tracking-tight" style={{ color: "var(--c-text-1)" }}>Athlètes</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
            {athletes.length > 0
              ? `${athletes.length} athlète${athletes.length>1?"s":""} suivi${athletes.length>1?"s":""} · Cliquez pour le profil complet`
              : "Aucun athlète pour l'instant"}
          </p>
        </div>
        <button onClick={() => setAthleteModalTarget("create")} className="btn-primary">
          <Plus size={16} /> Inscrire un athlète
        </button>
      </div>

      {athletes.length === 0 ? (
        <EmptySection icon={UsersIcon} title="Aucun athlète enregistré" sub="Clique sur « Inscrire un athlète » pour ajouter le premier." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {athletes.map(a => (
            <AthleteCard key={a.id} athlete={a} weeklyCharge={weeklyCharge} onClick={setSelectedAthlete} />
          ))}
        </div>
      )}

      {athleteModalTarget && (
        <AddAthleteModal
          onClose={() => setAthleteModalTarget(null)}
          onCreate={athleteModalTarget === "create" ? createAthlete : form => updateAthlete(athleteModalTarget.id, form)}
          initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
        />
      )}
    </div>
  );
}

export default memo(AthleteList);