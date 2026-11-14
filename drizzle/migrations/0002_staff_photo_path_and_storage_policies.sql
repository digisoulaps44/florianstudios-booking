ALTER TABLE public.staff ADD COLUMN photo_path text NULL;

CREATE POLICY "staff_photos_public_select" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'staff-photos');

CREATE POLICY "staff_photos_authenticated_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'staff-photos'
  AND (
    public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  )
);

CREATE POLICY "staff_photos_authenticated_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'staff-photos'
  AND (
    public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  )
);

CREATE POLICY "staff_photos_authenticated_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.user_id = auth.uid()
    )
  )
);