
UPDATE public.marketplace_items SET status = 'active' WHERE status NOT IN ('active','sold','hidden');

ALTER TYPE public.campoint_reason ADD VALUE IF NOT EXISTS 'event_created';
ALTER TYPE public.campoint_reason ADD VALUE IF NOT EXISTS 'listing_created';
ALTER TYPE public.report_target ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE public.report_target ADD VALUE IF NOT EXISTS 'listing';

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check CHECK (status IN ('active','hidden'));

ALTER TABLE public.marketplace_items DROP CONSTRAINT IF EXISTS marketplace_items_status_check;
ALTER TABLE public.marketplace_items ADD CONSTRAINT marketplace_items_status_check CHECK (status IN ('active','sold','hidden'));
ALTER TABLE public.marketplace_items ALTER COLUMN status SET DEFAULT 'active';

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "events_select_active" ON public.events;
CREATE POLICY "events_select_active" ON public.events FOR SELECT
  USING (status = 'active' OR host_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Marketplace items are viewable by everyone" ON public.marketplace_items;
DROP POLICY IF EXISTS "market_select_active" ON public.marketplace_items;
CREATE POLICY "market_select_active" ON public.marketplace_items FOR SELECT
  USING (status <> 'hidden' OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "events_admin_update" ON public.events;
CREATE POLICY "events_admin_update" ON public.events FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR host_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR host_id = auth.uid());

DROP POLICY IF EXISTS "events_admin_delete" ON public.events;
CREATE POLICY "events_admin_delete" ON public.events FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR host_id = auth.uid());

DROP POLICY IF EXISTS "market_admin_update" ON public.marketplace_items;
CREATE POLICY "market_admin_update" ON public.marketplace_items FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR seller_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR seller_id = auth.uid());

DROP POLICY IF EXISTS "market_admin_delete" ON public.marketplace_items;
CREATE POLICY "market_admin_delete" ON public.marketplace_items FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.award_for_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_campoints(NEW.host_id, 'event_created'::public.campoint_reason, 15, 'event', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_award_for_event ON public.events;
CREATE TRIGGER trg_award_for_event AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.award_for_event();

CREATE OR REPLACE FUNCTION public.award_for_listing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.award_campoints(NEW.seller_id, 'listing_created'::public.campoint_reason, 10, 'listing', NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_award_for_listing ON public.marketplace_items;
CREATE TRIGGER trg_award_for_listing AFTER INSERT ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.award_for_listing();

CREATE OR REPLACE FUNCTION public.award_campoints(_user uuid, _reason campoint_reason, _delta integer, _ref_type text DEFAULT NULL::text, _ref_id uuid DEFAULT NULL::uuid, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _today_count integer; _cap integer; _today_start timestamptz;
BEGIN
  IF _user IS NULL OR _delta = 0 THEN RETURN 0; END IF;
  IF _delta > 0 THEN
    _cap := CASE _reason
      WHEN 'post' THEN 5 WHEN 'comment' THEN 20 WHEN 'like_received' THEN 50
      WHEN 'comment_received' THEN 30 WHEN 'share_click' THEN 10
      WHEN 'daily_checkin' THEN 1 WHEN 'event_created' THEN 2 WHEN 'listing_created' THEN 3
      ELSE NULL END;
    IF _cap IS NOT NULL THEN
      _today_start := ((now() AT TIME ZONE 'Africa/Lagos')::date) AT TIME ZONE 'Africa/Lagos';
      SELECT COUNT(*) INTO _today_count FROM public.campoints_ledger
      WHERE user_id = _user AND reason = _reason AND created_at >= _today_start;
      IF _today_count >= _cap THEN RETURN 0; END IF;
    END IF;
  END IF;
  INSERT INTO public.campoints_ledger(user_id, delta, reason, ref_type, ref_id, meta)
  VALUES (_user, _delta, _reason, _ref_type, _ref_id, COALESCE(_meta,'{}'::jsonb));
  RETURN _delta;
END $function$;
