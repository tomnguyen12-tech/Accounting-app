-- One-shot wipe: clear every transaction & import-related record, keep
-- users/departments/cards/category_rules. RESTART IDENTITY so the next
-- imports start at #1. CASCADE handles the FK cycle between receipt_files
-- and transactions cleanly.
truncate
  public.review_logs,
  public.transactions,
  public.receipt_files,
  public.import_jobs
restart identity cascade;
