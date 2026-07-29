import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260801080000_structured_performance_context.sql"), "utf8");

describe("migration des performances structurées", () => {
  it("stocke toutes les dimensions techniques demandées", () => {
    for (const column of [
      "measurement_type", "performance_direction", "venue_type", "wind_mps",
      "timing_method", "implement_weight_kg", "hurdle_height_m",
      "official_status", "scoring_table_version", "metadata_version",
    ]) expect(sql).toContain(column);
  });

  it("dérive PR/SB dans la même transaction avec verrouillage", () => {
    const rpc = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.add_athlete_performance"), sql.indexOf("CREATE OR REPLACE FUNCTION public.add_competition_result_v2"));
    expect(rpc).toContain("INSERT INTO public.athlete_performances");
    expect(rpc).toContain("INSERT INTO public.records");
    expect(rpc).toContain("ON CONFLICT (athlete_id, discipline) DO NOTHING");
    expect(rpc).toContain("FOR UPDATE");
  });

  it("garde les anciens RPC et ajoute des versions v2", () => {
    expect(sql).toContain("public.add_competition_result_v2");
    expect(sql).toContain("public.create_solo_competition_result_v2");
    expect(sql).not.toMatch(/DROP\s+FUNCTION\s+public\.(add_competition_result|create_solo_competition_result)/iu);
  });

  it("revérifie l'accès avant les mises à jour SECURITY DEFINER", () => {
    expect(sql).toContain("u.role IN ('head_coach', 'coach')");
    expect(sql).toContain("RAISE EXCEPTION 'Résultat inaccessible.'");
    expect(sql).toContain("RAISE EXCEPTION 'Performance inaccessible.'");
  });
});
