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

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // objet supabase.auth.user
  const [profile, setProfile] = useState(null);   // ligne table users
  const [loading, setLoading] = useState(true);   // vrai jusqu'à la 1ère résolution

  // ─── Charge le profil métier depuis la table `users` ─────────────────────────
  // Appelé à chaque changement de session (connexion, refresh, déconnexion).
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    try {
      // On récupère la ligne `users` dont l'id correspond à auth.uid().
      // La colonne users.id DOIT être un UUID égal à auth.uid() — c'est le lien
      // entre Supabase Auth et ta table métier.
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
    await supabase.auth.signOut();
    // onAuthStateChange va déclencher setUser(null) + setProfile(null) automatiquement
  }, []);

  // ─── Valeur du contexte ───────────────────────────────────────────────────────
  const value = {
    user,
    profile,
    // clubId est le raccourci critique : remplace partout `.eq("club_id", 1)`
    clubId: profile?.club_id ?? null,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook consommateur ────────────────────────────────────────────────────────
// Usage dans n'importe quel module :
//   const { user, profile, clubId, signOut } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}