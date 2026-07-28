// ============================================================
// AthleteOS — src/modules/Competitions.jsx
// CORRECTION Auth Phase 3 :
// - useAuth() remplace club_id: 1 hardcodé (4 occurrences corrigées)
// - <LoadingState> et <ErrorState> remplacent les blocs dupliqués
// Fonctionnalités identiques : timeline, modal détail, CRUD compétitions,
// ajout résultats, détection auto record → alerte, analyse contextuelle.
// ============================================================

import { memo, useState, useMemo, useEffect, useCallback } from "react";
import { CalendarDays, Clock, TrendingUp, Trophy, Plus } from "lucide-react";
import { supabase }                 from "../utils/supabaseClient";
import { useAuth }                  from "../context/AuthContext";
import LoadingState                 from "../components/ui/LoadingState";
import ErrorState                   from "../components/ui/ErrorState";
import { alertNewRecord, notifyAthleteResult, postClubCelebration } from "../utils/notifications";
import { initialsFromName } from "../utils/helpers.js";
import { TYPE_CONFIG, isNewRecord } from "./competitionsShared";
import CompCard from "./CompCard";
import CompModal from "./CompModal";
import CreateCompModal from "./CreateCompModal";

// ─── Composant principal ──────────────────────────────────────────────────────

function Competitions() {
  // ✅ CORRECTION : useAuth() remplace club_id: 1 hardcodé
  const { clubId } = useAuth();

  const [selectedComp,    setSelectedComp]    = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [athletes,        setAthletes]        = useState([]);
  const [weeklyCharge,    setWeeklyCharge]    = useState([]);
  const [competitionList, setCompetitionList] = useState([]);
  const [records,         setRecords]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return; // ✅ CORRECTION : attendre que clubId soit disponible
    try {
      setLoading(true);
      setError(null);

      // ✅ CORRECTION 1 : .eq("club_id", clubId) au lieu de .eq("club_id", 1)
      const athletesRes = await supabase
        .from("athletes")
        .select("id, name, main_discipline, profile_data")
        .eq("club_id", clubId);
      if (athletesRes.error) throw athletesRes.error;

      const athleteIds = athletesRes.data.map((a) => a.id);

      const [chargeRes, competitionsRes, recordsRes] = await Promise.all([
        athleteIds.length
          ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
        // ✅ CORRECTION 2 : .eq("club_id", clubId) au lieu de .eq("club_id", 1)
        supabase.from("competitions").select("*").eq("club_id", clubId),
        athleteIds.length
          ? supabase.from("records").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (chargeRes.error)       throw chargeRes.error;
      if (competitionsRes.error) throw competitionsRes.error;
      if (recordsRes.error)      throw recordsRes.error;

      const competitionIds = competitionsRes.data.map((c) => c.id);

      const [compAthletesRes, compResultsRes] = await Promise.all([
        competitionIds.length
          ? supabase.from("competition_athletes").select("*").in("competition_id", competitionIds)
          : Promise.resolve({ data: [], error: null }),
        competitionIds.length
          ? supabase.from("competition_results").select("*").in("competition_id", competitionIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (compAthletesRes.error) throw compAthletesRes.error;
      if (compResultsRes.error)  throw compResultsRes.error;

      const remappedAthletes = athletesRes.data.map((a) => ({
        id:             a.id,
        name:           a.name,
        mainDiscipline: a.main_discipline,
        avatar:         a.profile_data?.avatar ?? initialsFromName(a.name),
        injuries:       [],
      }));

      const remappedCharge = chargeRes.data.map((c) => ({
        athleteId: c.athlete_id,
        week:      c.week,
        rawLoad:   c.raw_load,
      }));

      const remappedCompetitions = competitionsRes.data.map((c) => {
        const rows   = compAthletesRes.data.filter((x) => x.competition_id === c.id);
        const athIds = rows.map((x) => x.athlete_id);
        const plannedEvents = {};
        rows.forEach((r) => { plannedEvents[r.athlete_id] = r.planned_event; });
        const results = compResultsRes.data
          .filter((r) => r.competition_id === c.id)
          .map((r) => ({
            athleteId: r.athlete_id,
            event:     r.event,
            result:    r.result,
            context:   r.context,
          }));
        return {
          id: c.id, name: c.name, date: c.date,
          location: c.location, type: c.type,
          athleteIds: athIds, plannedEvents, results,
        };
      });

      setAthletes(remappedAthletes);
      setWeeklyCharge(remappedCharge);
      setCompetitionList(remappedCompetitions);
      setRecords(recordsRes.data.map((r) => ({
        id:         r.id,
        athleteId:  r.athlete_id,
        discipline: r.discipline,
        sb:         r.sb,
        pr:         r.pr,
        prDate:     r.pr_date,
      })));
    } catch (err) {
      console.error("Erreur chargement Competitions :", err);
      setError(err.message ?? "Erreur inconnue lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [clubId]); // ✅ clubId dans les dépendances

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écriture : créer une compétition ════════════════════════════════════

  const createCompetition = useCallback(async (form) => {
    const { data: newComp, error: compError } = await supabase
      .from("competitions")
      .insert({
        club_id:  clubId, // ✅ CORRECTION 3 : clubId au lieu de 1
        name:     form.name,
        date:     form.date,
        location: form.location || null,
        type:     form.type,
      })
      .select()
      .single();
    if (compError) throw compError;

    if (form.athleteEntries.length > 0) {
      const rows = form.athleteEntries.map((e) => ({
        competition_id: newComp.id,
        athlete_id:     e.athleteId,
        planned_event:  e.plannedEvent || null,
      }));
      const { error: linkError } = await supabase.from("competition_athletes").insert(rows);
      if (linkError) throw linkError;
    }

    await fetchAll();
  }, [clubId, fetchAll]); // ✅ clubId dans les dépendances

  // ═══ Écriture : ajouter un résultat ══════════════════════════════════════

  const addResult = useCallback(async (competitionId, athleteId, form) => {
    const { error: insertError } = await supabase
      .from("competition_results")
      .insert({
        competition_id: competitionId,
        athlete_id:     athleteId,
        event:          form.event,
        result:         form.result,
        context:        form.context || null,
      });
    if (insertError) throw insertError;

    // Détection automatique de record personnel
    const competition    = competitionList.find((c) => c.id === competitionId);
    const athlete        = athletes.find((a) => a.id === athleteId);
    const existingRecord = records.find((r) => r.athleteId === athleteId && r.discipline === form.event);

    if (isNewRecord(form.result, existingRecord?.pr, form.event)) {
      if (existingRecord) {
        const { error: updateError } = await supabase
          .from("records")
          .update({ pr: form.result, pr_date: competition?.date ?? null, sb: form.result })
          .eq("id", existingRecord.id);
        if (updateError) console.error("Erreur mise à jour record :", updateError);
      } else {
        const { error: insertRecError } = await supabase
          .from("records")
          .insert({
            athlete_id: athleteId,
            discipline: form.event,
            sb:         form.result,
            pr:         form.result,
            pr_date:    competition?.date ?? null,
          });
        if (insertRecError) console.error("Erreur création record :", insertRecError);
      }
      // ✅ Système centralisé : alerte coach + notif athlète
      await alertNewRecord(clubId, athlete, form.event, form.result, competition?.name);
      await notifyAthleteResult(clubId, athleteId, form.event, form.result, competition?.name ?? "");
      await postClubCelebration(clubId, athleteId, "record",
        `${athlete?.name?.split(" ")[0] ?? "Un athlète"} a battu son record en ${form.event} : ${form.result} !`);
    } else {
      // Notif athlète même sans record
      await notifyAthleteResult(clubId, athleteId, form.event, form.result, competition?.name ?? "");
    }

    await fetchAll();
  }, [fetchAll, competitionList, athletes, records, clubId]); // ✅ clubId dans les dépendances

  // Synchronise la compétition sélectionnée avec les données fraîches
  const liveSelectedComp = selectedComp
    ? competitionList.find((c) => c.id === selectedComp.id) ?? selectedComp
    : null;

  const sorted = useMemo(
    () => [...competitionList].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [competitionList]
  );

  const now         = new Date();
  const pastComps   = sorted.filter((c) => new Date(c.date) < now);
  const futureComps = sorted.filter((c) => new Date(c.date) >= now);
  const nextComp    = futureComps[0];

  const stats = useMemo(() => ({
    total:       competitionList.length,
    past:        pastComps.length,
    upcoming:    futureComps.length,
    withResults: competitionList.filter((c) => c.results?.length > 0).length,
  }), [competitionList, pastComps, futureComps]);

  // ═══ Render ═══════════════════════════════════════════════════════════════

  if (loading) return <LoadingState message="Chargement des compétitions…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[var(--c-text-1)] tracking-tight">Compétitions</h2>
          <p className="text-[13px] text-[var(--c-text-3)] mt-0.5">Calendrier et analyse des performances</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={athletes.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-40"
          style={{ background: "#1D9E75" }}
        >
          <Plus size={16} />
          Créer une compétition
        </button>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total saison",   value: stats.total,       color: "#378ADD", icon: CalendarDays },
          { label: "Passées",        value: stats.past,        color: "#94A3B8", icon: Clock        },
          { label: "À venir",        value: stats.upcoming,    color: "#1D9E75", icon: TrendingUp   },
          { label: "Avec résultats", value: stats.withResults, color: "#EF9F27", icon: Trophy       },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] shadow-sm px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                <Icon size={16} color={s.color} />
              </div>
              <div>
                <p className="text-[22px] font-bold text-[var(--c-text-1)] leading-none">{s.value}</p>
                <p className="text-[10px] text-[var(--c-text-3)] mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende types ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: cfg.dot }} />
            <span className="text-[var(--c-text-2)] font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      {competitionList.length === 0 ? (
        <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] shadow-sm p-16 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-[var(--c-text-4)]" />
          <p className="text-[15px] font-semibold text-[var(--c-text-3)]">Aucune compétition programmée</p>
          <p className="text-[12px] text-[var(--c-text-3)] mt-1">
            Clique sur "Créer une compétition" pour démarrer le calendrier de saison.
          </p>
        </div>
      ) : (
        <div>
          {/* Compétitions passées */}
          {pastComps.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[var(--c-border)]" />
                <span className="text-[11px] font-semibold text-[var(--c-text-3)] uppercase tracking-widest px-2">
                  Compétitions passées
                </span>
                <div className="h-px flex-1 bg-[var(--c-border)]" />
              </div>
              <div className="opacity-75">
                {pastComps.map((c) => (
                  <CompCard
                    key={c.id}
                    competition={c}
                    athletes={athletes}
                    isPast={true}
                    isNext={false}
                    onClick={setSelectedComp}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Séparateur "Aujourd'hui" */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-[rgba(29,158,117,0.35)]" />
            <div className="flex items-center gap-2 bg-[rgba(29,158,117,0.15)] border border-[rgba(29,158,117,0.35)] rounded-full px-4 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-[#4DC9A0] uppercase tracking-wider">
                Aujourd'hui · {new Date().toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="h-px flex-1 bg-[rgba(29,158,117,0.35)]" />
          </div>

          {/* Compétitions à venir */}
          {futureComps.length > 0 ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[var(--c-border)]" />
                <span className="text-[11px] font-semibold text-[var(--c-text-3)] uppercase tracking-widest px-2">
                  À venir
                </span>
                <div className="h-px flex-1 bg-[var(--c-border)]" />
              </div>
              {futureComps.map((c) => (
                <CompCard
                  key={c.id}
                  competition={c}
                  athletes={athletes}
                  isPast={false}
                  isNext={c.id === nextComp?.id}
                  onClick={setSelectedComp}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] shadow-sm p-10 text-center">
              <Trophy size={32} className="mx-auto mb-2 text-[var(--c-text-4)]" />
              <p className="text-[14px] font-semibold text-[var(--c-text-3)]">Aucune compétition à venir programmée</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {liveSelectedComp && (
        <CompModal
          competition={liveSelectedComp}
          athletes={athletes}
          weeklyCharge={weeklyCharge}
          records={records}
          onClose={() => setSelectedComp(null)}
          onAddResult={addResult}
        />
      )}

      {showCreateModal && (
        <CreateCompModal
          athletes={athletes}
          onClose={() => setShowCreateModal(false)}
          onCreate={createCompetition}
        />
      )}
    </div>
  );
}

export default memo(Competitions);