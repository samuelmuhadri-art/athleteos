import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { MODULE_KEYS, rowsToModuleMap, resolveEffectiveModules } from "../domain/modules/moduleRegistry";
import {
  fetchModuleConfiguration,
  resetModuleOnboarding,
  saveAthleteModules,
  saveClubModules,
  saveModuleAthletes,
} from "../services/moduleService";
import { supabase } from "../utils/supabaseClient";

import { ModulesContext } from "./modulesContextValue";

export function ModulesProvider({ children }) {
  const { clubId, profile } = useAuth();
  const refreshTimerRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: null,
    configuredAt: null,
    clubModules: [],
    athleteModules: [],
    athletes: [],
  });

  const refresh = useCallback(async () => {
    if (!clubId || !profile?.id) return;
    try {
      setState((current) => ({ ...current, loading: true, error: null }));
      const next = await fetchModuleConfiguration({ clubId, role: profile.role, profileId: profile.id });
      setState({ loading: false, error: null, ...next });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, [clubId, profile?.id, profile?.role]);

  useEffect(() => { refresh(); }, [refresh]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 180);
  }, [refresh]);

  useEffect(() => {
    if (!clubId) return undefined;
    const channel = supabase.channel(`module-configuration-${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_modules", filter: `club_id=eq.${clubId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_modules", filter: `club_id=eq.${clubId}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [clubId, scheduleRefresh]);

  const value = useMemo(() => {
    const club = rowsToModuleMap(state.clubModules);
    const athleteRowsById = new Map();
    state.athleteModules.forEach((row) => {
      const rows = athleteRowsById.get(row.athlete_id) ?? [];
      rows.push(row);
      athleteRowsById.set(row.athlete_id, rows);
    });
    const athlete = Object.fromEntries(state.athletes.map((item) => [item.id, rowsToModuleMap(athleteRowsById.get(item.id))]));
    const effectiveForAthlete = (athleteId) => resolveEffectiveModules(club, athlete[athleteId]);
    const ownAthleteId = profile?.role === "athlete" ? state.athletes[0]?.id ?? null : null;
    return {
      ...state,
      managed: true,
      club,
      athlete,
      ownAthleteId,
      effective: ownAthleteId ? effectiveForAthlete(ownAthleteId) : club,
      effectiveForAthlete,
      enabledAthleteIds: (moduleKey) => state.athletes
        .filter((item) => effectiveForAthlete(item.id)[moduleKey])
        .map((item) => item.id),
      refresh,
      saveClub: async (keys) => {
        await saveClubModules(keys);
        const enabled = new Set(keys);
        setState((current) => ({
          ...current,
          configuredAt: new Date().toISOString(),
          clubModules: MODULE_KEYS.map((moduleKey) => ({ module_key: moduleKey, enabled: enabled.has(moduleKey), config: {} })),
        }));
        void refresh();
      },
      saveAthletes: async (ids, keys) => {
        await saveAthleteModules(ids, keys);
        const targetIds = new Set(ids);
        const enabled = new Set(keys);
        setState((current) => ({
          ...current,
          athleteModules: current.athleteModules.map((row) => targetIds.has(row.athlete_id)
            ? { ...row, enabled: enabled.has(row.module_key) }
            : row),
        }));
        void refresh();
      },
      saveModuleForAthletes: async (moduleKey, ids) => {
        await saveModuleAthletes(moduleKey, ids);
        const enabledIds = new Set(ids);
        setState((current) => ({
          ...current,
          athleteModules: current.athleteModules.map((row) => {
            if (row.module_key === moduleKey) return { ...row, enabled: enabledIds.has(row.athlete_id) };
            if (moduleKey === "training_load" && row.module_key === "session_feedback" && enabledIds.has(row.athlete_id)) return { ...row, enabled: true };
            if (moduleKey === "session_feedback" && row.module_key === "training_load" && !enabledIds.has(row.athlete_id)) return { ...row, enabled: false };
            return row;
          }),
        }));
        void refresh();
      },
      restartOnboarding: async () => { await resetModuleOnboarding(); await refresh(); },
    };
  }, [profile?.role, refresh, state]);

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}
