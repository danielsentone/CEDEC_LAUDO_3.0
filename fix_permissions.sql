-- Enable RLS on all tables
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE laudo_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Engineers" ON engineers;
DROP POLICY IF EXISTS "Public Access Protocols" ON protocols;
DROP POLICY IF EXISTS "Public Access History" ON laudo_history;

-- Create policies for 'engineers' (Allow all operations for public)
CREATE POLICY "Public Access Engineers" ON engineers
FOR ALL
USING (true)
WITH CHECK (true);

-- Create policies for 'protocols' (Allow all operations for public)
CREATE POLICY "Public Access Protocols" ON protocols
FOR ALL
USING (true)
WITH CHECK (true);

-- Create policies for 'laudo_history' (Allow all operations for public)
CREATE POLICY "Public Access History" ON laudo_history
FOR ALL
USING (true)
WITH CHECK (true);
