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
import { getISOWeekYear, matchesISOWeek } from "./helpers";

// Un item "critical" passe toujours avant un "positive", peu importe
// l'ordre dans lequel les règles ci-dessous ont été évaluées.
const PRIORITY = { critical: 0, warning: 1, info: 2, positive: 3 };

function firstName(name) {
  return name?.split(" ")[0] ?? "Athlète";
}

function localDateKey(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/u.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : localDateKey(parsed);
}

export function buildCoachFeed({
  athletes = [], weeklyCharge = [], sessions = [], injuries = [], competitions = [], alerts = [],
  currentWeek, now = new Date(), currentYear = getISOWeekYear(now),
}) {
  const items = [];
  const todayKey = localDateKey(now);
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysKey = localDateKey(inSevenDays);
  const weekSessions = sessions.filter(session => matchesISOWeek(session, currentWeek, currentYear));

  const unreadAlerts = alerts.filter(alert => !alert.is_read);
  if (unreadAlerts.length > 0) {
    const important = unreadAlerts.filter(alert => ["high", "critical", "danger"].includes(String(alert.severity).toLowerCase())).length;
    items.push({
      id: "unread-alerts", priority: important > 0 ? "critical" : "warning", order: 0,
      icon: "alert", color: important > 0 ? "#E24B4A" : "#EF9F27", route: "alerts", label: "Alertes à lire",
      sentence: `${unreadAlerts.length} alerte${unreadAlerts.length > 1 ? "s" : ""} attend${unreadAlerts.length > 1 ? "ent" : ""} ton attention${important > 0 ? `, dont ${important} prioritaire${important > 1 ? "s" : ""}` : ""}.`,
    });
  }

  const upcomingSessions = weekSessions.filter(session => {
    const dateKey = localDateKey(session.sessionDate);
    return dateKey && dateKey >= todayKey && dateKey <= inSevenDaysKey;
  });
  const missingResponses = upcomingSessions.reduce((count, session) => (
    count + (session.validations ?? []).filter(validation => !validation.rsvpStatus).length
  ), 0);
  if (missingResponses > 0) {
    items.push({
      id: "missing-rsvp", priority: "warning", order: 10, icon: "users", color: "#EF9F27", route: "planning", label: "Réponses manquantes",
      sentence: `${missingResponses} réponse${missingResponses > 1 ? "s" : ""} de présence manque${missingResponses > 1 ? "nt" : ""} encore pour les prochaines séances.`,
    });
  }

  const pendingAthleteSessions = sessions.filter(session => session.createdByAthlete);
  if (pendingAthleteSessions.length > 0) {
    items.push({
      id: "athlete-session-validations", priority: "info", order: 40, icon: "check", color: "var(--tone-info)", route: "planning", label: "Validations",
      sentence: `${pendingAthleteSessions.length} séance${pendingAthleteSessions.length > 1 ? "s" : ""} ajoutée${pendingAthleteSessions.length > 1 ? "s" : ""} par un athlète ${pendingAthleteSessions.length > 1 ? "sont" : "est"} à vérifier.`,
    });
  }

  const nextCompetition = [...competitions]
    .filter(competition => localDateKey(competition.date) >= todayKey)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  if (nextCompetition) {
    const competitionDate = new Date(`${localDateKey(nextCompetition.date)}T12:00:00`);
    const days = Math.max(0, Math.round((competitionDate - new Date(`${todayKey}T12:00:00`)) / 86_400_000));
    if (days <= 14) {
      items.push({
        id: `competition-${nextCompetition.id}`, priority: "info", order: 50, icon: "trophy", color: "#A78BFA", route: "competitions", label: "Compétition proche",
        sentence: `${nextCompetition.name} arrive ${days === 0 ? "aujourd'hui" : `dans ${days} jour${days > 1 ? "s" : ""}`}. Vérifie les athlètes et les épreuves prévues.`,
      });
    }
  }

  athletes.forEach(athlete => {
    const hasCharge = weeklyCharge.some(row =>
      row.athleteId === athlete.id && matchesISOWeek(row, currentWeek, currentYear)
    );
    const name = firstName(athlete.name);

    if (hasCharge) {
      const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, currentWeek);

      if (metrics.variationPercent != null && Math.abs(metrics.variationPercent) >= 20) {
        const direction = metrics.variationPercent > 0 ? "plus élevée" : "plus basse";
        items.push({
          id: `load-variation-${athlete.id}`, priority: "info", order: 70, icon: "activity", color: "#378ADD", route: "charge", label: "Charge inhabituelle",
          sentence: `La charge de ${name} est ${direction} que d'habitude (${Math.abs(metrics.variationPercent)} % d'écart). Ouvre le détail pour voir quelles séances expliquent ce changement.`,
        });
      }

      if (metrics.wellnessScore != null && metrics.wellnessScore < 25) {
        items.push({
          id: `fatigue-${athlete.id}`, priority: "warning", order: 60, icon: "zap", color: "#EF9F27", route: "athletes", label: "Ressenti à discuter",
          sentence: `${name} a donné plusieurs réponses basses dans son état du jour — prends contact pour comprendre ce qui pèse aujourd'hui.`,
        });
      }

      if (metrics.wellnessScore >= 85) {
        items.push({
          id: `top-${athlete.id}`, priority: "positive", order: 90, icon: "trending", color: "#1D9E75", route: "athletes", label: "Retour positif",
          sentence: `${name} décrit un bon ressenti aujourd'hui. Le détail des cinq réponses reste disponible.`,
        });
      }
    }

    // Axe de charge inhabituel : un seul signal par athlète, sur l'axe le
    // plus marqué (évite de noyer le coach si plusieurs axes sortent en
    // même temps). Volontairement pas de chiffre — juste "quel axe" et
    // "ce que ça veut dire", cf. AxisRadarCard.
    const axisProfile = getAthleteAxisProfile(athlete.id, weekSessions, currentWeek);
    if (axisProfile) {
      const worst = Object.entries(axisProfile).sort((a, b) => b[1].score - a[1].score)[0];
      if (worst && worst[1].score >= 75) {
        const [axisId, axisData] = worst;
        const axis = LOAD_AXES[axisId];
        items.push({
          id: `axis-${athlete.id}`, priority: "info", order: 80, icon: "activity", color: axisData.color, route: "charge", label: "Sollicitation marquée",
          sentence: `${name} a surtout travaillé ${axis.nounPhrase} cette semaine — ${axis.what}`,
        });
      }
    }

    // Absences répétées cette semaine.
    const athleteWeekSessions = weekSessions.filter(s => s.athleteIds?.includes(athlete.id));
    const missed = athleteWeekSessions.filter(s => s.validations?.find(v => v.athleteId === athlete.id && v.status === "none")).length;
    if (missed >= 2) {
      items.push({
        id: `absent-${athlete.id}`, priority: "warning", order: 65, icon: "users", color: "var(--tone-danger)", route: "athletes", label: "Absences répétées",
        sentence: `${name} a manqué ${missed} séances cette semaine — vaut le coup de vérifier ce qui se passe.`,
      });
    }
  });

  // Blessures actives.
  (injuries ?? []).filter(i => i.status !== "résolu").forEach(inj => {
    const athlete = athletes.find(a => a.id === inj.athleteId);
    if (!athlete) return;
    items.push({
      id: `injury-${inj.id}`, priority: inj.intensity >= 6 ? "critical" : "warning", order: 20, icon: "heart", route: "athletes", label: "Blessure active",
      color: inj.intensity >= 6 ? "#E24B4A" : "#EF9F27",
      sentence: `${firstName(athlete.name)} gère une blessure active (${inj.name}, intensité ${inj.intensity}/10).`,
    });
  });

  return items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || PRIORITY[a.priority] - PRIORITY[b.priority]);
}
