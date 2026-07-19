// ============================================================
// AthleteOS — src/App.jsx
// AJOUT : routeur coach/athlète
// - Si role === "athlete" → AthleteApp (vue personnelle)
// - Si role === "head_coach" ou "coach" → app complète coach
// ============================================================

import { useState, useCallback, useEffect, Suspense, lazy } from "react";
import {
  LayoutDashboard, CalendarDays, Users, TrendingUp,
  Activity, Trophy, Bell, MessageSquare,
  ChevronLeft, ChevronRight, Menu, X, Zap, LogOut,
} from "lucide-react";

import { supabase }   from "./utils/supabaseClient";
import { useAuth }    from "./context/AuthContext";
import LoginPage      from "./pages/LoginPage";
import AthleteApp     from "./AthleteApp"; // ← VUE ATHLÈTE
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

// ─── Loaders ──────────────────────────────────────────────────────────────────
function ViewLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-sm font-medium">Chargement…</span>
      </div>
    </div>
  );
}

function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F5F2" }}>
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-sm font-medium">Vérification de la session…</span>
      </div>
    </div>
  );
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── App Coach ────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, clubId, loading: authLoading, signOut } = useAuth();

  const [activeView,  setActiveView]  = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const { subscribed, subscribe, permissionState } = usePushNotifications(null, clubId, profile?.id);
  console.log("Push hook - profile.id:", profile?.id, "clubId:", clubId);
  // ── Badge alertes non lues ────────────────────────────────────────────────
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
    setMobileOpen(false);
  }, [activeView, fetchUnreadCount]);

  // ── Guards auth ───────────────────────────────────────────────────────────
  if (authLoading) return <AuthLoader />;
  if (!user)       return <LoginPage />;

  // ── Routeur rôle : athlète → vue dédiée ──────────────────────────────────
  if (profile?.role === "athlete") return <AthleteApp />;

  // ── App coach (head_coach ou coach) ───────────────────────────────────────
  const currentNav    = NAV_ITEMS.find((n) => n.id === activeView);
  const coachName     = profile?.name ?? user.email ?? "Coach";
  const coachInitials = initialsFromName(coachName);
  const coachRole     = profile?.role === "head_coach" ? "Head coach" : "Coach";

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F5F5F2", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Overlay mobile ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════════════════ */}
      <aside
        className={[
          "flex flex-col bg-white border-r border-slate-100 z-30 transition-all duration-300 ease-in-out flex-shrink-0",
          sidebarOpen ? "w-56" : "w-16",
          "fixed md:relative inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-100 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1D9E75 0%, #16826C 100%)" }}
          >
            <Zap size={16} color="white" strokeWidth={2.5} />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-slate-800 text-[15px] tracking-tight whitespace-nowrap">
              AthleteOS
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon      = item.icon;
            const isActive  = activeView === item.id;
            const showBadge = item.id === "alerts" && unreadAlerts > 0;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={[
                  "w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium transition-all duration-150 relative",
                  "hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  isActive ? "text-emerald-700 bg-emerald-50" : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-500" />
                )}
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {showBadge && (
                      <span
                        className="ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                        style={{ background: "#E24B4A" }}
                      >
                        {unreadAlerts}
                      </span>
                    )}
                  </>
                )}
                {!sidebarOpen && showBadge && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Profil + déconnexion */}
        <div className="border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ background: "#378ADD" }}
            >
              {coachInitials}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-slate-700 truncate">{coachName}</p>
                <p className="text-[11px] text-slate-400 truncate">{coachRole}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>

          {!sidebarOpen && (
            <button
              onClick={signOut}
              title="Se déconnecter"
              className="w-full flex items-center justify-center py-2 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={15} />
            </button>
          )}

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden md:flex w-full items-center justify-center gap-2 py-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors text-[12px] border-t border-slate-100"
          >
            {sidebarOpen ? (
              <><ChevronLeft size={14} /><span>Réduire</span></>
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          ZONE PRINCIPALE
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center gap-4 px-6 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 tracking-tight">
            {currentNav?.label ?? "AthleteOS"}
          </h1>
          <div className="flex-1" />
          <PushToggleButton
  subscribed={subscribed}
  onToggle={subscribe}
  permissionState={permissionState}
/>
          <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <CalendarDays size={13} />
            <span>
              {new Date().toLocaleDateString("fr-BE", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<ViewLoader />}>
            <ActiveView view={activeView} onNavigate={navigate} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}