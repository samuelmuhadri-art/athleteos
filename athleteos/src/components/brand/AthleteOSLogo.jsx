import { memo } from "react";

export const BRAND_NAME = "AthleteOS";

export const AthleteOSMark = memo(function AthleteOSMark({
  size = 32,
  color = "var(--color-success)",
  title,
  className,
  style,
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", color, flexShrink: 0, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M48 16A23 23 0 1 0 54 32" />
        <path d="M19 45 31.2 17.2c.4-.9 1.7-.9 2.1 0L46 45M25 35h15" />
      </g>
    </svg>
  );
});

export const AthleteOSBadge = memo(function AthleteOSBadge({ size = 36, title = BRAND_NAME, style }) {
  const radius = Math.max(8, Math.round(size * 0.29));
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--color-success)",
        background: "var(--c-surface-2)",
        border: "1px solid rgba(67,201,155,0.20)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045), var(--shadow-xs)",
        ...style,
      }}
    >
      <AthleteOSMark size={Math.round(size * 0.67)} color="currentColor" title={title} />
    </span>
  );
});

export const AthleteOSWordmark = memo(function AthleteOSWordmark({
  size = 15,
  color = "var(--c-text-1)",
  accentColor = "var(--color-success)",
  className,
  style,
}) {
  return (
    <span
      className={className}
      aria-label={BRAND_NAME}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        color,
        fontSize: size,
        fontWeight: 650,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      Athlete<span style={{ color: accentColor }}>OS</span>
    </span>
  );
});

const AthleteOSLogo = memo(function AthleteOSLogo({
  size = 36,
  wordmarkSize = 15,
  direction = "row",
  showWordmark = true,
  title = BRAND_NAME,
  className,
  style,
}) {
  const vertical = direction === "column";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        gap: vertical ? 12 : 10,
        ...style,
      }}
    >
      <AthleteOSBadge size={size} title={showWordmark ? null : title} />
      {showWordmark && <AthleteOSWordmark size={wordmarkSize} />}
    </span>
  );
});

export default AthleteOSLogo;
