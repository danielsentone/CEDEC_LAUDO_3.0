-- Enable RLS for engineers table
ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for everyone (or authenticated users)
CREATE POLICY "Enable read access for all users" ON "public"."engineers"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

-- Create policy to allow insert access for everyone (or authenticated users)
CREATE POLICY "Enable insert access for all users" ON "public"."engineers"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow update access for everyone (or authenticated users)
CREATE POLICY "Enable update access for all users" ON "public"."engineers"
AS PERMISSIVE FOR UPDATE
TO public
USING (true);

-- Create policy to allow delete access for everyone (or authenticated users)
CREATE POLICY "Enable delete access for all users" ON "public"."engineers"
AS PERMISSIVE FOR DELETE
TO public
USING (true);
