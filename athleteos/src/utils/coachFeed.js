// ============================================================
// AthleteOS — src/utils/coachFeed.js
//
// "Fil du coach" — transforme les métriques descriptives déjà calculées
// (charge, ressenti, blessures, absences, compétitions à venir) en
// phrases priorisées et actionnables, plutôt que de laisser le coach
// relire des chiffres bruts et en déduire lui-même ce qui compte cette
// semaine. Aucun nouveau calcul de charge : ce fichier lit uniquement
// getAthleteMetricsForWeek() (chargeCalculations.js) et applique des
// règles de priorisation.
//
// Pur JS sans dépendance React — même esprit que weeklyReports.js —
// donc facilement lisible/testable indépendamment du rendu.
// ============================================================

import { getAthleteMetricsForWeek } from "./chargeCalculations";
import { getAthleteAxisProfile, LOAD_AXES } from "./loadAxes";

// Un item "critical" passe toujours avant un "positive", peu importe
// l'ordre dans lequel les règles ci-dessous ont été évaluées.
const PRIORITY = { critical: 0, warning: 1, info: 2, positive: 3 };

function firstName(name) {
  return name?.split(" ")[0] ?? "Athlète";
}

export function buildCoachFeed({ athletes, weeklyCharge, sessions, injuries, competitions, currentWeek }) {
  const items = [];

  athletes.forEach(athlete => {
    const hasCharge = weeklyCharge.some(w => w.athleteId === athlete.id);
    const name = firstName(athlete.name);

    if (hasCharge) {
      const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek);

      if (metrics.variationPercent != null && Math.abs(metrics.variationPercent) >= 20) {
        const direction = metrics.variationPercent > 0 ? "plus élevée" : "plus basse";
        items.push({
          id: `load-variation-${athlete.id}`, priority: "info", icon: "activity", color: "#378ADD",
          sentence: `La charge de ${name} est ${direction} que d'habitude (${Math.abs(metrics.variationPercent)} % d'écart). Ouvre le détail pour voir quelles séances expliquent ce changement.`,
        });
      }

      if (metrics.wellnessScore != null && metrics.wellnessScore < 25) {
        items.push({
          id: `fatigue-${athlete.id}`, priority: "warning", icon: "zap", color: "#EF9F27",
          sentence: `${name} a donné plusieurs réponses basses dans son état du jour — prends contact pour comprendre ce qui pèse aujourd'hui.`,
        });
      }

      if (metrics.wellnessScore >= 85) {
        items.push({
          id: `top-${athlete.id}`, priority: "positive", icon: "trending", color: "#1D9E75",
          sentence: `${name} décrit un bon ressenti aujourd'hui. Le détail des cinq réponses reste disponible.`,
        });
      }
    }

    // Axe de charge inhabituel : un seul signal par athlète, sur l'axe le
    // plus marqué (évite de noyer le coach si plusieurs axes sortent en
    // même temps). Volontairement pas de chiffre — juste "quel axe" et
    // "ce que ça veut dire", cf. AxisRadarCard.
    const axisProfile = getAthleteAxisProfile(athlete.id, sessions, currentWeek);
    if (axisProfile) {
      const worst = Object.entries(axisProfile).sort((a, b) => b[1].score - a[1].score)[0];
      if (worst && worst[1].score >= 75) {
        const [axisId, axisData] = worst;
        const axis = LOAD_AXES[axisId];
        items.push({
          id: `axis-${athlete.id}`, priority: "info", icon: "activity", color: axisData.color,
          sentence: `${name} a surtout travaillé ${axis.nounPhrase} cette semaine — ${axis.what}`,
        });
      }
    }

    // Absences répétées cette semaine.
    const weekSessions = sessions.filter(s => s.week === currentWeek && s.athleteIds?.includes(athlete.id));
    const missed = weekSessions.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "none")).length;
    if (missed >= 2) {
      items.push({
        id: `absent-${athlete.id}`, priority: "warning", icon: "users", color: "#E24B4A",
        sentence: `${name} a manqué ${missed} séances cette semaine — vaut le coup de vérifier ce qui se passe.`,
      });
    }
  });

  // Blessures actives.
  (injuries ?? []).filter(i => i.status !== "résolu").forEach(inj => {
    const athlete = athletes.find(a => a.id === inj.athleteId);
    if (!athlete) return;
    items.push({
      id: `injury-${inj.id}`, priority: inj.intensity >= 6 ? "critical" : "warning", icon: "heart",
      color: inj.intensity >= 6 ? "#E24B4A" : "#EF9F27",
      sentence: `${firstName(athlete.name)} gère une blessure active (${inj.name}, intensité ${inj.intensity}/10).`,
    });
  });

  // Les compétitions restent visibles ailleurs dans le dashboard. Aucun
  // signal de risque n'est généré automatiquement à partir d'un ratio de charge.
  void competitions;

  return items.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
}
