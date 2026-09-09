import { MODULE_KEYS } from "../../src/domain/modules/moduleRegistry.js";

// Browser-only fixtures: all API calls are intercepted, including writes.
// No credentials, local database or production data are used.
export async function installUxFixture(page, { role = "head_coach", empty = false, configured = true, keys = ["planning", "performances", "messaging"], athleteGroups = ["Sprint","Sprint"] } = {}) {
  const writes = [];
  const unexpectedWrites = [];
  const authId = "11111111-1111-4111-8111-111111111111";
  const profile = { id: role === "athlete" ? 2 : 1, name: role === "athlete" ? "Alice Martin" : "Camille Coach", role, club_id: 1, auth_uid: authId };
  const athletes = empty ? [] : [
    { id: 10, name: "Alice Martin", user_id: 2, club_id: 1, group_name: athleteGroups[0], main_discipline: "100m", profile_data: {}, records: {} },
    { id: 11, name: "Léa Simon", user_id: 3, club_id: 1, group_name: athleteGroups[1], main_discipline: "100m", profile_data: {}, records: {} },
  ];
  const club = { id: 1, name: "Club UX", invite_code: "UX123456", modules_configured_at: configured ? "2026-09-01T12:00:00Z" : null };
  let moduleKeys = keys;
  let dashboardPreferences = {};
  const sessions = empty ? [] : [{ id: 20, club_id: 1, title: "Sprint du jour", session_date: "2026-09-07", day: "Lundi", week: 37, time: "18:00", category: "sprint", type: "Sprint", training_focus: "sprint_general", duration_minutes: 60, description: "6 × 40 m", instructions: "Récupération complète", lifecycle_status: "planned", created_by: 1, session_athletes: [{ session_id: 20, athlete_id: 10 }] }];
  const templates = empty ? [] : [{ id: 30, club_id: 1, name: "Départs blocs", title: "Accélération 30 m", category: "sprint", type: "Sprint", training_focus: "acceleration", duration_minutes: 45, description: "4 × 30 m", instructions: "Récupération complète", scope: "club", tags: ["100 m", "départs"], created_by: 1, session_template_documents: [] }];
  await page.clock.setFixedTime(new Date("2026-09-07T10:00:00Z"));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = value => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
    if (url.pathname.startsWith("/auth/v1/")) {
      const user = { id: authId, aud: "authenticated", role: "authenticated", email: "ux@example.invalid", app_metadata: {}, user_metadata: {} };
      const payload = Buffer.from(JSON.stringify({ sub: authId, exp: 4102444800, role: "authenticated" })).toString("base64url");
      return json(url.pathname.endsWith("/user") ? user : { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, token_type: "bearer", expires_in: 3600, refresh_token: "ux-fixture", user });
    }
    if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/functions/v1/")) {
      const resource = url.pathname.split("/").pop();
      if (request.method() !== "GET" && request.method() !== "HEAD") {
        const body = request.postDataJSON();
        writes.push({ resource, body });
        if (resource === "configure_my_club_modules") {
          moduleKeys = body.p_enabled_module_keys;
          club.modules_configured_at = "2026-09-07T10:00:00Z";
          return json({});
        }
        if (resource === "configure_athlete_modules") return json({});
        if (resource === "get_club_alert_rules") return json([]);
        if (resource === "configure_club_alert_rules") return json(body.p_rules);
        if (resource === "evaluate_club_alert_rules") return json({ ok:true, generated:0 });
        if (resource === "get_my_dashboard_preferences") return json(dashboardPreferences);
        if (resource === "get_coach_following") return json({ coaches:[{ id:profile.id, name:profile.name, role:profile.role, mode:"club", revision:0, groups:[], athleteIds:[] }], athletes:athletes.map(item => ({ id:item.id, name:item.name, group:item.group_name })) });
        if (resource === "configure_my_dashboard_preferences") { dashboardPreferences = body.p_preferences; return json(dashboardPreferences); }
        if (resource === "get_wellness_questionnaire") return json({ versionId:null, versionNumber:1, isDefault:true, questions:[{ key:"sleep", required:true },{ key:"energy", required:true },{ key:"soreness", required:true },{ key:"mood", required:true },{ key:"stress", required:true }], activeDays:[1,2,3,4,5,6,7], responseVisibility:"staff" });
        if (resource === "configure_wellness_questionnaire") return json({ versionId:4, versionNumber:2 });
        if (resource === "create_club_athlete") {
          const id = 10 + athletes.length;
          athletes.push({ id, club_id: 1, name: body.p_payload.name, profile_data: {}, records: {} });
          return json({ athleteId: id });
        }
        if (resource === "create_competition_with_athletes") return json({ competitionId: 50 });
        if (resource === "publish_session_document_distribution") return json({});
        if (resource === "create_session_with_athletes") {
          const form = body.p_session;
          const id = 20 + sessions.length;
          sessions.push({ id, club_id: 1, title: form.title, session_date: form.sessionDate, day: form.day, week: form.week, time: form.time, category: form.category, training_focus: form.trainingFocus, duration_minutes: form.durationMinutes, description: form.description, instructions: form.instructions, session_athletes: body.p_athlete_ids.map(athlete_id => ({ session_id: id, athlete_id })) });
          return json({ sessionId: id });
        }
        if (resource === "update_session_with_athletes") {
          const session = sessions.find(item => item.id === body.p_session_id);
          Object.assign(session, { title: body.p_session.title, instructions: body.p_session.instructions });
          return json({});
        }
        if (resource === "duplicate_week_transactional") return json({ duplicatedCount: sessions.length });
        if (resource === "upsert_session_template") {
          const id = body.p_template_id ?? 30 + templates.length;
          const existing = templates.find(item => item.id === id);
          const template = { id, club_id: 1, created_by: 1, scope: body.p_template.scope, tags: body.p_template.tags, name: body.p_template.name, title: body.p_template.title, category: body.p_template.category, type: body.p_template.type, training_focus: body.p_template.trainingFocus, duration_minutes: body.p_template.durationMinutes, description: body.p_template.description, instructions: body.p_template.instructions, session_template_documents: [] };
          if (existing) Object.assign(existing, template); else templates.unshift(template);
          return json({ templateId: id });
        }
        if (resource === "duplicate_session_template") return json({ templateId: 99 });
        if (resource === "delete_session_template") return json({ templateId: body.p_template_id, deleted: true });
        if (["notifications", "athlete_notifications", "alerts", "alert_read_states", "send-push", "push_subscriptions"].includes(resource)) return json([]);
        unexpectedWrites.push({ resource, body });
        return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: `Unimplemented test write: ${resource}` }) });
      }
      let rows = [];
      if (resource === "users") rows = url.searchParams.has("auth_uid") ? [profile] : [{ id: 1, name: "Camille Coach", role: "head_coach", club_id: 1 }, { id: 2, name: "Alice Martin", role: "athlete", club_id: 1 }, { id: 3, name: "Léa Simon", role: "athlete", club_id: 1 }];
      if (resource === "clubs") rows = [club];
      if (resource === "athletes") rows = url.searchParams.has("user_id") ? athletes.filter(item => `eq.${item.user_id}` === url.searchParams.get("user_id")) : athletes;
      if (resource === "club_modules") rows = MODULE_KEYS.map(module_key => ({ module_key, enabled: moduleKeys.includes(module_key), config: {} }));
      if (resource === "athlete_modules") rows = athletes.flatMap(athlete => MODULE_KEYS.map(module_key => ({ athlete_id: athlete.id, module_key, enabled: true, config: {} })));
      if (resource === "sessions") rows = sessions;
      if (resource === "session_athletes") rows = sessions.flatMap(session => session.session_athletes);
      if (resource === "session_templates") rows = templates;
      const single = request.headers().accept?.includes("vnd.pgrst.object");
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` }, body: JSON.stringify(single ? rows[0] ?? null : rows) });
    }
    // Only the app's local assets may use the network. Block fonts, telemetry,
    // remote storage and every other external request.
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    return route.abort();
  });
  await page.routeWebSocket("**/*", socket => socket.close());
  return { writes, unexpectedWrites };
}

export async function loginUx(page, route = "/") {
  await page.goto(route);
  await page.getByLabel("Adresse email").fill("ux@example.invalid");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Fixture-only-123!");
  await page.getByRole("button", { name: "Se connecter" }).click();
}
