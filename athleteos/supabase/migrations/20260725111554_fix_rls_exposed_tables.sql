BEGIN;

-- 1) Tables that already have correct club-scoped policies — just turn RLS on.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_charge ENABLE ROW LEVEL SECURITY;

-- 2) athlete_notifications: drop the policy that always evaluates to TRUE
--    (it bypassed the correct club-scoped policy for every SELECT), then enable RLS.
--    "athlete_notifs" (club_id = get_my_club_id()) already covers legitimate access.
DROP POLICY IF EXISTS "athlete can read own notifications" ON public.athlete_notifications;
ALTER TABLE public.athlete_notifications ENABLE ROW LEVEL SECURITY;

-- 3) push_subscriptions and athlete_wellness: no policy existed at all — create one
--    matching the same convention used everywhere else in this DB, then enable RLS.
CREATE POLICY "push_subscriptions_club" ON public.push_subscriptions
  FOR ALL TO public
  USING (club_id = get_my_club_id());
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_wellness_club" ON public.athlete_wellness
  FOR ALL TO public
  USING (club_id = get_my_club_id());
ALTER TABLE public.athlete_wellness ENABLE ROW LEVEL SECURITY;

COMMIT;
