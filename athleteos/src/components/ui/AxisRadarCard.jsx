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
// jamais de chiffre brut (pas de ratio ACWR affiché) — seulement un mot
// ("Normal", "Élevé"...) et, uniquement pour les axes qui sortent de
// l'ordinaire, une phrase d'explication. Objectif : rester lisible pour
// un coach ou un athlète qui n'est pas familier des statistiques.
// ============================================================

import { memo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { LOAD_AXES } from "../../utils/loadAxes";

const AXIS_IDS = Object.keys(LOAD_AXES);

function RadarDot({ cx, cy, payload }) {
  return <circle cx={cx} cy={cy} r={4} fill={payload.color} stroke="var(--c-surface)" strokeWidth={1.5} />;
}

const AxisRadarCard = memo(({ profile, title = "Profil de charge", subtitle = "Comparé à tes semaines habituelles" }) => {
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
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10.5, fill: "var(--c-text-2)", fontWeight: 600 }} />
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
          const axis    = LOAD_AXES[id];
          const p       = profile[id];
          const flagged = p.label !== "Normal";
          return (
            <div key={id} style={{ padding: "7px 10px", borderRadius: 10, background: flagged ? `${p.color}12` : "var(--c-surface-2)" }}>
              <div className="flex items-center gap-2.5">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text-1)", flex: 1 }}>{axis.label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: p.color, flexShrink: 0 }}>{p.label}</span>
              </div>
              {flagged && (
                <p style={{ fontSize: 10, color: "var(--c-text-3)", marginTop: 3, marginLeft: 17, lineHeight: 1.4 }}>
                  {axis.what}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default AxisRadarCard;
