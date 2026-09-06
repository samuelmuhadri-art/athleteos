// ============================================================
// AthleteOS — src/context/AuthContext.jsx
//
// Fournit à toute l'app :
//   - user        : objet Supabase Auth (email, id, etc.)
//   - profile     : ligne de la table `users` (name, role, club_id, avatar)
//   - clubId      : raccourci vers profile.club_id (remplace la constante =1)
//   - loading     : true pendant la vérification initiale de session
//   - signIn(email, password) → { error }
//   - signOut()
//
// Pattern :
//   1. Au montage, on écoute onAuthStateChange (Supabase gère le refresh token).
//   2. Quand un user est connecté, on charge son profil depuis la table `users`.
//   3. Tous les modules lisent useAuth() au lieu d'un ID hardcodé.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { revokeCurrentPushSubscription } from "../utils/pushSubscriptions";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // objet supabase.auth.user
  const [profileState, setProfileState] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [profileAttempt, setProfileAttempt] = useState(0);
  // true entre le moment où on clique le lien "mot de passe oublié" reçu par
  // email et le moment où un nouveau mot de passe est effectivement défini —
  // pendant ce laps de temps il ne faut PAS router vers le dashboard normal.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // ─── Charge le profil métier depuis la table `users` ─────────────────────────
  // Appelé à chaque changement de session (connexion, refresh, déconnexion).
  const authUserId = user?.id;
  useEffect(() => {
    if (!authUserId) { setProfileState(null); return undefined; }
    let active = true;
    const controller = new AbortController();
    const fail = message => {
      if (active) setProfileState({ authId: authUserId, data: null, error: message });
    };
    const timeout = globalThis.setTimeout(() => {
      fail("Le chargement de ton club prend trop de temps. Vérifie ta connexion puis réessaie.");
      active = false;
      controller.abort();
    }, 12000);
    async function load() {
      try {
        // Hors du callback Auth : aucune requête n'attend le verrou de session
        // depuis un événement qui détient déjà ce verrou.
        const { data, error } = await supabase.from("users")
          .select("id, name, role, club_id").eq("auth_uid", authUserId)
          .maybeSingle().abortSignal(controller.signal);
        if (!active) return;
        if (error) {
          fail("Impossible de charger ton accès au club. Réessaie dans quelques instants.");
        } else if (!data?.club_id || !["head_coach", "coach", "athlete"].includes(data.role)) {
          fail("Ton compte est connecté, mais son accès au club est introuvable. Réessaie ; si le problème persiste, contacte le support. Ne recrée pas de compte pour le moment.");
        } else {
          setProfileState({ authId: authUserId, data, error: null });
        }
      } catch {
        fail("Impossible de charger ton accès au club. Vérifie ta connexion puis réessaie.");
      } finally { globalThis.clearTimeout(timeout); }
    }
    load();
    return () => { active = false; globalThis.clearTimeout(timeout); controller.abort(); };
  }, [authUserId, profileAttempt]);

  // ─── Écoute les changements de session Supabase ───────────────────────────────
  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const settle = session => {
      if (!active) return;
      setUser(session?.user ?? null);
      setSessionError(null);
      setSessionLoading(false);
    };
    const timeout = globalThis.setTimeout(() => {
      if (!active || eventReceived) return;
      setSessionError("La vérification de ta session prend trop de temps. Vérifie ta connexion puis réessaie.");
      setSessionLoading(false);
    }, 12000);
    // Ce callback reste synchrone : les lectures métier sont dans l'effet ci-dessus.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        eventReceived = true;
        globalThis.clearTimeout(timeout);
        if (_event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (_event === "SIGNED_OUT") { setPasswordRecovery(false); setProfileState(null); }
        if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(_event)) setProfileAttempt(value => value + 1);
        settle(session);
      }
    );
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return;
      globalThis.clearTimeout(timeout);
      if (error) throw error;
      settle(data?.session);
    }).catch(() => {
      if (!active || eventReceived) return;
      globalThis.clearTimeout(timeout);
      setSessionError("Impossible de vérifier ta session. Réessaie dans quelques instants.");
      setSessionLoading(false);
    });
    return () => { active = false; globalThis.clearTimeout(timeout); subscription.unsubscribe(); };
  }, [sessionAttempt]);

  const retryProfile = useCallback(() => {
    if (authUserId) { setProfileState(null); setProfileAttempt(value => value + 1); }
    else { setSessionError(null); setSessionLoading(true); setSessionAttempt(value => value + 1); }
  }, [authUserId]);
  // Jamais de profil de l'ancien compte pendant un changement de session.
  const currentProfile = profileState?.authId === authUserId ? profileState : null;
  const profile = currentProfile?.data ?? null;
  const loading = sessionLoading || Boolean(authUserId && !currentProfile);
  const profileError = sessionError ?? currentProfile?.error ?? null;

  // ─── Actions exposées ─────────────────────────────────────────────────────────

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const result = await revokeCurrentPushSubscription(supabase);
      if (result.databaseError) console.error("Suppression de l’abonnement push :", result.databaseError.message);
    } catch (error) {
      // La déconnexion reste possible même si le navigateur refuse la
      // révocation. L'endpoint sera aussi nettoyé par send-push sur 404/410.
      console.error("Révocation de l’abonnement push :", error);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // onAuthStateChange va déclencher setUser(null) + setProfile(null) automatiquement
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setPasswordRecovery(false);
    return { error };
  }, []);

  // ─── Valeur du contexte ───────────────────────────────────────────────────────
  const value = {
    user,
    profile,
    // clubId est le raccourci critique : remplace partout `.eq("club_id", 1)`
    clubId: profile?.club_id ?? null,
    loading,
    profileError,
    retryProfile,
    passwordRecovery,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
