-- Run this script in your Supabase SQL Editor to add the pdf_url column to the laudo_history table
-- This allows the system to track the PDF URL and delete it from storage when the history entry is deleted.

ALTER TABLE laudo_history ADD COLUMN IF NOT EXISTS pdf_url TEXT;
