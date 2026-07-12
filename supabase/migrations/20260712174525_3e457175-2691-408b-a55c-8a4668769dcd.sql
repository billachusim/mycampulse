
-- Extend campoint_reason enum with ambassador-specific rewards
DO $$ BEGIN
  ALTER TYPE public.campoint_reason ADD VALUE IF NOT EXISTS 'ambassador_task_reward';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.campoint_reason ADD VALUE IF NOT EXISTS 'ambassador_bonus';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enums for ambassador domain
DO $$ BEGIN
  CREATE TYPE public.ambassador_tier AS ENUM ('ambassador','senior','regional_lead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ambassador_scope_type AS ENUM ('school','faculty','department','hostel','region');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ambassador_status AS ENUM ('active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ambassador_app_status AS ENUM ('pending','approved','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ambassador_task_status AS ENUM ('submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Updated-at helper (idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.touch_updated_at_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 1) Applications
CREATE TABLE IF NOT EXISTS public.ambassador_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type public.ambassador_scope_type NOT NULL DEFAULT 'school',
  scope_id uuid,
  region text,
  motivation text NOT NULL,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.ambassador_app_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_applications_one_pending
  ON public.ambassador_applications(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ambassador_applications_scope_idx
  ON public.ambassador_applications(scope_type, scope_id);

GRANT SELECT, INSERT, UPDATE ON public.ambassador_applications TO authenticated;
GRANT ALL ON public.ambassador_applications TO service_role;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own application" ON public.ambassador_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user creates own application" ON public.ambassador_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user withdraws own pending" ON public.ambassador_applications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage applications" ON public.ambassador_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ambassador_applications_touch
  BEFORE UPDATE ON public.ambassador_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 2) Ambassadors
CREATE TABLE IF NOT EXISTS public.ambassadors (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier public.ambassador_tier NOT NULL DEFAULT 'ambassador',
  scope_type public.ambassador_scope_type NOT NULL,
  scope_id uuid,
  region text,
  status public.ambassador_status NOT NULL DEFAULT 'active',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  suspend_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Enforce one PRIMARY ambassador per scope (tier='ambassador', active)
CREATE UNIQUE INDEX IF NOT EXISTS ambassadors_one_primary_per_scope
  ON public.ambassadors(scope_type, scope_id)
  WHERE status = 'active' AND tier = 'ambassador';
CREATE INDEX IF NOT EXISTS ambassadors_scope_idx ON public.ambassadors(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS ambassadors_tier_idx ON public.ambassadors(tier);

GRANT SELECT ON public.ambassadors TO authenticated;
GRANT ALL ON public.ambassadors TO service_role;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ambassadors" ON public.ambassadors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage ambassadors" ON public.ambassadors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ambassadors_touch BEFORE UPDATE ON public.ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- Helper: is user an active ambassador?
CREATE OR REPLACE FUNCTION public.is_active_ambassador(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = _user_id AND status = 'active')
$$;

-- 3) Campaign codes
CREATE TABLE IF NOT EXISTS public.ambassador_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(user_id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  landing_path text NOT NULL DEFAULT '/',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ambassador_campaigns_ambassador_idx
  ON public.ambassador_campaigns(ambassador_id);

GRANT SELECT, INSERT, UPDATE ON public.ambassador_campaigns TO authenticated;
GRANT ALL ON public.ambassador_campaigns TO service_role;
ALTER TABLE public.ambassador_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read campaigns" ON public.ambassador_campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ambassador manages own campaigns" ON public.ambassador_campaigns
  FOR ALL TO authenticated
  USING (auth.uid() = ambassador_id)
  WITH CHECK (auth.uid() = ambassador_id AND public.is_active_ambassador(auth.uid()));
CREATE POLICY "admins manage campaigns" ON public.ambassador_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ambassador_campaigns_touch BEFORE UPDATE ON public.ambassador_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 4) Tasks
CREATE TABLE IF NOT EXISTS public.ambassador_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ambassador_tasks TO authenticated;
GRANT ALL ON public.ambassador_tasks TO service_role;
ALTER TABLE public.ambassador_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassadors read tasks" ON public.ambassador_tasks
  FOR SELECT TO authenticated
  USING (public.is_active_ambassador(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage tasks" ON public.ambassador_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ambassador_tasks_touch BEFORE UPDATE ON public.ambassador_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 5) Task completions
CREATE TABLE IF NOT EXISTS public.ambassador_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.ambassador_tasks(id) ON DELETE CASCADE,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(user_id) ON DELETE CASCADE,
  status public.ambassador_task_status NOT NULL DEFAULT 'submitted',
  evidence_url text,
  notes text,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, ambassador_id)
);

GRANT SELECT, INSERT, UPDATE ON public.ambassador_task_completions TO authenticated;
GRANT ALL ON public.ambassador_task_completions TO service_role;
ALTER TABLE public.ambassador_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassador reads own completions" ON public.ambassador_task_completions
  FOR SELECT TO authenticated USING (auth.uid() = ambassador_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ambassador submits own completion" ON public.ambassador_task_completions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ambassador_id AND public.is_active_ambassador(auth.uid()));
CREATE POLICY "admins manage completions" ON public.ambassador_task_completions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ambassador_task_completions_touch BEFORE UPDATE ON public.ambassador_task_completions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 6) Announcements
CREATE TABLE IF NOT EXISTS public.ambassador_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all', -- 'all' | 'tier' | 'scope'
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ambassador_announcements TO authenticated;
GRANT ALL ON public.ambassador_announcements TO service_role;
ALTER TABLE public.ambassador_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassadors read announcements" ON public.ambassador_announcements
  FOR SELECT TO authenticated
  USING (public.is_active_ambassador(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage announcements" ON public.ambassador_announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ambassador_announcements_touch BEFORE UPDATE ON public.ambassador_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 7) Marketing assets
CREATE TABLE IF NOT EXISTS public.ambassador_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL, -- image|pdf|video|copy
  storage_path text,
  external_url text,
  body text,
  tier_min public.ambassador_tier NOT NULL DEFAULT 'ambassador',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ambassador_assets TO authenticated;
GRANT ALL ON public.ambassador_assets TO service_role;
ALTER TABLE public.ambassador_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassadors read assets" ON public.ambassador_assets
  FOR SELECT TO authenticated
  USING (public.is_active_ambassador(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage assets" ON public.ambassador_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ambassador_assets_touch BEFORE UPDATE ON public.ambassador_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 8) Attribution log
CREATE TABLE IF NOT EXISTS public.signup_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid REFERENCES auth.users(id),
  campaign_id uuid REFERENCES public.ambassador_campaigns(id),
  campaign_code text,
  school_id uuid REFERENCES public.schools(id),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_attributions_referrer_idx ON public.signup_attributions(referrer_id);
CREATE INDEX IF NOT EXISTS signup_attributions_campaign_idx ON public.signup_attributions(campaign_id);
CREATE INDEX IF NOT EXISTS signup_attributions_school_idx ON public.signup_attributions(school_id);

GRANT SELECT, INSERT ON public.signup_attributions TO authenticated;
GRANT ALL ON public.signup_attributions TO service_role;
ALTER TABLE public.signup_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own attribution" ON public.signup_attributions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = referrer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage attributions" ON public.signup_attributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
