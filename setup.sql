-- 우리 둘 통합 설정 (V18: 로그인 보안 + 휴지통)
-- setup_v4 / v5 / v7 을 대체합니다. 여러 번 실행해도 기존 데이터는 그대로 유지됩니다.
-- 가계부 앱이 쓰는 테이블 7개만 다루며, legacy_diary_* 테이블은 건드리지 않습니다.
-- 실행 전: Authentication > Users 에서 공용 계정을 만들고, 새 가입 허용을 꺼두세요.

-- 1) 테이블 ---------------------------------------------------------------
create table if not exists public.couple_items(
  id bigint generated always as identity primary key,
  content text not null,
  category text,
  writer text,
  completed boolean default false,
  created_at timestamptz default now()
);
alter table public.couple_items
  add column if not exists event_date date,
  add column if not exists amount numeric(12,0),
  add column if not exists expense_group text,
  add column if not exists deleted_at timestamptz;

create table if not exists public.shopping_items(
  id bigint generated always as identity primary key,
  item_name text not null,
  quantity text,
  store text,
  completed boolean default false,
  writer text,
  created_at timestamptz default now()
);
alter table public.shopping_items add column if not exists deleted_at timestamptz;

create table if not exists public.travel_plans(
  id bigint generated always as identity primary key,
  title text not null,
  start_date date,
  end_date date,
  memo text,
  writer text,
  created_at timestamptz default now()
);
alter table public.travel_plans add column if not exists deleted_at timestamptz;

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
alter table public.schedule_events
  add column if not exists target_person text default '모두',
  add column if not exists deleted_at timestamptz;

create table if not exists public.couple_settings(
  id bigint primary key default 1,
  partner_one text default '진성',
  partner_two text default '성은',
  updated_at timestamptz default now()
);
alter table public.couple_settings add column if not exists anniversary_date date;

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

create table if not exists public.parking_records(
  id bigint generated always as identity primary key,
  car text not null,
  floor text not null,
  source text not null default '직접',
  writer text,
  recorded_at timestamptz not null default now()
);

-- 2) 기본 데이터 ------------------------------------------------------------
insert into public.couple_settings(id,partner_one,partner_two) values(1,'진성','성은')
on conflict(id) do nothing;

insert into public.schedule_categories(name,sort_order) values
 ('미분류',0),('약속',10),('가족',20),('병원',30),('기념일',40),('할 일',50)
on conflict(name) do nothing;

insert into public.expense_categories(name,sort_order) values
 ('미분류',0),('식비',10),('생활용품',20),('교통',30),('쇼핑',40),('주거',50),('여행',60),('의료',70),('기타',80)
on conflict(name) do nothing;

-- 3) 보안: 로그인한 사용자만 읽기/쓰기 ---------------------------------------
do $$
declare t text; p record;
begin
  foreach t in array array['couple_items','shopping_items','travel_plans','schedule_events','couple_settings','schedule_categories','expense_categories','parking_records']
  loop
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('create policy "members only" on public.%I for all to authenticated using (true) with check (true)',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- 4) 실시간 동기화 ----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['couple_items','shopping_items','travel_plans','schedule_events','couple_settings','schedule_categories','expense_categories','parking_records']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- 5) 주차 스티커: 로그인 없이(아이폰 사파리 등) 주차 위치만 저장 -------------------
-- 스티커 주소의 k 값과 private.app_secrets 의 'parking_tag' 값이 같을 때만 저장합니다.
-- 비밀 값은 이 파일(공개 저장소)에 넣지 말고 SQL 편집기에서 따로 넣으세요:
--   insert into private.app_secrets values('parking_tag','비밀값') on conflict(name) do update set value=excluded.value;
create schema if not exists private;
create table if not exists private.app_secrets(name text primary key, value text not null);
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

create or replace function public.nfc_parking(p_car text, p_floor text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or not exists(select 1 from private.app_secrets where name='parking_tag' and value=p_key) then return 'bad'; end if;
  if p_car not in ('니로','제네시스') or p_floor not in ('B3','B4','B5') then return 'bad'; end if;
  if exists(select 1 from public.parking_records where car=p_car and floor=p_floor and recorded_at > now() - interval '60 seconds') then return 'dup'; end if;
  insert into public.parking_records(car, floor, source, writer) values(p_car, p_floor, 'NFC', '태그');
  return 'ok';
end $$;
revoke all on function public.nfc_parking(text,text,text) from public;
grant execute on function public.nfc_parking(text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
