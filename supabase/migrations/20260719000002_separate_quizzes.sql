-- Drop dependent tables first to clean up
drop table if exists public.question_answers cascade;
drop table if exists public.responses cascade;
drop table if exists public.questions cascade;
drop table if exists public.sessions cascade;
drop table if exists public.quizzes cascade;

-- =========================================================================
-- 1. TABLE DEFINITIONS
-- =========================================================================

-- Create Quizzes
create table public.quizzes (
  id uuid default gen_random_uuid() primary key,
  presenter_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Questions (pointing to quizzes)
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  type text check (type in ('multiple_choice', 'open_ended')) not null,
  title text not null,
  image_url text,
  options jsonb default '[]'::jsonb not null,
  time_limit integer default 30 not null,
  sort_order integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Question Answers (for secure answers)
create table public.question_answers (
  question_id uuid references public.questions(id) on delete cascade primary key,
  correct_option_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Sessions (pointing to quizzes)
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  presenter_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('waiting', 'active', 'ended')) default 'waiting' not null,
  current_question_id uuid references public.questions(id) on delete set null,
  current_question_revealed boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Responses (pointing to sessions & questions)
create table public.responses (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null,
  answer jsonb not null,
  is_correct boolean default false not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, question_id, user_id)
);

-- =========================================================================
-- 2. ENABLE ROW-LEVEL SECURITY
-- =========================================================================
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.sessions enable row level security;
alter table public.responses enable row level security;

-- =========================================================================
-- 3. DEFINE SECURITY POLICIES
-- =========================================================================

-- Quizzes
create policy "Quizzes are viewable by anyone" 
  on public.quizzes for select 
  using (true);

create policy "Presenters can manage their quizzes" 
  on public.quizzes for all 
  using (auth.uid() = presenter_id);

-- Questions
create policy "Questions are viewable by everyone" 
  on public.questions for select 
  using (true);

create policy "Presenters can manage questions for their quizzes" 
  on public.questions for all 
  using (exists (
    select 1 from public.quizzes 
    where id = quiz_id and presenter_id = auth.uid()
  ));

-- Question Answers
create policy "Presenters can manage answers for their questions" 
  on public.question_answers for all 
  using (exists (
    select 1 from public.questions q
    join public.quizzes qz on qz.id = q.quiz_id
    where q.id = question_id and qz.presenter_id = auth.uid()
  ));

create policy "Students can view correct answers if revealed" 
  on public.question_answers for select 
  using (exists (
    select 1 from public.questions q
    join public.sessions s on s.quiz_id = q.quiz_id
    where q.id = question_id and s.current_question_revealed = true
  ));

-- Sessions
create policy "Sessions are viewable by anyone" 
  on public.sessions for select 
  using (true);

create policy "Presenters can manage their sessions" 
  on public.sessions for all 
  using (auth.uid() = presenter_id);

-- Responses
create policy "Presenters can view all responses" 
  on public.responses for select 
  using (exists (
    select 1 from public.sessions 
    where id = session_id and presenter_id = auth.uid()
  ));

create policy "Students can view their own responses" 
  on public.responses for select 
  using (auth.uid() = user_id);

create policy "Students can submit responses" 
  on public.responses for insert 
  with check (auth.uid() = user_id);

-- =========================================================================
-- 4. GRADING TRIGGER
-- =========================================================================
create or replace function public.check_response_correctness()
returns trigger as $$
declare
  correct_ans text;
  q_type text;
begin
  -- Fetch correct answer key and type
  select qa.correct_option_id, q.type into correct_ans, q_type
  from public.questions q
  join public.question_answers qa on qa.question_id = q.id
  where q.id = new.question_id;

  if q_type = 'multiple_choice' then
    if new.answer->>'option_id' = correct_ans then
      new.is_correct := true;
    else
      new.is_correct := false;
    end if;
  else
    -- Open ended string comparison (trimmed, case-insensitive)
    if lower(trim(new.answer->>'text')) = lower(trim(correct_ans)) then
      new.is_correct := true;
    else
      new.is_correct := false;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger tr_check_response_correctness
  before insert on public.responses
  for each row execute procedure public.check_response_correctness();

-- =========================================================================
-- 5. REALTIME BROADCAST REPLICATION
-- =========================================================================
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.responses;
