-- Cat-Gram — database setup
-- Re-run this whole file to rebuild the database from scratch.

-- === TABLE: one row per cat pin ===
create table cats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  lat double precision not null,
  lng double precision not null,
  photo_url text,
  created_at timestamptz not null default now()
);

-- === SECURITY: lock the table, then open read + add ===
alter table cats enable row level security;

create policy "anyone can read cats"
  on cats for select
  to anon using (true);

create policy "anyone can add a cat"
  on cats for insert
  to anon with check (true);

-- === STORAGE: allow uploads into the public 'cat-photos' bucket ===
-- (first create a PUBLIC bucket named 'cat-photos' in the Storage UI)
create policy "anyone can upload cat photos"
  on storage.objects for insert
  to anon with check ( bucket_id = 'cat-photos' );