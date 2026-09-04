import { initialsFromName } from "../../utils/helpers";

export default function InitialAvatar({
  name,
  initials,
  src,
  size = 40,
  variant = "brand",
  className = "",
  title,
}) {
  const label = title ?? name ?? "Avatar";
  const value = String(initials || initialsFromName(name)).slice(0, 2).toUpperCase();
  const backgrounds = {
    brand: "linear-gradient(135deg, var(--c-accent, #1D9E75), #16826C)",
    coach: "linear-gradient(135deg, #5B8DEF, #2563EB)",
    neutral: "var(--c-surface-3)",
  };

  if (src) {
    return <img src={src} alt={label} className={`initial-avatar ${className}`} style={{ width:size, height:size }} />;
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={`initial-avatar ${className}`}
      style={{ width:size, height:size, color:"#fff", background:backgrounds[variant] ?? backgrounds.brand }}
    >
      {value || "?"}
    </span>
  );
}
