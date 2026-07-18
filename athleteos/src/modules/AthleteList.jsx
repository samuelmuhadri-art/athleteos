// ============================================================
// AthleteOS — src/modules/AthleteList.jsx
// Version nettoyée Phase 2 :
// - useAuth() remplace .eq("club_id", 1) partout
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : 5 onglets, CRUD athlètes, records,
// blessures, charge scientifique, profil athlétique, radar.
// ============================================================

import { memo, useState, useMemo, useCallback, useEffect } from "react";
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
  { id: "profil",        label: "Profil Athlétique", icon: User       },
];

const RADAR_KEYS = [
  { key: "speed",       label: "Vitesse"     },
  { key: "strength",    label: "Force"       },
  { key: "explosivity", label: "Explosivité" },
  { key: "endurance",   label: "Endurance"   },
  { key: "technique",   label: "Technique"   },
];

const RADAR_KEYS_FORM = RADAR_KEYS;

const INJURY_STATUS_OPTIONS = ["actif", "en suivi", "chronique", "résolu"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(val, inverted = false) {
  if (inverted) {
    if (val > 70) return "#E24B4A";
    if (val > 45) return "#EF9F27";
    return "#1D9E75";
  }
  if (val >= 75) return "#1D9E75";
  if (val >= 50) return "#EF9F27";
  return "#E24B4A";
}

function acwrColor(acwr) {
  if (acwr > 1.3) return "#E24B4A";
  if (acwr < 0.8) return "#378ADD";
  return "#1D9E75";
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";

// ─── Sous-composants UI ───────────────────────────────────────────────────────

function StatusBadge({ readiness, fatigue, acwr }) {
  const s = getStatusLabel(readiness, fatigue, acwr);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold text-white" style={{ background: s.color }}>
      {s.dot} {s.label}
    </span>
  );
}

function ScoreRing({ value, color, label, size = 72 }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{value}</text>
      </svg>
      <span className="text-[11px] text-slate-400 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     cls: "bg-emerald-50 text-emerald-700" },
    partial: { label: "Partielle",    cls: "bg-amber-50 text-amber-700"     },
    none:    { label: "Non réalisée", cls: "bg-red-50 text-red-700"         },
    future:  { label: "À venir",      cls: "bg-slate-100 text-slate-400"    },
  };
  const b = map[status] ?? map.future;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>;
}

function StarRow({ value, max = 5, color = "#EF9F27" }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={11} fill={i < value ? color : "none"} color={i < value ? color : "#e2e8f0"} />
      ))}
    </div>
  );
}

function EmptySection({ icon: Icon = Trophy, title, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
      <Icon size={28} className="text-slate-200 mx-auto mb-2" />
      <p className="text-[13px] font-semibold text-slate-500">{title}</p>
      {sub && <p className="text-[11.5px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2.5 text-[12px]">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name} : <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── Modal record ─────────────────────────────────────────────────────────────

const AddRecordModal = memo(({ athleteName, onClose, onAdd }) => {
  const [form,      setForm]      = useState({ discipline: "", sb: "", pr: "", prDate: "" });
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.discipline.trim() || !form.sb.trim() || !form.pr.trim()) return;
    setSaving(true); setSaveError(null);
    try { await onAdd(form); onClose(); }
    catch (err) { setSaveError(err.message ?? "Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="text-[16px] font-bold text-slate-800">Ajouter un record</h3><p className="text-[12px] text-slate-400 mt-0.5">{athleteName}</p></div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {saveError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{saveError}</div>}
          <div><label className={labelCls}>Épreuve *</label><input className={inputCls} placeholder="Ex: 100m, Longueur…" value={form.discipline} onChange={(e) => set("discipline", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Season Best *</label><input className={inputCls} placeholder="Ex: 10.94s" value={form.sb} onChange={(e) => set("sb", e.target.value)} /></div>
            <div><label className={labelCls}>Record perso *</label><input className={inputCls} placeholder="Ex: 10.62s" value={form.pr} onChange={(e) => set("pr", e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Date du record perso</label><input type="date" className={inputCls} value={form.prDate} onChange={(e) => set("prDate", e.target.value)} /></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.discipline.trim() || !form.sb.trim() || !form.pr.trim() || saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "#1D9E75" }}>
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Modal blessure ───────────────────────────────────────────────────────────

const AddInjuryModal = memo(({ athleteName, initialData, onClose, onSave }) => {
  const isEdit = initialData != null;
  const [form,      setForm]      = useState(initialData ?? { name: "", location: "", intensity: 5, status: "actif", startDate: "", notes: "" });
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setSaveError(null);
    try { await onSave(form); onClose(); }
    catch (err) { setSaveError(err.message ?? "Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div><h3 className="text-[16px] font-bold text-slate-800">{isEdit ? "Modifier la blessure" : "Signaler une blessure"}</h3><p className="text-[12px] text-slate-400 mt-0.5">{athleteName}</p></div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {saveError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{saveError}</div>}
          <div><label className={labelCls}>Nom de la blessure *</label><input className={inputCls} placeholder="Ex: Tendinopathie rotulienne" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={labelCls}>Localisation</label><input className={inputCls} placeholder="Ex: Genou droit" value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-1"><label className={labelCls}>Intensité douleur</label><span className="text-[11px] font-bold text-emerald-600">{form.intensity}/10</span></div>
            <input type="range" min="0" max="10" value={form.intensity} onChange={(e) => set("intensity", Number(e.target.value))} className="w-full accent-emerald-600" />
          </div>
          <div><label className={labelCls}>Statut</label><select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>{INJURY_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
          <div><label className={labelCls}>Date de début</label><input type="date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><label className={labelCls}>Notes / suivi</label><textarea className={`${inputCls} resize-none`} rows={3} placeholder="Kiné, consignes, restrictions…" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "#1D9E75" }}>
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Enregistrement…</> : <><Plus size={15} />{isEdit ? "Enregistrer" : "Ajouter"}</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Modal athlète ────────────────────────────────────────────────────────────

const AddAthleteModal = memo(({ onClose, onCreate, initialData = null }) => {
  const isEdit = initialData != null;
  const [form, setForm] = useState(initialData ?? { name: "", email: "", age: "", mainDiscipline: "", secondaryDisciplines: "", group: "", level: "", speed: 50, strength: 50, explosivity: 50, endurance: 50, technique: 50, recoveryRate: "normale", volumeTolerance: "modérée", intensityTolerance: "modérée", psychProfile: "" });
  const [showProfile, setShowProfile] = useState(isEdit);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setSaveError(null);
    try { await onCreate(form); onClose(); }
    catch (err) { setSaveError(err.message ?? `Erreur lors de ${isEdit ? "la modification" : "l'inscription"}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-slate-800">{isEdit ? "Modifier le profil" : "Inscrire un nouvel athlète"}</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">{isEdit ? "Modifie uniquement ce qui a changé." : "Seul le nom est obligatoire."}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {saveError && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">{saveError}</div>}
          <div><label className={labelCls}>Nom complet *</label><input className={inputCls} placeholder="Ex: Nora Vandenberghe" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={labelCls}>Email (pour la messagerie)</label><input type="email" className={inputCls} placeholder="nora.v@exemple.be" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Âge</label><input type="number" className={inputCls} value={form.age} onChange={(e) => set("age", e.target.value)} /></div>
            <div><label className={labelCls}>Niveau</label><input className={inputCls} placeholder="Ex: Régional" value={form.level} onChange={(e) => set("level", e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Discipline principale</label><input className={inputCls} placeholder="Ex: Sprint 100m/200m" value={form.mainDiscipline} onChange={(e) => set("mainDiscipline", e.target.value)} /></div>
          <div><label className={labelCls}>Disciplines secondaires</label><input className={inputCls} placeholder="Séparées par des virgules" value={form.secondaryDisciplines} onChange={(e) => set("secondaryDisciplines", e.target.value)} /></div>
          <div><label className={labelCls}>Groupe d'entraînement</label><input className={inputCls} placeholder="Ex: Sprint-Haies" value={form.group} onChange={(e) => set("group", e.target.value)} /></div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowProfile((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-[12px] font-semibold text-slate-600">Profil athlétique initial (optionnel)</span>
              <span className="text-[11px] text-slate-400">{showProfile ? "Replier ▲" : "Déplier ▼"}</span>
            </button>
            {showProfile && (
              <div className="p-3.5 space-y-3">
                {RADAR_KEYS_FORM.map((k) => (
                  <div key={k.key}>
                    <div className="flex items-center justify-between mb-1"><label className="text-[11.5px] text-slate-500">{k.label}</label><span className="text-[11px] font-bold text-emerald-600">{form[k.key]}</span></div>
                    <input type="range" min="0" max="100" value={form[k.key]} onChange={(e) => set(k.key, Number(e.target.value))} className="w-full accent-emerald-600" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div><label className={labelCls}>Récupération</label><select className={inputCls} value={form.recoveryRate} onChange={(e) => set("recoveryRate", e.target.value)}>{["lente","normale","rapide"].map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}</select></div>
                  <div><label className={labelCls}>Tolérance volume</label><select className={inputCls} value={form.volumeTolerance} onChange={(e) => set("volumeTolerance", e.target.value)}>{["faible","modérée","élevée"].map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}</select></div>
                  <div><label className={labelCls}>Tolérance intensité</label><select className={inputCls} value={form.intensityTolerance} onChange={(e) => set("intensityTolerance", e.target.value)}>{["faible","modérée","élevée","très élevée"].map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}</select></div>
                  <div><label className={labelCls}>Profil psychologique</label><input className={inputCls} placeholder="Ex: compétitif" value={form.psychProfile} onChange={(e) => set("psychProfile", e.target.value)} /></div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors disabled:opacity-40">Annuler</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "#1D9E75" }}>
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isEdit ? "Enregistrement…" : "Inscription…"}</> : <><Plus size={15} />{isEdit ? "Enregistrer les modifications" : "Inscrire l'athlète"}</>}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Onglet 1 — Performances ──────────────────────────────────────────────────

const TabPerformances = memo(({ athlete, competitions, onAddRecord }) => {
  const disciplines       = Object.keys(athlete.records ?? {});
  const [selectedDisc,   setSelectedDisc]   = useState(disciplines[0]);
  const [showAddRecord,  setShowAddRecord]  = useState(false);

  const chartData = useMemo(() =>
    (athlete.performanceHistory ?? []).filter((p) => p.value !== null).map((p) => ({ ...p, label: String(p.month).slice(0, 7) })),
  [athlete]);

  const compHistory = useMemo(() => {
    const all = [];
    (competitions ?? []).forEach((c) => {
      if (!c.athleteIds.includes(athlete.id)) return;
      c.results.filter((r) => r.athleteId === athlete.id).forEach((r) => all.push({ comp: c, result: r }));
    });
    return all.sort((a, b) => new Date(b.comp.date) - new Date(a.comp.date));
  }, [athlete, competitions]);

  const rec = selectedDisc ? athlete.records?.[selectedDisc] : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h4 className="text-[14px] font-semibold text-slate-700">Records & Season Best</h4>
          <button onClick={() => setShowAddRecord(true)} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md" style={{ background: "#1D9E75" }}>
            <Plus size={13} /> Ajouter un record
          </button>
        </div>
        {disciplines.length === 0 ? (
          <EmptySection icon={Trophy} title="Aucun record enregistré" sub="Les records apparaîtront ici dès qu'ils seront ajoutés." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="border-b border-slate-50">{["Épreuve","SB 2025","PR","Date PR","% PR atteint"].map((h) => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {disciplines.map((disc) => {
                  const r = athlete.records[disc];
                  const sbNum = parseFloat(r.sb), prNum = parseFloat(r.pr);
                  const pct = !isNaN(sbNum) && !isNaN(prNum) && prNum > 0 ? Math.min(100, Math.round((sbNum / prNum) * 100)) : null;
                  const pc = pct === null ? "#94a3b8" : pct >= 95 ? "#1D9E75" : pct >= 85 ? "#EF9F27" : "#E24B4A";
                  return (
                    <tr key={disc} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">{disc}</td>
                      <td className="px-4 py-3 text-slate-600">{r.sb}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: "#1D9E75" }}>{r.pr}</td>
                      <td className="px-4 py-3 text-slate-400">{r.prDate ? new Date(r.prDate).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                      <td className="px-4 py-3">{pct !== null ? <div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pc }} /></div><span className="text-[11px] font-semibold" style={{ color: pc }}>{pct}%</span></div> : <span className="text-slate-300 text-[11px]">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {disciplines.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div><h4 className="text-[14px] font-semibold text-slate-700">Évolution — {athlete.mainDiscipline}</h4><p className="text-[11px] text-slate-400 mt-0.5">24 derniers mois</p></div>
            <div className="flex flex-wrap gap-1.5">
              {disciplines.slice(0, 5).map((d) => (
                <button key={d} onClick={() => setSelectedDisc(d)} className={["px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all", selectedDisc === d ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"].join(" ")}>{d}</button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} /><Tooltip content={<ChartTooltip />} /><Line dataKey="value" name={athlete.mainDiscipline} stroke="#1D9E75" strokeWidth={2.5} dot={{ r: 4, fill: "#1D9E75" }} activeDot={{ r: 6 }} connectNulls={false} /></LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-300 text-[13px]">Pas de données disponibles</div>
          )}
          {rec && <div className="mt-3 flex items-center gap-4 text-[12px] text-slate-400"><span>SB : <strong className="text-slate-600">{rec.sb}</strong></span><span>PR : <strong className="text-emerald-600">{rec.pr}</strong></span>{rec.prDate && <span>Date PR : <strong className="text-slate-600">{new Date(rec.prDate).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" })}</strong></span>}</div>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50"><h4 className="text-[14px] font-semibold text-slate-700">Historique compétitions</h4></div>
        {compHistory.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-300 text-[13px]">Aucune compétition enregistrée</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {compHistory.map(({ comp, result }, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><Trophy size={16} color="#EF9F27" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5"><span className="text-[13px] font-semibold text-slate-700">{comp.name}</span><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{comp.type}</span></div>
                  <p className="text-[12px] text-slate-500 mb-1">{result.event} — <strong className="text-emerald-600">{result.result}</strong></p>
                  {result.context && <p className="text-[11px] text-slate-400 italic">{result.context}</p>}
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(comp.date).toLocaleDateString("fr-BE", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddRecord && <AddRecordModal athleteName={athlete.name} onClose={() => setShowAddRecord(false)} onAdd={(form) => onAddRecord(athlete.id, form)} />}
    </div>
  );
});

// ─── Onglet 2 — Charge & Forme ────────────────────────────────────────────────

const TabCharge = memo(({ athlete, metrics, weeklyCharge, competitions }) => {
  const { fatigue, forme, recuperation, readiness, risque, acwr } = metrics;
  const chartData = useMemo(() => computeChargeChartData(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const nextComp  = useMemo(() => {
    const now = new Date();
    return (competitions ?? []).filter((c) => c.athleteIds.includes(athlete.id) && new Date(c.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
  }, [athlete.id, competitions]);
  const analysis = useMemo(() => generateContextAnalysis(metrics, nextComp), [metrics, nextComp]);
  const hasCharge = weeklyCharge.some((w) => w.athleteId === athlete.id);

  if (!hasCharge) return <EmptySection icon={Activity} title="Aucune charge d'entraînement enregistrée" sub="Les scores apparaîtront dès la première séance saisie." />;

  const scoreCards = [
    { label: "Fatigue",      value: fatigue,     color: scoreColor(fatigue, true),  hint: "> 70 = alerte"  },
    { label: "Forme",        value: forme,        color: scoreColor(forme),          hint: "> 65 = optimal" },
    { label: "Récupération", value: recuperation, color: scoreColor(recuperation),   hint: "0–100"          },
    { label: "Readiness",    value: readiness,    color: scoreColor(readiness),      hint: "> 75 = optimal" },
    { label: "Risque",       value: risque,       color: scoreColor(risque, true),   hint: "> 60 = alerte"  },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        {scoreCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col items-center gap-2">
            <ScoreRing value={s.value} color={s.color} label={s.label} />
            <span className="text-[10px] text-slate-300">{s.hint}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ACWR (Acute : Chronic)</p>
          <p className="text-[28px] font-bold" style={{ color: acwrColor(acwr) }}>{acwr.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cible : 0.80 – 1.30</p>
        </div>
        <div className="flex flex-col gap-1 text-[12px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> 0.80 – 1.30 : Zone optimale</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {"< 0.80 : Sous-charge"}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> {"> 1.30 : Surcharge aiguë"}</span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (acwr / 2) * 100)}%`, background: acwrColor(acwr) }} />
            <div className="absolute top-0 h-full border-l-2 border-emerald-400 opacity-50" style={{ left: "40%" }} />
            <div className="absolute top-0 h-full border-l-2 border-emerald-400 opacity-50" style={{ left: "65%" }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-300 mt-0.5"><span>0</span><span>0.8</span><span>1.3</span><span>2.0</span></div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h4 className="text-[14px] font-semibold text-slate-700 mb-1">Charge vs Forme — 12 semaines</h4>
          <p className="text-[11px] text-slate-400 mb-4">Axe gauche : rawLoad · scores de forme et fatigue</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradCharge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#378ADD" stopOpacity={0.25} /><stop offset="95%" stopColor="#378ADD" stopOpacity={0} /></linearGradient>
                <linearGradient id="gradForme" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1D9E75" stopOpacity={0.2} /><stop offset="95%" stopColor="#1D9E75" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="rawLoad" name="Charge brute" stroke="#378ADD" fill="url(#gradCharge)" strokeWidth={2} />
              <Area dataKey="forme"   name="Forme"        stroke="#1D9E75" fill="url(#gradForme)"  strokeWidth={2} />
              <Line dataKey="fatigue" name="Fatigue"      stroke="#E24B4A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3"><Zap size={15} color="#EF9F27" /><h4 className="text-[14px] font-semibold text-slate-700">Analyse contextuelle automatique</h4><span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-medium">Règles JS · sans IA</span></div>
        <div className="space-y-2">{analysis.map((line, i) => <p key={i} className="text-[13px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-4 py-3">{line}</p>)}</div>
      </div>
    </div>
  );
});

// ─── Onglet 3 — Entraînements ─────────────────────────────────────────────────

const TabEntrainements = memo(({ athlete, sessions }) => {
  const athleteSessions = useMemo(() => {
    if (!sessions.length) return [];
    const maxWeek = Math.max(...sessions.map((s) => s.week));
    return sessions.filter((s) => s.athleteIds.includes(athlete.id) && s.week >= maxWeek - 3).sort((a, b) => b.week - a.week || a.day.localeCompare(b.day));
  }, [athlete.id, sessions]);

  return (
    <div className="space-y-3">
      {athleteSessions.length === 0 ? (
        <EmptySection icon={Dumbbell} title="Aucune séance enregistrée" sub="Les séances apparaîtront ici une fois programmées." />
      ) : (
        athleteSessions.map((s) => {
          const val = s.validations.find((v) => v.athleteId === athlete.id);
          const status = val?.status ?? "future";
          return (
            <div key={s.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-start gap-4">
              <div className={["w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", status === "done" ? "bg-emerald-50" : status === "partial" ? "bg-amber-50" : status === "none" ? "bg-red-50" : "bg-slate-50"].join(" ")}>
                {status === "done" ? <CheckCircle size={17} color="#1D9E75" /> : status === "partial" ? <AlertTriangle size={17} color="#EF9F27" /> : status === "none" ? <AlertTriangle size={17} color="#E24B4A" /> : <Clock size={17} color="#94a3b8" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1"><span className="text-[13px] font-semibold text-slate-700">{s.title}</span><ValidationBadge status={status} /></div>
                <p className="text-[11.5px] text-slate-400 mb-2">{s.day} · Semaine {s.week} · {s.time} · {s.type}</p>
                {val?.comment && <p className="text-[12px] text-slate-500 italic mb-2">« {val.comment} »</p>}
                {(val?.feeling != null || val?.fatigue != null) && (
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    {val.feeling != null && <span className="flex items-center gap-1.5">Ressenti <StarRow value={val.feeling} /></span>}
                    {val.fatigue != null && <span className="flex items-center gap-1.5">Fatigue <StarRow value={val.fatigue} color="#E24B4A" /></span>}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-300 whitespace-nowrap mt-0.5">S{s.week}</span>
            </div>
          );
        })
      )}
    </div>
  );
});

// ─── Onglet 4 — Blessures ─────────────────────────────────────────────────────

const TabBlessures = memo(({ athlete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const injuries = athlete.injuries ?? [];
  const [modalTarget, setModalTarget]         = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const statusConfig = {
    "chronique": { cls: "bg-red-100 text-red-700",         label: "Chronique" },
    "en suivi":  { cls: "bg-amber-100 text-amber-700",     label: "En suivi"  },
    "résolu":    { cls: "bg-emerald-100 text-emerald-700", label: "Résolu"    },
    "actif":     { cls: "bg-red-100 text-red-700",         label: "Actif"     },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalTarget("create")} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md" style={{ background: "#1D9E75" }}>
          <Plus size={13} /> Signaler une blessure
        </button>
      </div>

      {injuries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
          <CheckCircle size={32} color="#1D9E75" className="mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-slate-600">Aucun antécédent enregistré</p>
          <p className="text-[12px] text-slate-400 mt-1">Athlète sans blessure connue</p>
        </div>
      ) : (
        injuries.map((inj) => {
          const sc = statusConfig[inj.status] ?? statusConfig["en suivi"];
          const active = inj.status !== "résolu";
          return (
            <div key={inj.id} className={["bg-white rounded-xl border shadow-sm overflow-hidden", active ? "border-l-4" : "border-slate-100"].join(" ")} style={active ? { borderLeftColor: inj.status === "chronique" ? "#E24B4A" : "#EF9F27" } : {}}>
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1"><h4 className="text-[15px] font-bold text-slate-800">{inj.name}</h4><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span></div>
                    <p className="text-[12px] text-slate-500">📍 {inj.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 mb-1">Intensité douleur</p>
                    <div className="flex items-center gap-1 justify-end">
                      {Array.from({ length: 10 }).map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: i < inj.intensity ? inj.intensity <= 3 ? "#1D9E75" : inj.intensity <= 6 ? "#EF9F27" : "#E24B4A" : "#f1f5f9" }} />)}
                      <span className="text-[12px] font-bold text-slate-600 ml-1">{inj.intensity}/10</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11.5px] text-slate-400 mb-3 flex-wrap">
                  {inj.startDate && <span>Début : <strong className="text-slate-600">{new Date(inj.startDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}</strong></span>}
                  {inj.endDate && <span>Fin : <strong className="text-slate-600">{new Date(inj.endDate).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}</strong></span>}
                  {!inj.endDate && active && <span className="text-amber-600 font-semibold">En cours</span>}
                </div>
                {inj.notes && <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100 mb-3"><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes / suivi</p><p className="text-[12.5px] text-slate-600 leading-relaxed">{inj.notes}</p></div>}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                  <button onClick={() => setModalTarget(inj)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">✏️ Modifier</button>
                  {confirmDeleteId === inj.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-red-600">Confirmer ?</span>
                      <button onClick={async () => { await onDeleteInjury(inj.id); setConfirmDeleteId(null); }} className="text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded px-2 py-0.5">Oui</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] text-slate-500">Non</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(inj.id)} className="text-[11px] font-semibold text-red-400 hover:text-red-600">🗑️ Supprimer</button>
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
          initialData={modalTarget === "create" ? null : { name: modalTarget.name, location: modalTarget.location, intensity: modalTarget.intensity, status: modalTarget.status, startDate: modalTarget.startDate ?? "", notes: modalTarget.notes ?? "" }}
          onClose={() => setModalTarget(null)}
          onSave={(form) => modalTarget === "create" ? onAddInjury(athlete.id, form) : onUpdateInjury(modalTarget.id, form)}
        />
      )}
    </div>
  );
});

// ─── Onglet 5 — Profil Athlétique ─────────────────────────────────────────────

const TabProfil = memo(({ athlete }) => {
  const p = athlete.profile ?? {};
  const hasProfile = Object.keys(p).length > 0;
  const stabilityScore = computePerformanceStability(athlete.performanceHistory);

  const stabilityColor = (s) => {
    if (s === null) return "#94a3b8";
    if (s >= 75)   return "#1D9E75";
    if (s >= 50)   return "#EF9F27";
    return "#E24B4A";
  };

  const toleranceColor = (val) => {
    if (val === "très élevée" || val === "élevée") return "#1D9E75";
    if (val === "modérée"     || val === "normale") return "#EF9F27";
    return "#E24B4A";
  };

  const stabilityCard = (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className="flex-shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="6" />
          {stabilityScore !== null && <circle cx="32" cy="32" r="26" fill="none" stroke={stabilityColor(stabilityScore)} strokeWidth="6" strokeDasharray={`${(stabilityScore / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`} strokeLinecap="round" transform="rotate(-90 32 32)" />}
          <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill={stabilityColor(stabilityScore)}>{stabilityScore ?? "—"}</text>
        </svg>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-slate-700">Stabilité de performance</p>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{stabilityScore !== null ? "Mesure la régularité des résultats (coefficient de variation)." : "Pas encore assez de mesures (minimum 3)."}</p>
      </div>
    </div>
  );

  if (!hasProfile) return <div className="space-y-5">{stabilityCard}<EmptySection icon={User} title="Profil athlétique non complété" sub="L'athlète n'a pas encore renseigné son profil." /></div>;

  const radarData = RADAR_KEYS.map((k) => ({ discipline: k.label, value: p[k.key] ?? 0 }));
  const infoRows = [
    { label: "Récupération",        value: p.recoveryRate       ?? "—" },
    { label: "Tolérance volume",    value: p.volumeTolerance    ?? "—" },
    { label: "Tolérance intensité", value: p.intensityTolerance ?? "—" },
    { label: "Profil psychologique",value: p.psychProfile       ?? "—" },
  ];

  return (
    <div className="space-y-5">
      {stabilityCard}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h4 className="text-[14px] font-semibold text-slate-700 mb-1">Profil athlétique</h4>
          <p className="text-[11px] text-slate-400 mb-4">Scores de 0 à 100</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#f1f5f9" />
              <PolarAngleAxis dataKey="discipline" tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={4} />
              <Radar name={athlete.name} dataKey="value" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-2 mt-2">{RADAR_KEYS.map((k) => <div key={k.key} className="text-center"><p className="text-[18px] font-bold text-slate-700">{p[k.key] ?? "—"}</p><p className="text-[10px] text-slate-400">{k.label}</p></div>)}</div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-[14px] font-semibold text-slate-700 mb-4">Caractéristiques individuelles</h4>
            <div className="space-y-3">{infoRows.map((r) => <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"><span className="text-[12.5px] text-slate-500">{r.label}</span><span className="text-[12.5px] font-semibold capitalize" style={{ color: toleranceColor(r.value) }}>{r.value}</span></div>)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-[14px] font-semibold text-slate-700 mb-3">Identité</h4>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between"><span className="text-slate-400">Discipline principale</span><span className="font-semibold text-slate-700">{athlete.mainDiscipline ?? "—"}</span></div>
              {athlete.secondaryDisciplines?.length > 0 && <div className="flex justify-between gap-4"><span className="text-slate-400">Disciplines secondaires</span><span className="font-semibold text-slate-700 text-right">{athlete.secondaryDisciplines.join(", ")}</span></div>}
              <div className="flex justify-between"><span className="text-slate-400">Groupe</span><span className="font-semibold text-slate-700">{athlete.group ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Niveau</span><span className="font-semibold text-slate-700">{athlete.level ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Âge</span><span className="font-semibold text-slate-700">{athlete.age ? `${athlete.age} ans` : "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Vue profil complet ───────────────────────────────────────────────────────

const AthleteProfile = memo(({ athlete, weeklyCharge, sessions, competitions, onBack, onAddRecord, onEditRequest, onDelete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const [activeTab,     setActiveTab]     = useState("performances");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);

  const metrics          = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const activeInjuries   = athlete.injuries?.filter((i) => i.status !== "résolu") ?? [];

  const handleDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try { await onDelete(athlete.id); onBack(); }
    catch { setDeleteError("Impossible de supprimer : cet athlète a des données liées. Supprime d'abord ces éléments."); setDeleting(false); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft size={16} /> Retour à la liste</button>
        <div className="flex items-center gap-2">
          <button onClick={() => onEditRequest(athlete)} className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">✏️ Modifier</button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-[12px] font-semibold text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 transition-colors">🗑️ Supprimer</button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-[12px] text-red-700 font-medium">Confirmer ?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 rounded px-2 py-1 disabled:opacity-50">{deleting ? "…" : "Oui"}</button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="text-[11px] text-slate-500 hover:text-slate-700">Non</button>
            </div>
          )}
        </div>
      </div>

      {deleteError && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[12.5px] text-red-700">{deleteError}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[18px] font-bold flex-shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}>{athlete.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">{athlete.name}</h2>
              <StatusBadge readiness={readiness} fatigue={fatigue} acwr={acwr} />
              {activeInjuries.length > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""} active{activeInjuries.length > 1 ? "s" : ""}</span>}
            </div>
            <p className="text-[13px] text-slate-500 mb-2">{athlete.mainDiscipline ?? "Discipline non renseignée"}{athlete.secondaryDisciplines?.length > 0 && <span className="text-slate-300"> · {athlete.secondaryDisciplines.join(", ")}</span>}</p>
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-slate-400"><span>{athlete.group ?? "—"}</span><span>·</span><span>{athlete.level ?? "—"}</span><span>·</span><span>{athlete.age ? `${athlete.age} ans` : "—"}</span></div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <ScoreRing value={readiness} color={scoreColor(readiness)} label="Readiness" size={80} />
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between gap-6"><span className="text-slate-400">Fatigue</span><span className="font-semibold" style={{ color: scoreColor(fatigue, true) }}>{fatigue}/100</span></div>
              <div className="flex items-center justify-between gap-6"><span className="text-slate-400">Forme</span><span className="font-semibold" style={{ color: scoreColor(metrics.forme) }}>{metrics.forme}/100</span></div>
              <div className="flex items-center justify-between gap-6"><span className="text-slate-400">ACWR</span><span className="font-semibold" style={{ color: acwrColor(acwr) }}>{acwr.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-slate-100 shadow-sm p-1.5 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={["flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-all flex-1 justify-center", isActive ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"].join(" ")}>
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "performances"  && <TabPerformances  athlete={athlete} competitions={competitions} onAddRecord={onAddRecord} />}
      {activeTab === "charge"        && <TabCharge        athlete={athlete} metrics={metrics} weeklyCharge={weeklyCharge} competitions={competitions} />}
      {activeTab === "entrainements" && <TabEntrainements athlete={athlete} sessions={sessions} />}
      {activeTab === "blessures"     && <TabBlessures     athlete={athlete} onAddInjury={onAddInjury} onUpdateInjury={onUpdateInjury} onDeleteInjury={onDeleteInjury} />}
      {activeTab === "profil"        && <TabProfil        athlete={athlete} />}
    </div>
  );
});

// ─── Carte athlète ────────────────────────────────────────────────────────────

const AthleteCard = memo(({ athlete, weeklyCharge, onClick }) => {
  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const status         = getStatusLabel(readiness, fatigue, acwr);
  const activeInjuries = athlete.injuries?.filter((i) => i.status !== "résolu") ?? [];
  const hasCharge      = weeklyCharge.some((w) => w.athleteId === athlete.id);

  return (
    <button onClick={() => onClick(athlete)} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left p-5 flex flex-col gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #1D9E75, #16826C)" }}>{athlete.avatar}</div>
          <div><p className="text-[14px] font-bold text-slate-800 leading-tight">{athlete.name}</p><p className="text-[11px] text-slate-400 mt-0.5">{athlete.mainDiscipline ?? "Discipline non renseignée"}</p></div>
        </div>
        <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-1" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hasCharge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: status.color }}>{status.dot} {status.label}</span>}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{athlete.level ?? "Niveau non renseigné"}</span>
        {activeInjuries.length > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⚕ {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}</span>}
      </div>
      {hasCharge ? (
        <div className="grid grid-cols-3 gap-2">
          {[{ label: "Readiness", value: readiness, color: scoreColor(readiness) }, { label: "Fatigue", value: fatigue, color: scoreColor(fatigue, true) }, { label: "ACWR", value: acwr.toFixed(2), color: acwrColor(acwr) }].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-lg p-2.5 text-center"><p className="text-[17px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p><p className="text-[9.5px] text-slate-400 mt-0.5">{s.label}</p></div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-[11px] text-slate-400">Pas encore de charge enregistrée</p></div>
      )}
      <p className="text-[11px] text-slate-400">{athlete.group ?? "Groupe non renseigné"}</p>
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

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const [athletesRes, sessionsRes, competitionsRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
        supabase.from("competitions").select("*").eq("club_id", clubId),
      ]);
      if (athletesRes.error)     throw athletesRes.error;
      if (sessionsRes.error)     throw sessionsRes.error;
      if (competitionsRes.error) throw competitionsRes.error;

      const athleteIds     = athletesRes.data.map((a) => a.id);
      const sessionIds     = sessionsRes.data.map((s) => s.id);
      const competitionIds = competitionsRes.data.map((c) => c.id);

      const [recordsRes, injuriesRes, perfHistRes, sessionAthletesRes, compAthletesRes, compResultsRes] = await Promise.all([
        athleteIds.length     ? supabase.from("records").select("*").in("athlete_id", athleteIds)                                          : Promise.resolve({ data: [], error: null }),
        athleteIds.length     ? supabase.from("injuries").select("*").in("athlete_id", athleteIds)                                         : Promise.resolve({ data: [], error: null }),
        athleteIds.length     ? supabase.from("performance_history").select("*").in("athlete_id", athleteIds)                              : Promise.resolve({ data: [], error: null }),
        sessionIds.length     ? supabase.from("session_athletes").select("*").in("session_id", sessionIds)                                 : Promise.resolve({ data: [], error: null }),
        competitionIds.length ? supabase.from("competition_athletes").select("*").in("competition_id", competitionIds)                     : Promise.resolve({ data: [], error: null }),
        competitionIds.length ? supabase.from("competition_results").select("*").in("competition_id", competitionIds)                      : Promise.resolve({ data: [], error: null }),
      ]);
      if (recordsRes.error)         throw recordsRes.error;
      if (injuriesRes.error)        throw injuriesRes.error;
      if (perfHistRes.error)        throw perfHistRes.error;
      if (sessionAthletesRes.error) throw sessionAthletesRes.error;
      if (compAthletesRes.error)    throw compAthletesRes.error;
      if (compResultsRes.error)     throw compResultsRes.error;

      // Charge calculée depuis session_athletes (RPE réels)
      const saForCharge = sessionAthletesRes.data;
      const byAthleteWeek = {};
      sessionsRes.data.forEach((s) => {
        saForCharge.filter((r) => r.session_id === s.id).forEach((r) => {
          if (r.rpe == null) return;
          const key = `${r.athlete_id}-${s.week}`;
          byAthleteWeek[key] = (byAthleteWeek[key] ?? 0) + (s.duration_minutes ?? 60) * r.rpe;
        });
      });
      const remappedCharge = Object.entries(byAthleteWeek).map(([key, rawLoad]) => {
        const [athleteId, week] = key.split("-").map(Number);
        return { athleteId, week, rawLoad };
      });

      const assembledAthletes = athletesRes.data.map((a) => {
        const pd = a.profile_data ?? {};
        const recs = {};
        recordsRes.data.filter((r) => r.athlete_id === a.id).forEach((r) => { recs[r.discipline] = { sb: r.sb, pr: r.pr, prDate: r.pr_date }; });
        const inj = injuriesRes.data.filter((i) => i.athlete_id === a.id).map((i) => ({ id: i.id, name: i.name, location: i.location, intensity: i.intensity, status: i.status, startDate: i.start_date, endDate: null, notes: i.notes }));
        const perfHistory = perfHistRes.data.filter((p) => p.athlete_id === a.id).sort((x, y) => x.month.localeCompare(y.month)).map((p) => ({ month: p.month, value: p.value }));
        return {
          id: a.id, name: a.name, age: a.age, avatar: pd.avatar ?? initialsFromName(a.name),
          mainDiscipline: a.main_discipline, secondaryDisciplines: pd.secondary_disciplines ?? [],
          group: a.group_name, level: pd.level ?? null,
          records: recs, injuries: inj, performanceHistory: perfHistory,
          profile: pd.profile ?? {},
        };
      });

      const remappedSessions = sessionsRes.data.map((s) => {
        const rows = sessionAthletesRes.data.filter((v) => v.session_id === s.id);
        return { id: s.id, week: s.week, day: s.day, time: s.time, type: s.type, category: s.category, title: s.title, description: s.description, instructions: s.instructions, loadWeight: s.load_weight, pdfUrl: s.pdf_url, athleteIds: rows.map((v) => v.athlete_id), validations: rows.map((v) => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, fatigue: v.fatigue, comment: v.comment })) };
      });

      const remappedCompetitions = competitionsRes.data.map((c) => ({
        id: c.id, name: c.name, date: c.date, location: c.location, type: c.type,
        athleteIds: compAthletesRes.data.filter((x) => x.competition_id === c.id).map((x) => x.athlete_id),
        results: compResultsRes.data.filter((r) => r.competition_id === c.id).map((r) => ({ athleteId: r.athlete_id, event: r.event, result: r.result, context: r.context })),
      }));

      setAthletes(assembledAthletes);
      setWeeklyCharge(remappedCharge);
      setSessions(remappedSessions);
      setCompetitions(remappedCompetitions);
    } catch (err) {
      console.error("AthleteList — chargement :", err);
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures ════════════════════════════════════════════════════════════

  const addRecord = useCallback(async (athleteId, form) => {
    const { error: err } = await supabase.from("records").insert({ athlete_id: athleteId, discipline: form.discipline, sb: form.sb, pr: form.pr, pr_date: form.prDate || null });
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const createAthlete = useCallback(async (form) => {
    let newUserId = null;
    if (form.email.trim()) {
      const { data: newUser, error: userError } = await supabase.from("users").insert({ club_id: clubId, name: form.name, email: form.email, role: "athlete" }).select().single();
      if (userError) throw userError;
      newUserId = newUser.id;
    }
    const secondaryDisciplines = form.secondaryDisciplines.split(",").map((s) => s.trim()).filter(Boolean);
    const profileData = { level: form.level || null, secondary_disciplines: secondaryDisciplines, profile: { speed: form.speed, strength: form.strength, explosivity: form.explosivity, endurance: form.endurance, technique: form.technique, recoveryRate: form.recoveryRate, volumeTolerance: form.volumeTolerance, intensityTolerance: form.intensityTolerance, psychProfile: form.psychProfile || null } };
    const { error: athleteError } = await supabase.from("athletes").insert({ club_id: clubId, name: form.name, age: form.age ? Number(form.age) : null, main_discipline: form.mainDiscipline || null, group_name: form.group || null, user_id: newUserId, profile_data: profileData });
    if (athleteError) throw athleteError;
    await fetchAll();
  }, [clubId, fetchAll]);

  const updateAthlete = useCallback(async (athleteId, form) => {
    const secondaryDisciplines = form.secondaryDisciplines.split(",").map((s) => s.trim()).filter(Boolean);
    const profileData = { level: form.level || null, secondary_disciplines: secondaryDisciplines, profile: { speed: form.speed, strength: form.strength, explosivity: form.explosivity, endurance: form.endurance, technique: form.technique, recoveryRate: form.recoveryRate, volumeTolerance: form.volumeTolerance, intensityTolerance: form.intensityTolerance, psychProfile: form.psychProfile || null } };
    const { error: err } = await supabase.from("athletes").update({ name: form.name, age: form.age ? Number(form.age) : null, main_discipline: form.mainDiscipline || null, group_name: form.group || null, profile_data: profileData }).eq("id", athleteId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const deleteAthlete = useCallback(async (athleteId) => {
    const { error: err } = await supabase.from("athletes").delete().eq("id", athleteId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const addInjury = useCallback(async (athleteId, form) => {
    const { error: err } = await supabase.from("injuries").insert({ athlete_id: athleteId, name: form.name, location: form.location || null, intensity: form.intensity, status: form.status, start_date: form.startDate || null, notes: form.notes || null });
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const updateInjury = useCallback(async (injuryId, form) => {
    const { error: err } = await supabase.from("injuries").update({ name: form.name, location: form.location || null, intensity: form.intensity, status: form.status, start_date: form.startDate || null, notes: form.notes || null }).eq("id", injuryId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const deleteInjury = useCallback(async (injuryId) => {
    const { error: err } = await supabase.from("injuries").delete().eq("id", injuryId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  function buildFormFromAthlete(a) {
    return { name: a.name ?? "", email: "", age: a.age ?? "", mainDiscipline: a.mainDiscipline ?? "", secondaryDisciplines: (a.secondaryDisciplines ?? []).join(", "), group: a.group ?? "", level: a.level ?? "", speed: a.profile?.speed ?? 50, strength: a.profile?.strength ?? 50, explosivity: a.profile?.explosivity ?? 50, endurance: a.profile?.endurance ?? 50, technique: a.profile?.technique ?? 50, recoveryRate: a.profile?.recoveryRate ?? "normale", volumeTolerance: a.profile?.volumeTolerance ?? "modérée", intensityTolerance: a.profile?.intensityTolerance ?? "modérée", psychProfile: a.profile?.psychProfile ?? "" };
  }

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des athlètes…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const liveSelected = selectedAthlete ? athletes.find((a) => a.id === selectedAthlete.id) ?? selectedAthlete : null;

  if (liveSelected) {
    return (
      <>
        <AthleteProfile
          athlete={liveSelected}
          weeklyCharge={weeklyCharge}
          sessions={sessions}
          competitions={competitions}
          onBack={() => setSelectedAthlete(null)}
          onAddRecord={addRecord}
          onEditRequest={setAthleteModalTarget}
          onDelete={deleteAthlete}
          onAddInjury={addInjury}
          onUpdateInjury={updateInjury}
          onDeleteInjury={deleteInjury}
        />
        {athleteModalTarget && (
          <AddAthleteModal
            onClose={() => setAthleteModalTarget(null)}
            onCreate={athleteModalTarget === "create" ? createAthlete : (form) => updateAthlete(athleteModalTarget.id, form)}
            initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Athlètes</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {athletes.length > 0 ? `${athletes.length} athlète${athletes.length > 1 ? "s" : ""} suivi${athletes.length > 1 ? "s" : ""} · Cliquez sur un profil pour le détail complet` : "Aucun athlète pour l'instant"}
          </p>
        </div>
        <button onClick={() => setAthleteModalTarget("create")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:shadow-md transition-all" style={{ background: "#1D9E75" }}>
          <Plus size={16} /> Inscrire un athlète
        </button>
      </div>

      {athletes.length === 0 ? (
        <EmptySection icon={UsersIcon} title="Aucun athlète enregistré" sub="Clique sur « Inscrire un athlète » pour ajouter le premier." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {athletes.map((a) => <AthleteCard key={a.id} athlete={a} weeklyCharge={weeklyCharge} onClick={setSelectedAthlete} />)}
        </div>
      )}

      {athleteModalTarget && (
        <AddAthleteModal
          onClose={() => setAthleteModalTarget(null)}
          onCreate={athleteModalTarget === "create" ? createAthlete : (form) => updateAthlete(athleteModalTarget.id, form)}
          initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
        />
      )}
    </div>
  );
}

export default memo(AthleteList);