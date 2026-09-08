import { describe, expect, it } from "vitest";
import { canManageSessionTemplate, filterSessionTemplates, mapSessionTemplate, nextTemplateCopyName, templatePayload } from "./sessionTemplateLibrary";

const templates = [
  { id:1, name:"Départs blocs", title:"Accélération", category:"sprint", scope:"personal", tags:["100 m"] },
  { id:2, name:"Technique haies", title:"Franchissements", category:"haies", scope:"club", tags:["rythme"] },
];

describe("bibliothèque de modèles de séance", () => {
  it("recherche dans le nom, le contenu et les tags puis combine les filtres", () => {
    expect(filterSessionTemplates(templates, { search:"100 M" }).map(item => item.id)).toEqual([1]);
    expect(filterSessionTemplates(templates, { category:"haies", scope:"club" }).map(item => item.id)).toEqual([2]);
  });

  it("réserve un modèle personnel à son auteur et un modèle club au head coach ou à son auteur", () => {
    expect(canManageSessionTemplate({ scope:"personal", created_by:4 }, 4, false)).toBe(true);
    expect(canManageSessionTemplate({ scope:"personal", created_by:4 }, 7, true)).toBe(false);
    expect(canManageSessionTemplate({ scope:"club", created_by:4 }, 7, true)).toBe(true);
  });

  it("normalise les documents et le payload sans inventer de nouveau modèle métier", () => {
    expect(mapSessionTemplate({ scope:null, tags:null, session_template_documents:[{ documents:{ id:8 } }] })).toMatchObject({ scope:"personal", tags:[], documents:[{ id:8 }] });
    expect(templatePayload({ name:"  Sprint  ", title:" Bloc ", durationMinutes:"45", tags:"vite, départ, vite", scope:"club" })).toMatchObject({ name:"Sprint", title:"Bloc", durationMinutes:45, tags:["vite", "départ", "vite"], scope:"club" });
  });

  it("produit un nom de copie personnel disponible", () => {
    expect(nextTemplateCopyName(templates[0], [
      ...templates,
      { name:"Départs blocs — copie", scope:"personal" },
      { name:"Départs blocs — copie 2", scope:"personal" },
    ])).toBe("Départs blocs — copie 3");
  });
});
