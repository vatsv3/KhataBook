-- ==================================================
-- KHATABOOK UPDATED & PRODUCTION-READY SQL MIGRATION SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ==================================================

-- 1. Drop old customer ledger tables if they exist
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- 2. Ensure all core tables exist
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.book_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (book_id, user_email)
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (book_id, name)
);

CREATE TABLE IF NOT EXISTS public.cashbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    transaction_date TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Drop function with CASCADE (automatically drops any policies dependent on it)
DROP FUNCTION IF EXISTS public.is_book_accessible(uuid,uuid) CASCADE;

-- 4. Recreate Security Definer Helper Function (With Hardened Search Path)
CREATE OR REPLACE FUNCTION public.is_book_accessible(book_id uuid, user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Get user email safely from auth.users table
  SELECT email INTO v_user_email FROM auth.users WHERE id = user_id;
  
  IF v_user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = is_book_accessible.book_id AND b.created_by = is_book_accessible.user_id
  ) OR EXISTS (
    SELECT 1 FROM public.book_collaborators c
    WHERE c.book_id = is_book_accessible.book_id AND LOWER(c.user_email) = LOWER(v_user_email)
  );
END;
$$;

-- 5. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies to avoid duplication errors
DROP POLICY IF EXISTS "Users can read books they own or collaborate on" ON public.books;
DROP POLICY IF EXISTS "Users can insert books they own" ON public.books;
DROP POLICY IF EXISTS "Owners can update their books" ON public.books;
DROP POLICY IF EXISTS "Owners can delete their books" ON public.books;

DROP POLICY IF EXISTS "Users can view collaborators for accessible books" ON public.book_collaborators;
DROP POLICY IF EXISTS "Owners can add collaborators" ON public.book_collaborators;
DROP POLICY IF EXISTS "Owners can remove collaborators" ON public.book_collaborators;

DROP POLICY IF EXISTS "Users can view departments of accessible books" ON public.departments;
DROP POLICY IF EXISTS "Users can insert departments into accessible books" ON public.departments;
DROP POLICY IF EXISTS "Users can update departments of accessible books" ON public.departments;
DROP POLICY IF EXISTS "Users can delete departments of accessible books" ON public.departments;

DROP POLICY IF EXISTS "Users can view cashbook of accessible books" ON public.cashbook;
DROP POLICY IF EXISTS "Users can insert cashbook entries in accessible books" ON public.cashbook;
DROP POLICY IF EXISTS "Users can update cashbook entries of accessible books" ON public.cashbook;
DROP POLICY IF EXISTS "Users can delete cashbook entries of accessible books" ON public.cashbook;

-- 7. Create RLS Policies
-- Books
CREATE POLICY "Users can read books they own or collaborate on"
    ON public.books FOR SELECT USING (public.is_book_accessible(id, auth.uid()));
CREATE POLICY "Users can insert books they own"
    ON public.books FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update their books"
    ON public.books FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Owners can delete their books"
    ON public.books FOR DELETE USING (created_by = auth.uid());

-- Book Collaborators
CREATE POLICY "Users can view collaborators for accessible books"
    ON public.book_collaborators FOR SELECT USING (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Owners can add collaborators"
    ON public.book_collaborators FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.books WHERE id = book_id AND created_by = auth.uid()
    ));
CREATE POLICY "Owners can remove collaborators"
    ON public.book_collaborators FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.books WHERE id = book_id AND created_by = auth.uid()
    ));

-- Departments
CREATE POLICY "Users can view departments of accessible books"
    ON public.departments FOR SELECT USING (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can insert departments into accessible books"
    ON public.departments FOR INSERT WITH CHECK (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can update departments of accessible books"
    ON public.departments FOR UPDATE USING (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can delete departments of accessible books"
    ON public.departments FOR DELETE USING (public.is_book_accessible(book_id, auth.uid()));

-- Cashbook
CREATE POLICY "Users can view cashbook of accessible books"
    ON public.cashbook FOR SELECT USING (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can insert cashbook entries in accessible books"
    ON public.cashbook FOR INSERT WITH CHECK (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can update cashbook entries of accessible books"
    ON public.cashbook FOR UPDATE USING (public.is_book_accessible(book_id, auth.uid()));
CREATE POLICY "Users can delete cashbook entries of accessible books"
    ON public.cashbook FOR DELETE USING (public.is_book_accessible(book_id, auth.uid()));

-- 8. Add All Tables to Realtime Replication Safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'books') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'book_collaborators') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.book_collaborators;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'departments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cashbook') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cashbook;
    END IF;
END $$;
