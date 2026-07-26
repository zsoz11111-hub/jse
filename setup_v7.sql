-- 우리 둘 V7: 일정, 여행 자동 연동 표시, 일정/가계부 카테고리 관리
-- 기존 setup_v5.sql 실행 후 이 파일을 한 번 실행하세요.

alter table public.couple_items
  add column if not exists event_date date,
  add column if not exists amount numeric(12,0),
  add column if not exists expense_group text;

create table if not exists public.schedule_events(
  id bigint generated always as identity primary key,
  title text not null,
  start_date date not null,
  end_date date,
  all_day boolean not null default true,
  start_time time,
  end_time time,
  category text not null default '미분류',
  location text,
  memo text,
  writer text,
  created_at timestamptz default now()
);

create table if not exists public.schedule_categories(
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.expense_categories(
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

insert into public.schedule_categories(name,sort_order) values
 ('미분류',0),('약속',10),('가족',20),('병원',30),('기념일',40),('할 일',50)
on conflict(name) do nothing;

insert into public.expense_categories(name,sort_order) values
 ('미분류',0),('식비',10),('생활용품',20),('교통',30),('쇼핑',40),('주거',50),('여행',60),('의료',70),('기타',80)
on conflict(name) do nothing;

update public.couple_items set expense_group='미분류'
where category='가계부' and (expense_group is null or btrim(expense_group)='');

alter table public.schedule_events enable row level security;
alter table public.schedule_categories enable row level security;
alter table public.expense_categories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['schedule_events','schedule_categories','expense_categories']
  loop
    execute format('drop policy if exists "anon read" on public.%I',t);
    execute format('drop policy if exists "anon insert" on public.%I',t);
    execute format('drop policy if exists "anon update" on public.%I',t);
    execute format('drop policy if exists "anon delete" on public.%I',t);
    execute format('create policy "anon read" on public.%I for select to anon using (true)',t);
    execute format('create policy "anon insert" on public.%I for insert to anon with check (true)',t);
    execute format('create policy "anon update" on public.%I for update to anon using (true) with check (true)',t);
    execute format('create policy "anon delete" on public.%I for delete to anon using (true)',t);
    execute format('grant select, insert, update, delete on public.%I to anon',t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to anon;

do $$ begin alter publication supabase_realtime add table public.schedule_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.schedule_categories; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.expense_categories; exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
