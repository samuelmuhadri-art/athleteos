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
    expect(source).toContain('admin.rpc("remove_club_user_transactional"');
    expect(source).toContain("if (deletionError) throw deletionError");
    expect(source.indexOf("if (deletionError) throw deletionError")).toBeLessThan(source.indexOf("admin.auth.admin.deleteUser"));
    expect(source).toContain("authCleanupPending: true");
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
