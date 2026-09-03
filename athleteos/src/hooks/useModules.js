import { useContext } from "react";
import { ModulesContext } from "../contexts/modulesContextValue";
import { MODULE_KEYS } from "../domain/modules/moduleRegistry";

const ALL_ENABLED = Object.freeze(Object.fromEntries(MODULE_KEYS.map((key) => [key, true])));
const LEGACY_MODULES = Object.freeze({
  managed: false,
  loading: false,
  error: null,
  configuredAt: new Date(0).toISOString(),
  club: ALL_ENABLED,
  athlete: {},
  athletes: [],
  effective: ALL_ENABLED,
  effectiveForAthlete: () => ALL_ENABLED,
  enabledAthleteIds: () => null,
  refresh: async () => {},
  saveClub: async () => {},
  saveAthletes: async () => {},
  restartOnboarding: async () => {},
});

export function useModules() {
  const value = useContext(ModulesContext);
  return value ?? LEGACY_MODULES;
}
