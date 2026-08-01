import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260801230000_harden_data_api_table_privileges.sql"),
  "utf8",
);

describe("privilèges minimaux de la Data API", () => {
  it("retire les droits de table qui contournent ou administrent RLS", () => {
    expect(sql).toContain("REVOKE TRUNCATE, REFERENCES, TRIGGER");
    expect(sql).toContain("FROM anon, authenticated");
  });

  it("retire l'usage des séquences au rôle anonyme", () => {
    expect(sql).toMatch(/REVOKE USAGE[\s\S]*ON ALL SEQUENCES[\s\S]*FROM anon/u);
  });

  it("durcit les privilèges par défaut du propriétaire applicatif", () => {
    expect(sql).toContain("FOR ROLE postgres IN SCHEMA public");
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/u);
  });
});
