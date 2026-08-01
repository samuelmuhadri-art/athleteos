import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const weekly = source("supabase/functions/weekly-cron/index.ts");
const reminders = source("supabase/functions/session-reminders/index.ts");
const sendPush = source("supabase/functions/send-push/index.ts");
const signup = source("supabase/functions/signup/index.ts");
const migration = source("supabase/migrations/20260801180000_iso_week_and_notification_idempotency.sql");
const pushRateMigration = source("supabase/migrations/20260801200000_push_delivery_rate_limit.sql");

describe("durcissement des crons et notifications", () => {
  it("sépare les semaines par année et par dates réelles", () => {
    expect(weekly).toContain("getIsoWeekContext");
    expect(weekly).toContain('.gte("session_date", week.startDate)');
    expect(weekly).toContain('.lte("session_date", week.endDate)');
    expect(weekly).toContain('.neq("lifecycle_status", "cancelled")');
    expect(weekly).not.toContain('s.day !== "Dimanche"');
    expect(migration).toContain("EXTRACT(ISOYEAR FROM s.session_date)");
    expect(migration).toContain("GROUP BY d.athlete_id, d.week, d.iso_year");
  });

  it("rend les créations idempotentes même sous concurrence", () => {
    expect(migration).toContain("alerts_club_type_dedupe_key_uidx");
    expect(migration).toContain("athlete_notifications_athlete_type_dedupe_key_uidx");
    expect(weekly).toContain('onConflict: "club_id,type,dedupe_key"');
    expect(weekly).toContain('onConflict: "athlete_id,type,dedupe_key"');
    expect(reminders).toContain('onConflict: "athlete_id,type,dedupe_key"');
  });

  it("échoue fermé si les secrets serveur manquent", () => {
    for (const edgeSource of [weekly, reminders, sendPush, signup]) {
      expect(edgeSource).toContain("configuration Supabase manquante");
    }
    expect(weekly).toContain('status: 503');
    expect(reminders).toContain('status: 503');
  });

  it("borne les vrais octets et vérifie les erreurs de requête", () => {
    for (const edgeSource of [weekly, reminders, sendPush, signup]) {
      expect(edgeSource).toContain("new TextEncoder().encode(rawBody).byteLength");
    }
    expect(sendPush).toContain('select("endpoint, p256dh, auth")');
    expect(sendPush).toContain("if (cleanupError) throw cleanupError");
    expect(weekly).toContain("requireData");
  });

  it("limite les envois push d'un utilisateur sans limiter les crons serveur", () => {
    expect(sendPush).toContain("MAX_USER_REQUESTS_PER_MINUTE");
    expect(sendPush).toContain("MAX_USER_REQUESTS_PER_DAY");
    expect(sendPush).toContain("push_delivery_attempts");
    expect(sendPush).toContain("return json(429");
    expect(pushRateMigration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(pushRateMigration).toContain("REVOKE ALL ON TABLE public.push_delivery_attempts FROM anon, authenticated");
  });
});
