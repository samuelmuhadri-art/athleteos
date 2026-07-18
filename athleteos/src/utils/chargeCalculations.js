// ============================================================
// AthleteOS — chargeCalculations.js
// Fonctions de calcul dynamique des scores à partir des rawLoad
// ⚠️ Ces fonctions lisent les seeds brutes (weeklyCharge) et
//    retournent les scores dérivés. Ne jamais coder les scores en dur.
// ============================================================

/**
 * Récupère les charges d'un athlète triées par semaine (plus récente en premier).
 * @param {number} athleteId
 * @param {Array}  weeklyCharge  — données brutes depuis mockData
 * @returns {Array<{week, rawLoad}>}
 */
function getAthleteLoads(athleteId, weeklyCharge) {
  return weeklyCharge
    .filter((w) => w.athleteId === athleteId)
    .sort((a, b) => b.week - a.week);
}

/**
 * Calcule la charge aiguë (moyenne des 4 dernières semaines).
 * Représente la charge récente (court terme).
 */
function computeAcute(loads) {
  const recent = loads.slice(0, 4);
  if (!recent.length) return 0;
  return recent.reduce((s, w) => s + w.rawLoad, 0) / recent.length;
}

/**
 * Calcule la charge chronique (moyenne des 12 dernières semaines).
 * Représente la capacité de travail de base (long terme).
 */
function computeChronic(loads) {
  const base = loads.slice(0, 12);
  if (!base.length) return 0;
  return base.reduce((s, w) => s + w.rawLoad, 0) / base.length;
}

/**
 * Calcule l'ACWR (Acute:Chronic Workload Ratio).
 * Cible : 0.8 – 1.3. Garde-fou division par zéro obligatoire.
 * @returns {number} arrondi à 2 décimales
 */
function computeACWR(acute, chronic) {
  // ⚠️ GARDE-FOU : ne jamais diviser par zéro
  if (chronic === 0) return 0;
  return Math.round((acute / chronic) * 100) / 100;
}

/**
 * Score de fatigue (0–100) dérivé de la charge aiguë.
 * - Charge aiguë élevée → fatigue élevée
 * - Normalisé sur une charge max estimée à 600
 */
function computeFatigue(acute, acwr) {
  const base = Math.min(100, Math.round((acute / 600) * 100));
  // Bonus si ACWR très élevé (surcharge soudaine)
  const acwrPenalty = acwr > 1.3 ? Math.round((acwr - 1.3) * 40) : 0;
  return Math.min(100, base + acwrPenalty);
}

/**
 * Score de forme (0–100).
 * La forme monte quand la charge chronique est élevée et la fatigue aiguë redescend.
 * Concept : fitness - fatigue = forme
 */
function computeForme(chronic, fatigue) {
  const fitness = Math.min(100, Math.round((chronic / 500) * 100));
  const forme   = Math.max(0, fitness - Math.round(fatigue * 0.4));
  return Math.min(100, forme);
}

/**
 * Score de récupération (0–100).
 * Élevé quand la semaine courante est plus légère que la moyenne chronique.
 */
function computeRecovery(acute, chronic) {
  if (chronic === 0) return 50;
  const ratio = acute / chronic;
  if (ratio < 0.6) return 90;  // semaine très légère = bonne récupération
  if (ratio < 0.8) return 75;
  if (ratio < 1.0) return 60;
  if (ratio < 1.2) return 45;
  return 30;                    // semaine chargée = récupération faible
}

/**
 * Score readiness (0–100) = combinaison forme + récupération - fatigue.
 * Indicateur global de disponibilité à la performance.
 */
function computeReadiness(forme, recovery, fatigue) {
  const raw = Math.round(forme * 0.4 + recovery * 0.35 + (100 - fatigue) * 0.25);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Score de risque blessure (0–100).
 * Alerte si > 60. Facteurs : ACWR élevé, fatigue élevée, récupération faible.
 */
function computeInjuryRisk(acwr, fatigue, recovery) {
  let risk = 0;
  // ACWR hors zone cible
  if (acwr > 1.5)      risk += 50;
  else if (acwr > 1.3) risk += 30;
  else if (acwr < 0.6) risk += 15; // déconditionnement
  // Fatigue élevée
  if (fatigue > 70) risk += 25;
  else if (fatigue > 50) risk += 10;
  // Mauvaise récupération
  if (recovery < 40) risk += 20;
  else if (recovery < 60) risk += 10;
  return Math.min(100, risk);
}

/**
 * Score de STABILITÉ DE PERFORMANCE (0–100).
 * ⚠️ NOUVEAU — dernier score composite manquant par rapport au document de
 * concept initial (fatigue, forme, récupération, readiness, risque, ACWR
 * existaient déjà ; celui-ci les complète).
 *
 * Contrairement aux autres scores (basés sur la charge d'entraînement),
 * celui-ci se base sur la RÉGULARITÉ des performances en compétition/tests
 * dans le temps : un athlète stable produit des résultats proches les uns
 * des autres ; un athlète en dents de scie a de gros écarts.
 *
 * Méthode : coefficient de variation (écart-type / moyenne) — mesure
 * statistique standard de dispersion relative. Un CV bas = résultats
 * groupés = stable. Un CV haut = résultats dispersés = instable.
 * Nécessite au moins 3 points de mesure pour être fiable statistiquement.
 *
 * @param {Array<{month, value}>} performanceHistory
 * @returns {number|null} 0-100, ou null si pas assez de données
 */
export function computePerformanceStability(performanceHistory) {
  const values = (performanceHistory ?? [])
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => Number(p.value))
    .filter((v) => !isNaN(v));

  if (values.length < 3) return null; // pas assez de mesures pour être fiable

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / Math.abs(mean); // coefficient de variation (dispersion relative)

  // Calibration : CV=0 (résultats identiques) → 100. CV≥0.15 (15% de dispersion) → proche de 0.
  // 15% est un seuil raisonnable en performance sportive (au-delà, la variabilité
  // est rarement due au hasard mais à un vrai manque de régularité).
  const score = Math.max(0, Math.min(100, Math.round(100 - (cv / 0.15) * 100)));
  return score;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Calcule les métriques d'un athlète pour une semaine donnée (fenêtre glissante).
 * Alias sémantique utilisé par AthleteList / AthleteProfile.
 *
 * @param {number} athleteId
 * @param {Array}  weeklyCharge  — données brutes depuis mockData
 * @param {number} [targetWeek] — semaine cible (défaut : la plus récente dispo)
 * @returns {{ fatigue, forme, recuperation, readiness, risque, acwr, acute, chronic, loads }}
 */
export function getAthleteMetricsForWeek(athleteId, weeklyCharge, targetWeek) {
  const allLoads = getAthleteLoads(athleteId, weeklyCharge); // desc par semaine

  // Si une semaine cible est demandée, on filtre jusqu'à cette semaine
  const loads = targetWeek
    ? allLoads.filter((w) => w.week <= targetWeek)
    : allLoads;

  const acute    = computeAcute(loads);
  const chronic  = computeChronic(loads);
  const acwr     = computeACWR(acute, chronic);
  const fatigue  = computeFatigue(acute, acwr);
  const forme    = computeForme(chronic, fatigue);
  const recovery = computeRecovery(acute, chronic);
  const readiness = computeReadiness(forme, recovery, fatigue);
  const risque   = computeInjuryRisk(acwr, fatigue, recovery);

  return {
    fatigue,
    forme,
    recuperation: recovery,
    readiness,
    risque,
    acwr,
    acute:   Math.round(acute),
    chronic: Math.round(chronic),
    loads,
  };
}

/**
 * Calcule l'ensemble des scores dérivés pour un athlète donné.
 * Utilisé par Dashboard, AthleteProfile, ChargeView.
 *
 * @param {number} athleteId
 * @param {Array}  weeklyCharge — données brutes depuis mockData
 * @returns {{ fatigue, forme, recuperation, readiness, risque, acwr }}
 */
export function computeAthleteScores(athleteId, weeklyCharge) {
  const loads    = getAthleteLoads(athleteId, weeklyCharge);
  const acute    = computeAcute(loads);
  const chronic  = computeChronic(loads);
  const acwr     = computeACWR(acute, chronic);
  const fatigue  = computeFatigue(acute, acwr);
  const forme    = computeForme(chronic, fatigue);
  const recovery = computeRecovery(acute, chronic);
  const readiness = computeReadiness(forme, recovery, fatigue);
  const risque   = computeInjuryRisk(acwr, fatigue, recovery);

  return {
    fatigue,
    forme,
    recuperation: recovery,
    readiness,
    risque,
    acwr,
    // Données brutes utiles pour les graphiques
    acute:   Math.round(acute),
    chronic: Math.round(chronic),
    loads,   // historique complet trié
  };
}

/**
 * Génère les données de graphique pour l'AreaChart charge/forme d'un athlète.
 * Retourne les 12 dernières semaines avec rawLoad, fatigue, forme calculés.
 *
 * @param {number} athleteId
 * @param {Array}  weeklyCharge
 * @returns {Array<{label, rawLoad, fatigue, forme, readiness}>}
 */
export function computeChargeChartData(athleteId, weeklyCharge) {
  const loads = getAthleteLoads(athleteId, weeklyCharge)
    .slice(0, 12)
    .reverse(); // chronologique pour le graphique

  return loads.map((entry, i) => {
    // Simuler le calcul sur une fenêtre glissante
    const sliceFrom  = Math.max(0, loads.length - 12 + i - 3);
    const acuteSlice = loads.slice(Math.max(0, i - 3), i + 1);
    const chronSlice = loads.slice(Math.max(0, i - 11), i + 1);

    const ac = acuteSlice.reduce((s, l) => s + l.rawLoad, 0) / (acuteSlice.length || 1);
    const ch = chronSlice.reduce((s, l) => s + l.rawLoad, 0) / (chronSlice.length || 1);
    const acwr  = computeACWR(ac, ch);
    const fat   = computeFatigue(ac, acwr);
    const forme = computeForme(ch, fat);
    const rec   = computeRecovery(ac, ch);
    const read  = computeReadiness(forme, rec, fat);

    return {
      label:     `S${entry.week}`,
      rawLoad:   entry.rawLoad,
      fatigue:   fat,
      forme,
      readiness: read,
    };
  });
}

/**
 * Retourne le statut textuel selon les scores.
 * Utilisé pour les badges et l'analyse contextuelle automatique.
 */
export function getStatusLabel(readiness, fatigue, acwr) {
  if (acwr > 1.3 || fatigue > 70)      return { label: "Surcharge",       color: "#E24B4A", dot: "🔴" };
  if (readiness >= 75 && fatigue <= 45) return { label: "Optimal",         color: "#1D9E75", dot: "🟢" };
  if (readiness >= 55)                  return { label: "Modéré",          color: "#EF9F27", dot: "🟡" };
  return                                       { label: "Récupération",    color: "#378ADD", dot: "⚪" };
}

/**
 * Génère le texte d'analyse contextuelle automatique (règles codées, sans IA).
 * Affiché dans l'onglet Charge & Forme du profil athlète.
 */
export function generateContextAnalysis(scores, nextCompetition) {
  const { acwr, fatigue, forme, readiness } = scores;
  const lines = [];

  // Règle 1 : surcharge aiguë
  if (acwr > 1.3) {
    lines.push(
      `⚠️ Charge aiguë élevée (ACWR ${acwr.toFixed(2)}). Risque accru de blessure et de contre-performance. Réduction de la charge recommandée cette semaine.`
    );
  }

  // Règle 2 : forme ascendante
  if (forme > 70 && fatigue < 40) {
    lines.push(
      `✅ Athlète en phase ascendante (forme ${forme}/100, fatigue ${fatigue}/100). Bon moment pour programmer une compétition ou un test de performance.`
    );
  }

  // Règle 3 : compétition imminente
  if (nextCompetition) {
    const daysUntil = Math.round(
      (new Date(nextCompetition.date) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil >= 0 && daysUntil <= 21) {
      const statut  = getStatusLabel(readiness, fatigue, acwr).label;
      const coherent = readiness >= 60 && fatigue <= 60 ? "cohérent avec l'objectif" : "préoccupant";
      lines.push(
        `🏆 La compétition "${nextCompetition.name}" est dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""}. L'athlète est en état "${statut}", ce qui est ${coherent}.`
      );
    }
  }

  // Règle 4 : sous-charge (risque de déconditionnement)
  if (acwr < 0.6) {
    lines.push(
      `📉 Charge aiguë très faible (ACWR ${acwr.toFixed(2)}). Risque de déconditionnement. Envisager une reprise progressive.`
    );
  }

  // Règle 5 : tout va bien
  if (lines.length === 0) {
    lines.push(
      `✅ Aucune anomalie détectée. Charge et forme dans les zones cibles (ACWR ${acwr.toFixed(2)}, readiness ${readiness}/100).`
    );
  }

  return lines;
}