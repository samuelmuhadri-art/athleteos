// ============================================================
// AthleteOS — src/App.jsx  ★ DESIGN PREMIUM
// Même logique métier qu'avant, rendu visuel entièrement repoli :
//   - Sidebar glass avec nav-items animés (pill active)
//   - Header glassmorphism
//   - Transitions de vue slide-up
//   - Loaders et badges premium
//   - Bouton push intégré dans le header
// ============================================================

import { useState, useCallback, useEffect, Suspense, lazy, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, Users, TrendingUp,
  Activity, Trophy, Bell, MessageSquare,
  ChevronLeft, ChevronRight, Menu, X, Zap, LogOut,
} from "lucide-react";

import { supabase }   from "./utils/supabaseClient";
import { useAuth }    from "./context/AuthContext";
import LoginPage      from "./pages/LoginPage";
import AthleteApp     from "./AthleteApp";
import { usePushNotifications, PushToggleButton } from "./hooks/usePushNotifications";

// ─── Lazy imports modules coach ───────────────────────────────────────────────
const Dashboard    = lazy(() => import("./modules/Dashboard"));
const Planning     = lazy(() => import("./modules/Planning"));
const AthleteList  = lazy(() => import("./modules/AthleteList"));
const Performances = lazy(() => import("./modules/Performances"));
const ChargeView   = lazy(() => import("./modules/ChargeView"));
const Competitions = lazy(() => import("./modules/Competitions"));
const AlertsView   = lazy(() => import("./modules/Alerts"));
const Messaging    = lazy(() => import("./modules/Messaging"));

// ─── Config navigation coach ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { id: "planning",     label: "Planning",         icon: CalendarDays    },
  { id: "athletes",     label: "Athlètes",         icon: Users           },
  { id: "performances", label: "Performances",     icon: TrendingUp      },
  { id: "charge",       label: "Charge & Fatigue", icon: Activity        },
  { id: "competitions", label: "Compétitions",     icon: Trophy          },
  { id: "alerts",       label: "Alertes",          icon: Bell            },
  { id: "messaging",    label: "Messagerie",       icon: MessageSquare   },
];

// ─── Résolution de la vue active ──────────────────────────────────────────────
function ActiveView({ view, onNavigate }) {
  switch (view) {
    case "dashboard":    return <Dashboard    onNavigate={onNavigate} />;
    case "planning":     return <Planning     />;
    case "athletes":     return <AthleteList  onNavigate={onNavigate} />;
    case "performances": return <Performances />;
    case "charge":       return <ChargeView   />;
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
        <span className="text-[12px] font-semibold text-slate-300 tracking-wide uppercase">
          Chargement…
        </span>
      </div>
    </div>
  );
}

// ─── Loader auth (plein écran) ────────────────────────────────────────────────
function AuthLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: "#F5F5F2" }}>
      {/* Logo animé */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
      >
        <Zap size={24} color="white" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="loader-ring" />
        <span className="text-[12px] font-semibold text-slate-400 tracking-wide">
          Vérification de la session…
        </span>
      </div>
    </div>
  );
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── CoachShell ───────────────────────────────────────────────────────────────
function CoachShell({ user, profile, clubId, signOut }) {
  const [activeView,   setActiveView]   = useState("dashboard");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  // Clé pour forcer re-mount de la vue → déclenche l'animation slide-up
  const [viewKey, setViewKey] = useState(0);

  const { subscribed, subscribe, permissionState } = usePushNotifications(
    null,
    clubId,
    profile.id
  );

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
    setActiveView(view);
    setViewKey(k => k + 1); // déclenche l'animation à chaque changement de vue
    setMobileOpen(false);
  }, [activeView, fetchUnreadCount]);

  const currentNav    = NAV_ITEMS.find((n) => n.id === activeView);
  const coachName     = profile.name ?? user.email ?? "Coach";
  const coachInitials = initialsFromName(coachName);
  const coachRole     = profile.role === "head_coach" ? "Head coach" : "Coach";

  return (
    <div
      className="flex h-screen overflow-hidden w-full"
      style={{ background: "#F5F5F2", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Overlay mobile ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden modal-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          SIDEBAR PREMIUM
      ══════════════════════════════════════════════════════════════ */}
      <aside
        className={[
          "flex flex-col sidebar-premium z-30 flex-shrink-0 transition-all duration-300 ease-spring",
          sidebarOpen ? "w-58" : "w-[68px]",
          "fixed md:relative inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        style={{ width: sidebarOpen ? "224px" : "68px" }}
      >
        {/* ── Logo ── */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-100/80 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
          >
            <Zap size={17} color="white" strokeWidth={2.5} />
          </div>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ width: sidebarOpen ? "auto" : 0, opacity: sidebarOpen ? 1 : 0 }}
          >
            <span className="font-bold text-slate-800 text-[15px] tracking-tight whitespace-nowrap">
              AthleteOS
            </span>
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
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white animate-bounce-in" />
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
        <div className="border-t border-slate-100 flex-shrink-0">
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
                <p className="text-[12.5px] font-semibold text-slate-700 truncate leading-tight">
                  {coachName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="status-dot-live" style={{ width: 6, height: 6 }} />
                  <p className="text-[10.5px] text-slate-400">{coachRole}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 ml-1"
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Déconnexion quand réduit */}
            {!sidebarOpen && (
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>

          {/* Toggle réduire / ouvrir */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden md:flex w-full items-center justify-center gap-2 py-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all text-[11.5px] font-medium border-t border-slate-100"
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
        <header className="h-16 header-glass flex items-center gap-4 px-5 flex-shrink-0 z-10">
          {/* Burger mobile */}
          <button
            className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          {/* Titre de la vue */}
          <div className="flex items-center gap-3">
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
            <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">
              {currentNav?.label ?? "AthleteOS"}
            </h1>
          </div>

          <div className="flex-1" />

          {/* Push toggle */}
          <PushToggleButton
            subscribed={subscribed}
            onToggle={subscribe}
            permissionState={permissionState}
          />

          {/* Date */}
          <div className="hidden sm:flex items-center gap-2 text-[11.5px] text-slate-400 bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-100">
            <CalendarDays size={12} className="text-slate-300" />
            <span className="font-medium">
              {new Date().toLocaleDateString("fr-BE", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </span>
          </div>
        </header>

        {/* ── Zone de contenu — transition de vue ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* La clé viewKey change à chaque navigation → re-monte le composant → déclenche view-transition */}
          <div key={viewKey} className="view-transition h-full">
            <Suspense fallback={<ViewLoader />}>
              <ActiveView view={activeView} onNavigate={navigate} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, clubId, loading: authLoading, signOut } = useAuth();

  if (authLoading) return <AuthLoader />;
  if (!user)       return <LoginPage />;
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