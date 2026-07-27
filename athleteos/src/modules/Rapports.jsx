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
import { getISOWeek, initialsFromName } from "../utils/helpers.js";
import { CATEGORIES, colorsFor, acwrColor } from "../athlete/shared";
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
    <div style={{ width: 60, height: 24 }}>
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
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--c-text-4)" }}><Minus size={12} /> Stable</span>;
}

// ─── Card d'une semaine (liste principale) ────────────────────────────────
function WeekCard({ week, dateRange, sessionCount, onClick }) {
  return (
    <button onClick={onClick} className="card tap-feedback"
      style={{ width: "100%", textAlign: "left", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(29,158,117,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FileText size={17} color="#1D9E75" strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>{formatWeekLabel(week, dateRange)}</p>
        <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>{sessionCount} séance{sessionCount > 1 ? "s" : ""} planifiée{sessionCount > 1 ? "s" : ""}</p>
      </div>
      <ChevronRight size={16} color="var(--c-text-4)" />
    </button>
  );
}

// ─── Ligne résumé d'un athlète pour une semaine ───────────────────────────
function AthleteWeekRow({ athlete, report, onClick }) {
  const { stats, metrics, categoriesWorked } = report;
  const chip = stats.total === 0
    ? { label: "Pas de séance", color: "var(--c-text-4)" }
    : { label: `${stats.done}/${stats.total} faites`, color: stats.done === stats.total ? "#4DC9A0" : stats.none > 0 ? "#F19A9A" : "#EAB308" };

  return (
    <button onClick={onClick} className="tap-feedback"
      style={{ width: "100%", textAlign: "left", padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", borderTop: "1px solid var(--c-border)" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #378ADD, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {athlete.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)" }} className="truncate">{athlete.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: chip.color }}>{chip.label}</span>
          {stats.total > 0 && (
            <>
              <span style={{ fontSize: 10, color: "var(--c-text-4)" }}>·</span>
              <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{stats.totalLoad} u.a.</span>
              {categoriesWorked[0] && (
                <>
                  <span style={{ fontSize: 10, color: "var(--c-text-4)" }}>·</span>
                  <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{categoriesWorked[0].label}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {stats.total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: acwrColor(metrics.acwr) }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: acwrColor(metrics.acwr) }}>{metrics.acwr.toFixed(2)}</span>
        </div>
      )}
      <ChevronRight size={15} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Panneau détail — rapport complet d'un athlète pour une semaine ───────
function AthleteWeekDetail({ athlete, report, onClose }) {
  const { stats, metrics, categoriesWorked, categoriesAbsent, wellnessAvg, summary, sessions, dateRange, week } = report;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden modal-content"
        style={{ background: "var(--c-surface)" }}>

        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, background: "rgba(29,158,117,0.06)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #378ADD, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {athlete.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--c-text-1)" }} className="truncate">{athlete.name}</p>
            <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 1 }}>{formatWeekLabel(week, dateRange)}</p>
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 10, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-2)", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Résumé auto */}
          <div style={{ padding: 14, borderRadius: 14, background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.15)" }}>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--c-text-2)" }}>{summary}</p>
          </div>

          {/* Métriques — style gauges Garmin/Whoop */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p style={{ fontSize: 9.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Charge aiguë</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }}>{stats.total > 0 ? metrics.acute : "—"}</p>
            </div>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p style={{ fontSize: 9.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ACWR</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: stats.total > 0 ? acwrColor(metrics.acwr) : "var(--c-text-1)", marginTop: 4 }}>
                {stats.total > 0 ? metrics.acwr.toFixed(2) : "—"}
              </p>
            </div>
            <div style={{ padding: "12px 10px", borderRadius: 14, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", textAlign: "center" }}>
              <p style={{ fontSize: 9.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wellness moy.</p>
              <p style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }}>{wellnessAvg != null ? `${wellnessAvg}` : "—"}</p>
            </div>
          </div>

          {/* Catégories */}
          {categoriesWorked.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Répartition de la charge</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {categoriesWorked.map(c => {
                  const col = colorsFor(c.id);
                  return (
                    <span key={c.id} style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 10, background: col.bg, color: col.text, border: `1px solid ${col.border}33` }}>
                      {c.label} · {c.load} u.a.
                    </span>
                  );
                })}
              </div>
              {categoriesAbsent.length > 0 && categoriesAbsent.length < CATEGORIES.length && (
                <p style={{ fontSize: 10.5, color: "var(--c-text-4)", marginTop: 8 }}>
                  Non travaillées : {categoriesAbsent.map(id => CATEGORIES.find(c => c.id === id)?.label ?? id).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Liste des séances */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Séances ({sessions.length})
            </p>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--c-text-4)" }}>Aucune séance planifiée cette semaine.</p>
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
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-text-1)" }}>{s.title}</p>
                          <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 7, background: col.bg, color: col.text }}>
                            {CATEGORIES.find(c => c.id === s.category)?.label ?? s.category}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10.5, color: "var(--c-text-4)" }}>
                            {s.sessionDate ? new Date(s.sessionDate + "T00:00:00").toLocaleDateString("fr-BE", { weekday: "short", day: "numeric", month: "short" }) : s.day}
                          </span>
                          {s.rpe != null && (
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: rpe.color }}>RPE {s.rpe} · {rpe.label}</span>
                          )}
                          {s.load != null && (
                            <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{s.load} u.a.</span>
                          )}
                        </div>
                        {s.comment && (
                          <p style={{ fontSize: 11, color: "var(--c-text-3)", fontStyle: "italic", marginTop: 4 }}>« {s.comment} »</p>
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
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #378ADD, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
          {athlete.avatar}
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)", flex: 1 }} className="truncate">{athlete.name}</p>
        <MiniLoadSpark data={sparkData} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text-1)" }}>{totalLoad}</span>
        <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>u.a. sur 4 semaines</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{doneTotal}/{sessionsTotal} séances faites</span>
        <span style={{ fontSize: 11, fontWeight: 600 }}><TrendArrow trend={trend} /></span>
      </div>
      {categoriesWorked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {categoriesWorked.slice(0, 4).map(c => {
            const col = colorsFor(c.id);
            return (
              <span key={c.id} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: col.bg, color: col.text }}>
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

      const mappedSessions = (sessionsRes.data ?? []).map(s => {
        const rows = s.session_athletes ?? [];
        return {
          id: s.id, week: s.week, day: s.day, sessionDate: s.session_date,
          category: s.category, title: s.title, durationMinutes: s.duration_minutes,
          athleteIds:  rows.map(v => v.athlete_id),
          validations: rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, rpe: v.rpe, comment: v.comment })),
        };
      });

      const mappedCharge = (chargeRes.data ?? [])
        .map(c => ({ athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load }));

      const mappedWellness = (wellnessRes.data ?? []).map(w => ({
        athleteId: w.athlete_id, date: w.date, sleep: w.sleep, energy: w.energy,
        soreness: w.soreness, mood: w.mood, stress: w.stress,
      }));

      setAthletes(mappedAthletes);
      setSessions(mappedSessions);
      setWeeklyCharge(mappedCharge);
      setWellnessRows(mappedWellness);

      if (mappedAthletes.length > 0) {
        await checkWeeklyReports(clubId, mappedAthletes, currentWeek, profile?.id ?? null);
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

  if (loading) return <LoadingState message="Chargement des rapports…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const selectedWeekMeta = weeks.find(w => w.week === selectedWeek);
  const selectedAthleteReport = selectedAthlete != null
    ? weekReports.find(r => r.athlete.id === selectedAthlete)
    : null;

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-4xl mx-auto animate-slide-up">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--c-text-1)", letterSpacing: "-0.02em" }}>Rapports</h2>
          <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>
            {athletes.length} athlète{athletes.length > 1 ? "s" : ""} · {weeks.length} semaine{weeks.length > 1 ? "s" : ""} avec des séances
          </p>
        </div>
        <div className="flex gap-1 rounded-2xl p-1.5" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
          {[{ id: "week", label: "Semaine" }, { id: "month", label: "Mois" }].map(m => (
            <button key={m.id} onClick={() => { setViewMode(m.id); setSelectedWeek(null); setSelectedAthlete(null); }}
              style={{
                padding: "7px 16px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: viewMode === m.id ? "#1D9E75" : "transparent",
                color: viewMode === m.id ? "#0A150F" : "var(--c-text-3)",
                border: "none", cursor: "pointer",
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── VUE SEMAINE ────────────────────────────────────────────────── */}
      {viewMode === "week" && selectedWeek == null && (
        weeks.length === 0 ? (
          <div className="card p-12 text-center">
            <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "var(--c-surface-2)" }}>
              <CalendarDays size={26} color="var(--c-text-4)" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Aucune séance planifiée</p>
            <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 4 }}>Les rapports apparaîtront dès que des séances seront créées</p>
          </div>
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
          <button onClick={() => setSelectedWeek(null)} className="tap-feedback"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <ChevronLeft size={15} /> Toutes les semaines
          </button>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>{formatWeekLabel(selectedWeek, selectedWeekMeta?.dateRange)}</p>
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
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Pas encore assez de données pour une vue mensuelle</p>
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
