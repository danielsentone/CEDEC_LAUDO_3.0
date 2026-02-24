-- Run this in your Supabase SQL Editor
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS distributedToId UUID REFERENCES engineers(id);
