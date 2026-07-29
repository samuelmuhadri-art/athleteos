// ============================================================
// AthleteOS — src/modules/Rapports.jsx  ★ DESIGN PREMIUM DARK
// Rapports hebdomadaires — générés à la volée depuis
// sessions/session_athletes (pas de nouvelle table). Vue "Semaine"
// (liste des semaines → athlètes → détail) et vue "Mois" (agrégat
// 4 semaines par athlète).
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, X, FileText, CalendarDays,
  CheckCircle2, AlertCircle, XCircle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { EmptyState, PageHeader, SegmentedTabs, StatCard } from "../components/ui/premium";
import { getISOWeek, initialsFromName } from "../utils/helpers.js";
import { CATEGORIES, colorsFor } from "../athlete/shared";
import { getRPELabel } from "../utils/chargeCalculations";
import {
  getAvailableWeeks, formatWeekLabel,
  buildWeeklyReport, buildMonthlyAggregate,
} from "../utils/weeklyReports";
import { checkWeeklyReports } from "../utils/notifications";

// ─── Sous-composants ──────────────────────────────────────────────────────

function StatusIcon({ status }) {
  if (status === "done")    return <CheckCircle2 size={15} color="#1D9E75" />;
  if (status === "partial") return <AlertCircle  size={15} color="#EF9F27" />;
  if (status === "none")    return <XCircle      size={15} color="#E24B4A" />;
  return <div style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px dashed var(--c-text-4)" }} />;
}

function MiniLoadSpark({ data }) {
  if (data.length < 2) return <div style={{ width: 60, height: 24 }} />;
  return (
    <div aria-hidden="true" style={{ width: 60, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="load" stroke="#1D9E75" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendArrow({ trend }) {
  if (trend === "up")   return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#4DC9A0" }}><TrendingUp size={12} /> Hausse</span>;
  if (trend === "down") return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#F19A9A" }}><TrendingDown size={12} /> Baisse</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--c-text-2)" }}><Minus size={12} /> Stable</span>;
}

// ─── Card d'une semaine (liste principale) ────────────────────────────────
function WeekCard({ week, dateRange, sessionCount, onClick }) {
  return (
    <button type="button" onClick={onClick} className="card tap-feedback w-full min-h-16 p-4 flex items-center gap-3 text-left">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(29,158,117,0.10)" }}>
        <FileText size={17} color="#1D9E75" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="card-title">{formatWeekLabel(week, dateRange)}</p>
        <p className="meta-text mt-1">{sessionCount} séance{sessionCount !== 1 ? "s" : ""} planifiée{sessionCount !== 1 ? "s" : ""}</p>
      </div>
      <ChevronRight size={16} color="var(--c-text-3)" />
    </button>
  );
}

// ─── Ligne résumé d'un athlète pour une semaine ───────────────────────────
function AthleteWeekRow({ athlete, report, onClick }) {
  const { stats, metrics, categoriesWorked } = report;
  const chip = stats.total === 0
    ? { label: "Pas de séance", color: "var(--c-text-2)" }
    : { label: `${stats.done}/${stats.total} faites`, color: stats.done === stats.total ? "#4DC9A0" : stats.none > 0 ? "#F19A9A" : "#EAB308" };

  return (
    <button type="button" onClick={onClick} className="tap-feedback w-full min-h-16 px-4 py-3 flex items-center gap-3 text-left border-t border-[var(--c-border)]">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #378ADD, #2563EB)" }}>
        {athlete.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--c-text-1)] truncate">{athlete.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[12px] font-semibold" style={{ color: chip.color }}>{chip.label}</span>
          {stats.total > 0 && (
            <>
              <span className="text-[12px] text-[var(--c-text-3)]">·</span>
              <span className="text-[12px] text-[var(--c-text-2)]">{stats.totalLoad} u.a.</span>
              {categoriesWorked[0] && (
                <>
                  <span className="text-[12px] text-[var(--c-text-3)]">·</span>
                  <span className="text-[12px] text-[var(--c-text-2)]">{categoriesWorked[0].label}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {stats.total > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#378ADD" }} />
          <span className="text-[12px] font-semibold" style={{ color: "#A9CBFB" }}>{metrics.load7 ?? "—"} u. / 7j</span>
        </div>
      )}
      <ChevronRight size={15} color="var(--c-text-3)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Panneau détail — rapport complet d'un athlète pour une semaine ───────
function AthleteWeekDetail({ athlete, report, onClose }) {
  const { stats, metrics, categoriesWorked, categoriesAbsent, wellnessAvg, summary, sessions, dateRange, week } = report;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="athlete-report-title" className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden modal-content border border-[var(--c-border)]"
        style={{ background: "var(--c-surface)" }}>

        <div className="px-4 sm:px-5 py-4 border-b border-[var(--c-border)] flex items-center gap-3" style={{ background: "rgba(29,158,117,0.06)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #378ADD, #2563EB)" }}>
            {athlete.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="athlete-report-title" className="card-title truncate">{athlete.name}</h3>
            <p className="meta-text mt-1">{formatWeekLabel(week, dateRange)}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl bg-[var(--c-surface-2)] text-[var(--c-text-2)] flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">

          {/* Résumé auto */}
          <div style={{ padding: 14, borderRadius: 14, background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.15)" }}>
            <p className="text-[13px] leading-relaxed text-[var(--c-text-2)]">{summary}</p>
          </div>

          {/* Métriques — style gauges Garmin/Whoop */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p className="metric-label">EWMA courte</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }}>{stats.total > 0 ? metrics.acute : "—"}</p>
            </div>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p className="metric-label">Charge 7 jours</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: "#A9CBFB", marginTop: 4 }}>
                {stats.total > 0 ? (metrics.load7 ?? "—") : "—"}
              </p>
            </div>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p className="metric-label">Wellness moy.</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }}>{wellnessAvg != null ? `${wellnessAvg}` : "—"}</p>
            </div>
          </div>

          {/* Catégories */}
          {categoriesWorked.length > 0 && (
            <div>
              <p className="metric-label mb-2">Répartition de la charge</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {categoriesWorked.map(c => {
                  const col = colorsFor(c.id);
                  return (
                    <span key={c.id} style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 10, background: col.bg, color: col.text, border: `1px solid ${col.border}33` }}>
                      {c.label} · {c.load} u.a.
                    </span>
                  );
                })}
              </div>
              {categoriesAbsent.length > 0 && categoriesAbsent.length < CATEGORIES.length && (
                <p className="text-[12px] text-[var(--c-text-2)] mt-2">
                  Non travaillées : {categoriesAbsent.map(id => CATEGORIES.find(c => c.id === id)?.label ?? id).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Liste des séances */}
          <div>
            <p className="metric-label mb-2">
              Séances ({sessions.length})
            </p>
            {sessions.length === 0 ? (
              <p className="meta-text">Aucune séance planifiée cette semaine.</p>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                {sessions.map((s, i) => {
                  const col = colorsFor(s.category);
                  const rpe = getRPELabel(s.rpe);
                  return (
                    <div key={s.id} style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10, borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                      <div style={{ marginTop: 2, flexShrink: 0 }}><StatusIcon status={s.status} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <p className="text-[13px] font-semibold text-[var(--c-text-1)]">{s.title}</p>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 7px", borderRadius: 7, background: col.bg, color: col.text }}>
                            {CATEGORIES.find(c => c.id === s.category)?.label ?? s.category}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          <span className="text-[12px] text-[var(--c-text-2)]">
                            {s.sessionDate ? new Date(s.sessionDate + "T00:00:00").toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" }) : s.day}
                          </span>
                          {s.rpe != null && (
                            <span className="text-[12px] font-semibold" style={{ color: rpe.color }}>RPE {s.rpe} · {rpe.label}</span>
                          )}
                          {s.load != null && (
                            <span className="text-[12px] text-[var(--c-text-2)]">{s.load} u.a.</span>
                          )}
                        </div>
                        {s.comment && (
                          <p className="text-[12px] text-[var(--c-text-2)] italic mt-1">« {s.comment} »</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card athlète — vue Mois ───────────────────────────────────────────────
function AthleteMonthCard({ athlete, aggregate }) {
  const { totalLoad, sessionsTotal, doneTotal, categoriesWorked, trend, weeks } = aggregate;
  const sparkData = weeks.map(w => ({ load: w.stats.totalLoad }));

  return (
    <div className="card p-4">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #378ADD, #2563EB)" }}>
          {athlete.avatar}
        </div>
        <p className="text-[13px] font-semibold text-[var(--c-text-1)] flex-1 truncate">{athlete.name}</p>
        <MiniLoadSpark data={sparkData} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text-1)" }}>{totalLoad}</span>
        <span className="text-[12px] text-[var(--c-text-2)]">u.a. sur {weeks.length} semaine{weeks.length !== 1 ? "s" : ""}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span className="text-[12px] text-[var(--c-text-2)]">{doneTotal}/{sessionsTotal} séances faites</span>
        <span className="text-[12px] font-semibold"><TrendArrow trend={trend} /></span>
      </div>
      {categoriesWorked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {categoriesWorked.slice(0, 4).map(c => {
            const col = colorsFor(c.id);
            return (
              <span key={c.id} style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: col.bg, color: col.text }}>
                {c.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function Rapports() {
  const { clubId, profile } = useAuth();
  const currentWeek = getISOWeek(new Date());

  const [athletes,     setAthletes]     = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [weeklyCharge, setWeeklyCharge] = useState([]);
  const [wellnessRows, setWellnessRows] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const [viewMode,        setViewMode]        = useState("week"); // "week" | "month"
  const [selectedWeek,    setSelectedWeek]    = useState(null);
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const athletesRes = await supabase.from("athletes").select("id, name, profile_data").eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const mappedAthletes = athletesRes.data.map(a => ({
        id: a.id, name: a.name, avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
      }));
      const athleteIds = mappedAthletes.map(a => a.id);

      // weekly_charge est une vue SANS RLS propre (cf. Dashboard.jsx/AthleteApp.jsx) —
      // on doit impérativement la scoper par athlete_id nous-mêmes, sinon on
      // récupère la charge de TOUS les clubs.
      const [sessionsRes, chargeRes, wellnessRes] = await Promise.all([
        supabase.from("sessions").select("*, session_athletes(*)").eq("club_id", clubId),
        athleteIds.length ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds) : Promise.resolve({ data: [] }),
        supabase.from("athlete_wellness").select("*").eq("club_id", clubId),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (chargeRes.error)   throw chargeRes.error;
      if (wellnessRes.error) throw wellnessRes.error;

      const mappedSessions = (sessionsRes.data ?? []).map(s => {
        const rows = s.session_athletes ?? [];
        return {
          id: s.id, week: s.week, day: s.day, sessionDate: s.session_date,
          category: s.category, title: s.title, durationMinutes: s.duration_minutes,
          athleteIds:  rows.map(v => v.athlete_id),
          validations: rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, rpe: v.rpe, comment: v.comment, actualDurationMinutes: v.actual_duration_minutes, durationSource: v.duration_source })),
        };
      });

      const mappedCharge = (chargeRes.data ?? [])
        .map(c => ({ athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load, dailyLoads: c.daily_loads ?? [], knownDays: c.known_days ?? 0, unknownDays: c.unknown_days ?? 0, estimatedDays: c.estimated_days ?? 0 }));

      const mappedWellness = (wellnessRes.data ?? []).map(w => ({
        athleteId: w.athlete_id, date: w.date, sleep: w.sleep, energy: w.energy,
        soreness: w.soreness, mood: w.mood, stress: w.stress,
      }));

      setAthletes(mappedAthletes);
      setSessions(mappedSessions);
      setWeeklyCharge(mappedCharge);
      setWellnessRows(mappedWellness);

      if (mappedAthletes.length > 0) {
        try {
          await checkWeeklyReports(clubId, mappedAthletes, currentWeek, profile?.id ?? null);
        } catch (notificationError) {
          console.error("Rapports — notifications hebdomadaires :", notificationError);
        }
      }
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId, currentWeek, profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const weeks = useMemo(() => getAvailableWeeks(sessions), [sessions]);

  const weekReports = useMemo(() => {
    if (selectedWeek == null) return [];
    return athletes.map(athlete => ({
      athlete,
      report: buildWeeklyReport({ athleteId: athlete.id, week: selectedWeek, sessions, weeklyCharge, wellnessRows }),
    })).sort((a, b) => b.report.stats.total - a.report.stats.total);
  }, [selectedWeek, athletes, sessions, weeklyCharge, wellnessRows]);

  const last4Weeks = useMemo(() => weeks.slice(0, 4).map(w => w.week), [weeks]);

  const monthAggregates = useMemo(() => {
    if (viewMode !== "month" || last4Weeks.length === 0) return [];
    return athletes.map(athlete => ({
      athlete,
      aggregate: buildMonthlyAggregate({ athleteId: athlete.id, weeks: last4Weeks, sessions, weeklyCharge, wellnessRows }),
    })).sort((a, b) => b.aggregate.totalLoad - a.aggregate.totalLoad);
  }, [viewMode, last4Weeks, athletes, sessions, weeklyCharge, wellnessRows]);

  const latestWeekOverview = useMemo(() => {
    const latestWeek = weeks[0]?.week;
    if (latestWeek == null) return null;
    const reports = athletes.map(athlete => buildWeeklyReport({
      athleteId: athlete.id,
      week: latestWeek,
      sessions,
      weeklyCharge,
      wellnessRows,
    }));
    return {
      week: latestWeek,
      planned: reports.reduce((sum, report) => sum + report.stats.total, 0),
      done: reports.reduce((sum, report) => sum + report.stats.done, 0),
      totalLoad: reports.reduce((sum, report) => sum + report.stats.totalLoad, 0),
    };
  }, [weeks, athletes, sessions, weeklyCharge, wellnessRows]);

  if (loading) return <LoadingState message="Chargement des rapports…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const selectedWeekMeta = weeks.find(w => w.week === selectedWeek);
  const selectedAthleteReport = selectedAthlete != null
    ? weekReports.find(r => r.athlete.id === selectedAthlete)
    : null;

  return (
    <div className="page-container py-4 md:py-6 space-y-5 md:space-y-6 max-w-5xl mx-auto animate-slide-up">

      <PageHeader
        eyebrow="SUIVI DU GROUPE"
        title="Rapports"
        description={`${athletes.length} athlète${athletes.length !== 1 ? "s" : ""} · ${weeks.length} semaine${weeks.length !== 1 ? "s" : ""} avec des séances`}
        actions={(
          <SegmentedTabs
            ariaLabel="Période des rapports"
            items={[{ id: "week", label: "Semaine" }, { id: "month", label: "Mois" }]}
            value={viewMode}
            onChange={(mode) => { setViewMode(mode); setSelectedWeek(null); setSelectedAthlete(null); }}
          />
        )}
      />

      {latestWeekOverview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {[
            { label: "Dernier rapport", value: `S${latestWeekOverview.week}`, detail: "semaine la plus récente" },
            { label: "Séances réalisées", value: `${latestWeekOverview.done}/${latestWeekOverview.planned}`, detail: "cumul du groupe" },
            { label: "Charge cumulée", value: latestWeekOverview.totalLoad, detail: "unités arbitraires" },
          ].map(item => (
            <StatCard key={item.label} label={item.label} value={item.value} helper={item.detail} />
          ))}
        </div>
      )}

      {/* ── VUE SEMAINE ────────────────────────────────────────────────── */}
      {viewMode === "week" && selectedWeek == null && (
        weeks.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune séance planifiée"
            description="Les rapports apparaîtront automatiquement dès que des séances seront créées et attribuées."
          />
        ) : (
          <div className="space-y-2.5">
            {weeks.map(w => (
              <WeekCard key={w.week} week={w.week} dateRange={w.dateRange} sessionCount={w.sessionCount}
                onClick={() => setSelectedWeek(w.week)} />
            ))}
          </div>
        )
      )}

      {viewMode === "week" && selectedWeek != null && (
        <div className="space-y-3">
          <button type="button" onClick={() => setSelectedWeek(null)} className="tap-feedback min-h-11 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-success)]">
            <ChevronLeft size={15} /> Toutes les semaines
          </button>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--c-border)" }}>
              <p className="card-title">{formatWeekLabel(selectedWeek, selectedWeekMeta?.dateRange)}</p>
            </div>
            {weekReports.map(({ athlete, report }) => (
              <AthleteWeekRow key={athlete.id} athlete={athlete} report={report} onClick={() => setSelectedAthlete(athlete.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── VUE MOIS ───────────────────────────────────────────────────── */}
      {viewMode === "month" && (
        last4Weeks.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-[15px] font-semibold text-[var(--c-text-2)]">Pas encore assez de données pour une vue mensuelle</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthAggregates.map(({ athlete, aggregate }) => (
              <AthleteMonthCard key={athlete.id} athlete={athlete} aggregate={aggregate} />
            ))}
          </div>
        )
      )}

      {/* ── DÉTAIL ATHLÈTE ─────────────────────────────────────────────── */}
      {selectedAthleteReport && (
        <AthleteWeekDetail athlete={selectedAthleteReport.athlete} report={selectedAthleteReport.report}
          onClose={() => setSelectedAthlete(null)} />
      )}
    </div>
  );
}
