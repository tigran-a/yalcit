-- Enable Realtime publication for sessions and responses
begin;
  -- Remove tables if they are already present (to avoid errors)
  -- and add them to the supabase_realtime publication
  alter publication supabase_realtime add table public.sessions;
  alter publication supabase_realtime add table public.responses;
commit;
