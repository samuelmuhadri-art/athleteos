import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902010000_configurable_club_and_athlete_modules.sql"), "utf8");
const guards = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902020000_enforce_module_aware_writes_and_notifications.sql"), "utf8");
const reset = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902030000_local_club_operational_reset.sql"), "utf8");
const resetScript = readFileSync(resolve(process.cwd(), "scripts/reset-smac-operational-data.mjs"), "utf8");
const uxMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260903010000_obvious_module_ux_and_optional_gamification.sql"), "utf8");

describe("architecture modulaire Supabase", () => {
  it("stocke les niveaux club et athlète hors de profile_data", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.club_modules");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.athlete_modules");
    expect(schema).toContain("UNIQUE (club_id, module_key)");
    expect(schema).toContain("UNIQUE (athlete_id, module_key)");
    expect(schema).not.toContain("profile_data");
  });

  it("conserve toutes les fonctions actives pour les clubs existants", () => {
    expect(schema).toMatch(/CROSS JOIN unnest[\s\S]*enabled[\s\S]*true/u);
    expect(schema).toContain("COALESCE(");
    expect(schema).toContain("ON CONFLICT (athlete_id, module_key) DO NOTHING");
  });

  it("centralise la dépendance charge vers feedback dans les RPC", () => {
    expect(schema.match(/'training_load' = ANY\(v_enabled\)/gu)).toHaveLength(2);
    expect(schema).toContain("La charge nécessite le feedback de séance.");
  });

  it("limite les mutations de configuration à des RPC sécurisées", () => {
    expect(schema).toContain("REVOKE INSERT, UPDATE, DELETE ON public.club_modules FROM authenticated");
    expect(schema).toContain("public.get_my_role() <> 'head_coach'");
    expect(schema).toContain("v_role NOT IN ('coach', 'head_coach')");
  });

  it("bloque les écritures métier et supprime les notifications désactivées", () => {
    expect(guards).toContain("enforce_session_athlete_modules");
    expect(guards).toContain("suppress_disabled_athlete_notification");
    expect(guards).toContain("suppress_disabled_coach_alert");
    expect(guards).toContain("module_key_for_notification_type");
  });

  it("garde chaque migration atomique", () => {
    for (const sql of [schema, guards, reset]) {
      expect(sql.trim().startsWith("--")).toBe(true);
      expect(sql).toContain("BEGIN;");
      expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    }
  });

  it("rend le reset SMAC local, explicite et service-role only", () => {
    expect(reset).toContain("auth.role() <> 'service_role'");
    expect(reset).toContain("upper(v_name) <> 'SMAC'");
    expect(reset).toContain("p_confirmation <> 'SMAC'");
    expect(reset).toContain("FROM PUBLIC, anon, authenticated");
    expect(resetScript).toContain('["localhost", "127.0.0.1", "::1"]');
    expect(resetScript).toContain('CONFIRM_RESET_CLUB_DATA !== "SMAC"');
  });

  it("ajoute la gamification sans supprimer ses données et partage une source de vérité inverse", () => {
    expect(uxMigration).toContain("'gamification'");
    expect(uxMigration).toContain("configure_module_athletes");
    expect(uxMigration).toContain("ON CONFLICT (athlete_id, module_key) DO NOTHING");
    expect(uxMigration).not.toMatch(/DELETE\s+FROM|TRUNCATE/iu);
    expect(uxMigration.trim().endsWith("COMMIT;")).toBe(true);
  });
});
