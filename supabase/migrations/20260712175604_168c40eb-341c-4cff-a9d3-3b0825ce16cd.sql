
-- 1) Add school_id anchor columns
ALTER TABLE public.ambassadors ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.ambassador_applications ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
CREATE INDEX IF NOT EXISTS ambassadors_school_idx ON public.ambassadors(school_id);
CREATE INDEX IF NOT EXISTS ambassador_applications_school_idx ON public.ambassador_applications(school_id);

-- Backfill school_id for existing school-scoped rows
UPDATE public.ambassadors SET school_id = scope_id
  WHERE school_id IS NULL AND scope_type = 'school' AND scope_id IS NOT NULL;
UPDATE public.ambassador_applications SET school_id = scope_id
  WHERE school_id IS NULL AND scope_type = 'school' AND scope_id IS NOT NULL;

-- 2) Helper: resolve the school for any ambassador scope
CREATE OR REPLACE FUNCTION public.resolve_school_id(
  _scope_type public.ambassador_scope_type,
  _scope_id uuid
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid;
BEGIN
  IF _scope_type = 'school' THEN
    RETURN _scope_id;
  ELSIF _scope_type = 'faculty' THEN
    SELECT school_id INTO _sid FROM public.faculties WHERE id = _scope_id;
    RETURN _sid;
  ELSIF _scope_type = 'department' THEN
    SELECT f.school_id INTO _sid FROM public.departments d
      JOIN public.faculties f ON f.id = d.faculty_id
      WHERE d.id = _scope_id;
    RETURN _sid;
  END IF;
  RETURN NULL;
END $$;

-- 3) Helper: is _user the active campus ambassador for _school_id?
CREATE OR REPLACE FUNCTION public.is_campus_ambassador_of(
  _user uuid,
  _school_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambassadors
    WHERE user_id = _user
      AND status = 'active'
      AND tier = 'ambassador'
      AND scope_type = 'school'
      AND scope_id = _school_id
  )
$$;

-- 4) Invitations table
CREATE TABLE IF NOT EXISTS public.ambassador_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invitee_email text,
  invitee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope_type public.ambassador_scope_type NOT NULL,
  scope_id uuid,
  region text,
  message text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scope_type IN ('faculty','department','hostel'))
);
CREATE INDEX IF NOT EXISTS ambassador_invitations_school_idx ON public.ambassador_invitations(school_id);
CREATE INDEX IF NOT EXISTS ambassador_invitations_inviter_idx ON public.ambassador_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS ambassador_invitations_invitee_idx ON public.ambassador_invitations(invitee_user_id);
CREATE INDEX IF NOT EXISTS ambassador_invitations_email_idx ON public.ambassador_invitations(lower(invitee_email));

GRANT SELECT, INSERT, UPDATE ON public.ambassador_invitations TO authenticated;
GRANT ALL ON public.ambassador_invitations TO service_role;
ALTER TABLE public.ambassador_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inviter reads own invitations" ON public.ambassador_invitations
  FOR SELECT TO authenticated USING (auth.uid() = inviter_id);
CREATE POLICY "invitee reads own invitations" ON public.ambassador_invitations
  FOR SELECT TO authenticated USING (auth.uid() = invitee_user_id);
CREATE POLICY "campus ambassador creates invitations" ON public.ambassador_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  );
CREATE POLICY "inviter revokes own invitations" ON public.ambassador_invitations
  FOR UPDATE TO authenticated
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "admins manage invitations" ON public.ambassador_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ambassador_invitations_touch
  BEFORE UPDATE ON public.ambassador_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 5) Extend RLS on ambassador_applications: campus ambassador review path
CREATE POLICY "campus ambassador reads sub applications" ON public.ambassador_applications
  FOR SELECT TO authenticated
  USING (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  );
CREATE POLICY "campus ambassador reviews sub applications" ON public.ambassador_applications
  FOR UPDATE TO authenticated
  USING (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  )
  WITH CHECK (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  );

-- 6) Extend RLS on ambassadors: campus ambassador manages sub-ambassadors
CREATE POLICY "campus ambassador reads sub ambassadors" ON public.ambassadors
  FOR SELECT TO authenticated
  USING (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  );
CREATE POLICY "campus ambassador inserts sub ambassadors" ON public.ambassadors
  FOR INSERT TO authenticated
  WITH CHECK (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
    AND tier IN ('ambassador','senior')
  );
CREATE POLICY "campus ambassador updates sub ambassadors" ON public.ambassadors
  FOR UPDATE TO authenticated
  USING (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
  )
  WITH CHECK (
    scope_type IN ('faculty','department','hostel')
    AND school_id IS NOT NULL
    AND public.is_campus_ambassador_of(auth.uid(), school_id)
    AND tier IN ('ambassador','senior')
  );

-- 7) Extend RLS on ambassador_task_completions: campus ambassador reviews sub completions
CREATE POLICY "campus ambassador reads sub completions" ON public.ambassador_task_completions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors a
      WHERE a.user_id = ambassador_task_completions.ambassador_id
        AND a.scope_type IN ('faculty','department','hostel')
        AND a.school_id IS NOT NULL
        AND public.is_campus_ambassador_of(auth.uid(), a.school_id)
    )
  );
CREATE POLICY "campus ambassador reviews sub completions" ON public.ambassador_task_completions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors a
      WHERE a.user_id = ambassador_task_completions.ambassador_id
        AND a.scope_type IN ('faculty','department','hostel')
        AND a.school_id IS NOT NULL
        AND public.is_campus_ambassador_of(auth.uid(), a.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ambassadors a
      WHERE a.user_id = ambassador_task_completions.ambassador_id
        AND a.scope_type IN ('faculty','department','hostel')
        AND a.school_id IS NOT NULL
        AND public.is_campus_ambassador_of(auth.uid(), a.school_id)
    )
  );
