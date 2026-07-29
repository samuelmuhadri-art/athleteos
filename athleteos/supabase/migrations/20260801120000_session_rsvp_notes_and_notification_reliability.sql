-- Message facultatif joint à la réponse de présence d'un athlète.
alter table public.session_athletes
  add column if not exists rsvp_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_athletes_rsvp_note_length'
  ) then
    alter table public.session_athletes
      add constraint session_athletes_rsvp_note_length
      check (rsvp_note is null or char_length(rsvp_note) <= 500);
  end if;
end $$;

-- Une alerte coach peut maintenant être reliée à une séance. Cela permet de
-- mettre à jour une réponse modifiée au lieu d'empiler des doublons.
alter table public.alerts
  add column if not exists session_id integer references public.sessions(id) on delete cascade;

create index if not exists alerts_club_session_type_idx
  on public.alerts (club_id, session_id, type, created_at desc);

-- Les compteurs et bandeaux ouverts dans l'application écoutent ces tables.
-- L'ajout est idempotent afin de fonctionner aussi si Realtime a déjà été
-- activé manuellement depuis le dashboard Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
    ) then
      alter publication supabase_realtime add table public.alerts;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'athlete_notifications'
    ) then
      alter publication supabase_realtime add table public.athlete_notifications;
    end if;
  end if;
end $$;
