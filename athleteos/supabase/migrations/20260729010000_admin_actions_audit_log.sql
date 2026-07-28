BEGIN;

-- ============================================================
-- Tâche 4 — journal d'audit pour admin-actions
--
-- admin-actions/index.ts (renommage club, rotation code invitation,
-- suppression de membre, changement de rôle) n'écrivait jusqu'ici aucune
-- trace : impossible de savoir qui a fait quoi, quand, ni de distinguer
-- une tentative refusée d'une action réussie. Sert aussi de registre
-- pour les clés d'idempotence (voir index unique plus bas) — un rejeu
-- de la même requête avec la même clé ne déclenche pas une seconde fois
-- l'effet, sans bloquer un nouvel essai après une erreur.
-- ============================================================

CREATE TABLE public.audit_logs (
  id              bigserial PRIMARY KEY,
  actor_user_id   integer REFERENCES public.users(id) ON DELETE SET NULL,
  actor_club_id   integer REFERENCES public.clubs(id) ON DELETE SET NULL,
  action          text NOT NULL,
  target_user_id  integer REFERENCES public.users(id) ON DELETE SET NULL,
  target_club_id  integer REFERENCES public.clubs(id) ON DELETE SET NULL,
  payload         jsonb,
  result          text NOT NULL CHECK (result IN ('success', 'denied', 'error')),
  error_message   text,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Au plus UNE ligne "success" par (clé d'idempotence, action) : une
-- tentative refusée ou en erreur peut être rejouée (retry légitime),
-- mais un succès ne peut jamais être exécuté deux fois avec la même clé.
CREATE UNIQUE INDEX audit_logs_idempotency_success_idx
  ON public.audit_logs (idempotency_key, action)
  WHERE idempotency_key IS NOT NULL AND result = 'success';

CREATE INDEX audit_logs_actor_club_id_created_at_idx ON public.audit_logs (actor_club_id, created_at DESC);
CREATE INDEX audit_logs_idempotency_key_idx ON public.audit_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Lecture réservée au head coach de son propre club — un coach ou un
-- athlète n'a pas à voir qui a fait quoi (et surtout pas ce qui se passe
-- dans un autre club). Écriture : uniquement service_role (admin-actions),
-- aucune policy d'écriture cliente.
CREATE POLICY "audit_logs_head_coach_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (actor_club_id = get_my_club_id() AND get_my_role() = 'head_coach');

REVOKE ALL ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;

COMMIT;
