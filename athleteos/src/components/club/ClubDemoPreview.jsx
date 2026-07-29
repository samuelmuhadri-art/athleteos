import { useRef } from "react";
import { createPortal } from "react-dom";
import { Activity, CalendarDays, CheckCircle2, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useModalAccessibility } from "../../hooks/useModalAccessibility";

const DEMO_ATHLETES = [
  { name: "Nora", discipline: "Sprint", dailyState: 86, state: "Bon ressenti" },
  { name: "Yanis", discipline: "Haies", dailyState: 54, state: "À discuter" },
  { name: "Lina", discipline: "Longueur", dailyState: 91, state: "Bon ressenti" },
];

export default function ClubDemoPreview({ onClose, onStart }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  useModalAccessibility({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  return createPortal(
    <div className="club-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="club-demo-dialog" role="dialog" aria-modal="true" aria-labelledby="club-demo-title" tabIndex={-1}>
        <header className="club-dialog-header">
          <div className="club-dialog-heading">
            <span className="club-dialog-icon"><Sparkles size={19} aria-hidden="true" /></span>
            <div>
              <p className="meta-text">MODE DÉCOUVERTE</p>
              <h2 id="club-demo-title">Voici AthleteOS avec un groupe actif</h2>
              <p>Données fictives — rien ne sera ajouté à ton club.</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="icon-btn" aria-label="Fermer la démonstration">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="club-demo-content">
          <div className="club-demo-hero">
            <div>
              <span><ShieldCheck size={14} aria-hidden="true" /> Semaine équilibrée</span>
              <h3>Le coach voit immédiatement où agir.</h3>
              <p>Les données importantes sont transformées en décisions simples et cliquables.</p>
            </div>
            <div className="club-demo-score"><strong>16/18</strong><span>états renseignés</span></div>
          </div>

          <div className="club-demo-metrics">
            {[
              { icon: Users, value: "18", label: "athlètes actifs" },
              { icon: CalendarDays, value: "6", label: "séances cette semaine" },
              { icon: Activity, value: "2", label: "points à vérifier" },
            ].map(({ icon: Icon, value, label }) => (
              <article key={label}><Icon size={17} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></article>
            ))}
          </div>

          <div className="club-demo-grid">
            <article className="club-demo-panel">
              <div className="club-demo-panel-title"><h4>État du groupe</h4><span>Exemple</span></div>
              {DEMO_ATHLETES.map((athlete) => (
                <div className="club-demo-athlete" key={athlete.name}>
                  <span className="club-demo-avatar">{athlete.name.slice(0, 1)}</span>
                  <div><strong>{athlete.name}</strong><span>{athlete.discipline}</span></div>
                  <div className="club-demo-readiness"><strong>{athlete.dailyState}</strong><span>{athlete.state}</span></div>
                </div>
              ))}
            </article>

            <article className="club-demo-panel">
              <div className="club-demo-panel-title"><h4>À faire aujourd’hui</h4><span>3 actions</span></div>
              {[
                "Valider la séance Sprint",
                "Échanger avec Yanis sur son ressenti",
                "Préparer la compétition de samedi",
              ].map((action) => (
                <div className="club-demo-action" key={action}><CheckCircle2 size={17} aria-hidden="true" /><span>{action}</span></div>
              ))}
            </article>
          </div>
        </div>

        <footer className="club-dialog-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Fermer</button>
          <button type="button" onClick={onStart} className="btn-primary">Créer ma première séance</button>
        </footer>
      </section>
    </div>,
    globalThis.document.body,
  );
}
