import { describe, expect, it } from "vitest";
import { firstSupabaseError } from "./supabaseResults";

describe("resultats Supabase paralleles", () => {
  it("remonte la premiere erreur au lieu de la transformer en liste vide", () => {
    const expected = new Error("Lecture indisponible");
    expect(firstSupabaseError([{ data:[] }, { data:null, error:expected }, { error:new Error("Autre") }])).toBe(expected);
    expect(firstSupabaseError([{ data:[] }, { data:null, error:null }])).toBeNull();
  });
});
