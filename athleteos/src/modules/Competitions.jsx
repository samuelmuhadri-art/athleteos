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
import { dispatchOutboxNotifications } from "../utils/notifications";
import { initialsFromName } from "../utils/helpers.js";
import { TYPE_CONFIG, daysUntil } from "./competitionsShared";
import { resolveDisciplineId, getDisciplineHib, getDisciplineUnit } from "../domain/disciplines.js";
import { parsePerf } from "../athlete/shared.js";
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

      const [chargeRes, competitionsRes, recordsRes, injuriesRes] = await Promise.all([
        athleteIds.length
          ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
        // ✅ CORRECTION 2 : .eq("club_id", clubId) au lieu de .eq("club_id", 1)
        supabase.from("competitions").select("*").eq("club_id", clubId),
        athleteIds.length
          ? supabase.from("records").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
        athleteIds.length
          ? supabase.from("injuries").select("*").in("athlete_id", athleteIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (chargeRes.error)       throw chargeRes.error;
      if (competitionsRes.error) throw competitionsRes.error;
      if (recordsRes.error)      throw recordsRes.error;
      if (injuriesRes.error)     throw injuriesRes.error;

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
        injuries:       (injuriesRes.data ?? [])
          .filter((injury) => injury.athlete_id === a.id)
          .map((injury) => ({
            id: injury.id,
            name: injury.name,
            location: injury.location,
            intensity: injury.intensity,
            status: injury.status,
            startDate: injury.start_date,
            notes: injury.notes,
          })),
      }));

      const remappedCharge = chargeRes.data.map((c) => ({
        athleteId: c.athlete_id,
        week:      c.week,
        rawLoad:   c.raw_load,
        dailyLoads: c.daily_loads ?? [],
        knownDays: c.known_days ?? 0,
        unknownDays: c.unknown_days ?? 0,
        estimatedDays: c.estimated_days ?? 0,
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
  // Tâche 14 : un seul appel RPC atomique (create_competition_with_athletes)
  // au lieu de deux inserts successifs (compétition, puis participants) —
  // avant, une panne entre les deux laissait une compétition sans aucun
  // participant, sans qu'on ait aucun moyen simple de le voir/réparer.
  // club_id résolu côté serveur (jamais envoyé par le client).

  const createCompetition = useCallback(async (form) => {
    const { error } = await supabase.rpc("create_competition_with_athletes", {
      p_name:            form.name,
      p_date:            form.date,
      p_location:        form.location || null,
      p_type:            form.type,
      p_athlete_entries: form.athleteEntries.map((e) => ({ athleteId: e.athleteId, plannedEvent: e.plannedEvent || null })),
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // ═══ Écriture : ajouter un résultat ══════════════════════════════════════
  // Tâche 14 : un seul appel RPC atomique (add_competition_result) —
  // résultat + comparaison/mise à jour du record (verrouillée côté serveur
  // contre deux résultats concurrents battant le même record) + écriture
  // de l'outbox de notifications se font dans LA MÊME transaction SQL.
  // Les vraies notifications ne sont dépêchées qu'après le retour en
  // succès du RPC (donc après COMMIT confirmé) — avant, une erreur sur la
  // mise à jour du record était juste loguée et n'empêchait pas l'envoi
  // des notifications malgré l'échec.

  const addResult = useCallback(async (competitionId, athleteId, form) => {
    // Tâche 9 : normalise un alias saisi librement ("100 m" -> "100m") vers
    // l'identifiant canonique du registre avant d'écrire en base.
    const event = resolveDisciplineId(form.event);
    const { data, error } = await supabase.rpc("add_competition_result", {
      p_competition_id:   competitionId,
      p_athlete_id:       athleteId,
      p_event:            event,
      p_result:           form.result,
      p_result_value:     parsePerf(form.result).value,
      p_higher_is_better: getDisciplineHib(event),
      p_context:          form.context || null,
      p_idempotency_key:  crypto.randomUUID(),
      p_unit:             getDisciplineUnit(event),
    });
    if (error) throw error;

    await dispatchOutboxNotifications(data?.notifications);
    await fetchAll();
  }, [fetchAll]);

  // Synchronise la compétition sélectionnée avec les données fraîches
  const liveSelectedComp = selectedComp
    ? competitionList.find((c) => c.id === selectedComp.id) ?? selectedComp
    : null;

  const sorted = useMemo(
    () => [...competitionList].sort((a, b) => a.date.localeCompare(b.date)),
    [competitionList]
  );

  const pastComps   = sorted.filter((c) => daysUntil(c.date) < 0);
  const futureComps = sorted.filter((c) => daysUntil(c.date) >= 0);
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
    <div className="page-container py-4 md:py-6 max-w-6xl mx-auto space-y-5 md:space-y-6 animate-slide-up">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="page-title">Compétitions</h2>
          <p className="secondary-text mt-1">Calendrier de la saison, engagements et résultats</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={athletes.length === 0}
          className="btn-primary"
          title={athletes.length === 0 ? "Ajoute d'abord un athlète au club" : undefined}
        >
          <Plus size={16} />
          Créer une compétition
        </button>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total saison",   value: stats.total,       color: "#378ADD", icon: CalendarDays },
          { label: "Passées",        value: stats.past,        color: "#94A3B8", icon: Clock        },
          { label: "À venir",        value: stats.upcoming,    color: "#1D9E75", icon: TrendingUp   },
          { label: "Avec résultats", value: stats.withResults, color: "#EF9F27", icon: Trophy       },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                <Icon size={16} color={s.color} />
              </div>
              <div>
                <p className="metric-value text-[var(--c-text-1)]">{s.value}</p>
                <p className="meta-text mt-1">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende types ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px]" aria-label="Types de compétitions">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: cfg.dot }} />
            <span className="text-[var(--c-text-2)] font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      {competitionList.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <Trophy size={40} className="mx-auto mb-3 text-[var(--c-text-3)]" />
          <p className="text-[15px] font-semibold text-[var(--c-text-2)]">Aucune compétition programmée</p>
          <p className="meta-text mt-1">
            {athletes.length === 0
              ? "Ajoute d'abord un athlète au club pour pouvoir préparer son calendrier."
              : "Clique sur “Créer une compétition” pour démarrer le calendrier de saison."}
          </p>
        </div>
      ) : (
        <div>
          {/* Compétitions passées */}
          {pastComps.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[var(--c-border)]" />
                <span className="metric-label px-2">
                  Compétitions passées
                </span>
                <div className="h-px flex-1 bg-[var(--c-border)]" />
              </div>
              <div>
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
              <span className="text-[12px] font-semibold text-[var(--color-success)] uppercase tracking-wider">
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
                <span className="metric-label px-2">
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
            <div className="card p-10 text-center">
              <Trophy size={32} className="mx-auto mb-2 text-[var(--c-text-3)]" />
              <p className="text-[14px] font-semibold text-[var(--c-text-2)]">Aucune compétition à venir programmée</p>
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
