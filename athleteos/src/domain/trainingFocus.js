// Objectif déclaré de la séance d'athlétisme.
//
// Ce catalogue décrit ce que la séance cherche à travailler. Il ne change
// jamais la charge session-RPE (durée réelle × RPE) et ne prédit ni fatigue,
// ni performance, ni risque. Une même distance peut donc avoir des objectifs
// différents : le coach choisit l'intention au lieu de laisser l'application
// la deviner à partir du titre ou du volume.

const weights = (neuromuscular, elastic, metabolic, muscular, technical, mental) => ({
  neuromuscular, elastic, metabolic, muscular, technical, mental,
});

export const TRAINING_FOCUS_GROUPS = Object.freeze({
  sprint: [
    { id: "sprint_general", label: "Sprint · objectif général", shortLabel: "Sprint général", description: "Séance de sprint sans objectif plus précis.", example: "À utiliser pour les anciennes séances ou si l'objectif reste mixte.", weights: weights(1, .7, .35, .35, .55, .4) },
    { id: "acceleration", label: "Départs & accélération", shortLabel: "Accélération", description: "Produire rapidement de la vitesse sur les premières foulées.", example: "Départs, 10 à 60 m, côtes courtes.", weights: weights(1, .7, .2, .45, .65, .5) },
    { id: "max_velocity", label: "Vitesse maximale", shortLabel: "Vitesse max", description: "Courir très vite avec beaucoup de récupération et une haute qualité d'exécution.", example: "Lancé, 40 à 80 m, travail de fréquence et de relâchement.", weights: weights(1, .85, .25, .4, .6, .55) },
    { id: "speed_endurance", label: "Tenir la vitesse", shortLabel: "Tenue de vitesse", description: "Maintenir une vitesse élevée quand l'effort se prolonge.", example: "Répétitions rapides typiques du 100–200 m.", weights: weights(.85, .65, .7, .5, .45, .55) },
    { id: "special_endurance", label: "Résistance sprint", shortLabel: "Résistance sprint", description: "Résister à la baisse de vitesse sur un effort long de sprint.", example: "150 à 600 m selon le niveau et l'épreuve, notamment 300–400 m.", weights: weights(.65, .5, 1, .55, .4, .65) },
    { id: "sprint_tempo", label: "Tempo & relâchement", shortLabel: "Tempo sprint", description: "Courir relâché à intensité contrôlée, sans rechercher la vitesse maximale.", example: "Répétitions sous-maximales avec récupération courte à modérée.", weights: weights(.35, .45, .65, .35, .45, .3) },
    { id: "sprint_technical", label: "Technique de course", shortLabel: "Technique sprint", description: "Améliorer les placements, le rythme et la qualité du geste.", example: "Gammes, éducatifs, passages techniques.", weights: weights(.45, .45, .25, .25, 1, .4) },
  ],
  haies: [
    { id: "hurdles_general", label: "Haies · objectif général", shortLabel: "Haies général", description: "Séance de haies à objectif mixte.", example: "Travail global de franchissement.", weights: weights(.85, .8, .35, .35, .9, .55) },
    { id: "hurdle_technique", label: "Technique de franchissement", shortLabel: "Technique haies", description: "Travailler les placements et la qualité du franchissement.", example: "Haies basses, éducatifs, jambe d'attaque et retour.", weights: weights(.5, .65, .25, .25, 1, .55) },
    { id: "hurdle_rhythm", label: "Rythme inter-haies", shortLabel: "Rythme haies", description: "Stabiliser le nombre de foulées et le rythme entre les obstacles.", example: "Parcours espacés ou rapprochés selon l'objectif.", weights: weights(.75, .75, .55, .35, .9, .65) },
    { id: "hurdle_speed", label: "Vitesse sur les haies", shortLabel: "Vitesse haies", description: "Associer haute vitesse et franchissement de qualité.", example: "Départs et passages rapides avec récupération longue.", weights: weights(1, .85, .4, .4, .8, .65) },
  ],
  endurance: [
    { id: "endurance_general", label: "Endurance · objectif général", shortLabel: "Endurance générale", description: "Séance d'endurance à objectif mixte ou non précisé.", example: "Utilisable pour les anciennes séances.", weights: weights(.2, .25, 1, .3, .2, .3) },
    { id: "easy_run", label: "Footing facile", shortLabel: "Footing facile", description: "Courir à une allure confortable, propice à l'échange.", example: "Footing souple ou reprise progressive.", weights: weights(.1, .2, .55, .2, .15, .15) },
    { id: "aerobic_endurance", label: "Endurance aérobie", shortLabel: "Endurance aérobie", description: "Développer la capacité à soutenir un effort continu modéré.", example: "Course continue ou répétitions longues contrôlées.", weights: weights(.15, .2, .85, .25, .15, .25) },
    { id: "threshold", label: "Allure soutenue / seuil", shortLabel: "Allure soutenue", description: "Soutenir une allure exigeante mais contrôlée sur plusieurs minutes.", example: "Blocs longs ou tempo continu soutenu.", weights: weights(.2, .25, 1, .3, .2, .45) },
    { id: "vma_vo2", label: "VMA / travail VO₂", shortLabel: "VMA", description: "Répéter des efforts à allure élevée pour solliciter fortement le système aérobie.", example: "Un 3 × 300 m peut appartenir ici si l'intention est la VMA.", weights: weights(.35, .4, 1, .4, .25, .5) },
    { id: "race_pace", label: "Allure spécifique", shortLabel: "Allure spécifique", description: "Se rapprocher du rythme et des exigences de l'épreuve préparée.", example: "Allure 800 m, 1 500 m, 5 000 m, etc.", weights: weights(.3, .35, .95, .4, .35, .6) },
    { id: "active_recovery", label: "Récupération active", shortLabel: "Récupération active", description: "Bouger facilement sans chercher un stimulus d'entraînement important.", example: "Footing très léger, vélo doux ou mobilité dynamique.", weights: weights(.05, .1, .3, .1, .1, .1) },
  ],
  saut: [
    { id: "jump_general", label: "Saut · objectif général", shortLabel: "Saut général", description: "Séance de saut à objectif mixte.", example: "Utilisable pour les anciennes séances.", weights: weights(.8, 1, .3, .4, .8, .5) },
    { id: "jump_technical", label: "Technique de saut", shortLabel: "Technique saut", description: "Améliorer l'élan, l'appel, le franchissement ou la réception.", example: "Répétitions techniques à qualité contrôlée.", weights: weights(.6, .7, .2, .3, 1, .55) },
    { id: "approach_run", label: "Course d'élan", shortLabel: "Course d'élan", description: "Stabiliser la vitesse, les marques et le placement avant l'appel.", example: "Élans partiels ou complets sans saut maximal systématique.", weights: weights(.75, .55, .25, .25, 1, .5) },
    { id: "plyometrics", label: "Pliométrie", shortLabel: "Pliométrie", description: "Produire rapidement de la force avec des contacts brefs et dynamiques.", example: "Sauts réactifs, contrebas, haies bondissantes selon le niveau.", weights: weights(.8, 1, .35, .55, .4, .45) },
    { id: "bounds", label: "Bonds", shortLabel: "Bonds", description: "Enchaîner des appuis bondissants horizontaux ou alternés.", example: "Multibonds, foulées bondissantes, cloche-pied.", weights: weights(.7, 1, .45, .55, .45, .4) },
    { id: "jump_power", label: "Impulsion & explosivité", shortLabel: "Explosivité", description: "Développer une production de force rapide à l'appel.", example: "Sauts courts, appels isolés, exercices explosifs.", weights: weights(1, .85, .25, .65, .45, .5) },
  ],
  lancer: [
    { id: "throw_general", label: "Lancer · objectif général", shortLabel: "Lancer général", description: "Séance de lancer à objectif mixte.", example: "Utilisable pour les anciennes séances.", weights: weights(.7, .45, .2, .7, .9, .45) },
    { id: "throw_technical", label: "Technique de lancer", shortLabel: "Technique lancer", description: "Améliorer les placements, le rythme et la trajectoire de l'engin.", example: "Lancers éducatifs, partiels ou complets contrôlés.", weights: weights(.55, .35, .15, .5, 1, .55) },
    { id: "throw_power", label: "Explosivité de lancer", shortLabel: "Explosivité lancer", description: "Produire rapidement de la force dans le geste de lancer.", example: "Lancers dynamiques, engins adaptés, mouvements explosifs.", weights: weights(.9, .5, .2, .85, .55, .55) },
    { id: "medicine_ball", label: "Médecine-ball", shortLabel: "Médecine-ball", description: "Développer la coordination et la puissance par des lancers variés.", example: "Lancers avant, arrière, rotationnels ou au-dessus de la tête.", weights: weights(.7, .35, .3, .8, .45, .4) },
  ],
  force: [
    { id: "strength_general", label: "Musculation · objectif général", shortLabel: "Musculation", description: "Séance de renforcement à objectif mixte.", example: "Utilisable pour les anciennes séances.", weights: weights(.6, .3, .3, 1, .3, .35) },
    { id: "max_strength", label: "Force maximale", shortLabel: "Force maximale", description: "Déplacer des charges élevées avec peu de répétitions et une technique maîtrisée.", example: "Séries lourdes avec récupération importante.", weights: weights(.85, .2, .2, 1, .4, .55) },
    { id: "strength_power", label: "Force-vitesse / puissance", shortLabel: "Puissance", description: "Produire de la force rapidement avec une intention explosive.", example: "Mouvements explosifs, charges adaptées, dérivés olympiques.", weights: weights(1, .45, .3, .85, .5, .5) },
    { id: "general_strength", label: "Renforcement général", shortLabel: "Renforcement", description: "Développer une base musculaire globale et contrôlée.", example: "Circuit, gainage, exercices unilatéraux.", weights: weights(.4, .25, .45, .85, .35, .3) },
    { id: "targeted_strength", label: "Renforcement ciblé", shortLabel: "Renforcement ciblé", description: "Travailler une zone ou une qualité définie par le programme.", example: "Mollets, ischio-jambiers, pied, tronc ou épaule.", weights: weights(.35, .25, .25, 1, .4, .3) },
  ],
  technique: [
    { id: "technical_general", label: "Technique générale", shortLabel: "Technique", description: "Apprendre ou stabiliser un geste précis.", example: "Éducatifs et répétitions de qualité.", weights: weights(.3, .3, .2, .2, 1, .35) },
  ],
  mobilite: [
    { id: "mobility_general", label: "Mobilité", shortLabel: "Mobilité", description: "Travailler l'amplitude et le contrôle du mouvement.", example: "Mobilité active, routine articulaire, contrôle moteur.", weights: weights(.1, .2, .1, .15, .3, .2) },
  ],
  recuperation: [
    { id: "recovery_general", label: "Récupération", shortLabel: "Récupération", description: "Séance facile orientée vers le relâchement et le retour au calme.", example: "Mobilité douce, marche, vélo léger ou routine de récupération.", weights: weights(.05, .05, .1, .05, .05, .1) },
  ],
});

const ALL_FOCUSES = Object.values(TRAINING_FOCUS_GROUPS).flat();
const FOCUS_BY_ID = new Map(ALL_FOCUSES.map(item => [item.id, item]));
const FOCUS_CATEGORY_BY_ID = new Map(Object.entries(TRAINING_FOCUS_GROUPS).flatMap(([category, items]) => items.map(item => [item.id, category])));

export function getTrainingFocusOptions(category) {
  return TRAINING_FOCUS_GROUPS[category] ?? TRAINING_FOCUS_GROUPS.technique;
}

export function getDefaultTrainingFocus(category) {
  return getTrainingFocusOptions(category)[0]?.id ?? "technical_general";
}

export function getTrainingFocus(focusId, category) {
  const focus = FOCUS_BY_ID.get(focusId);
  if (focus && (!category || FOCUS_CATEGORY_BY_ID.get(focusId) === category)) return focus;
  return FOCUS_BY_ID.get(getDefaultTrainingFocus(category));
}

export function getSessionTrainingFocus(session) {
  return getTrainingFocus(session?.trainingFocus ?? session?.training_focus, session?.category);
}

export function isTrainingFocusCompatible(focusId, category) {
  return getTrainingFocusOptions(category).some(item => item.id === focusId);
}
