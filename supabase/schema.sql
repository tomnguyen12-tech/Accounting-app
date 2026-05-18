-- ============================================================================
--  Expense Assistant — Supabase schema (DEMO MODE: no Auth, no email confirm)
--  Login = chọn user có sẵn. RLS mở cho anon → CRUD chạy ngay với publishable key.
--  Run ONCE: Supabase → SQL Editor → New query → paste all → Run.
--  (Phần RESET ở đầu sẽ xoá & tạo lại sạch — DB test nên không sao.)
-- ============================================================================

-- ---------- reset (an toàn khi chạy lại) ----------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.review_logs    cascade;
drop table if exists public.transactions   cascade;
drop table if exists public.import_jobs    cascade;
drop table if exists public.receipt_files  cascade;
drop table if exists public.corporate_cards cascade;
drop table if exists public.category_rules cascade;
drop table if exists public.users          cascade;
drop table if exists public.departments    cascade;

-- ---------- enums ----------
do $$ begin
  create type transaction_status as enum
    ('DRAFT','AI_EXTRACTED','SUBMITTED','NEEDS_REVISION','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type source_type as enum ('EXCEL','PDF','IMAGE','MANUAL');
exception when duplicate_object then null; end $$;
do $$ begin
  create type user_role as enum ('ADMIN','ACCOUNTANT','USER');
exception when duplicate_object then null; end $$;

-- ---------- tables ----------
create table public.departments (
  id          bigint generated always as identity primary key,
  name        text unique not null,
  created_at  timestamptz not null default now()
);

-- Plain users table (no link to auth.users — demo login looks up by email).
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text not null,
  role          user_role not null default 'USER',
  department_id bigint references public.departments(id),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.corporate_cards (
  id                  bigint generated always as identity primary key,
  card_number_masked  text unique not null,
  last4               text not null,
  issuer              text,
  holder_user_id      uuid references public.users(id),
  department_id       bigint references public.departments(id),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.receipt_files (
  id              bigint generated always as identity primary key,
  filename        text not null,
  stored_path     text not null,
  mime_type       text not null,
  size            int  not null default 0,
  uploaded_by_id  uuid references public.users(id),
  created_at      timestamptz not null default now()
);

create table public.import_jobs (
  id              bigint generated always as identity primary key,
  type            source_type not null default 'EXCEL',
  status          text not null default 'COMPLETED',
  original_name   text not null,
  total_rows      int not null default 0,
  imported_rows   int not null default 0,
  duplicate_rows  int not null default 0,
  error_rows      int not null default 0,
  log             jsonb,
  created_by_id   uuid references public.users(id),
  created_at      timestamptz not null default now()
);

create table public.transactions (
  id                  bigint generated always as identity primary key,
  user_id             uuid references public.users(id),
  department_id       bigint references public.departments(id),
  card_id             bigint references public.corporate_cards(id),
  transaction_date    date not null,
  approval_date       date,
  payment_date        date,
  card_number_masked  text not null,
  approval_number     text,
  merchant_name       text not null,
  merchant_number     text,
  amount              bigint not null,
  vat_amount          bigint not null default 0,
  discount_amount     bigint not null default 0,
  exchange_fee        bigint not null default 0,
  cancel_status       text,
  transaction_type    text,
  sales_type          text,
  category            text,
  purpose             text not null default '',
  memo                text not null default '',
  source_type         source_type not null default 'EXCEL',
  source_file_id      bigint references public.receipt_files(id),
  import_job_id       bigint references public.import_jobs(id),
  confidence_score    double precision,
  status              transaction_status not null default 'AI_EXTRACTED',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_tx_date     on public.transactions(transaction_date);
create index idx_tx_user     on public.transactions(user_id);
create index idx_tx_category on public.transactions(category);
create index idx_tx_status   on public.transactions(status);

create table public.category_rules (
  id         bigint generated always as identity primary key,
  keyword    text not null,
  category   text not null,
  priority   int  not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.review_logs (
  id              bigint generated always as identity primary key,
  transaction_id  bigint not null references public.transactions(id) on delete cascade,
  action          text not null,
  from_status     transaction_status,
  to_status       transaction_status,
  comment         text,
  reviewer_id     uuid references public.users(id),
  created_at      timestamptz not null default now()
);

-- ---------- RLS: mở cho anon + authenticated (demo, không cần đăng nhập) ----------
do $$
declare t text;
begin
  foreach t in array array['departments','users','corporate_cards','receipt_files',
                            'import_jobs','transactions','category_rules','review_logs']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists demo_all on public.%I;', t);
    execute format($f$create policy demo_all on public.%I
      for all to anon, authenticated using (true) with check (true);$f$, t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- ---------- seed: departments / users / cards / rules ----------
insert into public.departments (name) values ('Sales'),('Engineering'),('Marketing');

insert into public.users (id,email,name,role,department_id) values
  ('11111111-1111-1111-1111-111111111111','admin@demo.io','Admin','ADMIN',null),
  ('22222222-2222-2222-2222-222222222222','acct@demo.io','Accountant','ACCOUNTANT',null),
  ('33333333-3333-3333-3333-333333333333','kevin@demo.io','Kevin','USER',
     (select id from public.departments where name='Sales')),
  ('44444444-4444-4444-4444-444444444444','sora@demo.io','Sora','USER',
     (select id from public.departments where name='Engineering'));

insert into public.corporate_cards (card_number_masked,last4,issuer,holder_user_id,department_id)
values
  ('4835-****-****-7498','7498','Shinhan Card',
     '33333333-3333-3333-3333-333333333333',
     (select id from public.departments where name='Sales')),
  ('5210-****-****-1043','1043','Hyundai Card', null,
     (select id from public.departments where name='Engineering'));

insert into public.category_rules (keyword,category,priority) values
  ('티머니','교통',10),('택시','교통',10),('주차','교통',10),('렌트카','교통',10),
  ('주유소','교통',10),('카카오택시','교통',10),('버스','교통',10),('지하철','교통',10),
  ('커피','식음료',10),('카페','식음료',10),('스타벅스','식음료',10),('투썸','식음료',10),
  ('커피빈','식음료',10),('식당','식음료',10),('치킨','식음료',10),('횟집','식음료',10),
  ('비어','식음료',10),('김밥','식음료',10),('베이커리','식음료',10),
  ('호텔','숙박/여행',10),('숙박','숙박/여행',10),('제주','숙박/여행',10),
  ('리조트','숙박/여행',10),('항공','숙박/여행',10),
  ('AWS','소프트웨어',10),('Google','소프트웨어',10),('Microsoft','소프트웨어',10),
  ('Naver Cloud','소프트웨어',10),('Adobe','소프트웨어',10),
  ('문구','사무용품',10),('사무용품','사무용품',10),('모니터','사무용품',10),
  ('키보드','사무용품',10),('마우스','사무용품',10),('다이소','사무용품',10),
  ('CGV','레저',20),('메가박스','레저',20),('골프','레저',20),('스크린','레저',20);

-- ---------- seed: Kevin's March-2026 statement (exactly 6,058,150원 / 49건) ----------
do $$
declare
  v_card  bigint;
  v_dept  bigint;
  v_user  uuid := '33333333-3333-3333-3333-333333333333';
  cats    text[]   := array['식음료','숙박/여행','레저','교통','기타'];
  totals  bigint[] := array[2916250,1585000,1074000,440900,42000];
  counts  int[]    := array[22,6,8,11,2];
  merch   jsonb := '{
    "식음료":["텀블러비어역삼직영점","스타벅스역삼점","투썸플레이스강남","커피빈선릉","교촌치킨역삼","노량진수산횟집","김밥천국","이디야커피"],
    "숙박/여행":["제주신라호텔","롯데호텔서울","한화리조트제주"],
    "레저":["CGV강남","골프존역삼","스크린골프"],
    "교통":["카카오택시","티머니교통","GS칼텍스주유소","강남공영주차장"],
    "기타":["다이소역삼점","무인양품"]}';
  ci int; i int; n int; base bigint; running bigint; amt bigint; wobble bigint;
  d int; created int := 0; mlist jsonb; mname text; st transaction_status; conf double precision;
begin
  select id into v_card from public.corporate_cards where card_number_masked='4835-****-****-7498';
  select id into v_dept from public.departments where name='Sales';

  for ci in 1..array_length(cats,1) loop
    n := counts[ci]; base := (totals[ci]/n/100)*100; running := 0;
    mlist := merch -> cats[ci];
    for i in 1..n loop
      if i < n then
        wobble := (((i-1) % 5) - 2) * 5000;
        amt := greatest(5000, base + wobble);
        running := running + amt;
      else
        amt := totals[ci] - running;
      end if;
      d := ((created * 3) % 31) + 1;
      mname := mlist ->> ((i-1) % jsonb_array_length(mlist));
      if created % 9 = 0 then st := 'NEEDS_REVISION'; conf := 0.55;
      else st := 'AI_EXTRACTED'; conf := 0.92; end if;

      insert into public.transactions
        (user_id, department_id, card_id, transaction_date, approval_date,
         payment_date, card_number_masked, approval_number, merchant_name,
         merchant_number, amount, vat_amount, category, source_type,
         confidence_score, status)
      values
        (v_user, v_dept, v_card,
         make_date(2026,3, least(d,31)), make_date(2026,3, least(d,31)) + 1,
         make_date(2026,4,15), '4835-****-****-7498',
         (30000000 + created*137 + 19)::text, mname,
         (94586000 + created)::text, amt, round(amt/11.0), cats[ci], 'EXCEL',
         conf, st);
      created := created + 1;
    end loop;
  end loop;
end $$;
