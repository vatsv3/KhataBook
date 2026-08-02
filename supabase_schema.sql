-- Supabase Database Schema for Gujarati Cashbook (Department-Wise)
-- COPY and RUN this script in the Supabase SQL Editor

-- --------------------------------------------------
-- 1. Create Tables
-- --------------------------------------------------

-- Books (ચોપડા / કેશબુક સંગ્રહ)
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Book Collaborators (ભાગીદારો)
CREATE TABLE public.book_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (book_id, user_email)
);

-- Departments (વિભાગો)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (book_id, name)
);

-- Cashbook Transactions (રોકડમેળ / કેશબુક)
CREATE TABLE public.cashbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')), -- 'in' = રોકડ આવી (Cash In), 'out' = રોકડ ગઈ (Cash Out)
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    transaction_date TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- --------------------------------------------------
-- 2. Helper Functions for Security
-- --------------------------------------------------

-- Check if user can access a book (owner or collaborator)
DROP FUNCTION IF EXISTS public.is_book_accessible(uuid,uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_book_accessible(book_id uuid, user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Get user email from auth.users table
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

-- --------------------------------------------------
-- 3. Enable Row Level Security (RLS)
-- --------------------------------------------------
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------
-- 4. Create RLS Policies
-- --------------------------------------------------

-- Drop existing policies if they exist to avoid duplication errors
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

-- Policies for Books
CREATE POLICY "Users can read books they own or collaborate on"
    ON public.books FOR SELECT
    USING (public.is_book_accessible(id, auth.uid()));

CREATE POLICY "Users can insert books they own"
    ON public.books FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their books"
    ON public.books FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Owners can delete their books"
    ON public.books FOR DELETE
    USING (created_by = auth.uid());

-- Policies for Book Collaborators
CREATE POLICY "Users can view collaborators for accessible books"
    ON public.book_collaborators FOR SELECT
    USING (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Owners can add collaborators"
    ON public.book_collaborators FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.books 
        WHERE id = book_id AND created_by = auth.uid()
    ));

CREATE POLICY "Owners can remove collaborators"
    ON public.book_collaborators FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.books 
        WHERE id = book_id AND created_by = auth.uid()
    ));

-- Policies for Departments
CREATE POLICY "Users can view departments of accessible books"
    ON public.departments FOR SELECT
    USING (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can insert departments into accessible books"
    ON public.departments FOR INSERT
    WITH CHECK (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can update departments of accessible books"
    ON public.departments FOR UPDATE
    USING (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can delete departments of accessible books"
    ON public.departments FOR DELETE
    USING (public.is_book_accessible(book_id, auth.uid()));

-- Policies for Cashbook
CREATE POLICY "Users can view cashbook of accessible books"
    ON public.cashbook FOR SELECT
    USING (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can insert cashbook entries in accessible books"
    ON public.cashbook FOR INSERT
    WITH CHECK (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can update cashbook entries of accessible books"
    ON public.cashbook FOR UPDATE
    USING (public.is_book_accessible(book_id, auth.uid()));

CREATE POLICY "Users can delete cashbook entries of accessible books"
    ON public.cashbook FOR DELETE
    USING (public.is_book_accessible(book_id, auth.uid()));


-- --------------------------------------------------
-- 5. Enable Realtime Replication for Instant Sync
-- --------------------------------------------------
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.book_collaborators;
alter publication supabase_realtime add table public.departments;
alter publication supabase_realtime add table public.cashbook;
