-- =====================================================================
-- Stockage des justificatifs (fichier 3/3). Bucket privé "justificatifs"
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('justificatifs', 'justificatifs', false)
on conflict (id) do nothing;

create policy "membres lisent les justificatifs" on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs' and public.is_member());
create policy "membres ajoutent des justificatifs" on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs' and public.is_member());
create policy "tresorier supprime les justificatifs" on storage.objects for delete to authenticated
  using (bucket_id = 'justificatifs' and public.has_role(array['tresorier']));
