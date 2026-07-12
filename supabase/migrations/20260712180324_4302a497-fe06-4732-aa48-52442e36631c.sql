
-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_kind text,
  target_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can view audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log (actor_id, created_at DESC);

-- Bootstrap owner helper (only works while no owner exists yet)
CREATE OR REPLACE FUNCTION public.bootstrap_owner(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Owner already exists';
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user with that email';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _uid;
END;
$$;

-- Restrict bootstrap function to authenticated callers
REVOKE ALL ON FUNCTION public.bootstrap_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner(text) TO authenticated, service_role;

-- Lean list indexes
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS comments_created_idx ON public.comments (created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_items_created_idx ON public.marketplace_items (created_at DESC);
CREATE INDEX IF NOT EXISTS events_created_idx ON public.events (created_at DESC);
CREATE INDEX IF NOT EXISTS campoints_ledger_created_idx ON public.campoints_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS campoints_ledger_user_created_idx ON public.campoints_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_status_created_idx ON public.redemptions (status, created_at DESC);
