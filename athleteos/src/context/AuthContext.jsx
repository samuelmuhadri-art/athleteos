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
  const [profile, setProfile] = useState(null);   // ligne table users
  const [loading, setLoading] = useState(true);   // vrai jusqu'à la 1ère résolution
  // true entre le moment où on clique le lien "mot de passe oublié" reçu par
  // email et le moment où un nouveau mot de passe est effectivement défini —
  // pendant ce laps de temps il ne faut PAS router vers le dashboard normal.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // ─── Charge le profil métier depuis la table `users` ─────────────────────────
  // Appelé à chaque changement de session (connexion, refresh, déconnexion).
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    try {
      // users.id est l'identifiant métier entier. Le lien avec Supabase Auth
      // passe exclusivement par users.auth_uid = auth.users.id.
      const { data, error } = await supabase
        .from("users")
     .select("id, name, role, club_id")
       .eq("auth_uid", authUser.id)
        .single();

      if (error) {
        console.error("AuthContext — profil introuvable :", error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("AuthContext — erreur inattendue :", err);
      setProfile(null);
    }
  }, []);

  // ─── Écoute les changements de session Supabase ───────────────────────────────
  useEffect(() => {
    // Vérifie la session existante au montage (page refresh, retour sur l'onglet).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      await loadProfile(authUser);
      setLoading(false);
    });

    // Puis écoute les événements suivants :
    // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        const authUser = session?.user ?? null;
        setUser(authUser);
        await loadProfile(authUser);
        // loading reste false après la 1ère résolution (géré dans getSession ci-dessus)
      }
    );

    // Nettoyage : on se désabonne quand AuthProvider est démonté
    return () => subscription.unsubscribe();
  }, [loadProfile]);

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
