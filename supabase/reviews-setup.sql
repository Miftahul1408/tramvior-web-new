create table if not exists public.student_reviews (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  school text not null check (char_length(school) between 1 and 100),
  program text not null default '' check (char_length(program) <= 80),
  quote text not null check (char_length(quote) between 1 and 350),
  rating smallint not null check (rating between 1 and 5),
  published boolean not null default false,
  updated_at text not null,
  image_path text
);

alter table public.student_reviews enable row level security;

grant select on public.student_reviews to anon, authenticated;
grant insert, update, delete on public.student_reviews to authenticated;

drop policy if exists "Anyone can read published reviews" on public.student_reviews;
create policy "Anyone can read published reviews"
  on public.student_reviews
  for select
  to anon, authenticated
  using (published or (select auth.uid()) is not null);

drop policy if exists "Signed-in admins can manage reviews" on public.student_reviews;
create policy "Signed-in admins can manage reviews"
  on public.student_reviews
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Readers can view approved review images" on storage.objects;
create policy "Readers can view approved review images"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'review-images'
    and (
      (select auth.uid()) is not null
      or exists (
        select 1
        from public.student_reviews
        where student_reviews.image_path = storage.objects.name
          and student_reviews.published = true
      )
    )
  );

drop policy if exists "Signed-in admins can upload review images" on storage.objects;
create policy "Signed-in admins can upload review images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'review-images');

drop policy if exists "Signed-in admins can update review images" on storage.objects;
create policy "Signed-in admins can update review images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'review-images')
  with check (bucket_id = 'review-images');

drop policy if exists "Signed-in admins can delete review images" on storage.objects;
create policy "Signed-in admins can delete review images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'review-images');
