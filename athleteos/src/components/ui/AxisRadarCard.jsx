// ============================================================
// AthleteOS — src/components/ui/AxisRadarCard.jsx
// Radar du "profil de charge" (6 axes physiologiques, voir
// src/utils/loadAxes.js) + liste en langage clair juste en dessous.
// Utilisé côté athlète (AthleteDashboard) et côté coach
// (AthleteProfileTabs → TabCharge) — un seul composant, un seul
// rendu à faire évoluer.
//
// Design volontairement sobre : le radar donne l'impression d'un coup
// d'œil ("un axe qui dépasse les autres"), la liste en dessous ne montre
// jamais de chiffre brut par défaut (pas de ratio ACWR affiché) —
// seulement un mot ("Normal", "Élevé"...) et, uniquement pour les axes qui
// sortent de l'ordinaire, une phrase d'explication. Objectif : rester
// lisible pour un coach ou un athlète qui n'est pas familier des
// statistiques.
//
// Tâche 18 : chaque ligne devient dépliable (clic) pour montrer la
// provenance — sans changer le radar ni la lecture "au coup d'œil" pour
// qui ne clique pas. sessions/athleteId/currentWeek sont optionnels : sans
// eux, le détail affiche juste la baseline (déjà dans `profile`), sans les
// séances contributrices.
// ============================================================

import { memo, useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { LOAD_AXES, CURRENT_AXIS_MODEL_VERSION, getAxisTopContributors } from "../../utils/loadAxes";

const AXIS_IDS = Object.keys(LOAD_AXES);

function RadarDot({ cx, cy, payload }) {
  return <circle cx={cx} cy={cy} r={4} fill={payload.color} stroke="var(--c-surface)" strokeWidth={1.5} />;
}

const AxisRadarCard = memo(({
  profile, title = "Ce que les séances ont surtout sollicité", subtitle = "Lecture descriptive de la dernière semaine connue, basée sur l'objectif déclaré de chaque séance.",
  sessions = null, athleteId = null, currentWeek = null,
}) => {
  const [expanded, setExpanded] = useState(null); // axisId ouvert, ou null
  if (!profile) return null;

  const data = AXIS_IDS.map(id => ({
    axis: LOAD_AXES[id].label,
    score: profile[id].score,
    color: profile[id].color,
  }));

  return (
    <div className="card p-4">
      <p className="card-title">{title}</p>
      <p className="card-subtitle mb-2">{subtitle}</p>

      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--c-border)" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "var(--c-text-2)", fontWeight: 600 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="rgba(255,255,255,0.30)"
            fill="#1D9E75"
            fillOpacity={0.10}
            strokeWidth={1.5}
            dot={<RadarDot />}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="space-y-1.5 mt-1">
        {AXIS_IDS.map(id => {
          const axis     = LOAD_AXES[id];
          const p        = profile[id];
          const flagged  = p.label === "Dominant";
          const isOpen   = expanded === id;
          const contributors = isOpen && sessions && athleteId != null && currentWeek != null
            ? getAxisTopContributors(athleteId, sessions, id, currentWeek)
            : [];
          return (
            <div key={id} style={{ borderRadius: 10, background: flagged ? `${p.color}12` : "var(--c-surface-2)", overflow: "hidden" }}>
              <button
                type="button" onClick={() => setExpanded(isOpen ? null : id)}
                className="tap-feedback" style={{ width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-1)", flex: 1 }}>{axis.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.color, flexShrink: 0 }}>{p.label}</span>
                </div>
                {flagged && (
                  <p style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 4, marginLeft: 17, lineHeight: 1.5 }}>
                    {axis.what}
                  </p>
                )}
              </button>

              {isOpen && (
                <div style={{ padding: "2px 10px 12px 17px", fontSize: 12, color: "var(--c-text-2)", lineHeight: 1.6 }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="chip chip-warning">Lecture descriptive</span>
                    <span>modèle {CURRENT_AXIS_MODEL_VERSION}</span>
                  </div>
                  <p><strong style={{ color: "var(--c-text-1)" }}>{axis.scientificLabel}</strong> · {axis.what}</p>
                  <p>
                    Charge de la semaine S{p.currentWeek} : <strong style={{ color: "var(--c-text-2)" }}>{p.currentLoad}</strong>
                    {p.habitualLoad != null && <> · Moyenne précédente : <strong style={{ color: "var(--c-text-2)" }}>{p.habitualLoad}</strong></>}
                  </p>
                  <p style={{ marginTop: 2 }}>
                    Historique disponible : <strong style={{ color: "var(--c-text-1)" }}>{p.dataQuality}</strong> ({p.weeksOfData} semaine{p.weeksOfData > 1 ? "s" : ""}). Cette lecture répartit la charge globale pour aider à comprendre le contenu ; ce n'est ni une mesure physiologique directe ni une estimation de risque.
                  </p>
                  {contributors.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <p style={{ fontWeight: 500, color: "var(--c-text-2)" }}>Séances qui contribuent le plus :</p>
                      {contributors.map(c => (
                        <p key={c.id}>· {c.title} · {c.focusLabel ?? "objectif général"} (S{c.week}) — contribution {c.axisLoad}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default AxisRadarCard;
