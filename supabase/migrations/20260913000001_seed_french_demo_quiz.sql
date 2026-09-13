-- =========================================================================
-- MIGRATION: 20260913000001_seed_french_demo_quiz.sql
-- Description: Adds optional is_demo column, SQL toggle functions, and seeds
--              a 12-question "Learn French for Beginners (Demo)" public quiz.
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

  -- Question 1
  v_q1 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q1, v_quiz_id, 'multiple_choice',
    'What is the French word for ''Apple''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/640px-Red_Apple.jpg',
    '[{"id":"A","text":"La pomme"},{"id":"B","text":"La poire"},{"id":"C","text":"La banane"},{"id":"D","text":"L''orange"}]'::jsonb,
    30, 1
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q1, 'A');

  -- Question 2 (With Option Images)
  v_q2 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q2, v_quiz_id, 'multiple_choice',
    'Which of these option pictures represents ''Le Chat'' (The Cat)?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Red_Kitten_01.jpg/640px-Red_Kitten_01.jpg',
    '[
      {"id":"A","text":"Le chat","image_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/640px-Cat03.jpg"},
      {"id":"B","text":"Le chien","image_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/640px-YellowLabradorLooking_new.jpg"},
      {"id":"C","text":"Le lapin","image_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oryctolagus_cuniculus_Tasmania_2.jpg/640px-Oryctolagus_cuniculus_Tasmania_2.jpg"},
      {"id":"D","text":"L''oiseau","image_url":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Eopsaltria_australis_-_Austinmer.jpg/640px-Eopsaltria_australis_-_Austinmer.jpg"}
    ]'::jsonb,
    30, 2
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q2, 'A');

  -- Question 3
  v_q3 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q3, v_quiz_id, 'multiple_choice',
    'What does ''Bonjour'' mean in English?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Eiffel_Tower_from_the_Tour_Montparnasse3.jpg/640px-Eiffel_Tower_from_the_Tour_Montparnasse3.jpg',
    '[{"id":"A","text":"Hello / Good morning"},{"id":"B","text":"Good night"},{"id":"C","text":"Thank you"},{"id":"D","text":"Goodbye"}]'::jsonb,
    20, 3
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q3, 'A');

  -- Question 4
  v_q4 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q4, v_quiz_id, 'multiple_choice',
    'What is the French word for ''Bread''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Baguette_de_pain.jpg/640px-Baguette_de_pain.jpg',
    '[{"id":"A","text":"Le pain"},{"id":"B","text":"Le fromage"},{"id":"C","text":"Le beurre"},{"id":"D","text":"Le gâteau"}]'::jsonb,
    30, 4
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q4, 'A');

  -- Question 5
  v_q5 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q5, v_quiz_id, 'multiple_choice',
    'How do you say ''Car'' in French?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/2019_Toyota_Corolla_Icon_Tech_VVT-i_Hybrid_1.8.jpg/640px-2019_Toyota_Corolla_Icon_Tech_VVT-i_Hybrid_1.8.jpg',
    '[{"id":"A","text":"La voiture"},{"id":"B","text":"Le vélo"},{"id":"C","text":"Le train"},{"id":"D","text":"L''avion"}]'::jsonb,
    30, 5
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q5, 'A');

  -- Question 6
  v_q6 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q6, v_quiz_id, 'multiple_choice',
    'What color is ''Rouge'' in English?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Red_square.svg/640px-Red_square.svg.png',
    '[{"id":"A","text":"Red"},{"id":"B","text":"Blue"},{"id":"C","text":"Green"},{"id":"D","text":"Yellow"}]'::jsonb,
    20, 6
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q6, 'A');

  -- Question 7
  v_q7 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q7, v_quiz_id, 'multiple_choice',
    'What is ''The Sun'' called in French?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/640px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg',
    '[{"id":"A","text":"Le soleil"},{"id":"B","text":"La lune"},{"id":"C","text":"L''étoile"},{"id":"D","text":"Le ciel"}]'::jsonb,
    30, 7
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q7, 'A');

  -- Question 8
  v_q8 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q8, v_quiz_id, 'multiple_choice',
    'What English word translates to ''L''eau''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Glass_of_water.jpg/640px-Glass_of_water.jpg',
    '[{"id":"A","text":"Water"},{"id":"B","text":"Milk"},{"id":"C","text":"Coffee"},{"id":"D","text":"Tea"}]'::jsonb,
    20, 8
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q8, 'A');

  -- Question 9 (Open Ended)
  v_q9 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q9, v_quiz_id, 'open_ended',
    'Which French word means ''Thank you''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Gratitude_Thank_You.jpg/640px-Gratitude_Thank_You.jpg',
    '[]'::jsonb,
    30, 9
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q9, 'Merci');

  -- Question 10
  v_q10 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q10, v_quiz_id, 'multiple_choice',
    'What is the French number for ''3''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Number_3_in_yellow_circle.svg/640px-Number_3_in_yellow_circle.svg.png',
    '[{"id":"A","text":"Trois"},{"id":"B","text":"Un"},{"id":"C","text":"Deux"},{"id":"D","text":"Quatre"}]'::jsonb,
    20, 10
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q10, 'A');

  -- Question 11
  v_q11 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q11, v_quiz_id, 'multiple_choice',
    'What is the French word for ''Book''?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg/640px-Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg',
    '[{"id":"A","text":"Le livre"},{"id":"B","text":"Le stylo"},{"id":"C","text":"Le cahier"},{"id":"D","text":"La table"}]'::jsonb,
    30, 11
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q11, 'A');

  -- Question 12
  v_q12 := gen_random_uuid();
  insert into public.questions (id, quiz_id, type, title, image_url, options, time_limit, sort_order)
  values (
    v_q12, v_quiz_id, 'multiple_choice',
    'How do you say ''Goodbye'' in French?',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Waving_hand_icon.svg/640px-Waving_hand_icon.svg.png',
    '[{"id":"A","text":"Au revoir"},{"id":"B","text":"S''il vous plaît"},{"id":"C","text":"Bienvenue"},{"id":"D","text":"Bonne nuit"}]'::jsonb,
    20, 12
  );
  insert into public.question_answers (question_id, correct_option_id) values (v_q12, 'A');

end $$;
