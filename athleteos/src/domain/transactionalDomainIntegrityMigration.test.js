import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20260901020000_transactional_domain_integrity.sql",
), "utf8");

describe("intégrité transactionnelle des domaines", () => {
  it("rend uniques les affectations de compétitions et de séances", () => {
    expect(sql).toContain("competition_athletes_competition_athlete_uidx");
    expect(sql).toContain("session_athletes_session_athlete_uidx");
    expect(sql).toContain("ON CONFLICT (competition_id, athlete_id)");
    expect(sql).toContain("ON CONFLICT (session_id, athlete_id)");
  });

  it("sérialise l'idempotence et refuse le résultat d'un non-inscrit", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("Cet athlete n est pas inscrit a cette competition.");
    expect(sql).toContain("assignment.athlete_id = competition_results.athlete_id");
  });

  it("relie la performance solo à sa compétition", () => {
    expect(sql).toContain("SET competition_id = v_comp_id");
    expect(sql).toContain("WHERE id = (v_result->>'performanceId')::bigint");
  });

  it("expose un CRUD de planning atomique avec détection de chevauchement", () => {
    expect(sql).toContain("public.create_session_with_athletes");
    expect(sql).toContain("public.update_session_with_athletes");
    expect(sql).toContain("public.delete_session_transactional");
    expect(sql).toContain(") OVERLAPS (");
  });

  it("recalcule les records et synchronise users avec athletes", () => {
    expect(sql).toContain("public.delete_athlete_performance");
    expect(sql).toContain("public.create_club_athlete");
    expect(sql).toContain("public.update_club_athlete");
    expect(sql).toContain("UPDATE public.users SET name = v_name");
  });

  it("réserve les RPC aux utilisateurs authentifiés", () => {
    for (const signature of [
      "create_session_with_athletes(jsonb, integer[], text)",
      "update_session_with_athletes(integer, jsonb, integer[])",
      "delete_session_transactional(integer)",
      "delete_athlete_performance(bigint)",
      "create_club_athlete(jsonb)",
      "update_club_athlete(integer, jsonb)",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated`);
    }
  });
});
