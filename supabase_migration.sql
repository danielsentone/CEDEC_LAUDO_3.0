-- Run this script in your Supabase SQL Editor to update the database schema

-- 1. Add 'active' column to 'engineers' table
ALTER TABLE engineers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 2. Update all existing engineers to be active by default
UPDATE engineers SET active = TRUE WHERE active IS NULL;

-- 3. (Optional) If you want to ensure the column is not null in the future
-- ALTER TABLE engineers ALTER COLUMN active SET NOT NULL;
