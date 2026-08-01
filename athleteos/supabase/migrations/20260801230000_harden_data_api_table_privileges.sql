BEGIN;

-- RLS ne s'applique pas à TRUNCATE. Les rôles de la Data API n'ont pas
-- non plus à créer des triggers ni des contraintes de référence. Les
-- droits DML utiles à authenticated restent inchangés et toujours filtrés
-- par les policies.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Aucun parcours anonyme n'insère directement dans une table publique :
-- signup passe par une Edge Function et service_role. Les séquences n'ont
-- donc pas à être consommables par anon.
REVOKE USAGE
  ON ALL SEQUENCES IN SCHEMA public
  FROM anon;

-- Conserver le même principe pour les prochaines migrations applicatives.
-- Les objets du schéma public versionné ici appartiennent à postgres ; les
-- defaults du rôle système supabase_admin sont gérés par la plateforme et ne
-- sont volontairement pas modifiés.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE ON SEQUENCES FROM anon;

COMMIT;
