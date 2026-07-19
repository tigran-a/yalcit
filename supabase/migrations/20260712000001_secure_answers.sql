-- 1. Create QUESTION_ANSWERS table
create table public.question_answers (
  question_id uuid references public.questions(id) on delete cascade primary key,
  correct_option_id text not null, -- e.g., 'A', 'B', etc.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add current_question_revealed column to sessions to control visibility
alter table public.sessions add column current_question_revealed boolean default false not null;

-- Enable RLS
alter table public.question_answers enable row level security;

-- 3. RLS for question_answers
-- Presenters can always manage answers for their sessions
create policy "Presenters can manage answers for their questions"
  on public.question_answers for all
  using (exists (
    select 1 from public.questions q
    join public.sessions s on q.session_id = s.id
    where q.id = question_id and s.presenter_id = auth.uid()
  ));

-- Students can only view correct answers once the presenter has revealed them
create policy "Students can view correct answers if revealed"
  on public.question_answers for select
  using (exists (
    select 1 from public.questions q
    join public.sessions s on q.session_id = s.id
    where q.id = question_id and s.current_question_revealed = true
  ));
