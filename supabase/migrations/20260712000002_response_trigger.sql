-- Postgres function to verify student answer correctness server-side
create or replace function public.check_response_correctness()
returns trigger as $$
declare
  correct_option text;
begin
  -- Fetch correct answer option from question_answers
  select correct_option_id into correct_option
  from public.question_answers
  where question_id = new.question_id;

  -- Compare option_id from answer JSON with correct_option
  -- Expects student answer JSON: {"option_id": "A"} or {"text": "photosynthesis"}
  if new.answer->>'option_id' = correct_option or new.answer->>'text' = correct_option then
    new.is_correct := true;
  else
    new.is_correct := false;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to run before inserting into responses table
create or replace trigger on_response_submitting
  before insert on public.responses
  for each row
  execute procedure public.check_response_correctness();
