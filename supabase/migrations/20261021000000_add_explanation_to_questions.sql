-- =========================================================================
-- MIGRATION: 20261021000000_add_explanation_to_questions.sql
-- Description: Adds optional explanation text to public.questions.
--              Shown to students and presenter when correct answer is revealed.
-- =========================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'explanation'
  ) then
    alter table public.questions add column explanation text default null;
  end if;
end $$;
