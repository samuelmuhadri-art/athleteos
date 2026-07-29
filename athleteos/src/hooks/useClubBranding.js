import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { DEFAULT_CLUB_ACCENT, normalizeClubAccent } from "../utils/clubBranding";

const TRACKED_CLUB_SELECT = "name, invite_code, invite_code_created_at, invite_code_use_count, invite_code_last_used_at, invite_code_expires_at, logo_path, cover_path, accent_color";
const FULL_CLUB_SELECT = "name, invite_code, logo_path, cover_path, accent_color";
const LEGACY_CLUB_SELECT = "name, invite_code";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const EMPTY_CLUB_BRAND = Object.freeze({
  name: "",
  inviteCode: null,
  logoPath: null,
  coverPath: null,
  logoUrl: null,
  coverUrl: null,
  accentColor: DEFAULT_CLUB_ACCENT,
  inviteStatus: null,
});

async function resolveAssetUrl(client, path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await client.storage
    .from("club-branding")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function loadClubBranding(client, clubId) {
  if (!clubId) return EMPTY_CLUB_BRAND;

  let { data, error } = await client
    .from("clubs")
    .select(TRACKED_CLUB_SELECT)
    .eq("id", clubId)
    .single();

  // Compatibilité pendant le déploiement : on garde d'abord toute l'identité
  // visuelle si seuls les champs de suivi d'invitation ne sont pas encore là.
  if (error) {
    const brandingResult = await client
      .from("clubs")
      .select(FULL_CLUB_SELECT)
      .eq("id", clubId)
      .single();
    data = brandingResult.data;
    error = brandingResult.error;
  }
  if (error) {
    const legacyResult = await client
      .from("clubs")
      .select(LEGACY_CLUB_SELECT)
      .eq("id", clubId)
      .single();
    if (legacyResult.error) throw legacyResult.error;
    data = legacyResult.data;
  }

  const [logoUrl, coverUrl] = await Promise.all([
    resolveAssetUrl(client, data?.logo_path),
    resolveAssetUrl(client, data?.cover_path),
  ]);

  return {
    name: data?.name ?? "",
    inviteCode: data?.invite_code ?? null,
    logoPath: data?.logo_path ?? null,
    coverPath: data?.cover_path ?? null,
    logoUrl,
    coverUrl,
    accentColor: normalizeClubAccent(data?.accent_color),
    inviteStatus: data?.invite_code ? {
      active: !data?.invite_code_expires_at || new Date(data.invite_code_expires_at) > new Date(),
      createdAt: data?.invite_code_created_at ?? null,
      useCount: data?.invite_code_use_count ?? 0,
      lastUsedAt: data?.invite_code_last_used_at ?? null,
      expiresAt: data?.invite_code_expires_at ?? null,
    } : null,
  };
}

export function useClubBranding(clubId) {
  const [club, setClub] = useState(EMPTY_CLUB_BRAND);
  const [loading, setLoading] = useState(Boolean(clubId));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!clubId) {
      setClub(EMPTY_CLUB_BRAND);
      setLoading(false);
      return EMPTY_CLUB_BRAND;
    }
    setLoading(true);
    setError(null);
    try {
      const nextClub = await loadClubBranding(supabase, clubId);
      setClub(nextClub);
      return nextClub;
    } catch (loadError) {
      setError(loadError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { club, loading, error, refresh };
}
