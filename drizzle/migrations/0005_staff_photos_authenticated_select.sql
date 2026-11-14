drop policy if exists "staff_photos_public_select" on storage.objects;

create policy "staff_photos_authenticated_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos');