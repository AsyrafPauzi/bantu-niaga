-- Grant master permissions to bypass role limitations locally
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role, postgres, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role, postgres, anon, authenticated;

-- Force RLS to allow service role bypass cleanly
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Flush cache instantly
NOTIFY pgrst, 'reload schema';