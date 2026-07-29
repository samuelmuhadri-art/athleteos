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
