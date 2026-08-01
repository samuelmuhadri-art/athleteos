// ============================================================
// AthleteOS — src/modules/AthleteList.jsx
// ★ DESIGN PREMIUM DARK + PORTALS
// ============================================================

import { memo, useState, useCallback, useEffect } from "react";
import { FileSpreadsheet, Plus, Users as UsersIcon } from "lucide-react";
import { supabase }  from "../utils/supabaseClient";
import { useAuth }   from "../context/AuthContext";
import LoadingState  from "../components/ui/LoadingState";
import ErrorState    from "../components/ui/ErrorState";
import { initialsFromName } from "../utils/helpers.js";
import { parsePerf } from "../athlete/shared.js";
import {
  normalizePerformanceMetadata, resolveDisciplineId, validatePerformanceMetadata,
} from "../domain/disciplines.js";
import { getAthleteCsvImportError } from "../utils/athleteCsv.js";
import AthleteProfile from "./AthleteProfile";
import AthleteCard from "./AthleteCard";
import AddAthleteModal from "./AddAthleteModal";
import ImportAthletesCsvModal from "./ImportAthletesCsvModal";
import { EmptyState, InlineNotice, PageHeader } from "../components/ui/premium";

// ─── Composant principal ──────────────────────────────────────────────────────

function AthleteList() {
  const { clubId, profile } = useAuth();
  const canImportAthletes = profile?.role === "head_coach";

  const [selectedAthlete,    setSelectedAthlete]    = useState(null);
  const [athleteModalTarget, setAthleteModalTarget] = useState(null);
  const [athletes,           setAthletes]           = useState([]);
  const [weeklyCharge,       setWeeklyCharge]       = useState([]);
  const [sessions,           setSessions]           = useState([]);
  const [competitions,       setCompetitions]       = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [existingEmails,     setExistingEmails]     = useState([]);
  const [showImport,         setShowImport]         = useState(false);
  const [importReport,       setImportReport]       = useState(null);

  // ═══ Chargement (identique) ═══════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true); setError(null);
      const [athletesRes, sessionsRes, competitionsRes, usersRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("club_id", clubId),
        supabase.from("sessions").select("*").eq("club_id", clubId),
        supabase.from("competitions").select("*").eq("club_id", clubId),
        canImportAthletes
          ? supabase.from("users").select("email").eq("club_id", clubId)
          : Promise.resolve({ data: [], error: null }),
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
        athleteId: c.athlete_id, week: c.week, isoYear: c.iso_year, rawLoad: c.raw_load,
        dailyLoads: c.daily_loads ?? [], knownDays: c.known_days ?? 0,
        unknownDays: c.unknown_days ?? 0, estimatedDays: c.estimated_days ?? 0,
      }));

      setAthletes((athletesRes.data ?? []).map(a => {
        const pd = a.profile_data ?? {};
        const recs = {};
        (recordsRes.data ?? []).filter(r => r.athlete_id === a.id).forEach(r => { recs[r.discipline] = { ...r, sb: r.sb, pr: r.pr, prDate: r.pr_date }; });
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
      setExistingEmails((usersRes.data ?? []).map((row) => row.email).filter(Boolean));
      setSessions((sessionsRes.data ?? []).map(s => {
        const rows = (sessionAthletesRes.data ?? []).filter(v => v.session_id === s.id);
        return { id: s.id, week: s.week, day: s.day, sessionDate: s.session_date, time: s.time, type: s.type, category: s.category, trainingFocus: s.training_focus, title: s.title, description: s.description, instructions: s.instructions, durationMinutes: s.duration_minutes, loadWeight: s.load_weight, pdfUrl: s.pdf_url, athleteIds: rows.map(v => v.athlete_id), validations: rows.map(v => ({ athleteId: v.athlete_id, status: v.status, feeling: v.feeling, fatigue: v.fatigue, comment: v.comment, rpe: v.rpe, actualDurationMinutes: v.actual_duration_minutes, durationSource: v.duration_source })) };
      }));
      setCompetitions((competitionsRes.data ?? []).map(c => ({
        id: c.id, name: c.name, date: c.date, location: c.location, type: c.type,
        athleteIds: (compAthletesRes.data ?? []).filter(x => x.competition_id === c.id).map(x => x.athlete_id),
        results:    (compResultsRes.data ?? []).filter(r => r.competition_id === c.id).map(r => ({ athleteId: r.athlete_id, event: r.event, result: r.result, context: r.context })),
      })));
    } catch (err) {
      setError(err.message ?? "Erreur inconnue");
    } finally { setLoading(false); }
  }, [canImportAthletes, clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures (identiques) ═══════════════════════════════════════════════
  const addRecord = useCallback(async (athleteId, form) => {
    // Tâche 14 : records a désormais une contrainte UNIQUE(athlete_id,
    // discipline) (migration 20260730010000, nécessaire pour verrouiller
    // les résultats de compétition concurrents sans risque de doublon) —
    // un insert direct échouerait si un record existe déjà pour cette
    // discipline, là où il créait silencieusement un doublon auparavant
    // (déjà un bug latent). Bascule en upsert explicite, et renseigne
    // pr_value/sb_value pour rester cohérent avec les comparaisons faites
    // côté serveur par les RPC de compétition.
    // Tâche 12 : discipline passée au registre central avant écriture — ce
    // point d'ajout manuel (formulaire coach en texte libre) était le seul
    // à ne pas déjà le faire (tous les autres, compétitions/auto-déclaration
    // athlète, le font depuis la tâche 9), donc "100 m" et "100m" pouvaient
    // ne jamais se rejoindre malgré la discipline canonique identique.
    const discipline = resolveDisciplineId(form.discipline);
    const metadata = normalizePerformanceMetadata(discipline, form.metadata);
    const metadataIssues = validatePerformanceMetadata(discipline, metadata);
    if (metadataIssues.length) throw new Error(metadataIssues[0]);
    const sbValue = parsePerf(form.sb).value;
    const prValue = parsePerf(form.pr).value;
    if (sbValue == null || prValue == null) throw new Error("Le SB et le PR doivent contenir une valeur numérique valide.");
    const patch = {
      sb: form.sb, sb_value: sbValue,
      pr: form.pr, pr_value: prValue, pr_date: form.prDate || null,
      unit: metadata.unit, discipline_id: discipline,
      measurement_type: metadata.measurement_type,
      performance_direction: metadata.performance_direction,
      metadata_version: metadata.metadata_version,
    };
    const { data: existing } = await supabase.from("records").select("id")
      .eq("athlete_id", athleteId).eq("discipline", discipline).maybeSingle();
    const { error: e } = existing
      ? await supabase.from("records").update(patch).eq("id", existing.id)
      : await supabase.from("records").insert({ athlete_id: athleteId, discipline, ...patch });
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

  const importAthletes = useCallback(async (rows, context) => {
    const payload = rows.map((row) => ({
      name: row.name,
      email: row.email || null,
      age: row.age ? Number(row.age) : null,
      mainDiscipline: row.mainDiscipline || null,
      secondaryDisciplines: row.secondaryDisciplines
        ? row.secondaryDisciplines.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
      group: row.group || null,
      level: row.level || null,
    }));
    const { data, error: importError } = await supabase.rpc("import_club_athletes", { p_rows: payload });
    if (importError) throw getAthleteCsvImportError(importError, context?.sourceRows);
    const importedCount = data?.importedCount;
    const createdUserCount = data?.createdUserCount;
    if (
      !Number.isInteger(importedCount)
      || !Number.isInteger(createdUserCount)
      || importedCount < 0
      || createdUserCount < 0
      || createdUserCount > importedCount
    ) {
      throw new Error("La réponse du serveur est incomplète. Recharge la liste avant de relancer un import.");
    }
    setImportReport({
      importedCount,
      createdUserCount,
      skippedCount: context?.skippedRows?.length ?? 0,
      fileName: context?.fileName ?? "",
    });
    await fetchAll();
  }, [fetchAll]);

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
    <div className="page-container py-4 md:py-6 max-w-7xl mx-auto space-y-5 animate-slide-up">
      <PageHeader
        title="Athlètes"
        eyebrow="EFFECTIF DU CLUB"
        description={athletes.length > 0
          ? `${athletes.length} athlète${athletes.length > 1 ? "s" : ""} suivi${athletes.length > 1 ? "s" : ""} · Ouvre un profil pour le dossier complet.`
          : "Constitue ton groupe manuellement ou depuis un fichier CSV exporté par Excel."}
        actions={(
          <>
            {canImportAthletes && (
              <button type="button" onClick={() => setShowImport(true)} className="btn-secondary">
                <FileSpreadsheet size={16} aria-hidden="true" /> Importer un CSV
              </button>
            )}
            <button type="button" onClick={() => setAthleteModalTarget("create")} className="btn-primary">
              <Plus size={16} aria-hidden="true" /> Inscrire un athlète
            </button>
          </>
        )}
      />

      {importReport && (
        <InlineNotice
          tone={importReport.skippedCount > 0 ? "warning" : "success"}
          title={`${importReport.importedCount} athlète${importReport.importedCount > 1 ? "s" : ""} importé${importReport.importedCount > 1 ? "s" : ""}`}
          onDismiss={() => setImportReport(null)}
        >
          {`${importReport.createdUserCount > 0
            ? `${importReport.createdUserCount} profil${importReport.createdUserCount > 1 ? "s ont" : " a"} été relié${importReport.createdUserCount > 1 ? "s" : ""} à une adresse email.`
            : "Aucun profil importé n’a été relié à une adresse email."} ${importReport.skippedCount > 0
            ? `${importReport.skippedCount} ligne${importReport.skippedCount > 1 ? "s ont" : " a"} été ignorée${importReport.skippedCount > 1 ? "s" : ""} car elle ne respectait pas le modèle.`
            : `Le fichier ${importReport.fileName || "CSV"} a été traité sans modifier les profils existants.`}`}
        </InlineNotice>
      )}

      {athletes.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Ton effectif est prêt à être créé"
          description="Ajoute un premier athlète, importe un CSV exporté depuis Excel ou partage le QR code d’invitation depuis le dashboard."
          action={<button type="button" className="btn-primary" onClick={() => setAthleteModalTarget("create")}><Plus size={16} aria-hidden="true" /> Ajouter le premier</button>}
          secondaryAction={canImportAthletes
            ? <button type="button" className="btn-secondary" onClick={() => setShowImport(true)}><FileSpreadsheet size={16} aria-hidden="true" /> Importer un CSV</button>
            : null}
        />
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

      {showImport && canImportAthletes && (
        <ImportAthletesCsvModal
          existingEmails={existingEmails}
          onImport={importAthletes}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

export default memo(AthleteList);
