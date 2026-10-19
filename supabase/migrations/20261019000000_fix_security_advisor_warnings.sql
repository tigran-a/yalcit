-- Migration: Fix Supabase Security Advisor Warnings
-- 1. Fix mutable search_path on all SECURITY DEFINER functions to prevent search path hijacking
-- 2. Revoke execute on trigger functions from public/anon/authenticated to prevent direct RPC invocations
-- 3. Restrict demo quiz toggles to authenticated users only (revoke from anon)
-- 4. Remove broad public listing policy on yalcit-media bucket (public downloads remain active via CDN URL)

-- 1. Set explicit search_path on SECURITY DEFINER functions
alter function public.check_response_correctness() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.disable_demo_quizzes() set search_path = public, pg_temp;
alter function public.enable_demo_quizzes() set search_path = public, pg_temp;

-- 2. Revoke RPC execution on internal trigger functions
revoke execute on function public.check_response_correctness() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable') then
    execute 'alter function public.rls_auto_enable() set search_path = public, pg_temp;';
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated;';
  end if;
end $$;

-- 3. Restrict demo quiz toggling to authenticated presenters only
revoke execute on function public.disable_demo_quizzes() from anon, public;
revoke execute on function public.enable_demo_quizzes() from anon, public;
grant execute on function public.disable_demo_quizzes() to authenticated;
grant execute on function public.enable_demo_quizzes() to authenticated;

-- 4. Secure storage: remove public directory listing on yalcit-media
-- Public bucket downloads continue to work via public URL without this policy
drop policy if exists "Media is publicly readable" on storage.objects;
