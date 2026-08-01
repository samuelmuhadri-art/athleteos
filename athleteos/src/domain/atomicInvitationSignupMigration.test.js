import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260801170000_atomic_individual_invitation_acceptance.sql"), "utf8");
const signup = readFileSync(resolve(process.cwd(), "supabase/functions/signup/index.ts"), "utf8");

describe("acceptation atomique d’une invitation individuelle", () => {
  it("verrouille et revérifie l’invitation réservée", () => {
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_invitation.reservation_token IS DISTINCT FROM p_reservation_token");
    expect(sql).toContain("v_invitation.reserved_until <= now()");
    expect(sql).toContain("invitation_email_mismatch");
    expect(sql).toContain("invitation_club_mismatch");
  });

  it("crée le compte puis consomme le lien dans la même transaction", () => {
    expect(sql).toContain("v_result := public.signup_create_account");
    expect(sql).toContain("accepted_user_id = (v_result ->> 'userId')::integer");
    expect(sql).toContain("GET DIAGNOSTICS v_updated_count = ROW_COUNT");
    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("reste inaccessible aux clients et est utilisée par signup", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("FROM authenticated");
    expect(sql).toContain("TO service_role");
    expect(signup).toContain('admin.rpc("signup_create_account_with_invitation"');
    expect(signup).toContain("p_individual_invitation_id: individualInvitationId");
    expect(signup).not.toContain("individual invitation tracking:");
  });
});
