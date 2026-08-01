import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260801160000_transactional_user_removal.sql"), "utf8");

describe("suppression transactionnelle d’un membre", () => {
  it("reste réservée au service role et fixe son search_path", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.remove_club_user_transactional(integer, integer) TO service_role");
  });

  it("revérifie le rôle, le club, l’auto-cible et le dernier head coach", () => {
    expect(sql).toContain("v_actor.role <> 'head_coach'");
    expect(sql).toContain("v_target.club_id <> v_actor.club_id");
    expect(sql).toContain("v_target.id = v_actor.id");
    expect(sql).toContain("last_head_coach");
  });

  it("sérialise puis supprime les lignes métier dans une seule transaction", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("DELETE FROM public.athletes");
    expect(sql).toContain("DELETE FROM public.users");
    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
});
