BEGIN;

-- ============================================================
-- Tâche 5 — reproductibilité complète depuis zéro : compléments au socle
--
-- En comparant systématiquement le socle de la tâche 7
-- (20260720000000) à l'inventaire réel de la base distante (index,
-- triggers, event triggers — via `supabase db query --linked`, lecture
-- seule), deux écarts trouvés : des index de performance jamais
-- versionnés, et l'event trigger `ensure_rls` (qui appelle
-- `rls_auto_enable()`, déjà recréée dans le socle, mais jamais
-- enregistrée comme trigger). Aucun des deux n'empêchait les tests RLS
-- de passer (d'où l'écart non détecté à la tâche 7), mais leur absence
-- viole la Definition of Done de la tâche 5 : "le schéma généré
-- correspond aux besoins du code" et "recréés de façon déterministe".
-- ============================================================

-- Index de performance manquants du socle (confirmés un par un contre
-- la base réelle via pg_indexes — pas de clé primaire/unique manquante,
-- celles-ci sont déjà couvertes par les contraintes du socle).
CREATE INDEX IF NOT EXISTS athlete_notifications_athlete_id_is_read_idx
  ON public.athlete_notifications (athlete_id, is_read);
CREATE INDEX IF NOT EXISTS athlete_notifications_club_id_created_at_idx
  ON public.athlete_notifications (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS athlete_performances_athlete_id_discipline_idx
  ON public.athlete_performances (athlete_id, discipline);
CREATE INDEX IF NOT EXISTS athlete_performances_club_id_idx
  ON public.athlete_performances (club_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_athlete
  ON public.push_subscriptions (athlete_id);

-- Event trigger réel en production : chaque nouvelle table créée dans
-- public reçoit automatiquement RLS activée, sans y penser à chaque
-- migration. Absent du socle (seule la fonction rls_auto_enable() y
-- était) — sans lui, une future table créée par un développeur qui
-- oublierait le ENABLE ROW LEVEL SECURITY resterait ouverte en local
-- alors qu'elle serait protégée en production (comportement différent,
-- contraire à l'objectif "reproductible depuis zéro" de cette tâche).
-- Filtre WHEN confirmé identique à la production (pg_event_trigger.evttags).
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

COMMIT;
