import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { followedAthletes } from "../../domain/coachFollowing";

export default function CoachFollowingSettings() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await supabase.rpc("get_coach_following");
      if (result.error) throw result.error;
      setData(result.data); setDraft(null);
    } catch { setError("Les affectations ne sont pas disponibles. Réessaie sans modifier les accès existants."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const change = (patch) => { setDraft((current) => ({ ...current, ...patch })); setSaved(false); };
  const toggle = (key, value) => change({ [key]: draft[key].includes(value) ? draft[key].filter((item) => item !== value) : [...draft[key], value] });
  const save = async () => {
    if (saving || !draft) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await supabase.rpc("configure_coach_following", {
        p_coach_user_id: draft.id, p_mode: draft.mode,
        p_groups: draft.mode === "club" ? [] : draft.groups,
        p_athlete_ids: draft.mode === "club" ? [] : draft.athleteIds,
        p_expected_revision: draft.revision,
      });
      if (result.error) throw result.error;
      setData(result.data); setDraft(result.data.coaches.find((coach) => coach.id === draft.id)); setSaved(true);
    } catch (failure) { setError(failure.code === "40001" ? "Un autre responsable a modifié ces affectations. Note tes choix puis recharge la liste." : "Enregistrement impossible. Tes choix restent affichés ; vérifie les groupes puis réessaie."); }
    finally { setSaving(false); }
  };
  const groups = [...new Set((data?.athletes ?? []).map((athlete) => athlete.group).filter(Boolean))].sort();
  const staleGroups = (draft?.groups ?? []).filter((group) => !groups.includes(group));
  return <section className="card-premium p-4 space-y-3" aria-labelledby="coach-following-title">
    <h4 id="coach-following-title" className="card-title">Qui suit quels athlètes ?</h4>
    <p className="text-sm">Facultatif : organise le suivi de chaque coach par groupes ou par athlètes. Le head coach suit toujours tout le club. Ces choix ne retirent pas les accès actuels du staff aux données du club.</p>
    {loading ? <p role="status">Chargement…</p> : <>
      <label className="block">Coach à organiser
        <select className="input-premium w-full mt-2" value={draft?.id ?? ""} disabled={saving} onChange={(event) => { setDraft(data?.coaches.find((coach) => String(coach.id) === event.target.value) ?? null); setSaved(false); setError(null); setSearch(""); }}>
          <option value="">Choisir un coach</option>
          {(data?.coaches ?? []).filter((coach) => coach.role === "coach").map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
        </select>
      </label>
      {data && !data.coaches.some((coach) => coach.role === "coach") && <p className="text-sm">Invite d’abord un coach ci-dessus. Son nom apparaîtra après son inscription.</p>}
      {draft && <fieldset disabled={saving} className="space-y-3">
        <legend className="sr-only">Suivi de {draft.name}</legend>
        <label className="flex items-center gap-2 min-h-11"><input type="radio" name="following-mode" checked={draft.mode === "club"} onChange={() => change({ mode: "club" })} /> Tout le club</label>
        <label className="flex items-center gap-2 min-h-11"><input type="radio" name="following-mode" checked={draft.mode === "assigned"} onChange={() => change({ mode: "assigned" })} /> Choisir des groupes et athlètes</label>
        {draft.mode === "assigned" && <>
          <fieldset><legend className="font-semibold">Groupes suivis</legend>
            <p className="text-sm">Les athlètes ajoutés à ces groupes seront inclus automatiquement.</p>
            {[...groups, ...staleGroups].map((group) => <label key={group} className="flex items-center gap-2 min-h-11 break-words"><input type="checkbox" checked={draft.groups.includes(group)} onChange={() => toggle("groups", group)} />{group}{staleGroups.includes(group) ? " (groupe disparu : décoche-le)" : ""}</label>)}
            {!groups.length && <p className="text-sm">Aucun groupe : sélectionne directement des athlètes.</p>}
          </fieldset>
          <details><summary className="cursor-pointer py-3">Athlètes supplémentaires ({draft.athleteIds.length})</summary>
            <label className="block">Rechercher un athlète<input className="input-premium w-full my-2" value={search} onChange={(event) => setSearch(event.target.value)} type="search" /></label>
            <div className="max-h-64 overflow-y-auto">
              {data.athletes.filter((athlete) => athlete.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((athlete) => <label key={athlete.id} className="flex items-center gap-2 min-h-11"><input type="checkbox" checked={draft.athleteIds.includes(athlete.id)} onChange={() => toggle("athleteIds", athlete.id)} />{athlete.name}{athlete.group ? ` · ${athlete.group}` : ""}</label>)}
            </div>
          </details>
          <p role="status">{followedAthletes(data.athletes, draft).length} athlète(s) suivi(s). {followedAthletes(data.athletes, draft).length === 0 ? "Aucun athlète sélectionné ; le coach pourra toujours consulter le club." : ""}</p>
        </>}
        <button type="button" className="btn-primary" onClick={save}>{saving ? "Enregistrement…" : "Enregistrer les affectations"}</button>
      </fieldset>}
    </>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    {saved && <p role="status">Affectations enregistrées. Le coach les retrouve dans « Mes athlètes ».</p>}
    <button type="button" className="btn-ghost" disabled={loading || saving} onClick={load}>Recharger la liste</button>
  </section>;
}
