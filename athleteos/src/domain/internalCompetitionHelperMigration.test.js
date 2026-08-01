import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260801220000_harden_internal_competition_helper.sql"),
  "utf8",
);

describe("durcissement de l'aide interne des compétitions", () => {
  it("supprime la surcharge historique sans unité", () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\._apply_competition_result\([\s\S]*jsonb\s*\);/u);
  });

  it("retire explicitement l'exécution aux rôles de la Data API", () => {
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO postgres");
  });

  it("reste une migration atomique", () => {
    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
});
