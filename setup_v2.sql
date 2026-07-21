-- 우리 둘 V2 데이터베이스 설정
alter table public.couple_items
  add column if not exists event_date date,
  add column if not exists amount numeric(12,0),
  add column if not exists expense_group text;

alter table public.couple_items enable row level security;

drop policy if exists "authenticated users can read couple items" on public.couple_items;
drop policy if exists "authenticated users can insert couple items" on public.couple_items;
drop policy if exists "authenticated users can update couple items" on public.couple_items;
drop policy if exists "authenticated users can delete couple items" on public.couple_items;

create policy "authenticated users can read couple items"
on public.couple_items for select to authenticated using (true);

create policy "authenticated users can insert couple items"
on public.couple_items for insert to authenticated with check (true);

create policy "authenticated users can update couple items"
on public.couple_items for update to authenticated using (true) with check (true);

create policy "authenticated users can delete couple items"
on public.couple_items for delete to authenticated using (true);

create table if not exists public.couple_settings (
  id bigint primary key default 1,
  anniversary_date date,
  partner_one text default '진성',
  partner_two text default '성은',
  updated_at timestamptz default now()
);

alter table public.couple_settings enable row level security;

drop policy if exists "authenticated users can read couple settings" on public.couple_settings;
drop policy if exists "authenticated users can insert couple settings" on public.couple_settings;
drop policy if exists "authenticated users can update couple settings" on public.couple_settings;

create policy "authenticated users can read couple settings"
on public.couple_settings for select to authenticated using (true);

create policy "authenticated users can insert couple settings"
on public.couple_settings for insert to authenticated with check (true);

create policy "authenticated users can update couple settings"
on public.couple_settings for update to authenticated using (true) with check (true);

insert into public.couple_settings (id, partner_one, partner_two)
values (1, '진성', '성은')
on conflict (id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.couple_items;
exception
  when duplicate_object then null;
end $$;
