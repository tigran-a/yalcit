-- =========================================================================
-- MIGRATION: 20261020000000_add_quiz_tags_and_folders.sql
-- Description: Adds tags (text[]), category (text), and folder (text) to
--              public.quizzes with GIN and B-tree indexes for fast search
--              across thousands of public and personal quizzes.
-- =========================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quizzes' and column_name = 'tags'
  ) then
    alter table public.quizzes add column tags text[] default '{}'::text[] not null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quizzes' and column_name = 'category'
  ) then
    alter table public.quizzes add column category text default 'General' not null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quizzes' and column_name = 'folder'
  ) then
    alter table public.quizzes add column folder text default '' not null;
  end if;
end $$;

-- Indexes for fast searching and filtering across large quiz libraries
create index if not exists idx_quizzes_tags_gin on public.quizzes using gin (tags);
create index if not exists idx_quizzes_category on public.quizzes (category);
create index if not exists idx_quizzes_folder on public.quizzes (presenter_id, folder);
create index if not exists idx_quizzes_is_public_created on public.quizzes (is_public, created_at desc);

-- Tag the French Demo Quiz with rich tags & category
update public.quizzes
set
  category = 'Languages',
  tags = array['french', 'beginner', 'vocabulary', 'languages', 'demo']
where id = '00000000-0000-0000-0000-000000000002'::uuid or is_demo = true;
