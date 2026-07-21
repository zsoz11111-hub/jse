-- 우리 둘 V4: 로그인 없이 사용하는 버전
alter table public.couple_items
  add column if not exists event_date date,
  add column if not exists amount numeric(12,0);

create table if not exists public.shopping_items(
  id bigint generated always as identity primary key,
  item_name text not null,
  quantity text,
  store text,
  completed boolean default false,
  writer text,
  created_at timestamptz default now()
);

create table if not exists public.travel_plans(
  id bigint generated always as identity primary key,
  title text not null,
  start_date date,
  end_date date,
  memo text,
  writer text,
  created_at timestamptz default now()
);

create table if not exists public.couple_settings(
  id bigint primary key default 1,
  partner_one text default '진성',
  partner_two text default '성은',
  updated_at timestamptz default now()
);

alter table public.couple_items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.travel_plans enable row level security;
alter table public.couple_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['couple_items','shopping_items','travel_plans','couple_settings']
  loop
    execute format('drop policy if exists "anon read" on public.%I',t);
    execute format('drop policy if exists "anon insert" on public.%I',t);
    execute format('drop policy if exists "anon update" on public.%I',t);
    execute format('drop policy if exists "anon delete" on public.%I',t);

    execute format('create policy "anon read" on public.%I for select to anon using (true)',t);
    execute format('create policy "anon insert" on public.%I for insert to anon with check (true)',t);
    execute format('create policy "anon update" on public.%I for update to anon using (true) with check (true)',t);
    execute format('create policy "anon delete" on public.%I for delete to anon using (true)',t);
  end loop;
end $$;

insert into public.couple_settings(id,partner_one,partner_two)
values(1,'진성','성은')
on conflict(id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.couple_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.travel_plans;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.couple_settings;
exception when duplicate_object then null;
end $$;
