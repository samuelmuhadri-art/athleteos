/* global document, window */
import { test, expect } from "@playwright/test";
import { installUxFixture, loginUx } from "./helpers/ux-fixture.js";
test.use({ serviceWorkers:"block" });
const respond=(route,value)=>route.fulfill({contentType:"application/json",body:JSON.stringify(value)});
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);

for(const width of [320,375,768,1440]) {
  test.describe(`${width}px mise en service`,()=>{
    test.use({viewport:{width,height:width===320?568:900}});
    test("pages légales lisibles sans connexion",async({page},testInfo)=>{
      await installUxFixture(page);
      await page.goto("/?legal=privacy");
      await expect(page.getByRole("heading",{name:"Confidentialité et données personnelles",exact:true})).toBeVisible();
      await expect(page.getByText(/Activer un module ou accepter les conditions générales ne vaut pas consentement/)).toBeVisible();
      await page.getByRole("link",{name:"Conditions d’utilisation",exact:true}).click();
      await expect(page.getByRole("heading",{name:"Conditions d’utilisation",exact:true})).toBeVisible();
      await noOverflow(page);
      await page.screenshot({path:testInfo.outputPath("legal.png"),fullPage:true});
    });
    test("ré-authentification accessible, annulation sans export puis réessai",async({page},testInfo)=>{
      await installUxFixture(page);
      let exportCalls=0;
      await page.route("**/functions/v1/admin-actions",route=>{
        const body=route.request().postDataJSON();
        if(body.action==="export_personal_data") {
          exportCalls++;
          return respond(route,exportCalls<=2?{success:false,code:"reauthentication_required"}:{success:true,export:{version:1}});
        }
        return respond(route,{success:true,invitations:[]});
      });
      await loginUx(page);
      await page.getByRole("button",{name:/Ouvrir les réglages/}).click();
      const settings=page.getByRole("dialog",{name:"Réglages",exact:true});
      await settings.getByRole("button",{name:"Exporter mes données"}).click();
      const security=page.getByRole("dialog",{name:"Confirme que c’est bien toi"});
      await expect(security).toBeVisible();
      await expect(security.getByLabel("Mot de passe actuel")).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(security.getByRole("button",{name:"Annuler",exact:true})).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(security.getByLabel("Mot de passe actuel")).toBeFocused();
      const bounds=await security.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
      expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(page.viewportSize().height+1);
      await page.screenshot({path:testInfo.outputPath("reauth-dialog.png"),fullPage:true});
      await security.getByRole("button",{name:"Annuler",exact:true}).click();
      await expect(security).toBeHidden();expect(exportCalls).toBe(1);
      await expect(settings).toBeVisible();
      await settings.getByRole("button",{name:"Exporter mes données"}).click();
      await security.getByLabel("Mot de passe actuel").fill("Fixture-only-123!");
      await security.getByRole("button",{name:"Confirmer et poursuivre"}).click();
      await expect(security).toBeHidden();
      await expect(settings.getByText("Ton export personnel a été téléchargé.")).toBeVisible();
      expect(exportCalls).toBe(3);await noOverflow(page);
      await page.screenshot({path:testInfo.outputPath("reauth-complete.png"),fullPage:true});
    });
    test("organisation facultative des coachs et sauvegarde persistante",async({page})=>{
      await installUxFixture(page);
      const data={coaches:[{id:9,name:"Coach Sauts",role:"coach",mode:"club",revision:0,groups:[],athleteIds:[]}],athletes:[{id:10,name:"Alice Martin",group:"Sprint"},{id:11,name:"Léa Simon",group:"Sauts"}]};
      await page.route("**/functions/v1/admin-actions",route=>respond(route,{success:true,invitations:[]}));
      await page.route("**/rest/v1/rpc/get_coach_following",route=>respond(route,data));
      await page.route("**/rest/v1/rpc/configure_coach_following",route=>{
        const body=route.request().postDataJSON();
        expect(body.p_coach_user_id).toBe(9);expect(body.p_expected_revision).toBe(0);
        data.coaches[0]={...data.coaches[0],mode:body.p_mode,groups:body.p_groups,athleteIds:body.p_athlete_ids,revision:1};
        return respond(route,data);
      });
      await loginUx(page);await page.getByRole("button",{name:/Ouvrir les réglages/}).click();
      const settings=page.getByRole("dialog",{name:"Réglages",exact:true});
      await settings.getByRole("tab",{name:"Club",exact:true}).click();
      await settings.getByText("Organisation des coachs (facultatif)",{exact:true}).click();
      await settings.getByLabel("Coach à organiser").selectOption("9");
      await settings.getByLabel("Choisir des groupes et athlètes").check();
      await settings.getByLabel("Sprint",{exact:true}).check();
      await settings.getByRole("button",{name:"Enregistrer les affectations"}).click();
      await expect(settings.getByText(/Affectations enregistrées/)).toBeVisible();
      await settings.getByRole("button",{name:"Recharger la liste"}).click();
      await settings.getByLabel("Coach à organiser").selectOption("9");
      await expect(settings.getByLabel("Sprint",{exact:true})).toBeChecked();
      await noOverflow(page);
    });
  });
}
