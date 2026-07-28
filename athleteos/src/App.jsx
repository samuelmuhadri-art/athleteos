// ============================================================
// AthleteOS — src/App.jsx  ★ DESIGN PREMIUM DARK
// ============================================================

import { useState, useCallback, useEffect, useRef, Suspense, lazy } from "react";
import {
  LayoutDashboard, CalendarDays, Users, TrendingUp,
  Activity, Trophy, Bell, MessageSquare, FileText,
  ChevronLeft, ChevronRight, MoreHorizontal, X, LogOut,
  UserPlus, Copy, Check, Settings,
} from "lucide-react";

import { supabase }   from "./utils/supabaseClient";
import { useAuth }    from "./context/AuthContext";
import LoginPage      from "./pages/LoginPage";
import SignupPage     from "./pages/SignupPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AccountSettingsModal from "./components/ui/AccountSettingsModal";
import { AthleteOSBadge, AthleteOSWordmark } from "./components/brand/AthleteOSLogo";
import AthleteApp     from "./AthleteApp";
import { usePushNotifications, PushToggleButton } from "./hooks/usePushNotifications";
import { useUrlView } from "./hooks/useUrlView";
import { initialsFromName } from "./utils/helpers.js";
import MobileBottomNav from "./components/navigation/MobileBottomNav";
import MobileMoreSheet from "./components/navigation/MobileMoreSheet";
import {
  COACH_MOBILE_MORE_ITEMS,
  COACH_MOBILE_PRIMARY_ITEMS,
  isCoachMoreView,
} from "./navigation/mobileNavigation";

// ─── Lazy imports modules coach ───────────────────────────────────────────────
const Dashboard    = lazy(() => import("./modules/Dashboard"));
const Planning     = lazy(() => import("./modules/Planning"));
const AthleteList  = lazy(() => import("./modules/AthleteList"));
const Performances = lazy(() => import("./modules/Performances"));
const ChargeView   = lazy(() => import("./modules/ChargeView"));
const Competitions = lazy(() => import("./modules/Competitions"));
const AlertsView   = lazy(() => import("./modules/Alerts"));
const Messaging    = lazy(() => import("./modules/Messaging"));
const Rapports     = lazy(() => import("./modules/Rapports"));

// ─── Config navigation coach ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",    label: "Dashboard",        icon: LayoutDashboard },
  { id: "planning",     label: "Planning",         icon: CalendarDays    },
  { id: "athletes",     label: "Athlètes",         icon: Users           },
  { id: "performances", label: "Performances",     icon: TrendingUp      },
  { id: "charge",       label: "Charge & Fatigue", icon: Activity        },
  { id: "rapports",     label: "Rapports",         icon: FileText        },
  { id: "competitions", label: "Compétitions",     icon: Trophy          },
  { id: "alerts",       label: "Alertes",          icon: Bell            },
  { id: "messaging",    label: "Messagerie",       icon: MessageSquare   },
];
const NAV_ITEM_IDS = NAV_ITEMS.map(n => n.id);
const COACH_MOBILE_NAV_ITEMS = COACH_MOBILE_PRIMARY_ITEMS.map((mobileItem) => ({
  ...NAV_ITEMS.find((item) => item.id === mobileItem.id),
  ...mobileItem,
}));
const COACH_MORE_NAV_ITEMS = COACH_MOBILE_MORE_ITEMS.map((mobileItem) => ({
  ...NAV_ITEMS.find((item) => item.id === mobileItem.id),
  ...mobileItem,
}));

// ─── Résolution de la vue active ──────────────────────────────────────────────
function ActiveView({ view, onNavigate }) {
  switch (view) {
    case "dashboard":    return <Dashboard    onNavigate={onNavigate} />;
    case "planning":     return <Planning     />;
    case "athletes":     return <AthleteList  onNavigate={onNavigate} />;
    case "performances": return <Performances />;
    case "charge":       return <ChargeView   />;
    case "rapports":     return <Rapports     />;
    case "competitions": return <Competitions />;
    case "alerts":       return <AlertsView   />;
    case "messaging":    return <Messaging    />;
    default:             return <Dashboard    onNavigate={onNavigate} />;
  }
}

// ─── Loader vue (skeleton premium) ────────────────────────────────────────────
function ViewLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="loader-ring" />
        <span className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: "var(--c-text-3)" }}>
          Chargement…
        </span>
      </div>
    </div>
  );
}

// ─── Loader auth (plein écran) ────────────────────────────────────────────────
function AuthLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: "var(--c-bg)" }}>
      {/* Logo animé */}
      <AthleteOSBadge size={56} />
      <div className="flex flex-col items-center gap-2">
        <div className="loader-ring" />
        <span className="text-[12px] font-semibold tracking-wide" style={{ color: "var(--c-text-3)" }}>
          Vérification de la session…
        </span>
      </div>
    </div>
  );
}

// ─── CoachShell ───────────────────────────────────────────────────────────────
function CoachShell({ user, profile, clubId, signOut }) {
  const { activeView, navigate: navigateUrl, viewKey } = useUrlView(NAV_ITEM_IDS, "dashboard");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [showMore,     setShowMore]     = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [clubName, setClubName]     = useState("");
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied]         = useState(false);
  const moreButtonRef = useRef(null);

  const { subscribed, subscribe, permissionState } = usePushNotifications(
    null,
    clubId,
    profile.id
  );

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("name, invite_code").eq("id", clubId).single()
      .then(({ data }) => { if (data) { setClubName(data.name ?? ""); setInviteCode(data.invite_code ?? null); } });
  }, [clubId]);

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard?.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!clubId) return;
    const { count } = await supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("is_read", false);
    setUnreadAlerts(count ?? 0);
  }, [clubId]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  const navigate = useCallback((view) => {
    if (activeView === "alerts") fetchUnreadCount();
    navigateUrl(view);
    setShowMore(false);
  }, [activeView, fetchUnreadCount, navigateUrl]);

  const closeMore = useCallback(() => {
    setShowMore(false);
    requestAnimationFrame(() => moreButtonRef.current?.focus());
  }, []);

  const currentNav    = NAV_ITEMS.find((n) => n.id === activeView);
  const coachName     = profile.name ?? user.email ?? "Coach";
  const coachInitials = initialsFromName(coachName);
  const coachRole     = profile.role === "head_coach" ? "Head coach" : "Coach";

  return (
    <div
      className="flex h-screen overflow-hidden w-full"
      style={{ background: "var(--c-bg)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════════════════════════════
         SIDEBAR PREMIUM DARK
      ══════════════════════════════════════════════════════════════ */}
      <aside
        className={[
          "hidden md:flex flex-col sidebar-premium z-30 flex-shrink-0 transition-all duration-300 ease-spring",
          sidebarOpen ? "w-58" : "w-[68px]",
          "relative inset-y-0 left-0",
        ].join(" ")}
        style={{ width: sidebarOpen ? "224px" : "68px" }}
      >
        {/* ── Logo ── */}
        <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <AthleteOSBadge size={36} title={null} />
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ width: sidebarOpen ? "auto" : 0, opacity: sidebarOpen ? 1 : 0 }}
          >
            <AthleteOSWordmark size={15} />
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item, idx) => {
            const Icon      = item.icon;
            const isActive  = activeView === item.id;
            const showBadge = item.id === "alerts" && unreadAlerts > 0;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={[
                  "nav-item w-full animate-slide-right",
                  isActive ? "active" : "",
                ].join(" ")}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Icône */}
                <div className="relative flex-shrink-0">
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    className="transition-all duration-200"
                  />
                  {/* Badge rouge sur l'icône quand sidebar réduite */}
                  {!sidebarOpen && showBadge && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-bounce-in"
                      style={{ background: "var(--c-dim-danger)", border: "2px solid var(--c-surface)" }}
                    />
                  )}
                </div>

                {/* Label + badge (sidebar ouverte) */}
                <div
                  className="flex items-center justify-between flex-1 overflow-hidden transition-all duration-300"
                  style={{ width: sidebarOpen ? "auto" : 0, opacity: sidebarOpen ? 1 : 0 }}
                >
                  <span className="truncate text-[13.5px]">{item.label}</span>
                  {showBadge && (
                    <span
                      className="ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-bounce-in"
                      style={{ background: "#E24B4A" }}
                    >
                      {unreadAlerts}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* ── Profil coach ── */}
        <div className="flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div className="flex items-center gap-3 px-3 py-3.5">
            {/* Avatar coach */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, #378ADD 0%, #2563EB 100%)" }}
            >
              {coachInitials}
            </div>

            {/* Infos coach (masquées si sidebar réduite) */}
            <div
              className="flex items-center justify-between flex-1 transition-all duration-300 overflow-hidden"
              style={{ width: sidebarOpen ? "auto" : 0, opacity: sidebarOpen ? 1 : 0 }}
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold truncate leading-tight" style={{ color: "var(--c-text-1)" }}>
                  {coachName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="status-dot-live" style={{ width: 6, height: 6 }} />
                  <p className="text-[10.5px]" style={{ color: "var(--c-text-3)" }}>{coachRole}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                title="Réglages du compte"
                className="p-1.5 rounded-lg transition-all flex-shrink-0"
                style={{ color: "var(--c-text-3)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-1)"; e.currentTarget.style.background = "var(--c-surface-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}
              >
                <Settings size={14} />
              </button>
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="p-1.5 rounded-lg transition-all flex-shrink-0 ml-1"
                style={{ color: "var(--c-text-3)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#E05252"; e.currentTarget.style.background = "rgba(224,82,82,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Déconnexion quand réduit */}
            {!sidebarOpen && (
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                style={{ color: "var(--c-text-3)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#E05252"; e.currentTarget.style.background = "rgba(224,82,82,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>

          {/* Toggle réduire / ouvrir */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden md:flex w-full items-center justify-center gap-2 py-2.5 transition-all text-[11.5px] font-medium tap-feedback"
            style={{ borderTop: "1px solid var(--c-border)", color: "var(--c-text-3)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--c-text-1)"; e.currentTarget.style.background = "var(--c-surface-2)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--c-text-3)"; e.currentTarget.style.background = "transparent"; }}
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft size={13} />
                <span>Réduire</span>
              </>
            ) : (
              <ChevronRight size={13} />
            )}
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
         ZONE PRINCIPALE
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Header glassmorphism ── */}
        <header className="h-16 header-glass flex items-center gap-2 sm:gap-4 px-4 sm:px-5 flex-shrink-0 z-10">
          {/* Titre de la vue */}
          <div className="flex items-center gap-3 min-w-0">
            {(() => {
              const Icon = currentNav?.icon;
              return Icon ? (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(29,158,117,0.10)" }}
                >
                  <Icon size={15} color="#1D9E75" strokeWidth={2} />
                </div>
              ) : null;
            })()}
            <h1 className="text-[16px] font-bold tracking-tight truncate" style={{ color: "var(--c-text-1)" }}>
              {currentNav?.label ?? "AthleteOS"}
            </h1>
          </div>

          <div className="flex-1" />

          {/* Inviter un athlète */}
          <button
            onClick={() => setShowInvite(true)}
            aria-label="Inviter un athlète"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all tap-feedback"
            style={{ background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.20)", color: "#4DC9A0" }}
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Inviter</span>
          </button>

          {/* Push toggle */}
          <div className="md:hidden">
            <PushToggleButton
              subscribed={subscribed}
              onToggle={subscribe}
              permissionState={permissionState}
              compact
            />
          </div>
          <div className="hidden md:block">
            <PushToggleButton
              subscribed={subscribed}
              onToggle={subscribe}
              permissionState={permissionState}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="mobile-account-action md:hidden"
            aria-label="Ouvrir les réglages du compte"
          >
            {coachInitials}
          </button>

          {/* Date */}
          <div className="hidden sm:flex items-center gap-2 text-[11.5px] px-3 py-2 rounded-xl" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
            <CalendarDays size={12} />
            <span className="font-medium">
              {new Date().toLocaleDateString("fr-BE", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </span>
          </div>
        </header>

        {/* ── Zone de contenu — transition de vue ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
          <div key={viewKey} className="view-transition h-full">
            <Suspense fallback={<ViewLoader />}>
              <ActiveView view={activeView} onNavigate={navigate} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* ── Navigation mobile coach ── */}
      <MobileBottomNav
        ariaLabel="Navigation coach"
        items={COACH_MOBILE_NAV_ITEMS}
        activeId={activeView}
        onSelect={navigate}
        more={{
          label: "Plus",
          icon: MoreHorizontal,
          badge: unreadAlerts,
          active: showMore || isCoachMoreView(activeView),
          expanded: showMore,
          onSelect: () => setShowMore(true),
          buttonRef: moreButtonRef,
        }}
      />

      {showMore && (
        <MobileMoreSheet
          items={COACH_MORE_NAV_ITEMS.map((item) => ({
            ...item,
            badge: item.id === "alerts" ? unreadAlerts : 0,
          }))}
          activeId={activeView}
          onSelect={navigate}
          onClose={closeMore}
        />
      )}

      {/* ── Modal invitation ─────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm modal-content overflow-hidden"
            style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--c-border)" }}>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: "var(--c-text-1)" }}>Inviter un athlète</h3>
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--c-text-3)" }}>{clubName || "Ton club"}</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-[var(--c-surface-3)] transition-colors">
                <X size={16} style={{ color: "var(--c-text-3)" }} />
              </button>
            </div>
            <div className="px-6 py-6">
              <p className="text-[12.5px] mb-4" style={{ color: "var(--c-text-2)" }}>
                Partage ce code — chaque athlète qui s'inscrit avec sera automatiquement rattaché à ton club, sans rien faire de ton côté.
              </p>
              {inviteCode ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl px-4 py-3 text-center"
                    style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
                    <span className="text-[22px] font-bold" style={{ color: "var(--c-text-1)", letterSpacing: "0.12em" }}>
                      {inviteCode}
                    </span>
                  </div>
                  <button onClick={copyInviteCode}
                    className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 transition-all tap-feedback"
                    style={{ background: copied ? "rgba(29,158,117,0.15)" : "var(--c-surface-2)", border: "1px solid var(--c-border-strong)" }}>
                    {copied ? <Check size={16} color="#1D9E75" /> : <Copy size={15} style={{ color: "var(--c-text-2)" }} />}
                  </button>
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--c-text-4)" }}>Chargement…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, clubId, loading: authLoading, signOut, passwordRecovery } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (authLoading) return <AuthLoader />;
  // Priorité absolue : tant qu'un nouveau mot de passe n'est pas défini après
  // un clic sur le lien de réinitialisation, on ne route jamais ailleurs.
  if (passwordRecovery) return <ResetPasswordPage />;
  if (!user) {
    return showSignup
      ? <SignupPage onBack={() => setShowSignup(false)} />
      : <LoginPage onSignupClick={() => setShowSignup(true)} />;
  }
  if (profile?.role === "athlete") return <AthleteApp />;
  if (!profile) return <AuthLoader />;

  return (
    <CoachShell
      user={user}
      profile={profile}
      clubId={clubId}
      signOut={signOut}
    />
  );
}
