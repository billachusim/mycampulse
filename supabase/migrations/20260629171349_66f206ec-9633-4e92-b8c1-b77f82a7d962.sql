-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  rsvp_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events readable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "events insertable by host" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "events updatable by host" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "events deletable by host or admin" ON public.events FOR DELETE TO authenticated USING (auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_events_starts_at ON public.events(starts_at);
CREATE INDEX idx_events_school ON public.events(school_id);

-- RSVPs
CREATE TABLE public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT SELECT ON public.event_rsvps TO anon;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvps readable by everyone" ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "rsvps insert self" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvps delete self" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- bump rsvp count
CREATE OR REPLACE FUNCTION public.bump_rsvp_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = OLD.event_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_rsvp_count AFTER INSERT OR DELETE ON public.event_rsvps FOR EACH ROW EXECUTE FUNCTION public.bump_rsvp_count();

-- Marketplace items
CREATE TABLE public.marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  price_naira integer NOT NULL DEFAULT 0,
  image_url text,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_items TO authenticated;
GRANT SELECT ON public.marketplace_items TO anon;
GRANT ALL ON public.marketplace_items TO service_role;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items readable by everyone" ON public.marketplace_items FOR SELECT USING (true);
CREATE POLICY "items insertable by seller" ON public.marketplace_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "items updatable by seller" ON public.marketplace_items FOR UPDATE TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "items deletable by seller or admin" ON public.marketplace_items FOR DELETE TO authenticated USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_items_school ON public.marketplace_items(school_id);
CREATE INDEX idx_items_created ON public.marketplace_items(created_at DESC);

-- Hashtags column on posts (denormalized for fast trending)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON public.posts USING GIN(hashtags);

-- Auto-extract hashtags from post body on insert/update
CREATE OR REPLACE FUNCTION public.extract_hashtags() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tags text[];
BEGIN
  IF NEW.body IS NULL THEN
    NEW.hashtags := '{}';
  ELSE
    SELECT COALESCE(array_agg(DISTINCT lower(m[1])), '{}')
      INTO _tags
      FROM regexp_matches(NEW.body, '#([A-Za-z0-9_]{2,30})', 'g') AS m;
    NEW.hashtags := _tags;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_extract_hashtags ON public.posts;
CREATE TRIGGER trg_extract_hashtags BEFORE INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION public.extract_hashtags();

-- Backfill hashtags on existing posts
UPDATE public.posts SET body = body WHERE body IS NOT NULL;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.marketplace_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();