-- 1. Add columns to public.quizzes
alter table public.quizzes add column is_public boolean default false not null;
alter table public.quizzes add column forked_from_id uuid references public.quizzes(id) on delete set null;

-- 2. Drop old policies to update
drop policy if exists "Quizzes are viewable by anyone" on public.quizzes;
drop policy if exists "Presenters can manage their quizzes" on public.quizzes;
drop policy if exists "Questions are viewable by everyone" on public.questions;
drop policy if exists "Presenters can manage questions for their quizzes" on public.questions;
drop policy if exists "Presenters can manage answers for their questions" on public.question_answers;
drop policy if exists "Students can view correct answers if revealed" on public.question_answers;

-- 3. Define new updated policies
-- Quizzes
create policy "Quizzes viewable by owner or if public"
  on public.quizzes for select
  using (auth.uid() = presenter_id or is_public = true);

create policy "Presenters can manage their own quizzes"
  on public.quizzes for all
  using (auth.uid() = presenter_id);

-- Questions
create policy "Questions viewable if quiz is public or owned"
  on public.questions for select
  using (
    exists (
      select 1 from public.quizzes
      where id = quiz_id and (presenter_id = auth.uid() or is_public = true)
    ) or exists (
      select 1 from public.sessions s
      where s.quiz_id = quiz_id
    )
  );

create policy "Presenters can manage questions for their own quizzes"
  on public.questions for all
  using (exists (
    select 1 from public.quizzes
    where id = quiz_id and presenter_id = auth.uid()
  ));

-- Question Answers
create policy "Answers viewable if quiz is public or owned"
  on public.question_answers for select
  using (
    exists (
      select 1 from public.questions q
      join public.quizzes qz on qz.id = q.quiz_id
      where q.id = question_id and (qz.presenter_id = auth.uid() or qz.is_public = true)
    ) or exists (
      select 1 from public.questions q
      join public.sessions s on s.quiz_id = q.quiz_id
      where q.id = question_id and s.current_question_revealed = true
    )
  );

create policy "Presenters can manage answers for their own questions"
  on public.question_answers for all
  using (exists (
    select 1 from public.questions q
    join public.quizzes qz on qz.id = q.quiz_id
    where q.id = question_id and qz.presenter_id = auth.uid()
  ));
