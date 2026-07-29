import { describe, expect, it, vi } from "vitest";
import { loadClubBranding } from "./useClubBranding";

function clubQuery(result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue(result) })),
    })),
  };
}

describe("loadClubBranding", () => {
  it("charge les champs premium et signe les images privées", async () => {
    const from = vi.fn(() => clubQuery({
      data: {
        name: "AC Namur",
        invite_code: "A1B2C3D4",
        invite_code_created_at: "2026-07-20T10:00:00Z",
        invite_code_use_count: 3,
        invite_code_last_used_at: "2026-07-28T10:00:00Z",
        invite_code_expires_at: null,
        logo_path: "7/logo.webp",
        cover_path: "7/cover.webp",
        accent_color: "#378ADD",
      },
      error: null,
    }));
    const createSignedUrl = vi.fn((path) => Promise.resolve({ data: { signedUrl: `signed:${path}` }, error: null }));
    const client = { from, storage: { from: vi.fn(() => ({ createSignedUrl })) } };

    await expect(loadClubBranding(client, 7)).resolves.toMatchObject({
      name: "AC Namur",
      logoUrl: "signed:7/logo.webp",
      coverUrl: "signed:7/cover.webp",
      accentColor: "#378ADD",
      inviteStatus: expect.objectContaining({ active: true, useCount: 3 }),
    });
  });

  it("reste compatible avant la migration des champs de marque", async () => {
    const first = clubQuery({ data: null, error: { code: "42703" } });
    const second = clubQuery({ data: { name: "Club existant", invite_code: "ABCDEFGH" }, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const client = { from, storage: { from: vi.fn() } };

    await expect(loadClubBranding(client, 2)).resolves.toMatchObject({
      name: "Club existant",
      inviteCode: "ABCDEFGH",
      logoPath: null,
      accentColor: "#1D9E75",
    });
  });
});
