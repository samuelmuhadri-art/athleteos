import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { getNotificationPresentation } from "../notificationPresentation";
import { NotificationDecor, NotificationIcon } from "./NotificationIcon";

const DISPLAY_DURATION = 7000;

export default function NotificationBanner({ notification, onOpen, onDismiss }) {
  const presentation = getNotificationPresentation(notification);

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DISPLAY_DURATION);
    return () => window.clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div role="status" aria-live="polite" className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] animate-slide-down"
      style={{ width:"min(460px, calc(100% - 24px))", pointerEvents:"none" }}>
      <div style={{
        position:"relative", overflow:"hidden", pointerEvents:"auto", borderRadius:20,
        background:`linear-gradient(135deg, ${presentation.soft}, rgba(18,20,24,0.96) 46%)`,
        border:`1px solid ${presentation.border}`, boxShadow:"0 20px 60px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.08)",
        backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)",
      }}>
        <NotificationDecor presentation={presentation}/>
        <button type="button" onClick={() => onOpen(notification)} className="tap-feedback"
          style={{ position:"relative", width:"100%", padding:"14px 52px 14px 14px", display:"flex", alignItems:"center", gap:12, border:"none", background:"transparent", color:"inherit", textAlign:"left", cursor:"pointer" }}>
          <NotificationIcon presentation={presentation}/>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:12, fontWeight:800, color:presentation.accent, textTransform:"uppercase", letterSpacing:"0.055em" }}>{presentation.label}</p>
            <p style={{ marginTop:3, fontSize:14, lineHeight:1.35, fontWeight:800, color:"var(--c-text-1)" }} className="line-clamp-1">{notification.title}</p>
            {notification.description && <p style={{ marginTop:3, fontSize:13, lineHeight:1.4, color:"var(--c-text-2)" }} className="line-clamp-1">{notification.description}</p>}
            <span style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:800, color:presentation.accent }}>
              {presentation.actionLabel}<ArrowRight size={14}/>
            </span>
          </div>
        </button>
        <button type="button" aria-label="Fermer la notification" onClick={onDismiss}
          style={{ position:"absolute", right:6, top:6, width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", color:"var(--c-text-2)", cursor:"pointer" }}>
          <X size={17}/>
        </button>
        <div aria-hidden="true" className="notification-banner-progress" style={{ background:presentation.accent }}/>
      </div>
    </div>
  );
}
