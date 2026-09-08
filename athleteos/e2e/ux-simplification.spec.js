/* global document, window */
import { expect, test } from "@playwright/test";
import { installUxFixture, loginUx } from "./helpers/ux-fixture.js";

test.use({ serviceWorkers: "block" });

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === "passed") await page.screenshot({ path: testInfo.outputPath("verified.png"), animations: "disabled", caret: "hide" });
});

for (const path of ["/", "/alerts"]) {
  test(`calcul des alertes indisponible : lecture préservée sur ${path}`, async ({ page }) => {
    await installUxFixture(page);
    await page.route("**/rest/v1/rpc/evaluate_club_alert_rules", route => route.fulfill({
      status:500, contentType:"application/json", body:JSON.stringify({ message:"Évaluation temporairement indisponible" }),
    }));
    await loginUx(page, path);
    await expect(page.getByText(/Le calcul des nouvelles alertes est momentanément indisponible/)).toBeVisible();
    if (path === "/") {
      await page.getByRole("button", { name:"Planifier une séance", exact:true }).click();
      await expect(page.getByRole("dialog", { name:"Nouvelle séance" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name:"Centre d’action" })).toBeVisible();
    }
  });
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dialog = page.getByRole("dialog");
  if (await dialog.count() === 1) {
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  }
}

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    test("première connexion : un seul choix puis une invitation guidée", async ({ page }) => {
      const fixture = await installUxFixture(page, { empty: true, configured: false });
      await loginUx(page);
      const dialog = page.getByRole("dialog", { name: "Quels outils veux-tu utiliser ?" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("switch")).toHaveCount(0);
      await dialog.getByRole("button", { name: /^Essentiel/ }).click();
      await expect(dialog.getByRole("button", { name: "Continuer" })).toHaveCount(0);
      await noOverflow(page);
      await dialog.getByRole("button", { name: "Terminer" }).click();
      await expect(dialog).toBeHidden();
      expect(fixture.writes.find(item => item.resource === "configure_my_club_modules").body.p_enabled_module_keys).toEqual(["planning", "performances", "messaging"]);
      expect(fixture.writes.some(item => item.resource === "configure_athlete_modules")).toBe(false);
      await page.getByRole("button", { name: "Inviter les premiers athlètes" }).click();
      await expect(page.getByRole("dialog", { name: "Inviter un athlète" })).toBeVisible();
      await expect(page.getByLabel("Lien direct d’invitation")).toHaveValue(/invite=UX123456/);
      await noOverflow(page);
    });

    test("séance : date et athlète du contexte conservés, options et édition intactes", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/planning");
      await page.getByRole("radio", { name: "Sem.", exact: true }).click();
      await page.getByLabel("Filtrer par athlète").selectOption("10");
      await page.getByRole("button", { name: "Ajouter une séance le 09/09/2026", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Nouvelle séance" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Date *", { exact: true })).toHaveValue("2026-09-09");
      await expect(dialog.getByRole("button", { name: "Retirer Alice Martin" })).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.getByLabel("Consignes spécifiques")).toBeHidden();
      await dialog.getByLabel("Titre *").fill("Séance contextuelle");
      await dialog.locator("summary").filter({ hasText: "Plus d’options" }).click();
      await dialog.getByLabel("Consignes spécifiques").fill("Garder cette consigne");
      await dialog.locator("summary").filter({ hasText: "Plus d’options" }).click();
      await noOverflow(page);
      await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(dialog).toBeHidden();
      const created = fixture.writes.find(item => item.resource === "create_session_with_athletes");
      expect(created.body.p_session).toMatchObject({ sessionDate: "2026-09-09", instructions: "Garder cette consigne", recurrence: "none" });
      expect(created.body.p_athlete_ids).toEqual([10]);
      await page.getByText("Séance contextuelle", { exact: true }).first().click();
      await page.getByRole("button", { name: /Modifier/ }).first().click();
      const edit = page.getByRole("dialog", { name: "Modifier la séance" });
      await expect(edit.getByLabel("Date *", { exact: true })).toHaveValue("2026-09-09");
      await edit.getByLabel("Titre *").fill("Séance ajustée");
      await edit.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(edit).toBeHidden();
      expect(fixture.writes.find(item => item.resource === "update_session_with_athletes").body.p_session.instructions).toBe("Garder cette consigne");
      expect(fixture.writes.filter(item => item.resource === "athlete_notifications").flatMap(item => item.body).map(item => item.type)).toEqual(["new_session", "session_updated"]);
      expect(fixture.unexpectedWrites).toEqual([]);
      await noOverflow(page);
    });

    test("templates : bibliothèque filtrable et réutilisable sans débordement", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/planning");
      await page.getByRole("button", { name: "Nouvelle séance", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Nouvelle séance" });
      await dialog.locator("summary").filter({ hasText:"Modèles de séances" }).click();
      await expect(dialog.getByPlaceholder("Rechercher nom, contenu ou tag")).toBeVisible();
      await dialog.getByPlaceholder("Rechercher nom, contenu ou tag").fill("100 m");
      await dialog.getByText("Départs blocs", { exact:true }).click();
      await expect(dialog.getByLabel("Titre *", { exact:true })).toHaveValue("Accélération 30 m");
      await dialog.getByRole("button", { name:"Enregistrer ce brouillon" }).click();
      await expect(dialog.getByLabel("Portée du modèle")).toHaveValue("personal");
      await dialog.getByLabel("Nom du modèle").fill("Mon accélération");
      await dialog.getByRole("button", { name:"Enregistrer le modèle" }).click();
      await expect.poll(() => fixture.writes.filter(item => item.resource === "upsert_session_template").length).toBe(1);
      await noOverflow(page);
      expect(fixture.unexpectedWrites).toEqual([]);
    });

    test("wellness : configuration progressive et versionnée dans les outils", async ({ page }) => {
      const fixture = await installUxFixture(page, { keys:["planning","performances","messaging","wellness"] });
      await loginUx(page, "/");
      await page.getByRole("button", { name:/Ouvrir les réglages/ }).click();
      const dialog = page.getByRole("dialog", { name:"Réglages" });
      await dialog.getByRole("tab", { name:"Outils" }).click();
      await expect(dialog.getByRole("heading", { name:"Questionnaire du club" })).toBeVisible();
      const stressRow = dialog.getByText("Niveau de stress", { exact:true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
      await stressRow.locator("input[type=checkbox]").first().uncheck();
      await dialog.getByRole("button", { name:"Samedi" }).click();
      await dialog.getByText("Visibilité des réponses").click();
      await dialog.getByLabel("Qui peut consulter les nouvelles réponses ?").selectOption("head_coach");
      await dialog.getByRole("button", { name:"Activer cette configuration" }).click();
      await expect(dialog.getByText(/Questionnaire v2 activé/)).toBeVisible();
      const saved = fixture.writes.find(item => item.resource === "configure_wellness_questionnaire");
      expect(saved.body.p_questions.some(question => question.key === "stress")).toBe(false);
      expect(saved.body.p_active_days).not.toContain(6);
      expect(saved.body.p_response_visibility).toBe("head_coach");
      expect(fixture.unexpectedWrites).toEqual([]);
      await noOverflow(page);
    });

    test("alertes : seuils et destinataires configurables sur mobile et desktop", async ({ page }) => {
      const fixture = await installUxFixture(page, { keys:["planning","performances","messaging","wellness"] });
      await loginUx(page, "/");
      await page.getByRole("button", { name:/Ouvrir les réglages/ }).click();
      const dialog = page.getByRole("dialog", { name:"Réglages" });
      await dialog.getByRole("tab", { name:"Outils" }).click();
      await dialog.getByLabel("Activer Sommeil sous le seuil").check();
      await dialog.getByLabel("Seuil maximal").fill("1");
      await dialog.getByLabel("Population", { exact:true }).selectOption("Sprint");
      await dialog.getByLabel("Destinataires", { exact:true }).selectOption("head_coach");
      await noOverflow(page);
      await dialog.getByRole("button", { name:"Enregistrer les règles" }).click();
      await expect(dialog.getByText(/Règles d’alertes enregistrées/)).toBeVisible();
      await expect(dialog.getByText(/Règles d’alertes enregistrées/)).toBeInViewport();
      await expect(dialog.getByRole("heading", { name:"Réglages", exact:true })).toBeInViewport();
      await expect(dialog.getByRole("button", { name:"Fermer les réglages" })).toBeInViewport();
      const saved = fixture.writes.find(item => item.resource === "configure_club_alert_rules");
      expect(saved.body.p_rules.find(rule => rule.key === "sleep_low")).toMatchObject({
        enabled:true, parameters:{ threshold:1, consecutiveResponses:2 }, targetGroup:"Sprint", recipientScope:"head_coach",
      });
      expect(fixture.unexpectedWrites).toEqual([]);
      await noOverflow(page);
    });

    test("planning : semaine sans panneau parasite et duplication accessible", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/planning");
      await page.getByRole("radio", { name: "Sem.", exact: true }).click();
      await page.getByRole("button", { name: "Semaine suivante", exact: true }).click();
      await expect(page.getByRole("button", { name: "Ajouter une séance", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Ajouter au planning", exact: true }).click();
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: "Dupliquer la semaine", exact: true }).click();
      await expect.poll(() => fixture.writes.find(item => item.resource === "duplicate_week_transactional")).toBeTruthy();
      expect(fixture.writes.find(item => item.resource === "duplicate_week_transactional").body).toMatchObject({ p_source_monday: "2026-09-14", p_target_monday: "2026-09-21" });
      await noOverflow(page);
    });

    test("accueil : planifier ouvre directement le formulaire", async ({ page }) => {
      await installUxFixture(page);
      await loginUx(page);
      await page.getByRole("button", { name: "Planifier une séance", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Nouvelle séance" })).toBeVisible();
      await noOverflow(page);
    });

    test("configuration individuelle : outils immédiats et sélection collective disponible", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/athletes");
      await page.getByRole("button", { name: "Configurer les outils" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Personnaliser le suivi" });
      await expect(dialog.getByText("Ce que Alice voit dans AthleteOS.")).toBeVisible();
      await expect(dialog.getByRole("checkbox")).toHaveCount(0);
      await dialog.getByLabel("Messagerie : activé").click();
      await noOverflow(page);
      await dialog.getByRole("button", { name: "Appliquer" }).click();
      await expect(dialog).toBeHidden();
      expect(fixture.writes.find(item => item.resource === "configure_athlete_modules").body).toMatchObject({ p_athlete_ids: [10], p_enabled_module_keys: ["planning", "performances"] });
    });

    test("outils désactivés : aucune compétition ni analyse de charge dans le planning", async ({ page }) => {
      await installUxFixture(page, { keys: ["planning", "messaging"] });
      await loginUx(page, "/planning");
      await page.getByRole("button", { name: "Ajouter au planning", exact: true }).click();
      await expect(page.getByRole("button", { name: "Compétition", exact: true })).toHaveCount(0);
      const nav = viewport.width < 768 ? page.getByRole("navigation", { name: "Navigation coach", exact: true }) : page.getByRole("complementary", { name: "Navigation coach desktop" });
      await expect(nav.getByRole("button", { name: /Charge|Performances|Rapports|Alertes/ })).toHaveCount(0);
      if (viewport.width < 768) await expect(nav.getByRole("button", { name: "Plus", exact: true })).toHaveCount(0);
      await noOverflow(page);
    });

    test("inscription : les outils du club sont conservés sans configuration imposée", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/athletes");
      await page.getByRole("button", { name: "Inscrire un athlète", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Inscrire un athlète" });
      await expect(dialog.getByRole("switch")).toHaveCount(0);
      await dialog.getByPlaceholder("Ex: Nora Vandenberghe").fill("Nora Exemple");
      await dialog.getByRole("button", { name: "Inscrire l'athlète", exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(fixture.writes.find(item => item.resource === "configure_athlete_modules").body.p_enabled_module_keys).toEqual(["planning", "performances", "messaging"]);
      await noOverflow(page);
    });

    test("compétition : création possible au-dessus de la navigation mobile", async ({ page }) => {
      const fixture = await installUxFixture(page);
      await loginUx(page, "/planning");
      await page.getByRole("button", { name: "Ajouter au planning", exact: true }).click();
      await page.getByRole("button", { name: "Compétition", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Créer une compétition" });
      await dialog.getByLabel("Nom *", { exact: true }).fill("Meeting UX");
      await dialog.getByLabel("Date *", { exact: true }).fill("2026-09-12");
      await noOverflow(page);
      await dialog.getByRole("button", { name: "Créer", exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(fixture.writes.find(item => item.resource === "create_competition_with_athletes").body).toMatchObject({ p_name: "Meeting UX", p_date: "2026-09-12", p_athlete_entries: [] });
      expect(fixture.unexpectedWrites).toEqual([]);
    });

    test("performances vides : accès guidé aux athlètes", async ({ page }) => {
      await installUxFixture(page);
      await loginUx(page, "/performances");
      await page.getByRole("button", { name: "Choisir un athlète pour ajouter un record" }).click();
      await expect(page).toHaveURL(/\/athletes$/);
      await expect(page.getByRole("heading", { name: "Athlètes", exact: true })).toBeVisible();
      await noOverflow(page);
    });

    test("athlète : accueil essentiel et séance du jour accessibles", async ({ page }) => {
      await installUxFixture(page, { role: "athlete" });
      await loginUx(page);
      await expect(page.getByRole("heading", { name: "Aujourd’hui", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Voir ma séance", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByText("6 × 40 m", { exact: true })).toBeVisible();
      await noOverflow(page);
    });
  });
}
