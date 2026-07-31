import { memo, useEffect, useState } from "react";

// Anneau circulaire partagé pour les 5 jauges de "Charge d'entraînement" —
// même animation que l'anneau "Comment tu te sens" (WellnessRing), mais le
// centre affiche un mot de statut (Faible/Modéré/Bon/Élevé/Très élevé) au
// lieu d'un chiffre brut : le chiffre reste disponible dans le détail au tap.
const TrainingGauge = memo(({ value, color = "var(--c-text-3)", statusWord, label, size = 88, onClick }) => {
  const hasValue = value != null && Number.isFinite(Number(value));
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(hasValue ? Number(value) : 0), 150);
    return () => clearTimeout(timeout);
  }, [value, hasValue]);

  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, animated)) / 100) * circumference;

  return (
    <button type="button" onClick={onClick} className="tap-feedback"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: hasValue ? `drop-shadow(0 0 10px ${color}30)` : "none" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-border-strong)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.16,1,0.3,1)", opacity: hasValue ? 1 : 0.4 }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12%" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: hasValue ? color : "var(--c-text-3)", lineHeight: 1.15, textAlign: "center", letterSpacing: "-0.01em" }}>
            {hasValue ? statusWord : "—"}
          </span>
        </div>
      </div>
      <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-text-3)", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  );
});

export default TrainingGauge;
