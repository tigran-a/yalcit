-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES Table (Extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  role text check (role in ('presenter', 'student')) default 'student' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone" 
  on public.profiles for select 
  using (true);

create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Explicit Data API grants
grant select, insert, update, delete on public.profiles to anon, authenticated, service_role;

-- 2. SESSIONS Table
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique, -- 6 character alphanumeric code
  presenter_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('waiting', 'active', 'ended')) default 'waiting' not null,
  current_question_id uuid, -- Reference to active question
  settings jsonb default '{"timer_duration": 30, "allow_late_entries": true}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for sessions
alter table public.sessions enable row level security;

create policy "Sessions are viewable by anyone" 
  on public.sessions for select 
  using (true);

create policy "Presenters can create sessions" 
  on public.sessions for insert 
  with check (auth.uid() = presenter_id AND exists (
    select 1 from public.profiles where id = auth.uid() and role = 'presenter'
  ));

create policy "Presenters can update their own sessions" 
  on public.sessions for update 
  using (auth.uid() = presenter_id);

create policy "Presenters can delete their own sessions" 
  on public.sessions for delete 
  using (auth.uid() = presenter_id);

-- 3. QUESTIONS Table
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  type text check (type in ('multiple_choice', 'open_ended')) not null,
  title text not null,
  options jsonb default '[]'::jsonb not null, -- Multiple Choice options: [{"id": "A", "text": "Choice A", "is_correct": true}]
  time_limit integer default 30, -- in seconds
  sort_order integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Complete circular foreign key reference in sessions table
alter table public.sessions 
  add constraint fk_current_question 
  foreign key (current_question_id) 
  references public.questions(id) 
  on delete set null;

-- RLS for questions
alter table public.questions enable row level security;

create policy "Questions are viewable by anyone" 
  on public.questions for select 
  using (true);

create policy "Presenters can manage questions for their sessions" 
  on public.questions for all 
  using (exists (
    select 1 from public.sessions 
    where id = session_id and presenter_id = auth.uid()
  ));

-- 4. RESPONSES Table
create table public.responses (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null, -- Student display name
  answer jsonb not null, -- Response data: {"option_id": "A"} or {"text": "open text response"}
  is_correct boolean default false not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, question_id, user_id) -- prevent duplicate responses per question
);

-- RLS for responses
alter table public.responses enable row level security;

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

-- 5. PROFILE TRIGGER ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'User_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
