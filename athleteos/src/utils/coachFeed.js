// ============================================================
// AthleteOS — src/utils/coachFeed.js
//
// "Fil du coach" — transforme les métriques déjà calculées (ACWR,
// fatigue, readiness, blessures, absences, compétitions à venir) en
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

      if (metrics.acwr > 1.5) {
        items.push({
          id: `acwr-crit-${athlete.id}`, priority: "critical", icon: "alert", color: "#E24B4A",
          sentence: `${name} est en surcharge critique (ACWR ${metrics.acwr.toFixed(2)}) — hors de la zone habituelle, à examiner cette semaine.`,
        });
      } else if (metrics.acwr > 1.3) {
        items.push({
          id: `acwr-warn-${athlete.id}`, priority: "warning", icon: "activity", color: "#EF9F27",
          sentence: `${name} approche la zone de surcharge (ACWR ${metrics.acwr.toFixed(2)}) — à surveiller cette semaine.`,
        });
      } else if (metrics.acwr < 0.8) {
        items.push({
          id: `acwr-low-${athlete.id}`, priority: "info", icon: "activity", color: "#378ADD",
          sentence: `${name} est en sous-charge (ACWR ${metrics.acwr.toFixed(2)}) — risque de déconditionnement si ça se prolonge.`,
        });
      }

      if (metrics.fatigue > 75) {
        items.push({
          id: `fatigue-${athlete.id}`, priority: "warning", icon: "zap", color: "#EF9F27",
          sentence: `${name} affiche une fatigue élevée (${metrics.fatigue}/100) — envisage une séance allégée.`,
        });
      }

      if (metrics.readiness >= 85 && metrics.acwr >= 0.8 && metrics.acwr <= 1.3) {
        items.push({
          id: `top-${athlete.id}`, priority: "positive", icon: "trending", color: "#1D9E75",
          sentence: `${name} est en forme optimale (readiness ${metrics.readiness}/100) — bon moment pour une séance exigeante.`,
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
      if (worst && worst[1].score > 75) {
        const [axisId, axisData] = worst;
        const axis = LOAD_AXES[axisId];
        items.push({
          id: `axis-${athlete.id}`, priority: "warning", icon: "activity", color: axisData.color,
          sentence: `${name} a une charge ${axis.nounPhrase} nettement plus élevée que d'habitude cette semaine — ${axis.what}`,
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

  // Compétition dans les 7 jours + athlète en zone de surcharge.
  const in7Days = new Date(Date.now() + 7 * 86400000);
  (competitions ?? []).forEach(comp => {
    const compDate = new Date(comp.date);
    if (compDate > in7Days || compDate < new Date()) return;
    (comp.athleteIds ?? []).forEach(athleteId => {
      const athlete = athletes.find(a => a.id === athleteId);
      if (!athlete || !weeklyCharge.some(w => w.athleteId === athleteId)) return;
      const metrics = getAthleteMetricsForWeek(athleteId, weeklyCharge, currentWeek);
      if (metrics.acwr <= 1.3) return;
      const days = Math.max(0, Math.round((compDate - new Date()) / 86400000));
      items.push({
        id: `comp-risk-${comp.id}-${athleteId}`, priority: "warning", icon: "trophy", color: "#EF9F27",
        sentence: `${firstName(athlete.name)} dispute "${comp.name}" dans ${days === 0 ? "moins d'un jour" : `${days}j`}, en zone de surcharge (ACWR ${metrics.acwr.toFixed(2)}).`,
      });
    });
  });

  return items.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
}
