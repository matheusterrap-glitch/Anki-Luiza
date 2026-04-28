-- Migration to create the tables in Supabase
-- WARNING: This will drop existing tables and all data!
-- Run this in the Supabase SQL Editor

-- Function to create a subject table
CREATE OR REPLACE FUNCTION create_subject_table(table_name TEXT) 
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        materia TEXT,
        question TEXT NOT NULL,
        correct TEXT NOT NULL,
        fundamento TEXT,
        review_date TEXT,
        days_interval INTEGER DEFAULT 0,
        hits INTEGER DEFAULT 0,
        misses INTEGER DEFAULT 0,
        ultima_resposta TEXT,
        ultimo_resultado TEXT,
        ultima_classificacao TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Ensure columns exist if table was already there
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS materia TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS fundamento TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS review_date TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS days_interval INTEGER DEFAULT 0;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS hits INTEGER DEFAULT 0;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS misses INTEGER DEFAULT 0;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS ultima_resposta TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS ultimo_resultado TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS ultima_classificacao TEXT;
      ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Allow all access" ON %I;
      CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true);
    ', table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Create the table
SELECT create_subject_table('tjsc');

-- Create stats table
CREATE TABLE IF NOT EXISTS session_stats (
  id BIGSERIAL PRIMARY KEY,
  materia TEXT,
  new_hits INTEGER DEFAULT 0,
  new_misses INTEGER DEFAULT 0,
  review_hits INTEGER DEFAULT 0,
  review_misses INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON session_stats;
CREATE POLICY "Allow all access" ON session_stats FOR ALL USING (true) WITH CHECK (true);

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
