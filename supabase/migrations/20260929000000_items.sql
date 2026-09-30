-- Inspo Canvas: saved inspirations and their media.

create type public.item_kind as enum ('image', 'video', 'link', 'note', 'voice');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.item_kind not null,
  title text,
  -- Note text, or a voice-note transcript.
  body text,
  -- Object paths in the private "media" bucket: <user_id>/<item_id>/<file>.
  storage_path text,
  thumb_path text,
  width integer,
  height integer,
  duration_ms integer,
  -- Links.
  url text,
  link_title text,
  link_description text,
  link_image_url text,
  link_site_name text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Basic keyword search; retrieval gets its own design once that part of the spec is settled.
  search tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce(link_title, '') || ' ' ||
      coalesce(link_description, '') || ' ' || coalesce(link_site_name, '')
    )
  ) stored,
  constraint media_kinds_have_media check (kind not in ('image', 'video', 'voice') or storage_path is not null),
  constraint links_have_url check (kind <> 'link' or url is not null)
);

create index items_user_created_idx on public.items (user_id, created_at desc);
create index items_search_idx on public.items using gin (search);
create index items_tags_idx on public.items using gin (tags);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_touch_updated_at before update on public.items
for each row execute function public.touch_updated_at();

alter table public.items enable row level security;

create policy "Users read their own items" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own items" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own items" on public.items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own items" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Private bucket; the app reads through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  209715200, -- 200 MB, enough for short videos
  array['image/*', 'video/*', 'audio/*']
)
on conflict (id) do nothing;

create policy "Users read their own media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update their own media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
