// @vitest-environment node
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Execute the actual Edge handler with its network/database dependencies injected.
const source = stripTypeScriptTypes(readFileSync("supabase/functions/session-reminders/index.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, ""));

function fixture({ ruleError = null } = {}) {
  const from = vi.fn(table => {
    const rows = table === "club_alert_rules" ? [{ club_id:1 }, { club_id:1 }]
      : table === "push_event_outbox" ? [{ actor_user_id:7 }] : [];
    const query = {
      select:() => query, eq:() => query, in:() => query, is:() => query,
      then:resolve => resolve({ data:rows, error:table === "club_alert_rules" ? ruleError : null }),
    };
    return query;
  });
  const rpc = vi.fn(async () => ({ data:{ ok:true }, error:null }));
  const createClient = vi.fn(() => ({ from, rpc }));
  const dispatch = vi.fn().mockResolvedValueOnce({ events:20 }).mockResolvedValue({ events:3 });
  const fetch = vi.fn();
  let handler;
  runInNewContext(source, {
    serve:callback => { handler = callback; }, createClient,
    localDateInTimeZone:() => "2026-09-08", dispatchTrustedPushEvents:dispatch,
    Deno:{ env:{ get:key => key === "SUPABASE_URL" ? "http://127.0.0.1:54321" : "test-service-key" } },
    Response, TextEncoder, fetch, console:{ error:vi.fn() },
  });
  const request=(body,authorization="Bearer test-service-key") => new Request("http://localhost/session-reminders", {
    method:"POST",headers:{ Authorization:authorization },body,
  });
  return { handler, request, from, rpc, dispatch, createClient, fetch };
}

describe("cron quotidien : exécution et simulation des alertes", () => {
  it("vérifie l’authentification et le corps avant toute requête métier", async () => {
    const f = fixture();
    expect((await f.handler(f.request("{}", "Bearer invalid"))).status).toBe(401);
    expect((await f.handler(f.request("{invalid"))).status).toBe(400);
    expect((await f.handler(f.request("x".repeat(2001)))).status).toBe(413);
    expect(f.createClient).not.toHaveBeenCalled();
  });

  it("transmet dry_run sans envoyer de Push même sans séance du jour", async () => {
    const f = fixture();
    const response = await f.handler(f.request('{"dry_run":true}'));
    expect(response.status).toBe(200);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("evaluate_club_alert_rules", {
      p_club_id:1,p_as_of:"2026-09-08",p_dry_run:true,
    });
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("traite plusieurs lots de Push sans dépendre des séances du jour", async () => {
    const f = fixture();
    expect((await f.handler(f.request("{}"))).status).toBe(200);
    expect(f.rpc).toHaveBeenCalledWith("evaluate_club_alert_rules", expect.objectContaining({ p_dry_run:false }));
    expect(f.dispatch).toHaveBeenCalledTimes(2);
  });

  it("remonte une panne de génération comme erreur serveur et non comme JSON invalide", async () => {
    const f = fixture({ ruleError:new Error("database unavailable") });
    const response = await f.handler(f.request("{}"));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("session_reminders_failed");
    expect(f.dispatch).not.toHaveBeenCalled();
  });
});
