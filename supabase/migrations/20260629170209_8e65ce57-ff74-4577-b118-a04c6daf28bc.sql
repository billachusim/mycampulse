
DO $$ BEGIN
  CREATE TYPE public.campoint_reason AS ENUM (
    'daily_checkin','streak_bonus','post','comment','like_received','comment_received',
    'referral_qualified','referral_first_post','share_click','profile_complete','quest',
    'redemption_debit','redemption_refund','admin_adjust'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_kind AS ENUM ('airtime','data','cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_status AS ENUM ('pending','approved','paid','failed','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.profiles
SET referral_code = upper(substr(md5(id::text || random()::text), 1, 7))
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS public.campoints_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason public.campoint_reason NOT NULL,
  ref_type text,
  ref_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campoints_ledger_user_idx ON public.campoints_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campoints_ledger_user_reason_idx
  ON public.campoints_ledger(user_id, reason, created_at DESC);

GRANT SELECT ON public.campoints_ledger TO authenticated;
GRANT ALL ON public.campoints_ledger TO service_role;
ALTER TABLE public.campoints_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger" ON public.campoints_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all ledger" ON public.campoints_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.campoints_balances (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campoints_balances TO authenticated;
GRANT ALL ON public.campoints_balances TO service_role;
ALTER TABLE public.campoints_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own balance" ON public.campoints_balances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all balances" ON public.campoints_balances
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_ledger_to_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.campoints_balances(user_id, balance, lifetime_earned, updated_at)
  VALUES (NEW.user_id, NEW.delta, GREATEST(NEW.delta, 0), now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.campoints_balances.balance + NEW.delta,
        lifetime_earned = public.campoints_balances.lifetime_earned + GREATEST(NEW.delta, 0),
        updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS campoints_ledger_balance ON public.campoints_ledger;
CREATE TRIGGER campoints_ledger_balance AFTER INSERT ON public.campoints_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_ledger_to_balance();

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  streak integer NOT NULL DEFAULT 1,
  awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own check-ins" ON public.daily_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.share_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sharer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, sharer_id)
);
GRANT SELECT ON public.share_clicks TO authenticated;
GRANT ALL ON public.share_clicks TO service_role;
ALTER TABLE public.share_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own shares" ON public.share_clicks
  FOR SELECT TO authenticated USING (sharer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.redemption_kind NOT NULL,
  amount_points integer NOT NULL CHECK (amount_points > 0),
  amount_naira integer NOT NULL CHECK (amount_naira > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  provider_ref text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS redemptions_user_idx ON public.redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_status_idx ON public.redemptions(status, created_at DESC);

GRANT SELECT, INSERT ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update redemptions" ON public.redemptions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.touch_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS redemptions_touch ON public.redemptions;
CREATE TRIGGER redemptions_touch BEFORE UPDATE ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_redemption();

CREATE OR REPLACE FUNCTION public.award_campoints(
  _user uuid,
  _reason public.campoint_reason,
  _delta integer,
  _ref_type text DEFAULT NULL,
  _ref_id uuid DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today_count integer;
  _cap integer;
  _today_start timestamptz;
BEGIN
  IF _user IS NULL OR _delta = 0 THEN RETURN 0; END IF;

  IF _delta > 0 THEN
    _cap := CASE _reason
      WHEN 'post' THEN 5
      WHEN 'comment' THEN 20
      WHEN 'like_received' THEN 50
      WHEN 'comment_received' THEN 30
      WHEN 'share_click' THEN 10
      WHEN 'daily_checkin' THEN 1
      ELSE NULL
    END;
    IF _cap IS NOT NULL THEN
      _today_start := ((now() AT TIME ZONE 'Africa/Lagos')::date) AT TIME ZONE 'Africa/Lagos';
      SELECT COUNT(*) INTO _today_count
      FROM public.campoints_ledger
      WHERE user_id = _user AND reason = _reason AND created_at >= _today_start;
      IF _today_count >= _cap THEN RETURN 0; END IF;
    END IF;
  END IF;

  INSERT INTO public.campoints_ledger(user_id, delta, reason, ref_type, ref_id, meta)
  VALUES (_user, _delta, _reason, _ref_type, _ref_id, COALESCE(_meta,'{}'::jsonb));
  RETURN _delta;
END $$;

CREATE OR REPLACE FUNCTION public.award_for_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_campoints(NEW.author_id, 'post'::public.campoint_reason, 10, 'post', NEW.id);
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.author_id AND p.referred_by IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.campoints_ledger l WHERE l.reason = 'referral_first_post' AND l.meta->>'referred_user' = NEW.author_id::text) THEN
    PERFORM public.award_campoints(
      (SELECT referred_by FROM public.profiles WHERE id = NEW.author_id),
      'referral_first_post', 50, 'post', NEW.id,
      jsonb_build_object('referred_user', NEW.author_id)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_award ON public.posts;
CREATE TRIGGER posts_award AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.award_for_post();

CREATE OR REPLACE FUNCTION public.award_for_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  PERFORM public.award_campoints(NEW.author_id, 'comment', 2, 'comment', NEW.id);
  SELECT author_id INTO _author FROM public.posts WHERE id = NEW.post_id;
  IF _author IS NOT NULL AND _author <> NEW.author_id THEN
    PERFORM public.award_campoints(_author, 'comment_received', 3, 'comment', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS comments_award ON public.comments;
CREATE TRIGGER comments_award AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.award_for_comment();

CREATE OR REPLACE FUNCTION public.award_for_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  SELECT author_id INTO _author FROM public.posts WHERE id = NEW.post_id;
  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    PERFORM public.award_campoints(_author, 'like_received', 1, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS likes_award ON public.likes;
CREATE TRIGGER likes_award AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.award_for_like();

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || random()::text), 1, 7));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_referral_code ON public.profiles;
CREATE TRIGGER profiles_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();
