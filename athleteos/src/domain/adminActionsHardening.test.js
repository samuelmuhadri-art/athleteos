import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "supabase/functions/admin-actions/index.ts"), "utf8");

describe("durcissement d’admin-actions", () => {
  it("refuse les méthodes inattendues et borne le payload avant traitement", () => {
    expect(source).toContain('req.method !== "POST"');
    expect(source).toContain("MAX_BODY_BYTES");
    expect(source).toContain("declaredLength > MAX_BODY_BYTES");
    expect(source).toContain("new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES");
    expect(source).toContain("configuration Supabase manquante");
  });

  it("ne renvoie pas les détails PostgreSQL inattendus au navigateur", () => {
    expect(source).toContain('const clientMessage = denied ? internalMessage : "Une erreur technique est survenue. Réessaie dans un instant."');
  });

  it("contrôle chaque suppression avant de toucher au compte Auth", () => {
    const removalStart = source.indexOf('if (currentAction === "remove_user")');
    const deletionCheck = source.indexOf("if (deletionError) throw deletionError", removalStart);
    const authDeletion = source.indexOf("admin.auth.admin.deleteUser", removalStart);
    expect(source).toContain('admin.rpc("remove_club_user_transactional"');
    expect(deletionCheck).toBeGreaterThan(removalStart);
    expect(deletionCheck).toBeLessThan(authDeletion);
    expect(source).toContain("authCleanupPending: true");
  });

  it("construit l'export personnel depuis l'identité JWT sans accepter d'identifiant client", () => {
    const exportStart = source.indexOf('if (currentAction === "export_personal_data")');
    const headCoachGate = source.indexOf('if (!isHeadCoach && currentAction !== "create_club_invitation")');
    expect(exportStart).toBeGreaterThan(0);
    expect(exportStart).toBeLessThan(headCoachGate);
    expect(source).toContain('targetUserId = caller.id');
    expect(source).toContain('`user_id.eq.${caller.id},athlete_id.eq.${athlete.id}`');
    expect(source).toContain('.eq("athlete_id", athleteId)');
    expect(source).toContain('return ok({ export: personalExport })');
  });

  it("supprime son propre compte via une transaction avant le nettoyage Auth", () => {
    const actionStart = source.indexOf('if (currentAction === "delete_own_account")');
    const headCoachGate = source.indexOf('if (!isHeadCoach && currentAction !== "create_club_invitation")');
    expect(actionStart).toBeGreaterThan(0);
    expect(actionStart).toBeLessThan(headCoachGate);
    expect(source).toContain('admin.rpc("delete_own_account_transactional"');
    expect(source).toContain('p_user_id: caller.id');
    expect(source.indexOf('if (deletionError)', actionStart)).toBeLessThan(
      source.indexOf("admin.auth.admin.deleteUser", actionStart),
    );
    expect(source).toContain("Transfère d’abord la responsabilité du club");
  });

  it("consomme atomiquement et de façon idempotente une invitation d'un compte existant", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260801190000_atomic_existing_member_invitation_acceptance.sql"), "utf8");
    expect(source).toContain("accept_existing_member_club_invitation");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("accepted_by_caller");
    expect(migration).toContain("v_invitation.accepted_user_id = p_user_id");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.accept_existing_member_club_invitation");
  });
});
