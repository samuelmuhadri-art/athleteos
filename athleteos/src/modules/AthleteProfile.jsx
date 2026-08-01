// ============================================================
// AthleteOS — src/modules/AthleteProfile.jsx
// Vue détail d'un athlète (hero + onglets) — extraite d'AthleteList.jsx.
// ============================================================

import { memo, useState, useMemo } from "react";
import { ArrowLeft, HeartPulse, Pencil, Trash2 } from "lucide-react";
import { getAthleteMetricsForWeek } from "../utils/chargeCalculations";
import { getISOWeek } from "../utils/helpers.js";
import { TABS } from "./athleteListUtils";
import { StatusBadge, ScoreRing } from "./athleteListShared";
import { TabPerformances, TabCharge, TabEntrainements, TabBlessures, TabProfil } from "./AthleteProfileTabs";
import { ConfirmDialog, InlineNotice, SegmentedTabs } from "../components/ui/premium";

const AthleteProfile = memo(({ athlete, weeklyCharge, sessions, competitions, onBack, onAddRecord, onEditRequest, onDelete, onAddInjury, onUpdateInjury, onDeleteInjury }) => {
  const [activeTab,      setActiveTab]      = useState("performances");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteError,   setDeleteError]   = useState(null);

  const metrics        = useMemo(() => getAthleteMetricsForWeek(athlete.id, weeklyCharge, getISOWeek(new Date())), [athlete.id, weeklyCharge]);
  const activeInjuries = athlete.injuries?.filter(i => i.status !== "résolu") ?? [];

  const handleDelete = async () => {
    setDeleting(true); setDeleteError(null);
    try { await onDelete(athlete.id); onBack(); }
    catch { setDeleteError("Impossible de supprimer : cet athlète a des données liées."); setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className="page-container py-4 md:py-6 max-w-6xl mx-auto space-y-5 animate-slide-up">
      {/* Barre actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 min-h-10 text-[13px] font-semibold transition-colors tap-feedback" style={{ color: "var(--c-text-2)" }} onMouseEnter={e => e.currentTarget.style.color = "var(--c-text-1)"} onMouseLeave={e => e.currentTarget.style.color = "var(--c-text-2)"}>
          <ArrowLeft size={16} /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEditRequest(athlete)}
            className="btn-secondary">
            <Pencil size={15} aria-hidden="true" /> Modifier
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn-secondary athlete-profile-delete">
            <Trash2 size={15} aria-hidden="true" /> Supprimer
          </button>
        </div>
      </div>

      {deleteError && (
        <InlineNotice tone="danger" title="Suppression impossible" onDismiss={() => setDeleteError(null)}>{deleteError}</InlineNotice>
      )}

      {/* Hero banner */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--c-accent) 0%, var(--c-accent-dark) 72%, #07120C 150%)" }}
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0 shadow-lg"
            style={{ background: "rgba(255,255,255,0.20)" }}
          >
            {athlete.avatar}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-[24px] font-bold text-white tracking-tight">{athlete.name}</h2>
              <StatusBadge wellnessScore={metrics.wellnessScore} />
              {activeInjuries.length > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "rgba(239,159,39,0.3)", border: "1px solid rgba(239,159,39,0.4)" }}>
                  <HeartPulse size={11} /> {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.86)" }}>{athlete.mainDiscipline ?? "Discipline non renseignée"}</p>
            <div className="flex items-center gap-3 flex-wrap text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
              <span>{athlete.group ?? "—"}</span>
              <span>·</span>
              <span>{athlete.level ?? "—"}</span>
              <span>·</span>
              <span>{athlete.age ? `${athlete.age} ans` : "—"}</span>
            </div>
          </div>

          {/* Métriques inline */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ScoreRing value={metrics.wellnessScore ?? 0} color="white" label="Bien-être" size={80} />
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-6">
                <span style={{ color: "rgba(255,255,255,0.76)" }}>Cette semaine</span>
                <span className="font-bold text-white">{metrics.load7 ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span style={{ color: "rgba(255,255,255,0.76)" }}>Rythme habituel · 4 sem.</span>
                <span className="font-bold text-white">{metrics.load28 ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span style={{ color: "rgba(255,255,255,0.76)" }}>Variation</span>
                <span className="font-bold text-white">{metrics.variationPercent == null ? "—" : `${metrics.variationPercent >= 0 ? "+" : ""}${metrics.variationPercent}%`}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs pill premium */}
      <SegmentedTabs
        className="aos-segmented-tabs--fill"
        ariaLabel="Sections du profil athlète"
        items={TABS.map((tab) => ({
          ...tab,
          tabId: `coach-athlete-tab-${tab.id}`,
          panelId: "coach-athlete-tabpanel",
        }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* Contenu onglet */}
      <div
        id="coach-athlete-tabpanel"
        role="tabpanel"
        aria-labelledby={`coach-athlete-tab-${activeTab}`}
        className="view-transition"
      >
        {activeTab === "performances"  && <TabPerformances  athlete={athlete} competitions={competitions} onAddRecord={onAddRecord} />}
        {activeTab === "charge"        && <TabCharge        athlete={athlete} metrics={metrics} weeklyCharge={weeklyCharge} competitions={competitions} sessions={sessions} />}
        {activeTab === "entrainements" && <TabEntrainements athlete={athlete} sessions={sessions} />}
        {activeTab === "blessures"     && <TabBlessures     athlete={athlete} onAddInjury={onAddInjury} onUpdateInjury={onUpdateInjury} onDeleteInjury={onDeleteInjury} />}
        {activeTab === "profil"        && <TabProfil        athlete={athlete} />}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Supprimer ${athlete.name} ?`}
        description="Le profil et ses données liées seraient retirés du club. Cette action reste volontairement protégée."
        confirmLabel="Supprimer le profil"
        loadingLabel="Suppression…"
        loading={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
});

export default AthleteProfile;
