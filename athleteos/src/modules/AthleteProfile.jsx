// ============================================================
// AthleteOS — src/modules/AthleteProfile.jsx
// Vue détail d'un athlète (hero + onglets) — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useState, useMemo } from "react";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { TABS, StatusBadge, ScoreRing } from "./athleteListShared";
import { TabPerformances, TabCharge, TabEntrainements, TabBlessures, TabProfil } from "./AthleteProfileTabs";

const AthleteProfile = memo(({ athlete, weeklyCharge, sessions, competitions, onBack, onAddRecord, onEditRequest, onDelete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const [activeTab,      setActiveTab]      = useState("performances");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);

  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge), [athlete.id, weeklyCharge]);
  const { readiness, fatigue, acwr } = metrics;
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];

  const handleDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try { await onDelete(athlete.id); onBack(); }
    catch { setDeleteError("Impossible de supprimer : cet athlète a des données liées."); setDeleting(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 animate-slide-up">
      {/* Barre actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors tap-feedback" style={{ color: "var(--c-text-3)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-1)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-3)"}>
          <ArrowLeft size={16} /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onEditRequest(athlete)}
            className="text-[12px] font-bold border rounded-xl px-3 py-1.5 transition-colors" style={{ color: "var(--c-text-3)", borderColor: "var(--c-border)", background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-surface-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            ✏️ Modifier
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="text-[12px] font-bold border rounded-xl px-3 py-1.5 transition-colors" style={{ color: "#F19A9A", borderColor: "rgba(226,75,74,0.3)", background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(226,75,74,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              🗑️ Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5" style={{ background: "rgba(226,75,74,0.1)", borderColor: "rgba(226,75,74,0.3)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "#F19A9A" }}>Confirmer ?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="text-[11px] font-bold text-white rounded-lg px-2 py-0.5 disabled:opacity-50" style={{ background: "#E24B4A" }}>
                {deleting ? "…" : "Oui"}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="text-[11px]" style={{ color: "var(--c-text-4)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-2)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-4)"}>Non</button>
            </div>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="rounded-2xl px-4 py-3 text-[12.5px]" style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", color: "#F19A9A" }}>
          {deleteError}
        </div>
      )}

      {/* Hero banner */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D9E75 0%, #0f7a5a 60%, #0a6048 100%)" }}
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[20px] font-black flex-shrink-0 shadow-lg"
            style={{ background: "rgba(255,255,255,0.20)" }}
          >
            {athlete.avatar}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-[22px] font-black text-white tracking-tight">{athlete.name}</h2>
              <StatusBadge readiness={readiness} fatigue={fatigue} acwr={acwr} />
              {activeInjuries.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "rgba(239,159,39,0.3)", border: "1px solid rgba(239,159,39,0.4)" }}>
                  <HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-white/70 text-[13px]">{athlete.mainDiscipline ?? "Discipline non renseignée"}</p>
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-white/50 mt-1">
              <span>{athlete.group ?? "—"}</span>
              <span>·</span>
              <span>{athlete.level ?? "—"}</span>
              <span>·</span>
              <span>{athlete.age ? `${athlete.age} ans` : "—"}</span>
            </div>
          </div>

          {/* Métriques inline */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ScoreRing value={readiness} color="white" label="Readiness" size={80} />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">Fatigue</span>
                <span className="font-black text-white">{fatigue}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">Forme</span>
                <span className="font-black text-white">{metrics.forme}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-white/60">ACWR</span>
                <span className="font-black text-white">{acwr.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs pill premium */}
      <div className="flex gap-1 rounded-2xl border p-1.5 overflow-x-auto" style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}>
        {TABS.map(tab => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={["flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all flex-1 justify-center tap-feedback", isActive ? "" : "hover:opacity-80"].join(" ")}
              style={isActive ? { background: "#1D9E75", color: "#0A150F", boxShadow: "0 2px 8px rgba(29,158,117,0.30)" } : { color: "var(--c-text-3)", background: "transparent" }}
            >
              <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu onglet */}
      <div className="view-transition">
        {activeTab === "performances"  && <TabPerformances  athlete={athlete} competitions={competitions} onAddRecord={onAddRecord} />}
        {activeTab === "charge"        && <TabCharge        athlete={athlete} metrics={metrics} weeklyCharge={weeklyCharge} competitions={competitions} sessions={sessions} />}
        {activeTab === "entrainements" && <TabEntrainements athlete={athlete} sessions={sessions} />}
        {activeTab === "blessures"     && <TabBlessures     athlete={athlete} onAddInjury={onAddInjury} onUpdateInjury={onUpdateInjury} onDeleteInjury={onDeleteInjury} />}
        {activeTab === "profil"        && <TabProfil        athlete={athlete} />}
      </div>
    </div>
  );
});

export default AthleteProfile;
