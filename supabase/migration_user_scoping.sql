-- Migration: scope every imported transaction to a user (req #1), with optional
-- card linkage (#2), and a fully populated import_jobs row for traceability (#3).
-- Idempotent — safe to re-run.

-- import_jobs: owner, card, period, file path, success/failed counters
alter table public.import_jobs
  add column if not exists user_id       uuid   references public.users(id),
  add column if not exists card_id       bigint references public.corporate_cards(id),
  add column if not exists import_month  text,
  add column if not exists date_from     date,
  add column if not exists date_to       date,
  add column if not exists file_path     text,
  add column if not exists success_count int not null default 0,
  add column if not exists failed_count  int not null default 0;

-- Backfill any pre-existing rows to admin so we can enforce NOT NULL.
update public.import_jobs
   set user_id = (select id from public.users where email = 'admin@demo.io')
 where user_id is null;
alter table public.import_jobs alter column user_id set not null;

create index if not exists idx_import_jobs_user on public.import_jobs(user_id);
create index if not exists idx_import_jobs_card on public.import_jobs(card_id);

-- transactions.user_id becomes required (seed already populated).
update public.transactions
   set user_id = (select id from public.users where email = 'admin@demo.io')
 where user_id is null;
alter table public.transactions alter column user_id set not null;

-- receipt_files: scope to user/card and link to import job + transaction.
alter table public.receipt_files
  add column if not exists user_id        uuid   references public.users(id),
  add column if not exists card_id        bigint references public.corporate_cards(id),
  add column if not exists import_job_id  bigint references public.import_jobs(id),
  add column if not exists transaction_id bigint references public.transactions(id);

update public.receipt_files
   set user_id = coalesce(uploaded_by_id, (select id from public.users where email = 'admin@demo.io'))
 where user_id is null;
