import { Trophy, Activity, Dumbbell, HeartPulse, User } from "lucide-react";

export const TABS = [
  { id: "performances", label: "Performances", icon: Trophy },
  { id: "charge", label: "Charge & Forme", icon: Activity },
  { id: "entrainements", label: "Entraînements", icon: Dumbbell },
  { id: "blessures", label: "Blessures", icon: HeartPulse },
  { id: "profil", label: "Profil", icon: User },
];

export const RADAR_KEYS = [
  { key: "speed", label: "Vitesse" },
  { key: "strength", label: "Force" },
  { key: "explosivity", label: "Explosivité" },
  { key: "endurance", label: "Endurance" },
  { key: "technique", label: "Technique" },
];

export const INJURY_STATUS_OPTIONS = ["actif", "en suivi", "chronique", "résolu"];

export function scoreColor(value, inverted = false) {
  if (inverted) {
    if (value > 70) return "#E24B4A";
    if (value > 45) return "#EF9F27";
    return "#1D9E75";
  }
  if (value >= 75) return "#1D9E75";
  if (value >= 50) return "#EF9F27";
  return "#E24B4A";
}

export function acwrColor(value) {
  return value > 1.3 ? "#E24B4A" : value < 0.8 ? "#378ADD" : "#1D9E75";
}

export const inputCls = "input-premium";
export const labelCls = "block text-[12px] font-bold uppercase tracking-wide mb-1.5";
