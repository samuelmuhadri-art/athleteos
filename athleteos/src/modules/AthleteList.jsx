// ============================================================
// AthleteOS — src/modules/AthleteList.jsx
// ★ DESIGN PREMIUM DARK + PORTALS
// ============================================================

import { memo, useState, useCallback, useEffect } from "react";
import { Plus, Users as UsersIcon } from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { initialsFromName } from "../utils/helpers.js";
import { EmptySection } from "./athleteListShared";
import AthleteProfile from "./AthleteProfile";
import AthleteCard from "./AthleteCard";
import AddAthleteModal from "./AddAthleteModal";

// ─── Composant principal ──────────────────────────────────────────────────────

function AthleteList({ onNavigate }) {
  const { clubId } = useAuth();

  const [selectedAthlete,    setSelectedAthlete]    = useState(null);
  const [athleteModalTarget, setAthleteModalTarget] = useState(null);
  const [athletes,           setAthletes]           = useState([]);
  const [weeklyCharge,       setWeeklyCharge]       = useState([]);
  const [sessions,           setSessions]           = useState([]);
  const [competitions,       setCompetitions]       = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);

  // ═══ Chargement (identique) ═══════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes, competitionsRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
        supabase.from("competitions").select("*").eq("club_id", clubId),
      ]);
      if (athletesRes.error) throw athletesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (competitionsRes.error) throw competitionsRes.error;

      const athleteIds     = athletesRes.data.map(a => a.id);
      const sessionIds     = sessionsRes.data.map(s => s.id);
      const competitionIds = competitionsRes.data.map(c => c.id);

      const [recordsRes,injuriesRes,perfHistRes,sessionAthletesRes,compAthletesRes,compResultsRes,weeklyChargeRes] = await Promise.all([
        athleteIds.length     ? supabase.from("records").select("*").in("athlete_id", athleteIds)              : Promise.resolve({data:[]}),
        athleteIds.length     ? supabase.from("injuries").select("*").in("athlete_id", athleteIds)             : Promise.resolve({data:[]}),
        athleteIds.length     ? supabase.from("performance_history").select("*").in("athlete_id", athleteIds)  : Promise.resolve({data:[]}),
        sessionIds.length     ? supabase.from("session_athletes").select("*").in("session_id", sessionIds)     : Promise.resolve({data:[]}),
        competitionIds.length ? supabase.from("competition_athletes").select("*").in("competition_id", competitionIds) : Promise.resolve({data:[]}),
        competitionIds.length ? supabase.from("competition_results").select("*").in("competition_id", competitionIds)  : Promise.resolve({data:[]}),
        // Charge hebdomadaire calculée côté serveur (vue weekly_charge, voir
        // migration 20260726120000) — plus de recalcul JS à partir des séances.
        athleteIds.length     ? supabase.from("weekly_charge").select("*").in("athlete_id", athleteIds)         : Promise.resolve({data:[]}),
      ]);

      const remappedCharge = (weeklyChargeRes.data ?? []).map(c => ({
        athleteId: c.athlete_id, week: c.week, rawLoad: c.raw_load,
      }));

      setAthletes((athletesRes.data ?? []).map(a => {
        const pd = a.profile_data ?? {};
        const recs = {};
        (recordsRes.data ?? []).filter(r => r.athlete_id === a.id).forEach(r => { recs[r.discipline] = { sb: r.sb, pr: r.pr, prDate: r.pr_date }; });
        return {
          id: a.id, name: a.name, age: a.age, avatar: pd.avatar ?? initialsFromName(a.name),
          mainDiscipline: a.main_discipline, secondaryDisciplines: pd.secondary_disciplines ?? [],
          group: a.group_name, level: pd.level ?? null,
          records: recs,
          injuries: (injuriesRes.data ?? []).filter(i => i.athlete_id === a.id).map(i => ({
            id: i.id, name: i.name, location: i.location, intensity: i.intensity,
            status: i.status, startDate: i.start_date, endDate: null, notes: i.notes,
          })),
          performanceHistory: (perfHistRes.data ?? []).filter(p => p.athlete_id === a.id).sort((x,y) => x.month.localeCompare(y.month)).map(p => ({ month: p.month, value: p.value })),
          profile: pd.profile ?? {},
        };
      }));

      setWeeklyCharge(remappedCharge);
      setSessions((sessionsRes.data ?? []).map(s => {
        const rows = (sessionAthletesRes.data ?? []).filter(v => v.session_id === s.id);
        return { id: s.id, week: s.week, day: s.day, time: s.time, type: s.type, category: s.category, title: s.title, description: s.description, instructions: s.instructions, loadWeight: s.load_weight, pdfUrl: s.pdf_url, athleteIds: rows.map(v => v.athlete_id), validations: rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, fatigue: v.fatigue, comment: v.comment })) };
      }));
      setCompetitions((competitionsRes.data ?? []).map(c => ({
        id: c.id, name: c.name, date: c.date, location: c.location, type: c.type,
        athleteIds: (compAthletesRes.data ?? []).filter(x => x.competition_id === c.id).map(x => x.athlete_id),
        results:    (compResultsRes.data ?? []).filter(r => r.competition_id === c.id).map(r => ({ athleteId: r.athlete_id, event: r.event, result: r.result, context: r.context })),
      })));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures (identiques) ═══════════════════════════════════════════════
  const addRecord = useCallback(async (athleteId, form) => {
    const { error: e } = await supabase.from("records").insert({ athlete_id: athleteId, discipline: form.discipline, sb: form.sb, pr: form.pr, pr_date: form.prDate || null });
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const createAthlete = useCallback(async (form) => {
    let newUserId = null;
    if (form.email.trim()) {
      const { data: u, error: ue } = await supabase.from("users").insert({ club_id: clubId, name: form.name, email: form.email, role: "athlete" }).select().single();
      if (ue) throw ue; newUserId = u.id;
    }
    const secDisc = form.secondaryDisciplines.split(",").map(s => s.trim()).filter(Boolean);
    const pd = { level: form.level||null, secondary_disciplines:secDisc, profile:{speed:form.speed,strength:form.strength,explosivity:form.explosivity,endurance:form.endurance,technique:form.technique,recoveryRate:form.recoveryRate,volumeTolerance:form.volumeTolerance,intensityTolerance:form.intensityTolerance,psychProfile:form.psychProfile||null} };
    const { error: ae } = await supabase.from("athletes").insert({ club_id:clubId, name:form.name, age:form.age?Number(form.age):null, main_discipline:form.mainDiscipline||null, group_name:form.group||null, user_id:newUserId, profile_data:pd });
    if (ae) throw ae; await fetchAll();
  }, [clubId, fetchAll]);

  const updateAthlete = useCallback(async (athleteId, form) => {
    const secDisc = form.secondaryDisciplines.split(",").map(s => s.trim()).filter(Boolean);
    const pd = { level:form.level||null, secondary_disciplines:secDisc, profile:{speed:form.speed,strength:form.strength,explosivity:form.explosivity,endurance:form.endurance,technique:form.technique,recoveryRate:form.recoveryRate,volumeTolerance:form.volumeTolerance,intensityTolerance:form.intensityTolerance,psychProfile:form.psychProfile||null} };
    const { error: e } = await supabase.from("athletes").update({ name:form.name, age:form.age?Number(form.age):null, main_discipline:form.mainDiscipline||null, group_name:form.group||null, profile_data:pd }).eq("id", athleteId);
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const deleteAthlete = useCallback(async (id) => {
    const { error: e } = await supabase.from("athletes").delete().eq("id", id);
    if (e) throw e; await fetchAll();
  }, [fetchAll]);

  const addInjury    = useCallback(async (aid, form) => { const {error:e}=await supabase.from("injuries").insert({athlete_id:aid,name:form.name,location:form.location||null,intensity:form.intensity,status:form.status,start_date:form.startDate||null,notes:form.notes||null}); if(e)throw e; await fetchAll(); }, [fetchAll]);
  const updateInjury = useCallback(async (id,  form) => { const {error:e}=await supabase.from("injuries").update({name:form.name,location:form.location||null,intensity:form.intensity,status:form.status,start_date:form.startDate||null,notes:form.notes||null}).eq("id",id); if(e)throw e; await fetchAll(); }, [fetchAll]);
  const deleteInjury = useCallback(async (id)        => { const {error:e}=await supabase.from("injuries").delete().eq("id",id); if(e)throw e; await fetchAll(); }, [fetchAll]);

  function buildFormFromAthlete(a) {
    return { name:a.name??"", email:"", age:a.age??"", mainDiscipline:a.mainDiscipline??"", secondaryDisciplines:(a.secondaryDisciplines??[]).join(", "), group:a.group??"", level:a.level??"", speed:a.profile?.speed??50, strength:a.profile?.strength??50, explosivity:a.profile?.explosivity??50, endurance:a.profile?.endurance??50, technique:a.profile?.technique??50, recoveryRate:a.profile?.recoveryRate??"normale", volumeTolerance:a.profile?.volumeTolerance??"modérée", intensityTolerance:a.profile?.intensityTolerance??"modérée", psychProfile:a.profile?.psychProfile??"" };
  }

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des athlètes…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  const liveSelected = selectedAthlete ? athletes.find(a => a.id === selectedAthlete.id) ?? selectedAthlete : null;

  if (liveSelected) {
    return (
      <>
        <AthleteProfile
          athlete={liveSelected} weeklyCharge={weeklyCharge}
          sessions={sessions} competitions={competitions}
          onBack={() => setSelectedAthlete(null)}
          onAddRecord={addRecord}
          onEditRequest={setAthleteModalTarget}
          onDelete={deleteAthlete}
          onAddInjury={addInjury} onUpdateInjury={updateInjury} onDeleteInjury={deleteInjury}
        />
        {athleteModalTarget && (
          <AddAthleteModal
            onClose={() => setAthleteModalTarget(null)}
            onCreate={athleteModalTarget === "create" ? createAthlete : form => updateAthlete(athleteModalTarget.id, form)}
            initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-black tracking-tight" style={{ color: "var(--c-text-1)" }}>Athlètes</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
            {athletes.length > 0
              ? `${athletes.length} athlète${athletes.length>1?"s":""} suivi${athletes.length>1?"s":""} · Cliquez pour le profil complet`
              : "Aucun athlète pour l'instant"}
          </p>
        </div>
        <button onClick={() => setAthleteModalTarget("create")} className="btn-primary">
          <Plus size={16} /> Inscrire un athlète
        </button>
      </div>

      {athletes.length === 0 ? (
        <EmptySection icon={UsersIcon} title="Aucun athlète enregistré" sub="Clique sur « Inscrire un athlète » pour ajouter le premier." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {athletes.map(a => (
            <AthleteCard key={a.id} athlete={a} weeklyCharge={weeklyCharge} onClick={setSelectedAthlete} />
          ))}
        </div>
      )}

      {athleteModalTarget && (
        <AddAthleteModal
          onClose={() => setAthleteModalTarget(null)}
          onCreate={athleteModalTarget === "create" ? createAthlete : form => updateAthlete(athleteModalTarget.id, form)}
          initialData={athleteModalTarget === "create" ? null : buildFormFromAthlete(athleteModalTarget)}
        />
      )}
    </div>
  );
}

export default memo(AthleteList);