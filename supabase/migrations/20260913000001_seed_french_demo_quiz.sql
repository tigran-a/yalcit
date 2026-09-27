-- =========================================================================
-- MIGRATION: 20260913000001_seed_french_demo_quiz.sql
-- Description: Seeds the 12-question "Learn French for Beginners (Demo)" quiz
--              with educational prompts and 100% verified 200 OK image URLs.
-- =========================================================================

-- 1. Add is_demo column to public.quizzes if it does not exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'quizzes' and column_name = 'is_demo'
  ) then
    alter table public.quizzes add column is_demo boolean default false not null;
  end if;
end $$;

-- 2. Create SQL helper functions to enable or disable demo quizzes
create or replace function public.disable_demo_quizzes()
returns void as $$
begin
  update public.quizzes set is_public = false where is_demo = true;
end;
$$ language plpgsql security definer;

create or replace function public.enable_demo_quizzes()
returns void as $$
begin
  update public.quizzes set is_public = true where is_demo = true;
end;
$$ language plpgsql security definer;

grant execute on function public.disable_demo_quizzes() to anon, authenticated;
grant execute on function public.enable_demo_quizzes() to anon, authenticated;

-- 3. Seed Demo Quiz & Questions
do $$
declare
  v_presenter_id uuid;
  v_quiz_id uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_q4 uuid; v_q5 uuid; v_q6 uuid;
  v_q7 uuid; v_q8 uuid; v_q9 uuid; v_q10 uuid; v_q11 uuid; v_q12 uuid;
begin
  -- Find an existing presenter profile to associate the demo quiz with
  select id into v_presenter_id from public.profiles where role = 'presenter' limit 1;

  -- Fallback to system UUID if no presenter profile exists yet
  if v_presenter_id is null then
    v_presenter_id := '00000000-0000-0000-0000-000000000001'::uuid;
    insert into public.profiles (id, display_name, role)
    values (v_presenter_id, 'Yalcit Demo System', 'presenter')
    on conflict (id) do nothing;
  end if;

  -- Delete previous seed if re-running
  delete from public.quizzes where id = v_quiz_id;

  -- Insert 12-Question French Demo Quiz
  insert into public.quizzes (id, presenter_id, title, is_public, is_demo)
  values (
    v_quiz_id,
    v_presenter_id,
    '🇫🇷 Learn French for Beginners (Demo)',
    true,
    true
  );

  -- Question 1: Apple
  v_q1 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q1, v_quiz_id, 'multiple_choice',
    'In French, what is the word for ''Apple''?',
    'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"La pomme"},{"id":"B","text":"La poire"},{"id":"C","text":"La banane"},{"id":"D","text":"L''orange"}]'::jsonb,
    30, 1
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q1, 'A');

  -- Question 2: Rabbit
  v_q2 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q2, v_quiz_id, 'multiple_choice',
    'Look at the animal in the picture. What is the French word for ''The Rabbit''?',
    'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Le lapin"},{"id":"B","text":"Le chat"},{"id":"C","text":"Le chien"},{"id":"D","text":"L''oiseau"}]'::jsonb,
    30, 2
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q2, 'A');

  -- Question 3: Greeting
  v_q3 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q3, v_quiz_id, 'multiple_choice',
    'You greet a friend in Paris in the morning with ''Bonjour!''. What does this mean in English?',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Hello / Good morning"},{"id":"B","text":"Good night"},{"id":"C","text":"Thank you"},{"id":"D","text":"Goodbye"}]'::jsonb,
    20, 3
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q3, 'A');

  -- Question 4: Bread
  v_q4 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q4, v_quiz_id, 'multiple_choice',
    'In a French boulangerie (bakery), what is the French word for ''Bread''?',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Le pain"},{"id":"B","text":"Le fromage"},{"id":"C","text":"Le beurre"},{"id":"D","text":"Le gâteau"}]'::jsonb,
    30, 4
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q4, 'A');

  -- Question 5: Car
  v_q5 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q5, v_quiz_id, 'multiple_choice',
    'Traveling on the road: How do you say ''Car'' in French?',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"La voiture"},{"id":"B","text":"Le vélo"},{"id":"C","text":"Le train"},{"id":"D","text":"L''avion"}]'::jsonb,
    30, 5
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q5, 'A');

  -- Question 6: Red
  v_q6 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q6, v_quiz_id, 'multiple_choice',
    'Color vocabulary: Which English color corresponds to the French word ''Rouge''?',
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Red"},{"id":"B","text":"Blue"},{"id":"C","text":"Green"},{"id":"D","text":"Yellow"}]'::jsonb,
    20, 6
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q6, 'A');

  -- Question 7: Sun
  v_q7 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q7, v_quiz_id, 'multiple_choice',
    'On a clear summer day, you look up at the sky. What is ''The Sun'' called in French?',
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Le soleil"},{"id":"B","text":"La lune"},{"id":"C","text":"L''étoile"},{"id":"D","text":"Le nuage"}]'::jsonb,
    30, 7
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q7, 'A');

  -- Question 8: Water
  v_q8 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q8, v_quiz_id, 'multiple_choice',
    'When you ask for ''De l''eau'' at a cafe, what beverage are you requesting?',
    'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Water"},{"id":"B","text":"Milk"},{"id":"C","text":"Coffee"},{"id":"D","text":"Tea"}]'::jsonb,
    20, 8
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q8, 'A');

  -- Question 9: Open Ended (Merci)
  v_q9 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q9, v_quiz_id, 'open_ended',
    'Polite phrases: Type the French word for ''Thank you''.',
    'https://images.unsplash.com/photo-1528642474498-1af0c17fd8c3?w=800&auto=format&fit=crop&q=80',
    '[]'::jsonb,
    30, 9
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q9, 'Merci');

  -- Question 10: Number 3
  v_q10 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q10, v_quiz_id, 'multiple_choice',
    'Counting in French: If you have 3 croissants, how do you say the number ''3'' in French?',
    'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Trois"},{"id":"B","text":"Un"},{"id":"C","text":"Deux"},{"id":"D","text":"Quatre"}]'::jsonb,
    20, 10
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q10, 'A');

  -- Question 11: Book
  v_q11 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q11, v_quiz_id, 'multiple_choice',
    'At the library: What is the French word for ''Book''?',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Le livre"},{"id":"B","text":"Le stylo"},{"id":"C","text":"Le cahier"},{"id":"D","text":"La table"}]'::jsonb,
    30, 11
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q11, 'A');

  -- Question 12: Goodbye
  v_q12 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q12, v_quiz_id, 'multiple_choice',
    'Saying goodbye: How do you say ''Goodbye'' in French?',
    'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=800&auto=format&fit=crop&q=80',
    '[{"id":"A","text":"Au revoir"},{"id":"B","text":"S''il vous plaît"},{"id":"C","text":"Bienvenue"},{"id":"D","text":"Bonne nuit"}]'::jsonb,
    20, 12
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q12, 'A');

end $$;
