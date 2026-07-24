// ============================================================
// AthleteOS — src/athlete/components/FormeDetailPanel.jsx
// ★ DARK MODE — fix mobile (z-index + portal sur body)
// ============================================================

import { useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { X, Zap } from "lucide-react";
import { getISOWeek, METRIC_SCIENCE } from "../shared";

const FormeDetailPanel = memo(({ metricKey, metrics, sessions, weeklyCharge, athlete, onClose }) => {
  const science     = METRIC_SCIENCE[metricKey];
  const value       = metrics[metricKey] ?? 0;
  const color       = science.color(value);
  const currentWeek = getISOWeek(new Date());

  const threshold = science.thresholds.find(t => value >= t.min && value <= t.max)
    ?? science.thresholds[science.thresholds.length - 1];

  const weekSessions = useMemo(() => {
    return sessions
      .filter(s => s.week === currentWeek || s.week === currentWeek - 1)
      .filter(s => s.athleteIds?.includes(athlete.id))
      .map(s => {
        const val = s.validations?.find(v => v.athleteId === athlete.id);
        return { ...s, validation: val };
      })
      .filter(s => s.validation?.rpe != null)
      .sort((a, b) => b.week - a.week || a.day?.localeCompare(b.day ?? ""));
  }, [sessions, athlete.id, currentWeek]);

  const recentCharge = useMemo(() => {
    return weeklyCharge
      .filter(w => w.athleteId === athlete.id && w.week >= currentWeek - 3 && w.week <= currentWeek)
      .sort((a, b) => a.week - b.week)
      .map(w => ({
        week:  w.week,
        label: `S${w.week}`,
        load:  w.rawLoad,
        color: w.rawLoad > 500 ? "#E05252" : w.rawLoad > 350 ? "#E8A020" : "#1D9E75",
      }));
  }, [weeklyCharge, athlete.id, currentWeek]);

  const maxLoad = Math.max(...recentCharge.map(w => w.load), 1);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--c-surface)",
        borderRadius: "20px 20px 0 0",
        border: "1px solid var(--c-border)",
        borderBottom: "none",
        width: "100%",
        maxWidth: 560,
        maxHeight: "92dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.50)",
        animation: "sheet-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* Poignée */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 32, height: 3, borderRadius: 99, background: "var(--c-border-strong)" }} />
        </div>

        {/* Header coloré */}
        <div style={{
          padding: "16px 20px 16px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          background: `linear-gradient(135deg, ${color}12, ${color}05)`,
          borderBottom: `1px solid ${color}20`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Icône */}
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: `${color}14`, border: `1px solid ${color}20`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, fontSize: 24,
            }}>
              {science.icon}
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: color, marginBottom: 3 }}>
                État de forme
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--c-text-1)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {science.label}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {value}
                </span>
                <div>
                  <p style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>{science.unit}</p>
                  <span style={{
                    fontSize: 9.5, fontWeight: 500, padding: "1px 7px", borderRadius: 4,
                    background: `${threshold.color}14`, color: threshold.color,
                    display: "inline-block", marginTop: 2,
                  }}>
                    {threshold.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding: 8, borderRadius: 10, background: "var(--c-surface-2)", border: "none", cursor: "pointer", color: "var(--c-text-3)", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Jauge */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--c-text-3)", marginBottom: 6 }}>
              <span>{science.inverted ? "Optimal" : "Faible"}</span>
              <span style={{ color, fontWeight: 500 }}>Optimal : {science.optimal}</span>
              <span>{science.inverted ? "Critique" : "Optimal"}</span>
            </div>
            <div style={{ position: "relative", height: 8, borderRadius: 99, background: "var(--c-surface-2)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${value}%`,
                background: `linear-gradient(90deg, ${color}60, ${color})`,
                transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
              }} />
              <div style={{
                position: "absolute", top: 0, height: "100%", width: 1.5,
                background: "rgba(255,255,255,0.20)",
                left: science.inverted ? "30%" : "75%",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "var(--c-text-4)", marginTop: 4 }}>
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {/* Conseil */}
          <div style={{
            borderRadius: 12, padding: "12px 14px",
            background: `${threshold.color}10`,
            border: `1px solid ${threshold.color}20`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: threshold.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={11} color="white" />
              </div>
              <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: threshold.color }}>
                Conseil du jour
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--c-text-2)", lineHeight: 1.55, fontWeight: 400 }}>
              {threshold.advice}
            </p>
          </div>

          {/* Ce que ça mesure */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 6 }}>
              Ce que mesure ce score
            </p>
            <p style={{ fontSize: 12.5, color: "var(--c-text-2)", lineHeight: 1.55 }}>{science.what}</p>
          </div>

          {/* Formule */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border)" }}>
            <div style={{ padding: "9px 14px", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)" }}>
                Formule de calcul
              </p>
            </div>
            <div style={{ padding: "10px 14px", background: "var(--c-surface)" }}>
              <p style={{
                fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.6,
                fontFamily: "monospace", background: "var(--c-surface-2)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                {science.formula}
              </p>
            </div>
          </div>

          {/* Séances */}
          {weekSessions.length > 0 && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)" }}>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)" }}>Séances ayant contribué</p>
                <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 1 }}>2 dernières semaines · RPE validé</p>
              </div>
              <div>
                {weekSessions.slice(0, 6).map((s, idx) => {
                  const rpe    = s.validation?.rpe ?? 0;
                  const load   = (s.durationMinutes ?? 60) * rpe;
                  const rpeCol = rpe <= 3 ? "#1D9E75" : rpe <= 6 ? "#E8A020" : "#E05252";
                  return (
                    <div key={s.id} style={{
                      padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                      borderTop: idx > 0 ? "1px solid var(--c-border)" : "none",
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: rpeCol + "18", border: `1px solid ${rpeCol}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 600, color: rpeCol,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {rpe}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-1)" }} className="truncate">{s.title}</p>
                        <p style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{s.day} · S{s.week} · {s.durationMinutes ?? 60} min</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: rpeCol, fontVariantNumeric: "tabular-nums" }}>{load}</p>
                        <p style={{ fontSize: 9, color: "var(--c-text-4)" }}>charge</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charge hebdo */}
          {recentCharge.length > 0 && (
            <div className="card" style={{ padding: "12px 14px" }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-text-1)", marginBottom: 2 }}>Charge hebdomadaire</p>
              <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginBottom: 12 }}>
                4 dernières semaines · méthode session-RPE
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
                {recentCharge.map((w, i) => {
                  const pct       = (w.load / maxLoad) * 100;
                  const isCurrent = w.week === currentWeek;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                      <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                        <div style={{
                          width: "100%", height: `${Math.max(pct, 5)}%`,
                          borderRadius: "4px 4px 2px 2px",
                          background: isCurrent ? w.color + "55" : "rgba(255,255,255,0.05)",
                          borderTop: `2px solid ${w.color}${isCurrent ? "CC" : "40"}`,
                          transition: "height 0.6s cubic-bezier(0.16,1,0.3,1)",
                        }} />
                      </div>
                      <p style={{ fontSize: 8, color: isCurrent ? "var(--c-text-2)" : "var(--c-text-4)", fontWeight: isCurrent ? 500 : 400 }}>
                        {w.label}
                      </p>
                      <p style={{ fontSize: 8.5, fontWeight: 600, color: w.color, fontVariantNumeric: "tabular-nums" }}>
                        {w.load}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 9.5, color: "var(--c-text-4)", marginTop: 10 }}>
                Charge = durée (min) × RPE · Foster et al. (2001)
              </p>
            </div>
          )}

          {/* Sources */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--c-border)" }}>
            <div style={{ padding: "9px 14px", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)" }}>
              <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)" }}>
                Sources scientifiques
              </p>
            </div>
            <div>
              {science.sources.map((src, i) => (
                <div key={i} style={{ padding: "10px 14px", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                  <p style={{ fontSize: 11.5, fontWeight: 500, color: "var(--c-text-1)" }}>{src.ref}</p>
                  <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2, fontStyle: "italic" }}>{src.detail}</p>
                </div>
              ))}
              <div style={{ padding: "9px 14px", background: "rgba(232,160,32,0.07)", borderTop: "1px solid var(--c-border)" }}>
                <p style={{ fontSize: 10.5, color: "#E8A020", lineHeight: 1.5 }}>
                  Les coefficients de pondération sont des conventions de coaching AthleteOS, pas des standards publiés.
                </p>
              </div>
            </div>
          </div>

          {/* Grille d'interprétation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
            <p style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 2 }}>
              Grille d'interprétation
            </p>
            {science.thresholds.map((t, i) => {
              const isActive = value >= t.min && value <= t.max;
              return (
                <div key={i} style={{
                  borderRadius: 10, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  background: isActive ? `${t.color}10` : "var(--c-surface-2)",
                  border: `${isActive ? 1.5 : 1}px solid ${isActive ? t.color + "30" : "var(--c-border)"}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: t.color }}>{t.label}</p>
                      <span style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>{t.min}–{t.max}</span>
                      {isActive && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                          background: t.color, color: "white",
                        }}>
                          Tu es ici
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--c-text-2)", lineHeight: 1.5 }}>{t.advice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default FormeDetailPanel;