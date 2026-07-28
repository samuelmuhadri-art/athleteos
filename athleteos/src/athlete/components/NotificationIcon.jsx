import {
  BarChart3,
  Bell,
  CalendarDays,
  FileText,
  Flag,
  Heart,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

const ICONS = {
  bell: Bell,
  calendar: CalendarDays,
  chart: BarChart3,
  flag: Flag,
  heart: Heart,
  message: MessageSquare,
  report: FileText,
  target: Target,
  trophy: Trophy,
};

export function NotificationIcon({ presentation, size = 46, iconSize = 20 }) {
  const Icon = ICONS[presentation.icon] ?? Bell;
  return (
    <div style={{
      width:size, height:size, borderRadius:Math.round(size * 0.32), flexShrink:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:presentation.soft, border:`1px solid ${presentation.border}`,
      boxShadow:`inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px ${presentation.soft}`,
    }}>
      <Icon size={iconSize} color={presentation.accent} strokeWidth={1.9}/>
    </div>
  );
}

export function NotificationDecor({ presentation }) {
  if (!presentation.celebration && presentation.icon !== "heart") return null;
  return (
    <div aria-hidden="true" style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      <Heart size={38} color={presentation.accent} strokeWidth={1.2} style={{ position:"absolute", right:48, top:-10, opacity:0.12, transform:"rotate(16deg)" }}/>
      <Heart size={20} color={presentation.accent} strokeWidth={1.2} style={{ position:"absolute", right:18, bottom:8, opacity:0.16, transform:"rotate(-12deg)" }}/>
      <Sparkles size={22} color={presentation.accent} strokeWidth={1.4} style={{ position:"absolute", left:"44%", top:5, opacity:0.13 }}/>
    </div>
  );
}
