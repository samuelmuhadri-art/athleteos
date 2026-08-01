import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const inspectMigration = read("supabase/migrations/20260801100000_individual_club_invitations.sql");
const signupMigration = read("supabase/migrations/20260801170000_atomic_individual_invitation_acceptance.sql");
const memberMigration = read("supabase/migrations/20260801190000_atomic_existing_member_invitation_acceptance.sql");
const signupEdge = read("supabase/functions/signup/index.ts");
const adminEdge = read("supabase/functions/admin-actions/index.ts");

describe("contrat du cycle de vie des invitations", () => {
  it("distingue invalide, révoquée, acceptée, expirée et active sans exposer l'email", () => {
    for (const status of ["invalid", "revoked", "accepted", "expired", "active"]) {
      expect(inspectMigration).toContain(`'${status}'`);
    }
    expect(inspectMigration).not.toContain("'recipientEmail'");
    expect(inspectMigration).not.toContain("'recipientName'");
  });

  it("réserve une invitation avant la création Auth et libère uniquement sa propre réservation en cas d'échec", () => {
    expect(signupEdge.indexOf("reservationToken = crypto.randomUUID()"))
      .toBeLessThan(signupEdge.indexOf('admin.rpc("signup_create_account_with_invitation"'));
    expect(signupEdge).toContain('.eq("reservation_token", reservationToken)');
    expect(signupMigration).toContain("FOR UPDATE");
    expect(signupMigration).toContain("invitation_email_mismatch");
    expect(signupMigration).toContain("invitation_acceptance_conflict");
  });

  it("rend le double clic idempotent pour son auteur mais refuse le mauvais compte", () => {
    expect(memberMigration).toContain("v_invitation.accepted_user_id = p_user_id");
    expect(memberMigration).toContain("accepted_by_caller");
    expect(memberMigration).toContain("email_mismatch");
    expect(memberMigration).toContain("different_club");
    expect(memberMigration).toContain("FOR UPDATE");
    expect(adminEdge).toContain("accept_existing_member_club_invitation");
  });

  it("révoque seulement une invitation encore active et non acceptée", () => {
    expect(adminEdge).toContain('.eq("status", "active").is("accepted_at", null)');
    expect(adminEdge).toContain("L’invitation a changé d’état");
  });
});
