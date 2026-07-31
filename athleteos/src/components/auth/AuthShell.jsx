import { ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import AthleteOSLogo from "../brand/AthleteOSLogo";

const PRODUCT_POINTS = [
  { icon: Sparkles, text: "Les actions importantes restent visibles au bon moment." },
  { icon: UsersRound, text: "Coach et athlètes partagent le même suivi, chacun à son niveau." },
  { icon: ShieldCheck, text: "Chaque membre accède uniquement à l’espace de son club." },
];

export default function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <main className="auth-shell">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />

      <div className="auth-layout">
        <aside className="auth-story" aria-label="Présentation AthleteOS">
          <AthleteOSLogo direction="row" size={44} wordmarkSize={21} />
          <div className="auth-product-points">
            {PRODUCT_POINTS.map(({ icon: Icon, text }) => (
              <div key={text} className="auth-product-point">
                <span><Icon size={16} aria-hidden="true" /></span>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <p className="auth-story-footnote">AthleteOS · Espace club sécurisé</p>
        </aside>

        <section className="auth-workspace" aria-labelledby="auth-page-title">
          <div className="auth-mobile-brand">
            <AthleteOSLogo direction="row" size={38} wordmarkSize={18} />
          </div>

          <div className="auth-card">
            <header className="auth-card-header">
              <p className="auth-kicker">{eyebrow}</p>
              <h1 id="auth-page-title">{title}</h1>
              <p>{description}</p>
            </header>
            {children}
          </div>

          {footer && <div className="auth-footer">{footer}</div>}
        </section>
      </div>
    </main>
  );
}
