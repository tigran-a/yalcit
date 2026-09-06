-- Add speed_scoring & current_question_started_at to sessions table
alter table public.sessions 
  add column if not exists speed_scoring boolean not null default true,
  add column if not exists current_question_started_at timestamptz default now();

-- Add points to responses table
alter table public.responses 
  add column if not exists points integer not null default 0;

-- Update response grading trigger function to compute speed-based bonus points
create or replace function public.check_response_correctness()
returns trigger as $$
declare
  correct_option text;
  sess_speed boolean;
  sess_started timestamptz;
  q_time int;
  elapsed_sec float;
begin
  -- Fetch correct answer option from question_answers
  select correct_option_id into correct_option
  from public.question_answers
  where question_id = new.question_id;

  -- Compare option_id from answer JSON with correct_option (case insensitive trim comparison)
  if lower(trim(coalesce(new.answer->>'option_id', new.answer->>'text', ''))) = lower(trim(coalesce(correct_option, ''))) then
    new.is_correct := true;
  else
    new.is_correct := false;
  end if;

  -- Fetch session speed_scoring setting and start timestamp
  select speed_scoring, current_question_started_at
  into sess_speed, sess_started
  from public.sessions
  where id = new.session_id;

  -- Fetch question time limit
  select coalesce(time_limit, 30) into q_time
  from public.questions
  where id = new.question_id;

  if new.is_correct = true then
    if sess_speed = true and sess_started is not null and q_time > 0 then
      elapsed_sec := extract(epoch from (now() - sess_started));
      if elapsed_sec < 0 then elapsed_sec := 0; end if;
      new.points := greatest(500, least(1000, round(1000 - (elapsed_sec / cast(q_time as float)) * 500)));
    else
      new.points := 100;
    end if;
  else
    new.points := 0;
  end if;

  return new;
end;
$$ language plpgsql security definer;
