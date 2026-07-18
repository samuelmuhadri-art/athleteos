// ============================================================
// AthleteOS — src/modules/Competitions.jsx
// CORRECTION Auth Phase 3 :
// - useAuth() remplace club_id: 1 hardcodé (4 occurrences corrigées)
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : timeline, modal détail, CRUD compétitions,
// ajout résultats, détection auto record → alerte, analyse contextuelle.
// ============================================================

import { memo, useState, useMemo, useEffect, useCallback } from "react";
import {
  MapPin, CalendarDays, Users, Trophy,
  ChevronRight, X, TrendingUp, TrendingDown,
  Minus, Clock, Zap, AlertTriangle, CheckCircle, Plus,
} from "lucide-react";
import { supabase }                 from "../utils/supabaseClient";
import { useAuth }                  from "../context/AuthContext";
import LoadingState                 from "../components/ui/LoadingState";
import ErrorState                   from "../components/ui/ErrorState";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { alertNewRecord, notifyAthleteResult } from "../utils/notifications";

// ─── Config types de compétition (UI statique) ────────────────────────────────

const TYPE_CONFIG = {
  "préparation": {
    label: "Préparation", bg: "#F1F5F9", border: "#94A3B8",
    text: "#475569", dot: "#94A3B8", badge: "bg-slate-100 text-slate-500",
  },
  "régional": {
    label: "Régional", bg: "#EFF6FF", border: "#378ADD",
    text: "#1D4ED8", dot: "#378ADD", badge: "bg-blue-50 text-blue-700",
  },
  "objectif": {
    label: "Objectif", bg: "#F0FDF4", border: "#1D9E75",
    text: "#14532D", dot: "#1D9E75", badge: "bg-emerald-50 text-emerald-700",
  },
  "objectif A": {
    label: "Objectif A", bg: "#FFF1F2", border: "#E24B4A",
    text: "#9F1239", dot: "#E24B4A", badge: "bg-red-50 text-red-700",
  },
};

const ATHLETE_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

function getTypeConfig(type) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["préparation"];
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr, opts = {}) {
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    ...opts,
  });
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function dateToWeek(dateStr) {
  const d    = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

function parsePerf(str) {
  if (!str) return { value: null, higherIsBetter: true };
  const s = str.toString().trim();
  if (/^\d+:\d+/.test(s)) {
    const [min, sec] = s.split(":").map(Number);
    return { value: min * 60 + sec, higherIsBetter: false };
  }
  if (s.endsWith("m"))                          return { value: parseFloat(s), higherIsBetter: true  };
  if (s.includes("pts"))                        return { value: parseFloat(s), higherIsBetter: true  };
  if (s.endsWith("s") || /^\d+\.\d+$/.test(s)) return { value: parseFloat(s), higherIsBetter: false };
  const num = parseFloat(s);
  return { value: isNaN(num) ? null : num, higherIsBetter: true };
}

function isNewRecord(newResult, existingPr) {
  if (!existingPr) return true;
  const a = parsePerf(newResult);
  const b = parsePerf(existingPr);
  if (a.value === null || b.value === null) return false;
  return a.higherIsBetter ? a.value > b.value : a.value < b.value;
}

function generateResultAnalysis(result, competition, athlete, weeklyCharge) {
  const week    = dateToWeek(competition.date);
  const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week);
  const { acwr, fatigue, readiness } = metrics;
  const lines = [];

  if (acwr > 1.3) {
    lines.push(
      `⚠️ ACWR de ${acwr.toFixed(2)} à la date de cette compétition (semaine ~${week}). ` +
      `L'athlète était en phase de charge élevée — une performance en deçà du PR est normale et attendue dans ce contexte.`
    );
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    lines.push(
      `✅ ACWR optimal à ${acwr.toFixed(2)} à la date de cette compétition. ` +
      `L'athlète était dans une fenêtre de performance favorable.`
    );
  } else {
    lines.push(
      `📉 ACWR bas (${acwr.toFixed(2)}) à la date de cette compétition. ` +
      `L'athlète était en sous-charge — possibilité de déconditionnement léger.`
    );
  }

  if (fatigue > 65) {
    lines.push(
      `Fatigue estimée à ${fatigue}/100 — niveau élevé. Le résultat doit être interprété avec prudence : ` +
      `la fatigue accumulée peut masquer le vrai niveau de l'athlète.`
    );
  } else if (fatigue < 35) {
    lines.push(
      `Fatigue estimée à ${fatigue}/100 — athlète frais. Les conditions étaient réunies pour une bonne performance.`
    );
  }

  if (readiness >= 70) {
    lines.push(`Readiness estimé : ${readiness}/100 — l'athlète était prêt à performer.`);
  } else if (readiness < 50) {
    lines.push(`Readiness estimé : ${readiness}/100 — disponibilité physique limitée à cette date.`);
  }

  const activeInjuries = athlete.injuries?.filter((inj) => {
    const start    = new Date(inj.startDate);
    const end      = inj.endDate ? new Date(inj.endDate) : new Date("2099-01-01");
    const compDate = new Date(competition.date);
    return compDate >= start && compDate <= end;
  }) ?? [];

  if (activeInjuries.length > 0) {
    lines.push(
      `🩺 Blessure(s) active(s) à cette période : ${activeInjuries.map((i) => i.name).join(", ")}. ` +
      `À prendre en compte dans l'évaluation du résultat.`
    );
  }

  return lines;
}

function athleteColor(athleteId, athletes) {
  const idx = athletes.findIndex((x) => x.id === athleteId);
  return ATHLETE_COLORS[idx % ATHLETE_COLORS.length];
}

// ─── Composant carte compétition (timeline) ───────────────────────────────────

const CompCard = memo(({ competition, athletes, isPast, isNext, onClick }) => {
  const cfg            = getTypeConfig(competition.type);
  const days           = daysUntil(competition.date);
  const hasResults     = competition.results?.length > 0;
  const engagedAthletes = athletes.filter((a) => competition.athleteIds.includes(a.id));

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center flex-shrink-0 w-12">
        <div
          className="w-4 h-4 rounded-full border-2 border-white shadow-md flex-shrink-0 z-10 mt-5"
          style={{ background: cfg.dot }}
        />
        <div className="flex-1 w-0.5 bg-slate-100 mt-1" />
      </div>

      <button
        onClick={() => onClick(competition)}
        className="flex-1 mb-4 text-left bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 overflow-hidden"
        style={{ borderColor: isNext ? cfg.border : "#f1f5f9", borderWidth: isNext ? "1.5px" : "1px" }}
      >
        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{ background: cfg.bg, borderBottom: `1.5px solid ${cfg.border}20` }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cfg.text }}>
              {cfg.label}
            </span>
            {isNext && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white ml-1">
                PROCHAINE
              </span>
            )}
          </div>
          {isPast ? (
            hasResults ? (
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle size={10} /> Résultats disponibles
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Passée · sans résultat
              </span>
            )
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`}
            </span>
          )}
        </div>

        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-slate-800 leading-tight mb-2">
              {competition.name}
            </h3>
            <div className="flex items-center gap-4 text-[12px] text-slate-400 mb-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} />
                {formatDateShort(competition.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={12} />
                {competition.location || "Lieu non renseigné"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {engagedAthletes.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    title={a.name}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background: athleteColor(a.id, athletes) }}
                  >
                    {a.avatar.slice(0, 1)}
                  </div>
                ))}
                {engagedAthletes.length > 5 && (
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-500 text-[9px] font-bold">
                    +{engagedAthletes.length - 5}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {engagedAthletes.length} athlète{engagedAthletes.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300 flex-shrink-0 mt-1 group-hover:text-slate-500 transition-colors" />
        </div>
      </button>
    </div>
  );
});

// ─── Mini-formulaire "Ajouter un résultat" ────────────────────────────────────

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
    <div className="mt-2 space-y-1.5 bg-white border border-slate-200 rounded-lg p-2.5">
      <input
        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]"
        placeholder="Épreuve (ex: 100m)"
        value={form.event}
        onChange={(e) => set("event", e.target.value)}
      />
      <input
        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]"
        placeholder="Résultat (ex: 10.94s)"
        value={form.result}
        onChange={(e) => set("result", e.target.value)}
      />
      <input
        className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]"
        placeholder="Contexte (optionnel)"
        value={form.context}
        onChange={(e) => set("context", e.target.value)}
      />
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-[10px] text-slate-400 hover:text-slate-600"
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

// ─── Modal de détail compétition ──────────────────────────────────────────────

const CompModal = memo(({ competition, athletes, weeklyCharge, records, onClose, onAddResult }) => {
  if (!competition) return null;

  const cfg            = getTypeConfig(competition.type);
  const isPast         = daysUntil(competition.date) < 0;
  const days           = daysUntil(competition.date);
  const engagedAthletes = athletes.filter((a) => competition.athleteIds.includes(a.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div
          className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.border}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: cfg.border + "25", color: cfg.text }}
              >
                {cfg.label}
              </span>
              {!isPast && days <= 14 && days >= 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  {days === 0 ? "Aujourd'hui !" : `Dans ${days} jours`}
                </span>
              )}
              {isPast && (
                <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  Compétition passée
                </span>
              )}
            </div>
            <h3 className="text-[20px] font-bold leading-tight" style={{ color: cfg.text }}>
              {competition.name}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-[12px] flex-wrap" style={{ color: cfg.text + "bb" }}>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} />
                {formatDate(competition.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {competition.location || "Lieu non renseigné"}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors flex-shrink-0">
            <X size={18} style={{ color: cfg.text }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Athlètes engagés ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-slate-400" />
              <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
                Athlètes engagés ({engagedAthletes.length})
              </h4>
            </div>
            {engagedAthletes.length === 0 ? (
              <p className="text-[12px] text-slate-300">Aucun athlète engagé pour l'instant.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {engagedAthletes.map((a) => {
                  const color        = athleteColor(a.id, athletes);
                  const result       = competition.results?.find((r) => r.athleteId === a.id);
                  const plannedEvent = competition.plannedEvents?.[a.id];
                  const week         = dateToWeek(competition.date);
                  const metrics      = getAthleteMetricsForWeek(a.id, weeklyCharge, week);

                  return (
                    <div key={a.id} className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: color }}
                      >
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-700">{a.name}</p>
                        {plannedEvent && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Zap size={10} className="text-amber-500" />
                            Prévu : <strong className="text-slate-600">{plannedEvent}</strong>
                          </p>
                        )}
                        {result ? (
                          <div className="mt-1.5">
                            <p className="text-[11px] text-slate-500">
                              {result.event} :{" "}
                              <strong className="text-emerald-600">{result.result}</strong>
                              {(() => {
                                const rec   = records.find((r) => r.athleteId === a.id && r.discipline === result.event);
                                const isPR  = rec && rec.pr === result.result && rec.prDate === competition.date;
                                return isPR ? (
                                  <span className="ml-1.5 text-[10px] font-bold text-amber-600">🏆 Nouveau record !</span>
                                ) : null;
                              })()}
                            </p>
                          </div>
                        ) : isPast ? (
                          <AddResultInline
                            athlete={a}
                            competitionId={competition.id}
                            defaultEvent={plannedEvent}
                            onAdd={onAddResult}
                          />
                        ) : (
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 flex-wrap">
                            <span>ACWR prévu :</span>
                            <span className="font-bold" style={{ color: metrics.acwr > 1.3 ? "#E24B4A" : metrics.acwr < 0.8 ? "#378ADD" : "#1D9E75" }}>
                              {metrics.acwr.toFixed(2)}
                            </span>
                            <span>· Readiness :</span>
                            <span className="font-bold" style={{ color: metrics.readiness >= 70 ? "#1D9E75" : metrics.readiness >= 50 ? "#EF9F27" : "#E24B4A" }}>
                              {metrics.readiness}/100
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Résultats + analyse contextuelle ─────────────────────── */}
          {isPast && competition.results?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} className="text-slate-400" />
                <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
                  Résultats & Analyse contextuelle
                </h4>
              </div>
              <div className="space-y-4">
                {competition.results.map((result, i) => {
                  const athlete  = athletes.find((a) => a.id === result.athleteId);
                  if (!athlete) return null;
                  const color    = athleteColor(athlete.id, athletes);
                  const analysis = generateResultAnalysis(result, competition, athlete, weeklyCharge);
                  const week     = dateToWeek(competition.date);
                  const metrics  = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week);

                  return (
                    <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ background: color }}
                          >
                            {athlete.avatar}
                          </div>
                          <span className="text-[13px] font-bold text-slate-700">{athlete.name}</span>
                          <span className="text-[11px] text-slate-400">{result.event}</span>
                        </div>
                        <span className="text-[16px] font-bold text-emerald-600">{result.result}</span>
                      </div>

                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4 flex-wrap text-[11px]">
                        <span className="text-slate-400">À la semaine ~{week} :</span>
                        <span className="flex items-center gap-1">
                          ACWR :
                          <strong className="ml-1" style={{ color: metrics.acwr > 1.3 ? "#E24B4A" : metrics.acwr < 0.8 ? "#378ADD" : "#1D9E75" }}>
                            {metrics.acwr.toFixed(2)}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          Fatigue :
                          <strong className="ml-1" style={{ color: metrics.fatigue > 70 ? "#E24B4A" : metrics.fatigue > 45 ? "#EF9F27" : "#1D9E75" }}>
                            {metrics.fatigue}/100
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          Readiness :
                          <strong className="ml-1" style={{ color: metrics.readiness >= 70 ? "#1D9E75" : metrics.readiness >= 50 ? "#EF9F27" : "#E24B4A" }}>
                            {metrics.readiness}/100
                          </strong>
                        </span>
                      </div>

                      <div className="px-4 py-3 space-y-1.5">
                        {analysis.map((line, j) => (
                          <p key={j} className="text-[12px] text-slate-600 leading-relaxed">{line}</p>
                        ))}
                        {result.context && (
                          <p className="text-[11.5px] text-slate-400 italic pt-1 border-t border-slate-50 mt-2">
                            Note du coach : {result.context}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isPast && !(competition.results?.length > 0) && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
              <Trophy size={24} className="mx-auto mb-2 text-slate-200" />
              <p className="text-[12.5px] text-slate-400">
                Aucun résultat enregistré pour cette compétition. Utilise "Ajouter un résultat" sous chaque athlète ci-dessus.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Modal de création de compétition ─────────────────────────────────────────

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

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
  const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-slate-800">Créer une compétition</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">
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
              <p className="text-[12px] text-slate-300 mt-1">Aucun athlète disponible</p>
            ) : (
              <div className="space-y-2 mt-1">
                {athletes.map((a) => {
                  const entry    = form.athleteEntries.find((e) => e.athleteId === a.id);
                  const selected = !!entry;
                  return (
                    <div
                      key={a.id}
                      className={`rounded-lg border transition-all ${selected ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}
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
                        <span className={selected ? "text-emerald-700" : "text-slate-500"}>{a.name}</span>
                      </button>
                      {selected && (
                        <div className="px-2.5 pb-2">
                          <input
                            className="w-full border border-slate-200 rounded px-2 py-1 text-[11.5px]"
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

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
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

// ─── Composant principal ──────────────────────────────────────────────────────

function Competitions() {
  // ✅ CORRECTION : useAuth() remplace club_id: 1 hardcodé
  const { clubId } = useAuth();

  const [selectedComp,    setSelectedComp]    = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [athletes,        setAthletes]        = useState([]);
  const [weeklyCharge,    setWeeklyCharge]    = useState([]);
  const [competitionList, setCompetitionList] = useState([]);
  const [records,         setRecords]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return; // ✅ CORRECTION : attendre que clubId soit disponible
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRECTION 1 : .eq("club_id", clubId) au lieu de .eq("club_id", 1)
      const athletesRes = await supabase
        .from("athletes")
        .select("id, name, main_discipline, profile_data")
        .eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map((a) => a.id);

      const [chargeRes, competitionsRes, recordsRes] = await Promise.all([
        athleteIds.length
          ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
        // ✅ CORRECTION 2 : .eq("club_id", clubId) au lieu de .eq("club_id", 1)
        supabase.from("competitions").select("*").eq("club_id", clubId),
        athleteIds.length
          ? supabase.from("records").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (chargeRes.error)       throw chargeRes.error;
      if (competitionsRes.error) throw competitionsRes.error;
      if (recordsRes.error)      throw recordsRes.error;

      const competitionIds = competitionsRes.data.map((c) => c.id);

      const [compAthletesRes, compResultsRes] = await Promise.all([
        competitionIds.length
          ? supabase.from("competition_athletes").select("*").in("competition_id", competitionIds)
          : Promise.resolve({ data: [], error: null }),
        competitionIds.length
          ? supabase.from("competition_results").select("*").in("competition_id", competitionIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (compAthletesRes.error) throw compAthletesRes.error;
      if (compResultsRes.error)  throw compResultsRes.error;

      const remappedAthletes = athletesRes.data.map((a) => ({
        id:             a.id,
        name:           a.name,
        mainDiscipline: a.main_discipline,
        avatar:         a.profile_data?.avatar ?? initialsFromName(a.name),
        injuries:       [],
      }));

      const remappedCharge = chargeRes.data.map((c) => ({
        athleteId: c.athlete_id,
        week:      c.week,
        rawLoad:   c.raw_load,
      }));

      const remappedCompetitions = competitionsRes.data.map((c) => {
        const rows   = compAthletesRes.data.filter((x) => x.competition_id === c.id);
        const athIds = rows.map((x) => x.athlete_id);
        const plannedEvents = {};
        rows.forEach((r) => { plannedEvents[r.athlete_id] = r.planned_event; });
        const results = compResultsRes.data
          .filter((r) => r.competition_id === c.id)
          .map((r) => ({
            athleteId: r.athlete_id,
            event:     r.event,
            result:    r.result,
            context:   r.context,
          }));
        return {
          id: c.id, name: c.name, date: c.date,
          location: c.location, type: c.type,
          athleteIds: athIds, plannedEvents, results,
        };
      });

      setAthletes(remappedAthletes);
      setWeeklyCharge(remappedCharge);
      setCompetitionList(remappedCompetitions);
      setRecords(recordsRes.data.map((r) => ({
        id:         r.id,
        athleteId:  r.athlete_id,
        discipline: r.discipline,
        sb:         r.sb,
        pr:         r.pr,
        prDate:     r.pr_date,
      })));
    } catch (err) {
      console.error("Erreur chargement Competitions :", err);
      setError(err.message ?? "Erreur inconnue lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [clubId]); // ✅ clubId dans les dépendances

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écriture : créer une compétition ════════════════════════════════════

  const createCompetition = useCallback(async (form) => {
    const { data: newComp, error: compError } = await supabase
      .from("competitions")
      .insert({
        club_id:  clubId, // ✅ CORRECTION 3 : clubId au lieu de 1
        name:     form.name,
        date:     form.date,
        location: form.location || null,
        type:     form.type,
      })
      .select()
      .single();
    if (compError) throw compError;

    if (form.athleteEntries.length > 0) {
      const rows = form.athleteEntries.map((e) => ({
        competition_id: newComp.id,
        athlete_id:     e.athleteId,
        planned_event:  e.plannedEvent || null,
      }));
      const { error: linkError } = await supabase.from("competition_athletes").insert(rows);
      if (linkError) throw linkError;
    }

    await fetchAll();
  }, [clubId, fetchAll]); // ✅ clubId dans les dépendances

  // ═══ Écriture : ajouter un résultat ══════════════════════════════════════

  const addResult = useCallback(async (competitionId, athleteId, form) => {
    const { error: insertError } = await supabase
      .from("competition_results")
      .insert({
        competition_id: competitionId,
        athlete_id:     athleteId,
        event:          form.event,
        result:         form.result,
        context:        form.context || null,
      });
    if (insertError) throw insertError;

    // Détection automatique de record personnel
    const competition    = competitionList.find((c) => c.id === competitionId);
    const athlete        = athletes.find((a) => a.id === athleteId);
    const existingRecord = records.find((r) => r.athleteId === athleteId && r.discipline === form.event);

    if (isNewRecord(form.result, existingRecord?.pr)) {
      if (existingRecord) {
        const { error: updateError } = await supabase
          .from("records")
          .update({ pr: form.result, pr_date: competition?.date ?? null, sb: form.result })
          .eq("id", existingRecord.id);
        if (updateError) console.error("Erreur mise à jour record :", updateError);
      } else {
        const { error: insertRecError } = await supabase
          .from("records")
          .insert({
            athlete_id: athleteId,
            discipline: form.event,
            sb:         form.result,
            pr:         form.result,
            pr_date:    competition?.date ?? null,
          });
        if (insertRecError) console.error("Erreur création record :", insertRecError);
      }
      // ✅ Système centralisé : alerte coach + notif athlète
      await alertNewRecord(clubId, athlete, form.event, form.result, competition?.name);
      await notifyAthleteResult(clubId, athleteId, form.event, form.result, competition?.name ?? "");
    } else {
      // Notif athlète même sans record
      await notifyAthleteResult(clubId, athleteId, form.event, form.result, competition?.name ?? "");
    }

    await fetchAll();
  }, [fetchAll, competitionList, athletes, records, clubId]); // ✅ clubId dans les dépendances

  // Synchronise la compétition sélectionnée avec les données fraîches
  const liveSelectedComp = selectedComp
    ? competitionList.find((c) => c.id === selectedComp.id) ?? selectedComp
    : null;

  const sorted = useMemo(
    () => [...competitionList].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [competitionList]
  );

  const now         = new Date();
  const pastComps   = sorted.filter((c) => new Date(c.date) < now);
  const futureComps = sorted.filter((c) => new Date(c.date) >= now);
  const nextComp    = futureComps[0];

  const stats = useMemo(() => ({
    total:       competitionList.length,
    past:        pastComps.length,
    upcoming:    futureComps.length,
    withResults: competitionList.filter((c) => c.results?.length > 0).length,
  }), [competitionList, pastComps, futureComps]);

  // ═══ Render ═══════════════════════════════════════════════════════════════

  if (loading) return <LoadingState message="Chargement des compétitions…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Compétitions</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">Calendrier et analyse des performances</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={athletes.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-40"
          style={{ background: "#1D9E75" }}
        >
          <Plus size={16} />
          Créer une compétition
        </button>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total saison",   value: stats.total,       color: "#378ADD", icon: CalendarDays },
          { label: "Passées",        value: stats.past,        color: "#94A3B8", icon: Clock        },
          { label: "À venir",        value: stats.upcoming,    color: "#1D9E75", icon: TrendingUp   },
          { label: "Avec résultats", value: stats.withResults, color: "#EF9F27", icon: Trophy       },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                <Icon size={16} color={s.color} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-slate-800 leading-none">{s.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende types ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: cfg.dot }} />
            <span className="text-slate-500 font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      {competitionList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-[15px] font-semibold text-slate-400">Aucune compétition programmée</p>
          <p className="text-[12px] text-slate-300 mt-1">
            Clique sur "Créer une compétition" pour démarrer le calendrier de saison.
          </p>
        </div>
      ) : (
        <div>
          {/* Compétitions passées */}
          {pastComps.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-2">
                  Compétitions passées
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="opacity-75">
                {pastComps.map((c) => (
                  <CompCard
                    key={c.id}
                    competition={c}
                    athletes={athletes}
                    isPast={true}
                    isNext={false}
                    onClick={setSelectedComp}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Séparateur "Aujourd'hui" */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-emerald-200" />
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Aujourd'hui · {new Date().toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>

          {/* Compétitions à venir */}
          {futureComps.length > 0 ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-2">
                  À venir
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              {futureComps.map((c) => (
                <CompCard
                  key={c.id}
                  competition={c}
                  athletes={athletes}
                  isPast={false}
                  isNext={c.id === nextComp?.id}
                  onClick={setSelectedComp}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
              <Trophy size={32} className="mx-auto mb-2 text-slate-200" />
              <p className="text-[14px] font-semibold text-slate-400">Aucune compétition à venir programmée</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {liveSelectedComp && (
        <CompModal
          competition={liveSelectedComp}
          athletes={athletes}
          weeklyCharge={weeklyCharge}
          records={records}
          onClose={() => setSelectedComp(null)}
          onAddResult={addResult}
        />
      )}

      {showCreateModal && (
        <CreateCompModal
          athletes={athletes}
          onClose={() => setShowCreateModal(false)}
          onCreate={createCompetition}
        />
      )}
    </div>
  );
}

export default memo(Competitions);