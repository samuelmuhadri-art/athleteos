import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260801240000_guard_cron_schedule_by_secret.sql"),
  "utf8",
);

describe("garde-fou d'environnement des crons", () => {
  it("retire d'abord les jobs hérités", () => {
    expect(sql).toContain("cron.unschedule('weekly-notifications')");
    expect(sql).toContain("cron.unschedule('daily-session-reminders')");
  });

  it("ne planifie les appels distants qu'avec un secret Vault non vide", () => {
    const guard = sql.indexOf("IF EXISTS (");
    expect(guard).toBeGreaterThan(0);
    expect(sql.indexOf("PERFORM cron.schedule", guard)).toBeGreaterThan(guard);
    expect(sql).toContain("nullif(btrim(decrypted_secret), '') IS NOT NULL");
  });

  it("couvre les deux fonctions Edge planifiées", () => {
    expect(sql).toContain("/functions/v1/weekly-cron");
    expect(sql).toContain("/functions/v1/session-reminders");
  });
});
