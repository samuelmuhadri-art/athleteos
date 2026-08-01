import { useMemo, useState } from "react";
import { ArrowRight, Bell, CheckCheck, Heart, Sparkles, X } from "lucide-react";
import { PushToggleButton } from "../../hooks/usePushNotifications";
import {
  NOTIFICATION_FILTERS,
  filterNotificationItems,
  formatNotificationTime,
  getNotificationPresentation,
} from "../notificationPresentation";
import { NotificationDecor, NotificationIcon } from "./NotificationIcon";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";

export default function NotificationCenter({
  notifications,
  subscribed,
  onSubscribe,
  permissionState,
  onClose,
  onOpen,
  onMarkAllRead,
}) {
  const { dialogRef } = useAccessibleDialog({ onClose });
  const [activeFilter, setActiveFilter] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState(null);
  const unreadCount = notifications.filter(notification => !notification.is_read).length;
  const filteredNotifications = useMemo(
    () => filterNotificationItems(notifications, activeFilter),
    [notifications, activeFilter]
  );
  const counts = useMemo(() => ({
    all:notifications.length,
    unread:unreadCount,
    messages:filterNotificationItems(notifications, "messages").length,
    sport:filterNotificationItems(notifications, "sport").length,
    club:filterNotificationItems(notifications, "club").length,
  }), [notifications, unreadCount]);

  const markAllRead = async () => {
    setMarkingAll(true);
    setActionError(null);
    const success = await onMarkAllRead();
    if (!success) setActionError("Les notifications n’ont pas pu être marquées comme lues.");
    setMarkingAll(false);
  };

  return (
    <div className="fixed inset-0 z-40 bottom-sheet-backdrop" onClick={onClose}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="notification-center-title"
        className="bottom-sheet md:mx-auto md:my-auto md:rounded-[24px] md:max-w-[580px] md:max-h-[82vh]"
        style={{ bottom:"calc(60px + env(safe-area-inset-bottom))", height:"min(760px, 82dvh)", display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--c-surface)" }}
        onClick={event => event.stopPropagation()}>
        <div className="bottom-sheet-handle md:hidden"/>

        <header style={{ position:"relative", overflow:"hidden", padding:"18px 20px 16px", flexShrink:0, borderBottom:"1px solid var(--c-border)", background:"linear-gradient(145deg, rgba(236,72,153,0.07), rgba(91,141,239,0.06) 48%, transparent)" }}>
          <Heart aria-hidden="true" size={62} color="#F08AC0" strokeWidth={1} style={{ position:"absolute", right:74, top:-22, opacity:0.07, transform:"rotate(14deg)" }}/>
          <Sparkles aria-hidden="true" size={30} color="#8DB1F6" strokeWidth={1.2} style={{ position:"absolute", right:24, bottom:10, opacity:0.08 }}/>
          <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
            <div>
              <p style={{ fontSize:12, fontWeight:800, color:"var(--tone-info)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Centre d’activité</p>
              <h2 id="notification-center-title" style={{ marginTop:5, fontSize:22, lineHeight:1.2, fontWeight:800, letterSpacing:"-0.02em", color:"var(--c-text-1)" }}>Notifications</h2>
              <p style={{ marginTop:5, fontSize:13, color:"var(--c-text-2)" }}>{unreadCount ? `${unreadCount} nouve${unreadCount > 1 ? "lles" : "lle"} à découvrir` : "Tu es à jour"}</p>
            </div>
            <button type="button" aria-label="Fermer les notifications" onClick={onClose}
              style={{ width:44, height:44, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--c-surface-2)", border:"1px solid var(--c-border)", color:"var(--c-text-2)", cursor:"pointer" }}>
              <X size={18}/>
            </button>
          </div>

          <div style={{ position:"relative", marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <PushToggleButton subscribed={subscribed} onToggle={onSubscribe} permissionState={permissionState}/>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} disabled={markingAll} className="btn-secondary"
                style={{ minHeight:44, display:"flex", alignItems:"center", gap:7 }}>
                <CheckCheck size={16}/>{markingAll ? "Synchronisation…" : "Tout marquer comme lu"}
              </button>
            )}
          </div>
        </header>

        <nav aria-label="Filtrer les notifications" style={{ padding:"12px 16px", display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none", flexShrink:0, borderBottom:"1px solid var(--c-border)" }}>
          {NOTIFICATION_FILTERS.map(filter => {
            const active = activeFilter === filter.id;
            return (
              <button key={filter.id} type="button" aria-pressed={active} onClick={() => setActiveFilter(filter.id)} className="tap-feedback"
                style={{ minHeight:44, padding:"0 13px", borderRadius:12, flexShrink:0, border:`1px solid ${active ? "rgba(77,201,160,0.30)" : "var(--c-border)"}`, background:active ? "rgba(29,158,117,0.13)" : "var(--c-surface-2)", color:active ? "#7BD8B4" : "var(--c-text-2)", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                {filter.label} · {counts[filter.id]}
              </button>
            );
          })}
        </nav>

        {actionError && <p role="alert" style={{ padding:"10px 16px", fontSize:13, color:"var(--tone-danger)", background:"rgba(224,82,82,0.08)", borderBottom:"1px solid rgba(224,82,82,0.14)" }}>{actionError}</p>}

        <div style={{ flex:1, overflowY:"auto", padding:12, background:"var(--c-bg)" }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ minHeight:300, padding:32, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
              <div style={{ width:64, height:64, borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
                <Bell size={27} color="var(--c-text-3)" strokeWidth={1.6}/>
              </div>
              <p style={{ marginTop:16, fontSize:16, fontWeight:800, color:"var(--c-text-1)" }}>{notifications.length ? "Rien dans ce filtre" : "Aucune notification"}</p>
              <p style={{ marginTop:6, maxWidth:300, fontSize:13, lineHeight:1.5, color:"var(--c-text-2)" }}>{notifications.length ? "Choisis une autre catégorie pour retrouver tes actualités." : "Tes messages, séances et performances apparaîtront ici."}</p>
              {activeFilter !== "all" && <button type="button" onClick={() => setActiveFilter("all")} className="btn-secondary" style={{ marginTop:16 }}>Voir toutes les notifications</button>}
            </div>
          ) : filteredNotifications.map(notification => {
            const presentation = getNotificationPresentation(notification);
            return (
              <button key={notification.id} type="button" onClick={() => onOpen(notification)} className="tap-feedback"
                aria-label={`${notification.title}${notification.is_read ? "" : ", non lue"}. ${presentation.actionLabel}`}
                style={{ position:"relative", width:"100%", minHeight:92, marginBottom:8, padding:"14px 14px", overflow:"hidden", display:"flex", alignItems:"flex-start", gap:12, textAlign:"left", borderRadius:16, border:`1px solid ${notification.is_read ? "var(--c-border)" : presentation.border}`, background:notification.is_read ? "var(--c-surface)" : `linear-gradient(135deg, ${presentation.soft}, var(--c-surface) 62%)`, color:"inherit", cursor:"pointer", boxShadow:notification.is_read ? "none" : "var(--shadow-sm)" }}>
                <NotificationDecor presentation={presentation}/>
                <NotificationIcon presentation={presentation} size={44} iconSize={19}/>
                <div style={{ position:"relative", flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:presentation.accent, textTransform:"uppercase", letterSpacing:"0.045em" }}>{presentation.label}</span>
                    <span style={{ fontSize:12, color:"var(--c-text-3)", flexShrink:0 }}>{formatNotificationTime(notification.created_at)}</span>
                  </div>
                  <p style={{ marginTop:5, fontSize:14, lineHeight:1.35, fontWeight:notification.is_read ? 700 : 800, color:"var(--c-text-1)" }}>{notification.title}</p>
                  {notification.description && <p style={{ marginTop:4, fontSize:13, lineHeight:1.45, color:"var(--c-text-2)" }} className="line-clamp-2">{notification.description}</p>}
                  <span style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:800, color:presentation.accent }}>{presentation.actionLabel}<ArrowRight size={13}/></span>
                </div>
                {!notification.is_read && (
                  <span aria-label="Non lue" style={{ position:"absolute", left:5, top:"50%", width:5, height:26, borderRadius:99, background:presentation.accent, transform:"translateY(-50%)" }}/>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
