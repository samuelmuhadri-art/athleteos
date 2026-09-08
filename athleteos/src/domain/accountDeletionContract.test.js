import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  process.cwd(),
  "supabase/migrations/20260906010000_self_service_account_deletion.sql",
), "utf8");

describe("cycle de suppression d'un compte", () => {
  it("protège le dernier head coach et exige l'adresse du compte", () => {
    expect(migration).toContain("confirmation_email_mismatch");
    expect(migration).toContain("v_user.role = 'head_coach' AND v_other_head_coaches = 0");
    expect(migration).toContain("RAISE EXCEPTION 'last_head_coach'");
  });

  it("transfère le contenu sportif au lieu de le supprimer", () => {
    for (const table of ["sessions", "session_series", "session_templates", "planning_events"]) {
      expect(migration).toContain(`UPDATE public.${table} SET created_by = v_replacement.id`);
    }
    expect(migration).toContain("DELETE FROM public.messages");
    expect(migration).toContain("DELETE FROM public.athletes WHERE user_id = v_target.id");
  });

  it("n'expose les RPC de suppression qu'au service role", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.delete_own_account_transactional(integer, text) FROM authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.delete_own_account_transactional(integer, text) TO service_role");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public._prepare_user_content_for_removal(integer, integer) FROM service_role");
  });
});
