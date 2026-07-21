-- 기존 couple_items 테이블에 V1 기능용 열을 추가합니다.
alter table public.couple_items
  add column if not exists event_date date,
  add column if not exists amount numeric(12, 0);

alter table public.couple_items enable row level security;

-- 이전에 같은 이름의 정책이 있으면 제거합니다.
drop policy if exists "authenticated users can read couple items" on public.couple_items;
drop policy if exists "authenticated users can insert couple items" on public.couple_items;
drop policy if exists "authenticated users can update couple items" on public.couple_items;
drop policy if exists "authenticated users can delete couple items" on public.couple_items;

create policy "authenticated users can read couple items"
on public.couple_items for select
to authenticated
using (true);

create policy "authenticated users can insert couple items"
on public.couple_items for insert
to authenticated
with check (true);

create policy "authenticated users can update couple items"
on public.couple_items for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete couple items"
on public.couple_items for delete
to authenticated
using (true);

-- 실시간 동기화를 위해 테이블을 publication에 추가합니다.
do $$
begin
  alter publication supabase_realtime add table public.couple_items;
exception
  when duplicate_object then null;
end $$;
