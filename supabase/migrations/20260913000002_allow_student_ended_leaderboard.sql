-- =========================================================================
-- MIGRATION: 20260913000002_allow_student_ended_leaderboard.sql
-- Description: Allows students to view responses for leaderboard calculation
--              once the session status is 'ended'.
-- =========================================================================

drop policy if exists "Students can view session responses when ended" on public.responses;

create policy "Students can view session responses when ended"
  on public.responses for select
  using (
    exists (
      select 1 from public.sessions
      where id = session_id and status = 'ended'
    )
  );
