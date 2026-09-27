-- =========================================================================
-- MIGRATION: 20260927000000_add_data_api_grants.sql
-- Description: Explicitly grant table permissions to anon, authenticated, and
--              service_role for Data API access (PostgREST) following the
--              Supabase October 30 security update.
-- =========================================================================

grant select, insert, update, delete on public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.quizzes to anon, authenticated, service_role;
grant select, insert, update, delete on public.questions to anon, authenticated, service_role;
grant select, insert, update, delete on public.question_answers to anon, authenticated, service_role;
grant select, insert, update, delete on public.sessions to anon, authenticated, service_role;
grant select, insert, update, delete on public.responses to anon, authenticated, service_role;
