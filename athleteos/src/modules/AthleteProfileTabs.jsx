// ============================================================
// AthleteOS — src/modules/AthleteProfileTabs.jsx
// Les 5 onglets du profil athlète (Performances, Charge, Entraînements,
// Blessures, Profil) — extraits d'AthleteList.jsx.
// ============================================================

import { memo, useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Trophy, Activity, Dumbbell, User, CheckCircle, AlertTriangle, Clock, Zap, Plus } from "lucide-react";
import {
  computeChargeChartData,
  generateContextAnalysis, computePerformanceStability,
} from "../utils/chargeCalculations";
import { getAthleteAxisProfile } from "../utils/loadAxes";
import { getISOWeek } from "../utils/helpers.js";
import { parsePerf, pctOfReference } from "../athlete/shared.js";
import {
  RADAR_KEYS, scoreColor,
  ValidationBadge, StarRow, EmptySection, ChartTooltip, ScoreRing,
} from "./athleteListShared";
import AddRecordModal from "./AddRecordModal";
import AddInjuryModal from "./AddInjuryModal";
import AxisRadarCard from "../components/ui/AxisRadarCard";

// ─── Onglet Performances ──────────────────────────────────────────────────────

export const TabPerformances = memo(({ athlete, competitions, onAddRecord }) => {
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
            <h3 className="card-title">Records & Season Best</h3>
            <p className="card-subtitle mt-0.5">{disciplines.length} épreuve{disciplines.length > 1 ? "s" : ""}</p>
          </div>
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary !px-3 !text-[12px]">
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
                    <th key={h} className="text-left px-4 py-3 text-[12px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--c-text-2)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ divideY: "1px solid var(--c-border)" }}>
                {disciplines.map((disc, i) => {
                  const r    = athlete.records[disc];
                  // Tâche 11 : parsePerf (pas parseFloat, qui tronque "4:32" à 4) +
                  // pctOfReference (sens correct pour les disciplines chronométrées,
                  // au lieu d'un ratio sb/pr toujours dans le même sens).
                  const sbN  = parsePerf(r.sb).value;
                  const prN  = parsePerf(r.pr).value;
                  const pct  = pctOfReference(sbN, prN, disc);
                  const pc   = pct === null ? "var(--c-text-3)" : pct >= 95 ? "#1D9E75" : pct >= 85 ? "#EF9F27" : "#E24B4A";
                  return (
                    <tr key={disc} style={{ borderTop: i > 0 ? "1px solid var(--c-border)" : "none", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td className="px-4 py-3.5 font-bold" style={{ color: "var(--c-text-1)" }}>{disc}</td>
                      <td className="px-4 py-3.5" style={{ color: "var(--c-text-2)" }}>{r.sb}</td>
                      <td className="px-4 py-3.5 font-bold text-[14px]" style={{ color: "#1D9E75" }}>{r.pr}</td>
                      <td className="px-4 py-3.5" style={{ color: "var(--c-text-3)" }}>
                        {r.prDate ? new Date(r.prDate).toLocaleDateString("fr-BE",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "var(--c-surface-3)" }}>
                              <div className="h-full rounded-full" style={{ width:`${pct}%`, background:pc }} />
                            </div>
                            <span className="text-[12px] font-bold" style={{ color:pc }}>{pct}%</span>
                          </div>
                        ) : <span className="meta-text">—</span>}
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
              <h3 className="card-title">Évolution — {athlete.mainDiscipline}</h3>
              <p className="card-subtitle mt-0.5">24 derniers mois</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {disciplines.slice(0,5).map(d => (
                <button type="button" key={d} onClick={() => setSelectedDisc(d)}
                  className="px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all tap-feedback"
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
                <XAxis dataKey="label" tick={{ fontSize:12, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:12, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="value" name={athlete.mainDiscipline} stroke="#1D9E75" strokeWidth={2.5}
                  dot={{ r:4, fill:"#1D9E75", strokeWidth: 2, stroke: "var(--c-surface)" }} activeDot={{ r:6 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[13px]" style={{ color: "var(--c-text-3)" }}>
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
          <h3 className="card-title">Historique compétitions</h3>
        </div>
        {compHistory.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--c-text-3)" }}>Aucune compétition enregistrée</div>
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
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}>{comp.type}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>
                    {result.event} — <strong className="text-[13px]" style={{ color: "#3DBE8B" }}>{result.result}</strong>
                  </p>
                  {result.context && <p className="meta-text italic mt-0.5">{result.context}</p>}
                </div>
                <span className="meta-text whitespace-nowrap">
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

export const TabCharge = memo(({ athlete, metrics, weeklyCharge, competitions, sessions }) => {
  const { load7, load28, variationPercent, acute, chronic, acwr } = metrics;
  const chartData = useMemo(() => computeChargeChartData(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const currentWeek = useMemo(() => getISOWeek(new Date()), []);
  const axisProfile = useMemo(
    () => getAthleteAxisProfile(athlete.id, sessions ?? [], currentWeek),
    [athlete.id, sessions, currentWeek]
  );
  const nextComp  = useMemo(() => {
    const now = new Date();
    return (competitions ?? []).filter(c => c.athleteIds.includes(athlete.id) && new Date(c.date) >= now)
      .sort((a,b) => new Date(a.date) - new Date(b.date))[0] ?? null;
  }, [athlete.id, competitions]);
  const analysis  = useMemo(() => generateContextAnalysis(metrics, nextComp), [metrics, nextComp]);
  const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);

  if (!hasCharge) return <EmptySection icon={Activity} title="Aucune charge enregistrée" sub="Les scores apparaîtront dès la première séance saisie." />;

  const scoreCards = [
    { label: "Charge 7 jours", value: load7 ?? "—", color: "#378ADD", hint: "somme observée" },
    { label: "Charge 28 jours", value: load28 ?? "—", color: "#A9CBFB", hint: "somme observée" },
    { label: "EWMA courte", value: acute == null ? "—" : Math.round(acute), color: "#14B8A6", hint: "série quotidienne" },
    { label: "EWMA longue", value: chronic == null ? "—" : Math.round(chronic), color: "#A855F7", hint: "série quotidienne" },
    { label: "Variation", value: variationPercent == null ? "—" : `${variationPercent >= 0 ? "+" : ""}${variationPercent}%`, color: "#EF9F27", hint: "moy. 7j vs 28j" },
  ];

  return (
    <div className="space-y-5">
      {/* Score rings */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {scoreCards.map(s => (
          <div key={s.label} className="card p-4 flex flex-col items-center gap-2">
            <ScoreRing value={s.value} color={s.color} label={s.label} />
            <span className="meta-text font-medium">{s.hint}</span>
          </div>
        ))}
      </div>

      {/* ACWR expérimental : jamais utilisé comme cible ou signal de risque. */}
      <div className="card px-6 py-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="meta-text font-bold uppercase tracking-wide mb-1">Métrique expérimentale · ACWR EWMA</p>
          <p className="text-[32px] font-bold leading-none" style={{ color: "#94A3B8" }}>{acwr == null ? "—" : acwr.toFixed(2)}</p>
          <p className="meta-text mt-1">Affiché seulement avec 28 jours quotidiens continus connus</p>
        </div>
        <p className="text-[12px] max-w-md" style={{ color: "var(--c-text-2)" }}>Valeur de recherche descriptive. Elle ne constitue ni une zone optimale, ni une estimation individuelle du risque de blessure, ni une consigne d'entraînement.</p>
      </div>

      {/* Graphique charge */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="card-title mb-1">Charge observée — 12 semaines</h3>
          <p className="card-subtitle mb-4">Durée réelle × RPE CR10 · aucune estimation de forme ou de fatigue</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCharge2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
              <XAxis dataKey="label" tick={{ fontSize:12, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:12, fill:"var(--c-text-3)" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Area dataKey="rawLoad" name="Charge brute" stroke="#378ADD" fill="url(#gradCharge2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profil de charge (6 axes) */}
      <AxisRadarCard
        profile={axisProfile} title="Profil de charge" subtitle="Comparé aux semaines habituelles de l'athlète"
        sessions={sessions} athleteId={athlete.id} currentWeek={currentWeek}
      />

      {/* Analyse contextuelle */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,159,39,0.15)" }}>
            <Zap size={15} color="#EF9F27" />
          </div>
          <div>
            <h3 className="card-title">Analyse contextuelle</h3>
            <p className="meta-text">Règles automatiques · sans IA</p>
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

export const TabEntrainements = memo(({ athlete, sessions }) => {
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
                 <Clock size={18} style={{ color: "var(--c-text-3)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--c-text-1)" }}>{s.title}</span>
                  <ValidationBadge status={status} />
                </div>
                <p className="meta-text mb-2">
                  {s.day} · Semaine {s.week} · {s.time} · {s.type}
                </p>
                {val?.comment && (
                  <p className="text-[12px] italic mb-2" style={{ color: "var(--c-text-2)" }}>« {val.comment} »</p>
                )}
                {(val?.feeling != null || val?.fatigue != null) && (
                  <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--c-text-2)" }}>
                    {val.feeling != null && <span className="flex items-center gap-1.5">Ressenti <StarRow value={val.feeling} /></span>}
                    {val.fatigue != null && <span className="flex items-center gap-1.5">Fatigue <StarRow value={val.fatigue} color="#E24B4A" /></span>}
                  </div>
                )}
              </div>
              <span className="meta-text whitespace-nowrap mt-0.5">S{s.week}</span>
            </div>
          );
        })
      )}
    </div>
  );
});

// ─── Onglet Blessures ─────────────────────────────────────────────────────────

export const TabBlessures = memo(({ athlete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
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
          <p className="meta-text mt-1">Athlète sans blessure connue</p>
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
                      <h3 className="text-[15px] font-bold" style={{ color: "var(--c-text-1)" }}>{inj.name}</h3>
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>📍 {inj.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="meta-text mb-1.5">Intensité douleur</p>
                    <div className="flex items-center gap-1 justify-end">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-sm transition-colors"
                          style={{ background: i < inj.intensity ? iColor : "var(--c-surface-3)" }} />
                      ))}
                      <span className="text-[13px] font-bold ml-1.5" style={{ color: iColor }}>
                        {inj.intensity}/10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barre intensité */}
                <div className="progress-bar mb-3">
                  <div className="progress-fill" style={{ width:`${pct}%`, background:iColor }} />
                </div>

                <div className="flex items-center gap-4 text-[12px] mb-3 flex-wrap" style={{ color: "var(--c-text-2)" }}>
                  {inj.startDate && (
                    <span>Début : <strong style={{ color: "var(--c-text-2)" }}>
                      {new Date(inj.startDate).toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"})}
                    </strong></span>
                  )}
                  {!inj.endDate && active && <span className="font-bold" style={{ color: "#EF9F27" }}>⚡ En cours</span>}
                </div>

                {inj.notes && (
                  <div className="rounded-2xl px-4 py-3 border mb-3" style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border)" }}>
                    <p className="meta-text font-bold uppercase tracking-wide mb-1">Notes / suivi</p>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--c-text-2)" }}>{inj.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid var(--c-border)" }}>
                  <button onClick={() => setModalTarget(inj)}
                    className="text-[12px] font-semibold transition-colors" style={{ color: "var(--c-text-2)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-1)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-2)"}>
                    ✏️ Modifier
                  </button>
                  {confirmDeleteId === inj.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
                      <button onClick={async () => { await onDeleteInjury(inj.id); setConfirmDeleteId(null); }}
                        className="text-[12px] font-bold text-white rounded-lg px-2 py-0.5" style={{ background: "#E24B4A" }}>Oui</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[12px]" style={{ color: "var(--c-text-2)" }}>Non</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(inj.id)}
                      className="text-[12px] font-semibold transition-colors" style={{ color: "#F19A9A" }} onMouseEnter={e => e.currentTarget.style.color = "#E24B4A"} onMouseLeave={e => e.currentTarget.style.color = "#F19A9A"}>
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

export const TabProfil = memo(({ athlete }) => {
  const p = athlete.profile ?? {};
  const hasProfile = Object.keys(p).length > 0;
  const stabilityScore = computePerformanceStability(athlete.performanceHistory);
  const stabilityColor = s => s === null ? "var(--c-text-3)" : s >= 75 ? "#1D9E75" : s >= 50 ? "#EF9F27" : "#E24B4A";
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
        <p className="card-title">Stabilité de performance</p>
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
          <h3 className="card-title mb-1">Profil athlétique</h3>
          <p className="meta-text mb-4">Scores 0 – 100</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--c-border)" />
              <PolarAngleAxis dataKey="discipline" tick={{ fontSize:12, fill:"var(--c-text-3)", fontWeight:600 }} />
              <PolarRadiusAxis angle={90} domain={[0,100]} tick={{ fontSize:12, fill:"var(--c-text-3)" }} tickCount={4} />
              <Radar name={athlete.name} dataKey="value" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.18} strokeWidth={2.5} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {RADAR_KEYS.map(k => (
              <div key={k.key} className="text-center">
                <p className="text-[18px] font-bold" style={{ color: scoreColor(p[k.key] ?? 0) }}>{p[k.key] ?? "—"}</p>
                <p className="meta-text">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="card-title mb-4">Caractéristiques</h3>
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
            <h3 className="card-title mb-3">Identité</h3>
            <div className="space-y-2.5 text-[12.5px]">
              <div className="flex justify-between"><span style={{ color: "var(--c-text-2)" }}>Discipline</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.mainDiscipline ?? "—"}</span></div>
              {athlete.secondaryDisciplines?.length > 0 && <div className="flex justify-between gap-4"><span style={{ color: "var(--c-text-2)" }}>Secondaires</span><span className="font-bold text-right" style={{ color: "var(--c-text-1)" }}>{athlete.secondaryDisciplines.join(", ")}</span></div>}
              <div className="flex justify-between"><span style={{ color: "var(--c-text-2)" }}>Groupe</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.group ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--c-text-2)" }}>Niveau</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.level ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--c-text-2)" }}>Âge</span><span className="font-bold" style={{ color: "var(--c-text-1)" }}>{athlete.age ? `${athlete.age} ans` : "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
