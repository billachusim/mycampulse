
DROP POLICY IF EXISTS "campus_media_read" ON storage.objects;
CREATE POLICY "campus_media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campus-media');

DROP POLICY IF EXISTS "campus_media_insert" ON storage.objects;
CREATE POLICY "campus_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campus_media_update" ON storage.objects;
CREATE POLICY "campus_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "campus_media_delete" ON storage.objects;
CREATE POLICY "campus_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campus-media' AND (storage.foldername(name))[1] = auth.uid()::text);
