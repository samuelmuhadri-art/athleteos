// @vitest-environment node
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
const source = stripTypeScriptTypes(readFileSync("supabase/functions/_shared/recentAuthentication.ts", "utf8").replace("export function", "function"));
const valid = runInNewContext(`${source}\nhasRecentPasswordAuthentication`, { atob });
const now=1800000000000;
const token = claims => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
describe("Authentification récente — après validation JWT Auth", () => {
  it("accepte le mot de passe récent et la limite exacte", () => {
    expect(valid(token({amr:[{method:"password",timestamp:now/1000}]}),now)).toBe(true);
    expect(valid(token({amr:[{method:"password",timestamp:now/1000-300}]}),now)).toBe(true);
  });
  it("un refresh iat récent ne rajeunit pas le mot de passe", () => {
    expect(valid(token({iat:now/1000,amr:[{method:"password",timestamp:now/1000-301}]}),now)).toBe(false);
  });
  it("refuse le jeton mal formé, sans preuve, futur ou avec un horodatage texte", () => {
    for (const value of ["bad",token({}),token({amr:[null]}),token({amr:[{method:"password",timestamp:String(now/1000)}]}),token({amr:[{method:"password",timestamp:now/1000+60}]}),token({amr:[{method:"otp",timestamp:now/1000}]})]) expect(valid(value,now)).toBe(false);
  });
});
