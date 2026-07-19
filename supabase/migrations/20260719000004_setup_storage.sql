-- Create a public bucket for quiz media
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yalcit-media', 
  'yalcit-media', 
  true, 
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- Drop existing policies if any
drop policy if exists "Media is publicly readable" on storage.objects;
drop policy if exists "Presenters can upload media" on storage.objects;
drop policy if exists "Presenters can delete media" on storage.objects;

-- Define storage security policies
create policy "Media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'yalcit-media');

create policy "Presenters can upload media"
  on storage.objects for insert
  with check (
    bucket_id = 'yalcit-media'
    and auth.role() = 'authenticated'
  );

create policy "Presenters can delete media"
  on storage.objects for delete
  using (
    bucket_id = 'yalcit-media'
    and auth.role() = 'authenticated'
  );
