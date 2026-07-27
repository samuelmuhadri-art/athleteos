// ============================================================
// AthleteOS — src/athlete/views/MesRapports.jsx  ★ DESIGN PREMIUM DARK
// Onglet "Rapports" de Mes performances — même moteur de calcul que
// le module coach (src/utils/weeklyReports.js), juste affiché pour un
// seul athlète (pas de sélection d'athlète nécessaire).
// ============================================================

import { useState, useEffect, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, FileText, CalendarDays,
  CheckCircle2, AlertCircle, XCircle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "../../utils/supabaseClient";
import { CATEGORIES, colorsFor, acwrColor } from "../shared";
import { getRPELabel } from "../../utils/chargeCalculations";
import {
  getAvailableWeeks, formatWeekLabel,
  buildWeeklyReport, buildMonthlyAggregate,
} from "../../utils/weeklyReports";

function StatusIcon({ status }) {
  if (status === "done")    return <CheckCircle2 size={15} color="#1D9E75" />;
  if (status === "partial") return <AlertCircle  size={15} color="#EF9F27" />;
  if (status === "none")    return <XCircle      size={15} color="#E24B4A" />;
  return <div style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px dashed var(--c-text-4)" }} />;
}

function MiniLoadSpark({ data }) {
  if (data.length < 2) return <div style={{ width: 56, height: 22 }} />;
  return (
    <div style={{ width: 56, height: 22 }}>
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

function WeekCard({ week, dateRange, sessionCount, onClick }) {
  return (
    <button onClick={onClick} className="card tap-feedback"
      style={{ width: "100%", textAlign: "left", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(29,158,117,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FileText size={17} color="#1D9E75" strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>{formatWeekLabel(week, dateRange)}</p>
        <p style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 2 }}>{sessionCount} séance{sessionCount > 1 ? "s" : ""}</p>
      </div>
      <ChevronRight size={16} color="var(--c-text-4)" />
    </button>
  );
}

// ─── Détail d'une semaine (inline, pas de modal — un seul athlète) ───────
function WeekReportDetail({ report }) {
  const { stats, metrics, categoriesWorked, categoriesAbsent, wellnessAvg, summary, sessions } = report;

  return (
    <div className="space-y-4">
      <div style={{ padding: 14, borderRadius: 14, background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.15)" }}>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--c-text-2)" }}>{summary}</p>
      </div>

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
          <p style={{ fontSize: 19, fontWeight: 700, color: "var(--c-text-1)", marginTop: 4 }}>{wellnessAvg != null ? wellnessAvg : "—"}</p>
        </div>
      </div>

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
                      {s.rpe != null && <span style={{ fontSize: 10.5, fontWeight: 600, color: rpe.color }}>RPE {s.rpe} · {rpe.label}</span>}
                      {s.load != null && <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{s.load} u.a.</span>}
                    </div>
                    {s.comment && <p style={{ fontSize: 11, color: "var(--c-text-3)", fontStyle: "italic", marginTop: 4 }}>« {s.comment} »</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function MesRapports({ athlete, sessions, weeklyCharge }) {
  const [wellnessRows, setWellnessRows] = useState([]);
  const [viewMode,     setViewMode]     = useState("week"); // "week" | "month"
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    if (!athlete?.id) return;
    supabase.from("athlete_wellness").select("*").eq("athlete_id", athlete.id)
      .then(({ data }) => {
        setWellnessRows((data ?? []).map(w => ({
          athleteId: w.athlete_id, date: w.date, sleep: w.sleep, energy: w.energy,
          soreness: w.soreness, mood: w.mood, stress: w.stress,
        })));
      });
  }, [athlete?.id]);

  const weeks = useMemo(() => getAvailableWeeks(sessions, athlete.id), [sessions, athlete.id]);

  const selectedReport = useMemo(() => {
    if (selectedWeek == null) return null;
    return buildWeeklyReport({ athleteId: athlete.id, week: selectedWeek, sessions, weeklyCharge, wellnessRows });
  }, [selectedWeek, athlete.id, sessions, weeklyCharge, wellnessRows]);

  const last4Weeks = useMemo(() => weeks.slice(0, 4).map(w => w.week), [weeks]);
  const monthAggregate = useMemo(() => {
    if (viewMode !== "month" || last4Weeks.length === 0) return null;
    return buildMonthlyAggregate({ athleteId: athlete.id, weeks: last4Weeks, sessions, weeklyCharge, wellnessRows });
  }, [viewMode, last4Weeks, athlete.id, sessions, weeklyCharge, wellnessRows]);

  const selectedWeekMeta = weeks.find(w => w.week === selectedWeek);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-2xl p-1.5" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
        {[{ id: "week", label: "Semaine" }, { id: "month", label: "Mois" }].map(m => (
          <button key={m.id} onClick={() => { setViewMode(m.id); setSelectedWeek(null); }}
            className="flex-1"
            style={{
              padding: "8px 0", borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: viewMode === m.id ? "#1D9E75" : "transparent",
              color: viewMode === m.id ? "#0A150F" : "var(--c-text-3)",
              border: "none", cursor: "pointer",
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {viewMode === "week" && selectedWeek == null && (
        weeks.length === 0 ? (
          <div className="card p-12 text-center">
            <div style={{ width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: "var(--c-surface-2)" }}>
              <CalendarDays size={26} color="var(--c-text-4)" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Aucun rapport disponible</p>
            <p style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 4 }}>Il apparaîtra dès ta première semaine avec des séances</p>
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

      {viewMode === "week" && selectedWeek != null && selectedReport && (
        <div className="space-y-3">
          <button onClick={() => setSelectedWeek(null)} className="tap-feedback"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#4DC9A0", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <ChevronLeft size={15} /> Toutes mes semaines
          </button>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-1)" }}>
            {formatWeekLabel(selectedWeek, selectedWeekMeta?.dateRange)}
          </p>
          <WeekReportDetail report={selectedReport} />
        </div>
      )}

      {viewMode === "month" && (
        !monthAggregate ? (
          <div className="card p-12 text-center">
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)" }}>Pas encore assez de données pour une vue mensuelle</p>
          </div>
        ) : (
          <div className="card p-4">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)", flex: 1 }}>4 dernières semaines</p>
              <MiniLoadSpark data={monthAggregate.weeks.map(w => ({ load: w.stats.totalLoad }))} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "var(--c-text-1)" }}>{monthAggregate.totalLoad}</span>
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>u.a. cumulées</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{monthAggregate.doneTotal}/{monthAggregate.sessionsTotal} séances faites</span>
              <TrendArrow trend={monthAggregate.trend} />
            </div>
            {monthAggregate.categoriesWorked.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {monthAggregate.categoriesWorked.slice(0, 5).map(c => {
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
        )
      )}
    </div>
  );
}
