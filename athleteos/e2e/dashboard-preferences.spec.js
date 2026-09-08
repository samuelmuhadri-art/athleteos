/* global document, window */
import { test, expect } from "@playwright/test";
import { installUxFixture, loginUx } from "./helpers/ux-fixture.js";
test.use({ serviceWorkers:"block" });

for (const width of [320,375,768,1440]) {
  test.describe(`${width}px dashboard`, () => {
    test.use({ viewport:{width,height:width === 320 ? 568 : 900} });
    test("préférences personnelles persistantes, ordre et groupe cohérents", async ({ page },testInfo) => {
      const fixture=await installUxFixture(page,{role:"coach",keys:["planning","performances","wellness","session_feedback"],athleteGroups:["Sprint","Sauts"]});
      await loginUx(page);
      await expect(page.getByRole("heading",{name:"Wellness du jour"})).toBeVisible();
      await page.getByRole("button",{name:"Personnaliser mon accueil",exact:true}).click();
      const dialog=page.getByRole("dialog",{name:"Personnaliser mon accueil"});
      await dialog.getByLabel("Synthèse wellness",{exact:true}).uncheck();
      await dialog.getByLabel("Monter Vue d’ensemble").click();
      await dialog.getByLabel("Monter Vue d’ensemble").click();
      await dialog.getByLabel("Groupe par défaut").selectOption("Sprint");
      await dialog.getByLabel("Période des feedbacks récents").selectOption("14");
      await expect(dialog.getByRole("button",{name:"Enregistrer",exact:true})).toBeInViewport();
      await dialog.getByRole("button",{name:"Enregistrer",exact:true}).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByLabel("Groupe affiché")).toHaveValue("Sprint");
      await expect(page.locator('[data-dashboard-block]').first()).toHaveAttribute("data-dashboard-block","overview");
      await expect(page.getByRole("heading",{name:"Wellness du jour"})).toHaveCount(0);
      await expect(page.locator('[data-dashboard-block="followup"]').getByText("Léa Simon",{exact:true})).toHaveCount(0);
      await page.reload();
      await expect(page.getByLabel("Groupe affiché")).toHaveValue("Sprint");
      await expect(page.locator('[data-dashboard-block]').first()).toHaveAttribute("data-dashboard-block","overview");
      await page.getByRole("button",{name:"Personnaliser mon accueil",exact:true}).click();
      await expect(dialog.getByLabel("Période des feedbacks récents")).toHaveValue("14");
      await dialog.getByRole("button",{name:"Rétablir les valeurs par défaut"}).click();
      await dialog.getByRole("button",{name:"Enregistrer",exact:true}).click();
      await expect(page.getByLabel("Groupe affiché")).toHaveValue("");
      await expect(page.locator('[data-dashboard-block]').first()).toHaveAttribute("data-dashboard-block","priorities");
      await expect(page.getByRole("heading",{name:"Wellness du jour"})).toBeVisible();
      expect(fixture.unexpectedWrites).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath("dashboard-verified.png"),fullPage:true});
    });
  });
}

test("modules désactivés et annulation : aucun outil réactivé ni préférence écrite",async ({page}) => {
  const fixture=await installUxFixture(page,{keys:["planning"]});
  await loginUx(page);
  await page.getByRole("button",{name:"Personnaliser mon accueil",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Vue d’ensemble",{exact:true}).uncheck();
  await dialog.getByRole("button",{name:"Annuler",exact:true}).click();
  await expect(page.locator('[data-dashboard-block]')).toHaveCount(1);
  await expect(page.locator('[data-dashboard-block]')).toHaveAttribute("data-dashboard-block","overview");
  expect(fixture.writes.some(item => item.resource === "configure_my_dashboard_preferences")).toBe(false);
});

test("échec de sauvegarde : brouillon conservé et accueil inchangé",async ({page}) => {
  await installUxFixture(page);
  await page.route("**/rest/v1/rpc/configure_my_dashboard_preferences",route => route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({message:"Sauvegarde indisponible"})}));
  await loginUx(page);
  await page.getByRole("button",{name:"Personnaliser mon accueil",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Vue d’ensemble",{exact:true}).uncheck();
  await dialog.getByRole("button",{name:"Enregistrer",exact:true}).click();
  await expect(dialog.getByRole("alert")).toHaveText("Sauvegarde indisponible");
  await expect(dialog.getByLabel("Vue d’ensemble",{exact:true})).not.toBeChecked();
  await dialog.getByRole("button",{name:"Annuler",exact:true}).click();
  await expect(page.locator('[data-dashboard-block="overview"]')).toBeVisible();
});

test("groupe supprimé et lecture indisponible : repli explicite sans bloquer l’accueil",async ({page}) => {
  await installUxFixture(page);
  await page.route("**/rest/v1/rpc/get_my_dashboard_preferences",route => route.fulfill({contentType:"application/json",body:JSON.stringify({defaultGroup:"Ancien groupe"})}));
  await loginUx(page);
  await expect(page.getByText("Le groupe mémorisé n’existe plus. Tous les groupes sont affichés.")).toBeVisible();
  await expect(page.getByLabel("Groupe affiché")).toHaveValue("");
  await page.route("**/rest/v1/rpc/get_my_dashboard_preferences",route => route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({message:"Indisponible"})}));
  await page.reload();
  await expect(page.getByText(/Tes préférences n’ont pas pu être chargées/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Planifier une séance",exact:true})).toBeVisible();
});
