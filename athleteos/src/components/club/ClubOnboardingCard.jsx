import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Palette,
  PlayCircle,
  QrCode,
  Sparkles,
} from "lucide-react";
import { buildClubSetupSteps, getClubSetupProgress } from "../../utils/clubBranding";

export default function ClubOnboardingCard({
  club,
  athleteCount,
  sessionCount,
  onBranding,
  onInvite,
  onPlanning,
  onDemo,
}) {
  const steps = useMemo(
    () => buildClubSetupSteps({ club, athleteCount, sessionCount }),
    [club, athleteCount, sessionCount],
  );
  const progress = getClubSetupProgress(steps);
  const [expanded, setExpanded] = useState(progress < 100);

  const runAction = (action) => {
    if (action === "branding") onBranding?.();
    if (action === "invite") onInvite?.();
    if (action === "planning") onPlanning?.();
  };

  return (
    <section className={["club-onboarding-card", progress === 100 ? "complete" : ""].join(" ")} aria-labelledby="club-setup-title">
      <div className="club-onboarding-cover" style={club?.coverUrl ? { backgroundImage: `url(${club.coverUrl})` } : undefined} aria-hidden="true" />
      <div className="club-onboarding-main">
        <div className="club-onboarding-brand">
          <div className="club-onboarding-logo">
            {club?.logoUrl ? <img src={club.logoUrl} alt="" /> : <Sparkles size={22} aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <p className="meta-text">PREMIERS PAS</p>
            <h2 id="club-setup-title">Prépare {club?.name || "ton club"}</h2>
            <p>{progress === 100 ? "L’espace est prêt pour le groupe." : "Quelques étapes suffisent pour obtenir un espace réellement utile."}</p>
          </div>
        </div>

        <div className="club-onboarding-progress-block">
          <div className="club-onboarding-progress-copy">
            <strong>{progress} %</strong>
            <span>Configuration terminée</span>
          </div>
          <div className="club-progress-track" role="progressbar" aria-label="Progression de la configuration" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className="club-onboarding-toggle" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            {expanded ? "Réduire" : "Voir les étapes"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="club-onboarding-details">
          <ol className="club-setup-list">
            {steps.map((step) => (
              <li key={step.id} className={step.complete ? "complete" : ""}>
                <span className="club-setup-status">
                  {step.complete ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.description}</p>
                </div>
                {!step.complete && step.action && (
                  <button type="button" className="btn-secondary" onClick={() => runAction(step.action)}>
                    Continuer
                  </button>
                )}
              </li>
            ))}
          </ol>

          <div className="club-onboarding-actions">
            <button type="button" className="btn-ghost" onClick={onDemo}>
              <PlayCircle size={16} aria-hidden="true" /> Découvrir avec un exemple
            </button>
            <div>
              <button type="button" className="btn-secondary" onClick={onInvite}>
                <QrCode size={16} aria-hidden="true" /> Inviter
              </button>
              <button type="button" className="btn-secondary" onClick={onBranding}>
                <Palette size={16} aria-hidden="true" /> Personnaliser
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
