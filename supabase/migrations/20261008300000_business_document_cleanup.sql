grant delete on storage.objects to authenticated;

drop policy if exists "partner members remove unattached verification files" on storage.objects;
create policy "partner members remove unattached verification files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-documents'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  and split_part(name, '/', 2) = auth.uid()::text
  and public.has_business_permission(split_part(name, '/', 1)::uuid, 'partners.manage')
  and not exists (
    select 1 from public.business_documents d
    where d.storage_path = storage.objects.name
  )
);
